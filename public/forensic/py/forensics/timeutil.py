"""Timestamp normalisation.

This is the module the rest of the system rests on: every accuracy number the
evaluation reports is downstream of getting these conversions right. The hard
cases, in the order they bite:

1. Formats that omit the year (syslog) -- inferred from a case reference date,
   with December/January rollover handled explicitly.
2. Formats that omit the timezone -- supplied per-source by the case manifest.
   A source with no declared timezone is assumed UTC and *marked down* in
   `timestamp_confidence` rather than silently trusted.
3. Ambiguous day/month ordering (01/02/2026) -- never guessed; the manifest
   declares dayfirst per source.
4. Clock skew between hosts/sources -- estimated from anchor events observed
   in two sources at once (see `estimate_skew`), then subtracted.
5. Sub-second ties -- broken deterministically so two runs over the same
   evidence produce the same ordering (see `ordering_key`).
"""

from __future__ import annotations

import re
from datetime import datetime, timedelta, timezone
from statistics import median
from typing import Iterable, Optional

#: Chrome/WebKit stores time as microseconds since 1601-01-01 UTC.
WEBKIT_EPOCH = datetime(1601, 1, 1, tzinfo=timezone.utc)

_SYSLOG_RE = re.compile(
    r"^(?P<mon>[A-Z][a-z]{2})\s+(?P<day>\d{1,2})\s+"
    r"(?P<h>\d{2}):(?P<m>\d{2}):(?P<s>\d{2})$"
)
_MONTHS = {
    m: i + 1
    for i, m in enumerate(
        "Jan Feb Mar Apr May Jun Jul Aug Sep Oct Nov Dec".split()
    )
}


class TimestampError(ValueError):
    pass


def parse_offset(offset: str) -> timezone:
    """Parse '+05:30' / '-0800' / 'UTC' / 'Z' into a fixed-offset timezone.

    Deliberately fixed-offset only. Named zones would drag in DST ambiguity
    (the 01:30 that happens twice each autumn), and a forensic tool should
    make an investigator resolve that explicitly rather than pick one.
    """
    if offset in ("UTC", "Z", "+00:00", ""):
        return timezone.utc
    m = re.fullmatch(r"([+-])(\d{2}):?(\d{2})", offset)
    if not m:
        raise TimestampError(f"unsupported timezone offset: {offset!r}")
    sign = 1 if m.group(1) == "+" else -1
    delta = timedelta(hours=int(m.group(2)), minutes=int(m.group(3)))
    return timezone(sign * delta)


def _infer_year(month: int, day: int, reference: datetime) -> int:
    """Pick the year for a yearless timestamp nearest the case reference date.

    A log line dated 'Dec 31 23:58' inside a case referenced to Jan 2027
    belongs to 2026, not 2027; the naive `reference.year` would be a year out.
    """
    candidates = []
    for year in (reference.year - 1, reference.year, reference.year + 1):
        try:
            candidates.append(datetime(year, month, day, tzinfo=timezone.utc))
        except ValueError:
            continue  # e.g. Feb 29 in a non-leap year
    if not candidates:
        raise TimestampError(f"impossible date: month={month} day={day}")
    ref_utc = reference.astimezone(timezone.utc)
    return min(candidates, key=lambda d: abs((d - ref_utc).total_seconds())).year


