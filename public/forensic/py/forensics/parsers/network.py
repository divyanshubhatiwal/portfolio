"""Network flow evidence (tab-separated, Zeek `conn.log` shape, epoch time)."""

from __future__ import annotations

from typing import Iterator

from ..schema import Event, EventType, SourceKind
from ..timeutil import parse_timestamp
from .base import Case, SourceSpec, make_event_id, register

_COLUMNS = [
    "ts", "host", "user", "src_ip", "dst_ip", "dst_port",
    "proto", "bytes_out", "bytes_in", "domain",
]

#: A flow carrying more than this is reported as a transfer rather than a bare
#: connection. Tunable per deployment -- it is a reporting threshold, not a
#: verdict, and correlation still weighs the actual byte count.
TRANSFER_BYTES = 1_000_000


@register(SourceKind.NETWORK)
def parse_network(spec: SourceSpec, case: Case) -> Iterator[Event]:
    with spec.path.open(encoding="utf-8", errors="replace") as fh:
        for line_no, line in enumerate(fh, start=1):
            line = line.rstrip("\n")
            if not line or line.startswith("#"):
                continue
            parts = line.split("\t")
            if len(parts) < 6:
                continue
            row = dict(zip(_COLUMNS, parts))

            ts, confidence = parse_timestamp(
                row["ts"],
                fmt=spec.fmt if spec.fmt != "auto" else "epoch",
                tz_offset=spec.tz,
                dayfirst=spec.dayfirst,
                reference=case.reference_date,
            )
            if spec.assumed:
                confidence -= 0.1

            bytes_out = _int(row.get("bytes_out"))
            event_type = (
                EventType.NET_TRANSFER
                if bytes_out and bytes_out >= TRANSFER_BYTES
                else EventType.NET_CONNECT
            )

            yield Event(
                event_id=make_event_id(spec, line_no),
                timestamp=ts,
                raw_timestamp=row["ts"],
                timestamp_confidence=max(confidence, 0.0),
                event_type=event_type,
                source_kind=SourceKind.NETWORK,
                source_file=spec.name,
                source_line=line_no,
                action=(row.get("proto") or "tcp").lower(),
                user=_clean(row.get("user")),
                host=_clean(row.get("host")) or spec.host,
                src_ip=_clean(row.get("src_ip")),
                dst_ip=_clean(row.get("dst_ip")),
                dst_port=_int(row.get("dst_port")),
                domain=_clean(row.get("domain")),
                bytes_out=bytes_out,
                bytes_in=_int(row.get("bytes_in")),
                raw=line,
            )


def _clean(value):
    value = (value or "").strip()
    return value if value and value != "-" else None


def _int(value):
    try:
        return int(str(value).strip())
    except (TypeError, ValueError):
        return None
