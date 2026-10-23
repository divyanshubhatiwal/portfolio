"""Ingestion and cross-source normalisation.

Turns a case directory into one ordered event stream. Three things happen here
that no single parser can do alone, because they need to compare sources
against each other: clock-skew correction, deduplication, and total ordering.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import timedelta

from .parsers import Case, SourceSpec, load_case, parser_for
from .schema import Event, EventType, SourceKind
from .timeutil import MIN_ANCHORS, estimate_skew, ordering_key

#: Source kinds ranked by how much we trust their clocks. The most trusted
#: source becomes the reference frame that others are aligned to.
_REFERENCE_PREFERENCE = [
    SourceKind.AUTH,
    SourceKind.NETWORK,
    SourceKind.PROCESS,
    SourceKind.FILE,
    SourceKind.BROWSER,
]


@dataclass
class IngestReport:
    """What the normaliser did, so an investigator can audit it.

    Every adjustment the tool makes to evidence timestamps is recorded here and
    reproduced in the final report. Silent correction of evidence is the thing
    a defence expert would take the whole analysis apart over.
    """

    case_id: str
    events_parsed: int = 0
    per_source: dict[str, int] = field(default_factory=dict)
    skew_applied: dict[str, float] = field(default_factory=dict)
    skew_anchors: dict[str, int] = field(default_factory=dict)
    duplicates_dropped: int = 0
    warnings: list[str] = field(default_factory=list)

    def lines(self) -> list[str]:
        out = [f"case {self.case_id}: {self.events_parsed} events"]
        for name, count in sorted(self.per_source.items()):
            out.append(f"  {name}: {count} events")
        for name, skew in sorted(self.skew_applied.items()):
            anchors = self.skew_anchors.get(name, 0)
            out.append(f"  clock skew {name}: {skew:+.1f}s (from {anchors} anchors)")
        if self.duplicates_dropped:
            out.append(f"  duplicates dropped: {self.duplicates_dropped}")
        out.extend(f"  warning: {w}" for w in self.warnings)
        return out


def ingest(case_root, *, correct_skew: bool = True) -> tuple[list[Event], IngestReport]:
    case = load_case(case_root)
    report = IngestReport(case_id=case.case_id)

    by_source: dict[str, list[Event]] = {}
    for spec in case.sources:
        try:
            events = list(parser_for(spec.kind)(spec, case))
        except Exception as exc:  # a malformed source must not sink the case
            report.warnings.append(f"{spec.name}: parse failed ({exc})")
            continue
        if spec.assumed:
            report.warnings.append(
                f"{spec.name}: no manifest entry; timezone assumed UTC "
                f"(timestamps carry reduced confidence)"
            )
        if spec.known_skew_s:
            for ev in events:
                _shift(ev, -spec.known_skew_s)
            report.skew_applied[spec.name] = -spec.known_skew_s
            report.skew_anchors[spec.name] = -1  # -1 = declared, not estimated
        by_source[spec.name] = events
        report.per_source[spec.name] = len(events)

    if correct_skew:
        _align_clocks(case, by_source, report)

    events = [ev for evs in by_source.values() for ev in evs]
    events, dropped = _dedupe(events)
    report.duplicates_dropped = dropped
    events.sort(key=ordering_key)
    report.events_parsed = len(events)
    return events, report


def _align_clocks(case: Case, by_source: dict[str, list[Event]], report: IngestReport) -> None:
    """Estimate residual skew per source against the most-trusted source.

    Anchors are events the same action produced in two sources -- a `sudo`
    line in auth.log and the matching process start in the process log. When
    too few anchors exist we leave the clock alone rather than apply a
    correction we cannot defend.
    """
    spec_by_name = {s.name: s for s in case.sources}
    reference_name = _pick_reference(spec_by_name, by_source)
    if reference_name is None:
        return
    reference_events = by_source[reference_name]

    for name, events in by_source.items():
        if name == reference_name or not events:
            continue
        skew, anchors = estimate_skew(
            reference_events, events, match_key=_anchor_key
        )
        if anchors < MIN_ANCHORS or abs(skew) < 1.0:
            continue
        for ev in events:
            _shift(ev, -skew)
        report.skew_applied[name] = report.skew_applied.get(name, 0.0) - skew
        report.skew_anchors[name] = anchors


#: The only pair of event types that genuinely records the *same* action twice:
#: a `sudo ... COMMAND=X` line in the auth log and the matching start of X in
#: the process log. Anchoring on anything looser (say, any event mentioning the
#: same user and process) matches unrelated events and produces a confident
#: skew estimate for a source whose clock is fine.
_ANCHOR_TYPES = {EventType.PRIV_ESCALATION, EventType.PROCESS_START}


def _anchor_key(event: Event):
    """Identity an event shares with its counterpart in another source.

    Returns None for events that cannot anchor anything; `estimate_skew` skips
    those rather than bucketing them together.
    """
    if event.event_type not in _ANCHOR_TYPES:
        return None
    if not (event.user and event.process):
        return None
    return (event.user, event.host, event.process.lower())


def _pick_reference(spec_by_name: dict[str, SourceSpec], by_source: dict[str, list[Event]]):
    for kind in _REFERENCE_PREFERENCE:
        for name, spec in spec_by_name.items():
            if spec.kind is kind and by_source.get(name):
                return name
    return None


def _shift(event: Event, seconds: float) -> None:
    event.timestamp = event.timestamp + timedelta(seconds=seconds)
    event.skew_applied_s += seconds
    if seconds:
        # A corrected timestamp is a derived timestamp; say so numerically.
        event.timestamp_confidence = max(event.timestamp_confidence - 0.05, 0.0)


def _dedupe(events: list[Event]) -> tuple[list[Event], int]:
    """Drop exact re-records of the same observation.

    Same source file and line is the same bytes; same (time, type, user, path,
    dst) across *different* files is the same real-world action recorded twice,
    and we keep the first by source order so a citation still resolves.
    """
    seen: set[tuple] = set()
    kept: list[Event] = []
    dropped = 0
    for ev in sorted(events, key=ordering_key):
        key = (
            ev.timestamp,
            ev.event_type,
            ev.user,
            ev.host,
            ev.process,
            ev.path,
            ev.dst_ip,
            ev.bytes_out,
        )
        if key in seen:
            dropped += 1
            continue
        seen.add(key)
        kept.append(ev)
    return kept, dropped
