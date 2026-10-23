"""Process execution evidence (Sysmon-style CSV export)."""

from __future__ import annotations

import csv
from typing import Iterator

from ..schema import Event, EventType, SourceKind
from ..timeutil import parse_timestamp
from .base import Case, SourceSpec, make_event_id, register

_EVENT_TYPES = {
    "start": EventType.PROCESS_START,
    "create": EventType.PROCESS_START,
    "end": EventType.PROCESS_END,
    "terminate": EventType.PROCESS_END,
}


@register(SourceKind.PROCESS)
def parse_process(spec: SourceSpec, case: Case) -> Iterator[Event]:
    with spec.path.open(encoding="utf-8", errors="replace", newline="") as fh:
        reader = csv.DictReader(fh)
        for line_no, row in enumerate(reader, start=2):  # +1 for the header row
            raw_ts = (row.get("timestamp") or "").strip()
            if not raw_ts:
                continue

            ts, confidence = parse_timestamp(
                raw_ts,
                fmt=spec.fmt if spec.fmt != "auto" else "dmy",
                tz_offset=spec.tz,
                dayfirst=spec.dayfirst,
                reference=case.reference_date,
            )
            if spec.assumed:
                confidence -= 0.1

            image = (row.get("image") or "").strip()
            yield Event(
                event_id=make_event_id(spec, line_no),
                timestamp=ts,
                raw_timestamp=raw_ts,
                timestamp_confidence=max(confidence, 0.0),
                event_type=_EVENT_TYPES.get(
                    (row.get("action") or "start").strip().lower(),
                    EventType.PROCESS_START,
                ),
                source_kind=SourceKind.PROCESS,
                source_file=spec.name,
                source_line=line_no,
                action=(row.get("action") or "start").strip().lower(),
                user=_clean(row.get("user")),
                host=_clean(row.get("host")) or spec.host,
                process=image.rsplit("\\", 1)[-1].rsplit("/", 1)[-1] or None,
                path=image or None,
                pid=_int(row.get("pid")),
                ppid=_int(row.get("ppid")),
                cmdline=_clean(row.get("cmdline")),
                raw=",".join(f"{k}={v}" for k, v in row.items() if v),
            )


def _clean(value):
    value = (value or "").strip()
    return value or None


def _int(value):
    value = (value or "").strip()
    try:
        return int(value)
    except (TypeError, ValueError):
        return None
