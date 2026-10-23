"""Browser history evidence (Chrome-style CSV export, WebKit timestamps)."""

from __future__ import annotations

import csv
from typing import Iterator
from urllib.parse import urlparse

from ..schema import Event, EventType, SourceKind
from ..timeutil import parse_timestamp
from .base import Case, SourceSpec, make_event_id, register


@register(SourceKind.BROWSER)
def parse_browser(spec: SourceSpec, case: Case) -> Iterator[Event]:
    with spec.path.open(encoding="utf-8", errors="replace", newline="") as fh:
        reader = csv.DictReader(fh)
        for line_no, row in enumerate(reader, start=2):
            raw_ts = (row.get("last_visit_time") or row.get("timestamp") or "").strip()
            if not raw_ts:
                continue

            ts, confidence = parse_timestamp(
                raw_ts,
                fmt=spec.fmt,  # 'auto' sniffs WebKit vs ISO correctly
                tz_offset=spec.tz,
                dayfirst=spec.dayfirst,
                reference=case.reference_date,
            )
            if spec.assumed:
                confidence -= 0.1

            url = (row.get("url") or "").strip()
            visit_type = (row.get("visit_type") or "visit").strip().lower()
            yield Event(
                event_id=make_event_id(spec, line_no),
                timestamp=ts,
                raw_timestamp=raw_ts,
                timestamp_confidence=max(confidence, 0.0),
                event_type=(
                    EventType.BROWSER_DOWNLOAD
                    if visit_type == "download"
                    else EventType.BROWSER_VISIT
                ),
                source_kind=SourceKind.BROWSER,
                source_file=spec.name,
                source_line=line_no,
                action=visit_type,
                user=(row.get("user") or "").strip() or None,
                host=(row.get("host") or "").strip() or spec.host,
                process=(row.get("browser") or "chrome.exe").strip() or None,
                url=url or None,
                domain=urlparse(url).hostname if url else None,
                path=(row.get("download_path") or "").strip() or None,
                raw=",".join(f"{k}={v}" for k, v in row.items() if v),
            )
