"""Entity extraction.

Entities are the nodes of the evidence graph. Extraction is deliberately
deterministic -- fields the parsers already populated, plus light canonicalisation
-- rather than an LLM pass. An entity that appears because a model hallucinated
it would poison every downstream correlation, and no citation could catch it.
"""

from __future__ import annotations

from typing import Iterable

from .schema import Entity, EntityType, Event


def entity_id(entity_type: EntityType, value: str) -> str:
    return f"{entity_type.value}:{canonicalise(entity_type, value)}"


def canonicalise(entity_type: EntityType, value: str) -> str:
    """Normalise an entity's spelling so two mentions collapse into one node.

    Case folding for users/hosts/paths is right on Windows evidence and merely
    harmless on Linux evidence at this granularity; domains fold too. IPs are
    left alone.
    """
    value = value.strip()
    if entity_type is EntityType.IP:
        return value
    if entity_type is EntityType.FILE:
        return value.replace("/", "\\").lower()
    if entity_type is EntityType.USER:
        # DOMAIN\user and user@domain both reduce to the account name.
        if "\\" in value:
            value = value.rsplit("\\", 1)[-1]
        if "@" in value:
            value = value.split("@", 1)[0]
    return value.lower()


#: (attribute on Event, entity type) pairs to harvest.
_FIELD_MAP = [
    ("user", EntityType.USER),
    ("host", EntityType.HOST),
    ("process", EntityType.PROCESS),
    ("path", EntityType.FILE),
    ("src_ip", EntityType.IP),
    ("dst_ip", EntityType.IP),
    ("domain", EntityType.DOMAIN),
]


def extract(events: Iterable[Event]) -> dict[str, Entity]:
    """Build the entity table for a case, keyed by entity id."""
    table: dict[str, Entity] = {}
    for ev in events:
        for field_name, etype in _FIELD_MAP:
            value = getattr(ev, field_name, None)
            if not value:
                continue
            if field_name == "path" and ev.source_kind.value == "process":
                # A process image path is the process, not a separate file of
                # forensic interest; the PROCESS entity already covers it.
                continue
            eid = entity_id(etype, str(value))
            entity = table.get(eid)
            if entity is None:
                table[eid] = Entity(
                    entity_id=eid,
                    entity_type=etype,
                    value=canonicalise(etype, str(value)),
                    first_seen=ev.timestamp,
                    last_seen=ev.timestamp,
                    event_ids=[ev.event_id],
                )
            else:
                entity.last_seen = max(entity.last_seen, ev.timestamp)
                entity.first_seen = min(entity.first_seen, ev.timestamp)
                entity.event_ids.append(ev.event_id)
    return table


def entities_of(event: Event) -> list[str]:
    """Entity ids this single event touches."""
    out = []
    for field_name, etype in _FIELD_MAP:
        value = getattr(event, field_name, None)
        if value:
            if field_name == "path" and event.source_kind.value == "process":
                continue
            out.append(entity_id(etype, str(value)))
    return out
