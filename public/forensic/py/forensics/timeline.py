"""Timeline construction and rendering.

The ordering here comes from evidence timestamps and nothing else. No model is
consulted about what happened first -- that is the single most important design
rule in the project, because a plausible-sounding but wrong ordering is exactly
the kind of error that survives review.
"""

from __future__ import annotations

from datetime import datetime, timedelta
from typing import Iterable, Optional

from .schema import Anomaly, Event
from .timeutil import ordering_key


def build(events: Iterable[Event]) -> list[Event]:
    return sorted(events, key=ordering_key)


def window(
    events: Iterable[Event], start: datetime, end: datetime
) -> list[Event]:
    return [ev for ev in build(events) if start <= ev.timestamp <= end]


def around(
    events: Iterable[Event], anchor: datetime, span: timedelta = timedelta(minutes=10)
) -> list[Event]:
    return window(events, anchor - span, anchor + span)


def render(
    events: Iterable[Event],
    anomalies: Optional[Iterable[Anomaly]] = None,
    *,
    show_gaps: bool = True,
    max_rows: int = 200,
) -> str:
    """Plain-text timeline.

    Gaps are marked explicitly. A silent jump from 02:14 to 06:40 reads as
    continuous activity when it is not, and 'nothing was recorded here' is
    itself a forensic observation -- it may mean quiet, or it may mean a log
    was cleared.
    """
    events = build(events)[:max_rows]
    flagged = {a.event_id: a for a in (anomalies or [])}
    lines: list[str] = []
    previous: Optional[Event] = None

    for ev in events:
        if show_gaps and previous is not None:
            gap = ev.timestamp - previous.timestamp
            if gap > timedelta(minutes=30):
                lines.append(f"         ... no recorded activity for {gap.total_seconds() / 60:.0f} minutes ...")

        marker = " "
        anomaly = flagged.get(ev.event_id)
        if anomaly:
            marker = {"high": "!", "medium": "*", "low": "."}[anomaly.severity]

        low_confidence = " ~" if ev.timestamp_confidence < 0.85 else "  "
        lines.append(
            f"{marker}{low_confidence}{ev.timestamp:%Y-%m-%d %H:%M:%S}  "
            f"{ev.event_type.value:<16} {detail(ev):<52} {ev.event_id}"
        )
        previous = ev

    if flagged:
        lines.append("")
        lines.append("  ! high  * medium  . low anomaly score    ~ = derived/uncertain timestamp")
    return "\n".join(lines)


def detail(ev: Event) -> str:
    """The distinguishing part of an event: actors and targets, no time or type.

    Callers that already show the timestamp and event type in their own columns
    use this instead of `Event.summary()`, which repeats both.
    """
    bits = []
    if ev.user:
        bits.append(ev.user)
    if ev.process:
        bits.append(ev.process)
    if ev.path:
        bits.append(_shorten(ev.path, 30))
    if ev.dst_ip:
        target = ev.dst_ip
        if ev.dst_port:
            target += f":{ev.dst_port}"
        bits.append(f"-> {target}")
    if ev.domain and not ev.dst_ip:
        bits.append(f"-> {ev.domain}")
    if ev.bytes_out and ev.bytes_out > 1_000_000:
        bits.append(f"{ev.bytes_out / 1e6:.1f}MB out")
    elif ev.size and ev.size > 1_000_000:
        bits.append(f"{ev.size / 1e6:.1f}MB on disk")
    return " ".join(bits)


def _shorten(text: str, width: int) -> str:
    if len(text) <= width:
        return text
    return "..." + text[-(width - 3):]