def parse_timestamp(
    value: str,
    *,
    fmt: str = "auto",
    tz_offset: str = "UTC",
    dayfirst: bool = False,
    reference: Optional[datetime] = None,
) -> tuple[datetime, float]:
    """Return (UTC datetime, confidence in [0,1]).

    Confidence is not a probability -- it is a penalty ledger. It starts at 1.0
    and drops for every piece of information the source failed to provide and
    the normaliser had to supply itself. Findings built on low-confidence
    timestamps inherit the penalty in `correlate.py`.
    """
    value = value.strip()
    if not value:
        raise TimestampError("empty timestamp")
    reference = reference or datetime.now(timezone.utc)
    confidence = 1.0

    if fmt == "auto":
        fmt = sniff_format(value)

    if fmt == "epoch":
        dt = datetime.fromtimestamp(float(value), tz=timezone.utc)
        return dt, confidence

    if fmt == "webkit":
        dt = WEBKIT_EPOCH + timedelta(microseconds=int(float(value)))
        return dt, confidence

    if fmt == "iso":
        text = value.replace("Z", "+00:00")
        dt = datetime.fromisoformat(text)
        if dt.tzinfo is None:
            # Naive ISO: the source told us the shape but not the zone.
            dt = dt.replace(tzinfo=parse_offset(tz_offset))
            confidence -= 0.05 if tz_offset != "UTC" else 0.15
        return dt.astimezone(timezone.utc), confidence

    if fmt == "syslog":
        m = _SYSLOG_RE.match(value)
        if not m:
            raise TimestampError(f"not a syslog timestamp: {value!r}")
        month = _MONTHS[m.group("mon")]
        day = int(m.group("day"))
        year = _infer_year(month, day, reference)
        local = datetime(
            year, month, day,
            int(m.group("h")), int(m.group("m")), int(m.group("s")),
            tzinfo=parse_offset(tz_offset),
        )
        confidence -= 0.10  # year inferred
        if tz_offset == "UTC":
            confidence -= 0.10  # and zone assumed
        return local.astimezone(timezone.utc), confidence

    if fmt == "dmy":
        m = re.fullmatch(
            r"(\d{1,2})[/-](\d{1,2})[/-](\d{4})[ T](\d{2}):(\d{2}):(\d{2})",
            value,
        )
        if not m:
            raise TimestampError(f"not a d/m/Y timestamp: {value!r}")
        a, b = int(m.group(1)), int(m.group(2))
        day, month = (a, b) if dayfirst else (b, a)
        if not dayfirst and a > 12:
            raise TimestampError(
                f"{value!r} cannot be month-first; declare dayfirst for this source"
            )
        local = datetime(
            int(m.group(3)), month, day,
            int(m.group(4)), int(m.group(5)), int(m.group(6)),
            tzinfo=parse_offset(tz_offset),
        )
        if a <= 12 and b <= 12:
            # Genuinely ambiguous; we used the declared convention but say so.
            confidence -= 0.05
        return local.astimezone(timezone.utc), confidence

    raise TimestampError(f"unknown timestamp format: {fmt!r}")


def sniff_format(value: str) -> str:
    value = value.strip()
    if _SYSLOG_RE.match(value):
        return "syslog"
    if re.fullmatch(r"\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}:\d{2}.*", value):
        return "iso"
    if re.fullmatch(r"\d{1,2}[/-]\d{1,2}[/-]\d{4}[ T]\d{2}:\d{2}:\d{2}", value):
        return "dmy"
    if re.fullmatch(r"\d{16,18}", value):
        return "webkit"
    if re.fullmatch(r"\d{9,10}(\.\d+)?", value):
        return "epoch"
    raise TimestampError(f"cannot sniff timestamp format: {value!r}")


def estimate_skew(
    reference_events: Iterable,
    candidate_events: Iterable,
    *,
    match_key,
    window_s: float = 300.0,
) -> tuple[float, int]:
    """Estimate how far a source's clock runs ahead of a reference source.

    Anchors are events both sources should have recorded (same user, same host,
    same coarse action). For each anchor we take the nearest counterpart within
    `window_s` and collect the deltas; the median delta is the skew estimate.
    Median rather than mean because a handful of genuinely-unmatched anchors
    would drag a mean anywhere.

    Returns (skew_seconds, anchor_count). Callers should ignore an estimate
    backed by too few anchors -- see `MIN_ANCHORS`.
    """
    ref_by_key: dict = {}
    for ev in reference_events:
        key = match_key(ev)
        if key is None:
            continue  # not an anchorable event
        ref_by_key.setdefault(key, []).append(ev)

    deltas: list[float] = []
    for ev in candidate_events:
        key = match_key(ev)
        if key is None:
            continue
        peers = ref_by_key.get(key)
        if not peers:
            continue
        nearest = min(peers, key=lambda p: abs((ev.timestamp - p.timestamp).total_seconds()))
        delta = (ev.timestamp - nearest.timestamp).total_seconds()
        if abs(delta) <= window_s:
            deltas.append(delta)

    if not deltas:
        return 0.0, 0
    return float(median(deltas)), len(deltas)


#: Below this many anchor events, a skew estimate is noise and is not applied.
MIN_ANCHORS = 3


def ordering_key(event) -> tuple:
    """Total order over events.

    Timestamps alone are not a total order: several sources log whole seconds,
    so ties are common and `sorted` would otherwise order them by whatever the
    filesystem handed us. Ties break on stage (an access precedes the execution
    it enabled at the same displayed second), then source file and line, which
    preserves within-file order, then event_id as a final deterministic pin.
    """
    stage_rank = {
        "access": 0,
        "escalation": 1,
        "browsing": 2,
        "execution": 3,
        "collection": 4,
        "network": 5,
        "exfiltration": 6,
        "cleanup": 7,
    }
    return (
        event.timestamp,
        stage_rank.get(event.stage, 9),
        event.source_file,
        event.source_line,
        event.event_id,
    )
