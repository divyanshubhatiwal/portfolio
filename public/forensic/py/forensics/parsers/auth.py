"""Syslog-style authentication evidence (`auth.log` / `secure`)."""

from __future__ import annotations

import re
from typing import Iterator

from ..schema import Event, EventType, SourceKind
from ..timeutil import parse_timestamp
from .base import Case, SourceSpec, make_event_id, register

_LINE = re.compile(
    r"^(?P<ts>[A-Z][a-z]{2}\s+\d{1,2}\s+\d{2}:\d{2}:\d{2})\s+"
    r"(?P<host>\S+)\s+(?P<svc>[\w\-/]+)(?:\[(?P<pid>\d+)\])?:\s+(?P<msg>.*)$"
)

_ACCEPTED = re.compile(
    r"Accepted \w+ for (?:invalid user )?(?P<user>\S+) from (?P<ip>\S+)(?: port (?P<port>\d+))?"
)
_FAILED = re.compile(
    r"Failed \w+ for (?:invalid user )?(?P<user>\S+) from (?P<ip>\S+)(?: port (?P<port>\d+))?"
)
_DISCONNECT = re.compile(r"(?:Disconnected from|session closed for) user (?P<user>\S+)")
_SUDO = re.compile(
    r"^(?P<user>\S+)\s*:.*USER=(?P<target>\S+)\s*;\s*COMMAND=(?P<cmd>.+)$"
)


@register(SourceKind.AUTH)
def parse_auth(spec: SourceSpec, case: Case) -> Iterator[Event]:
    with spec.path.open(encoding="utf-8", errors="replace") as fh:
        for line_no, line in enumerate(fh, start=1):
            line = line.rstrip("\n")
            m = _LINE.match(line)
            if not m:
                continue

            msg = m.group("msg")
            event_type, user, ip, extra = _classify(msg)
            if event_type is None:
                continue

            ts, confidence = parse_timestamp(
                m.group("ts"),
                fmt=spec.fmt if spec.fmt != "auto" else "syslog",
                tz_offset=spec.tz,
                dayfirst=spec.dayfirst,
                reference=case.reference_date,
            )
            if spec.assumed:
                confidence -= 0.1

            yield Event(
                event_id=make_event_id(spec, line_no),
                timestamp=ts,
                raw_timestamp=m.group("ts"),
                timestamp_confidence=max(confidence, 0.0),
                event_type=event_type,
                source_kind=SourceKind.AUTH,
                source_file=spec.name,
                source_line=line_no,
                action=m.group("svc"),
                outcome="failure" if event_type is EventType.LOGIN_FAILURE else "success",
                user=user,
                host=m.group("host") or spec.host,
                src_ip=ip,
                pid=int(m.group("pid")) if m.group("pid") else None,
                process=extra.get("process"),
                cmdline=extra.get("cmdline"),
                raw=line,
            )


def _classify(msg: str):
    """Map a syslog message body to (EventType, user, ip, extras)."""
    if (m := _ACCEPTED.search(msg)):
        return EventType.LOGIN_SUCCESS, m.group("user"), m.group("ip"), {}
    if (m := _FAILED.search(msg)):
        return EventType.LOGIN_FAILURE, m.group("user"), m.group("ip"), {}
    if (m := _DISCONNECT.search(msg)):
        return EventType.LOGOUT, m.group("user"), None, {}
    if (m := _SUDO.match(msg)):
        cmd = m.group("cmd").strip()
        return (
            EventType.PRIV_ESCALATION,
            m.group("user"),
            None,
            {"process": cmd.split()[0].rsplit("/", 1)[-1], "cmdline": cmd},
        )
    return None, None, None, {}
