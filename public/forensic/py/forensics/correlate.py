"""Event correlation: turning ranked events into incident chains.

An anomaly list is a pile of individually-odd events. An investigator needs to
know which of them are the *same story*. This module links events that share
entities and follow each other closely in time, then keeps the chains whose
shape resembles an incident (access -> execution -> collection -> exfiltration)
rather than a coincidence.

The linking is deterministic and evidence-driven. No model decides that two
events are related; a shared user, host, process, file or address does, and the
edge that says so is citable.
"""

from __future__ import annotations

from collections import defaultdict
from datetime import timedelta
from typing import Iterable, Optional

from .entities import entities_of
from .schema import ARC_STAGES, Anomaly, Event, Incident

#: Two events sharing a *specific* entity -- the same file, the same external
#: address, the same uncommon process -- can belong to one chain this far
#: apart. Specific entities carry their own evidence of relatedness, so the
#: window can be generous.
LINK_WINDOW = timedelta(minutes=20)

#: Sharing only an account is much weaker: a user touches everything they do
#: all day. Account-only links are therefore restricted to events in immediate
#: succession, which is what makes "login, then sudo, then python3" one chain
#: while leaving that user's unrelated 3pm activity out of it.
WEAK_LINK_WINDOW = timedelta(minutes=3)
_WEAK_ENTITY_PREFIXES_FOR_WINDOW = ("user:",)

#: The progression a chain is scored against. A chain need not hit every stage.
#: Context stages (browsing, network) are deliberately absent: they are shown to
#: the investigator but earn no score, because an afternoon of web traffic
#: otherwise reads as a multi-stage incident.
STAGE_ORDER = list(ARC_STAGES)

#: Entities too common to imply a relationship. A chain linked only by "these
#: events involve the same host" is not a chain -- on a single-host case every
#: event shares the host.
_WEAK_ENTITY_PREFIXES = ("host:",)

#: An entity appearing in more than this share of the case links everything to
#: everything. A shared `bash` or a gateway address is not evidence that two
#: events belong to the same story; without this cutoff, transitive linking
#: fuses a whole working day into one 100-event "incident".
MAX_ENTITY_SHARE = 0.05
MIN_ENTITY_CUTOFF = 25


def correlate(
    events: Iterable[Event],
    anomalies: Iterable[Anomaly],
    *,
    min_events: int = 3,
    min_stages: int = 2,
) -> list[Incident]:
    events = sorted(events, key=lambda e: e.timestamp)
    by_id = {ev.event_id: ev for ev in events}
    anomaly_by_id = {a.event_id: a for a in anomalies}

    links = _build_links(events)
    seeds = [
        eid for eid, a in sorted(anomaly_by_id.items(), key=lambda kv: -kv[1].score)
        if a.severity in ("high", "medium")
    ]

    incidents: list[Incident] = []
    claimed: set[str] = set()

    for seed in seeds:
        if seed in claimed:
            continue
        member_ids = _grow(seed, links, by_id)
        if len(member_ids) < min_events:
            continue
        members = sorted((by_id[i] for i in member_ids), key=lambda e: e.timestamp)
        # Counted over arc stages only. A chain of "browsing -> network" is two
        # distinct stages and zero evidence of an incident.
        if len({ev.stage for ev in members} & set(ARC_STAGES)) < min_stages:
            continue

        incident = _build_incident(
            f"INC-{len(incidents) + 1:02d}", members, anomaly_by_id
        )
        incidents.append(incident)
        claimed |= member_ids

    incidents.sort(key=lambda i: -i.score)
    for rank, incident in enumerate(incidents, start=1):
        incident.incident_id = f"INC-{rank:02d}"
    return incidents


def _build_links(events: list[Event]) -> dict[str, set[str]]:
    """Adjacency over events that share a meaningful entity within the window."""
    by_entity: dict[str, list[Event]] = defaultdict(list)
    for ev in events:
        for eid in entities_of(ev):
            if eid.startswith(_WEAK_ENTITY_PREFIXES):
                continue
            by_entity[eid].append(ev)

    cutoff = max(MIN_ENTITY_CUTOFF, int(MAX_ENTITY_SHARE * len(events)))
    links: dict[str, set[str]] = defaultdict(set)
    for entity, members in by_entity.items():
        weak = entity.startswith(_WEAK_ENTITY_PREFIXES_FOR_WINDOW)
        if not weak and len(members) > cutoff:
            continue  # carries no discriminating information -- see MAX_ENTITY_SHARE
        window = WEAK_LINK_WINDOW if weak else LINK_WINDOW
        for i, a in enumerate(members):
            for b in members[i + 1:]:
                if b.timestamp - a.timestamp > window:
                    break  # members is time-sorted, so the rest are further out
                links[a.event_id].add(b.event_id)
                links[b.event_id].add(a.event_id)
    return links


