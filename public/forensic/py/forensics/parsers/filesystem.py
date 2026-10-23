"""File-activity evidence (JSON Lines, one object per operation)."""

from __future__ import annotations

import json
from typing import Iterator

from ..schema import Event, EventType, SourceKind
from ..timeutil import parse_timestamp
from .base import Case, SourceSpec, make_event_id, register

_OPS = {
    "read": EventType.FILE_READ,
    "open": EventType.FILE_READ,
    "write": EventType.FILE_WRITE,
    "modify": EventType.FILE_WRITE,
    "create": EventType.FILE_CREATE,
    "delete": EventType.FILE_DELETE,
    "unlink": EventType.FILE_DELETE,
}

_ARCHIVE_SUFFIXES = (".zip", ".rar", ".7z", ".tar", ".gz", ".tgz", ".cab")


@register(SourceKind.FILE)
def parse_filesystem(spec: SourceSpec, case: Case) -> Iterator[Event]:
    with spec.path.open(encoding="utf-8", errors="replace") as fh:
        for line_no, line in enumerate(fh, start=1):
            line = line.strip()
            if not line:
                continue
            try:
                row = json.loads(line)
            except json.JSONDecodeError:
                continue  # a truncated tail is normal in seized evidence

            raw_ts = str(row.get("ts") or row.get("timestamp") or "").strip()
            if not raw_ts:
                continue
            ts, confidence = parse_timestamp(
                raw_ts,
                fmt=spec.fmt,
                tz_offset=spec.tz,
                dayfirst=spec.dayfirst,
                reference=case.reference_date,
            )
            if spec.assumed:
                confidence -= 0.1

            op = str(row.get("op") or row.get("action") or "read").lower()
            path = row.get("path")
            event_type = _OPS.get(op, EventType.FILE_READ)
            # Creating an archive is the collection step of an exfiltration
            # chain; typing it distinctly is what lets correlation see it.
            if event_type is EventType.FILE_CREATE and _is_archive(path):
                event_type = EventType.ARCHIVE_CREATE

            yield Event(
                event_id=make_event_id(spec, line_no),
                timestamp=ts,
                raw_timestamp=raw_ts,
                timestamp_confidence=max(confidence, 0.0),
                event_type=event_type,
                source_kind=SourceKind.FILE,
                source_file=spec.name,
                source_line=line_no,
                action=op,
                user=row.get("user"),
                host=row.get("host") or spec.host,
                process=row.get("process"),
                pid=row.get("pid"),
                path=path,
                size=row.get("size"),
                raw=line,
            )


def _is_archive(path) -> bool:
    return bool(path) and str(path).lower().endswith(_ARCHIVE_SUFFIXES)