def _grow(seed: str, links: dict[str, set[str]], by_id: dict[str, Event]) -> set[str]:
    """Breadth-first expansion from a seed through the link graph.

    Bounded by total chain span rather than hop count: an operator working
    steadily for an hour is one incident, but transitive links must not walk
    the chain across the whole case.
    """
    member_ids = {seed}
    frontier = [seed]
    anchor = by_id[seed].timestamp
    # A chain is one actor's activity. Transitive links across accounts turn
    # unrelated people working at the same time into a single "incident", so
    # expansion stays within the seed's user where the seed names one.
    seed_user = (by_id[seed].user or "").lower()
    max_span = timedelta(hours=2)

    while frontier:
        current = frontier.pop()
        for neighbour in links.get(current, ()):
            if neighbour in member_ids:
                continue
            candidate = by_id[neighbour]
            if seed_user and candidate.user and candidate.user.lower() != seed_user:
                continue
            ts = candidate.timestamp
            if abs(ts - anchor) > max_span:
                continue
            member_ids.add(neighbour)
            frontier.append(neighbour)
    return member_ids


def _ordered_stages(members: list[Event]) -> list[str]:
    stages = []
    for ev in members:
        if not stages or stages[-1] != ev.stage:
            stages.append(ev.stage)
    return stages


def _build_incident(
    incident_id: str, members: list[Event], anomaly_by_id: dict[str, Anomaly]
) -> Incident:
    stages = _ordered_stages(members)
    distinct = [s for s in STAGE_ORDER if s in set(stages)]

    entities: dict[str, list[str]] = defaultdict(list)
    for ev in members:
        for eid in entities_of(ev):
            kind, _, value = eid.partition(":")
            if value not in entities[kind]:
                entities[kind].append(value)

    anomaly_mass = sum(
        anomaly_by_id[ev.event_id].score for ev in members if ev.event_id in anomaly_by_id
    )
    span_s = (members[-1].timestamp - members[0].timestamp).total_seconds()

    rationale = []
    # Stage coverage: how much of the access->exfiltration arc is present.
    coverage = len(distinct) / len(STAGE_ORDER)
    rationale.append(
        f"spans {len(distinct)} investigative stages ({' -> '.join(distinct)})"
    )
    context = [s for s in _ordered_stages(members) if s not in STAGE_ORDER]
    if context:
        # Named but not scored, so the investigator can see what else the chain
        # swept up without it inflating the chain's standing.
        rationale.append(
            f"also includes {', '.join(dict.fromkeys(context))} activity, "
            f"which is recorded as context and does not contribute to the score"
        )
    # Anomaly mass: how much independently-flagged oddness the chain contains.
    flagged = sum(1 for ev in members if ev.event_id in anomaly_by_id)
    rationale.append(f"{flagged} of {len(members)} events independently flagged as anomalous")
    # Tightness: events minutes apart correlate more convincingly than hours.
    tightness = 1.0 / (1.0 + span_s / 1800.0)
    rationale.append(f"activity compressed into {span_s / 60:.1f} minutes")

    monotonic = _is_monotonic(distinct)
    if monotonic:
        rationale.append("stages occur in escalating order, consistent with a single sequence")

    score = min(
        1.0,
        0.40 * coverage * (len(STAGE_ORDER) / 4)
        + 0.30 * min(anomaly_mass / 4.0, 1.0)
        + 0.20 * tightness
        + (0.10 if monotonic else 0.0),
    )

    # Confidence is the score discounted by how much we trust the timestamps
    # the correlation rests on. A chain built from evidence whose clocks we had
    # to infer is a weaker claim, and must say so numerically.
    ts_confidence = sum(ev.timestamp_confidence for ev in members) / len(members)
    confidence = round(score * ts_confidence, 3)
    if ts_confidence < 0.9:
        rationale.append(
            f"confidence reduced: mean timestamp confidence {ts_confidence:.2f} "
            f"(inferred timezone, year, or corrected clock skew)"
        )

    return Incident(
        incident_id=incident_id,
        start=members[0].timestamp,
        end=members[-1].timestamp,
        event_ids=[ev.event_id for ev in members],
        stages=distinct,
        entities=dict(entities),
        score=round(score, 3),
        confidence=confidence,
        rationale=rationale,
    )


def _is_monotonic(distinct_stages: list[str]) -> bool:
    ranks = [STAGE_ORDER.index(s) for s in distinct_stages]
    return all(a < b for a, b in zip(ranks, ranks[1:]))


def incident_for_event(incidents: list[Incident], event_id: str) -> Optional[Incident]:
    for incident in incidents:
        if event_id in incident.event_ids:
            return incident
    return None
