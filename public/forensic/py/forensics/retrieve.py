"""Evidence retrieval.

Hybrid on purpose: a structured filter narrows by the things forensic questions
are actually about (time, user, host, address, file, event type), and TF-IDF
ranks what survives. Semantic-only retrieval over log text is a bad trade here
-- "between 2 and 3 AM" and "10.0.0.5" are exact constraints, and an embedding
that treats them as soft suggestions will quietly return the wrong hour.
"""

from __future__ import annotations

import re
from dataclasses import dataclass, field
from datetime import datetime, time, timedelta, timezone
from typing import Iterable, Optional

from sklearn.feature_extraction.text import TfidfVectorizer

from .schema import Event, EventType

_IPV4 = re.compile(r"\b(?:\d{1,3}\.){3}\d{1,3}\b")
_TIME_RANGE = re.compile(
    r"between\s+(\d{1,2})(?::(\d{2}))?\s*(am|pm)?\s*(?:and|-|to)\s+(\d{1,2})(?::(\d{2}))?\s*(am|pm)?",
    re.I,
)
_AFTER = re.compile(r"after\s+(\d{1,2}):(\d{2})", re.I)
_PATHLIKE = re.compile(r"[\w:\\/.\-]+\.(?:zip|rar|7z|tar|gz|docx?|xlsx?|pdf|csv|txt|exe|dll|ps1|sql)")
_NAMED_USER = re.compile(r"\buser\s+([A-Za-z0-9._@\\-]{2,})", re.I)
#: Words that follow "user" without naming one.
_USER_STOPWORDS = {"activity", "account", "accounts", "logins", "login", "sessions", "behaviour", "behavior"}

_TYPE_HINTS = {
    EventType.LOGIN_SUCCESS: ("login", "logged in", "authentication", "signed in"),
    EventType.LOGIN_FAILURE: ("failed login", "failed password", "brute", "failure"),
    EventType.PRIV_ESCALATION: ("sudo", "privilege", "escalation", "admin", "root"),
    EventType.PROCESS_START: ("process", "executed", "ran", "powershell", "launched"),
    EventType.ARCHIVE_CREATE: ("archive", "zip", "rar", "compressed", "staged"),
    EventType.FILE_READ: ("accessed", "read", "opened"),
    EventType.FILE_DELETE: ("deleted", "removed", "wiped"),
    EventType.NET_TRANSFER: ("transfer", "upload", "exfil", "outbound", "uploaded"),
    EventType.NET_CONNECT: ("connection", "connected", "network"),
    EventType.BROWSER_DOWNLOAD: ("download", "downloaded"),
}


@dataclass
class Query:
    """A parsed question. Everything here is a hard constraint on retrieval."""

    text: str
    start: Optional[datetime] = None
    end: Optional[datetime] = None
    #: A clock range with no date ("between 2 and 3 am") applies to every day in
    #: the case, not to one guessed day. Pinning it to the busiest day silently
    #: hides an incident that happened on the other one.
    tod_start: Optional[time] = None
    tod_end: Optional[time] = None
    users: list[str] = field(default_factory=list)
    ips: list[str] = field(default_factory=list)
    paths: list[str] = field(default_factory=list)
    event_types: list[EventType] = field(default_factory=list)
    #: Entities the question names explicitly that do not appear anywhere in
    #: this case. Their presence means the honest answer is "no such evidence",
    #: not a best-effort list of whatever else scored highly.
    unknown_entities: list[str] = field(default_factory=list)

    def describe(self) -> str:
        if self.unknown_entities:
            return (
                "no evidence in this case mentions "
                + ", ".join(self.unknown_entities)
            )
        bits = []
        if self.tod_start and self.tod_end:
            bits.append(f"time-of-day {self.tod_start:%H:%M}-{self.tod_end:%H:%M} UTC, any date in case")
        elif self.start and self.end:
            bits.append(f"time {self.start:%H:%M}-{self.end:%H:%M} UTC")
        for label, values in (("user", self.users), ("address", self.ips), ("file", self.paths)):
            if values:
                bits.append(f"{label} {', '.join(values)}")
        if self.event_types:
            bits.append("types " + ", ".join(t.value for t in self.event_types))
        return "; ".join(bits) or "no structured constraints"


def parse_query(text: str, events: Iterable[Event]) -> Query:
    """Extract hard constraints from a natural-language question.

    Known users are matched against the case's actual user set rather than
    guessed from grammar -- that keeps retrieval honest when someone asks about
    a user who does not appear in the evidence at all.
    """
    events = list(events)
    query = Query(text=text)
    lowered = text.lower()

    known_users = {e.user.lower() for e in events if e.user}
    known_ips = {ip for e in events for ip in (e.src_ip, e.dst_ip) if ip}
    known_paths = {e.path.lower() for e in events if e.path}

    for ip in _IPV4.findall(text):
        (query.ips if ip in known_ips else query.unknown_entities).append(ip)

    for path in (p.lower() for p in _PATHLIKE.findall(text)):
        if any(path in known for known in known_paths):
            query.paths.append(path)
        else:
            query.unknown_entities.append(path)

    for user in known_users:
        if re.search(rf"\b{re.escape(user)}\b", lowered):
            query.users.append(user)

    # An explicit "user <name>" naming someone absent from the evidence is a
    # question with no answer here. Returning the case's other activity instead
    # would attach real events to a person the evidence never mentions.
    for named in _NAMED_USER.findall(text):
        if named.lower() not in known_users and named.lower() not in _USER_STOPWORDS:
            query.unknown_entities.append(f"user {named}")

    for etype, hints in _TYPE_HINTS.items():
        if any(hint in lowered for hint in hints):
            query.event_types.append(etype)

    if (m := _TIME_RANGE.search(text)):
        query.tod_start = _hour(m.group(1), m.group(2), m.group(3))
        query.tod_end = _hour(m.group(4), m.group(5), m.group(6) or m.group(3))
    elif (m := _AFTER.search(text)):
        query.tod_start = time(int(m.group(1)), int(m.group(2)))
        end_hour = (int(m.group(1)) + 2) % 24
        query.tod_end = time(end_hour, int(m.group(2)))

    return query


def _hour(h: str, minute: Optional[str], meridiem: Optional[str]) -> time:
    hour = int(h) % 24
    if meridiem:
        meridiem = meridiem.lower()
        if meridiem == "pm" and hour < 12:
            hour += 12
        if meridiem == "am" and hour == 12:
            hour = 0
    return time(hour, int(minute or 0))


def _in_time_of_day(clock: time, start: time, end: time) -> bool:
    """Whether a clock time falls in a window, which may wrap past midnight."""
    if start <= end:
        return start <= clock <= end
    return clock >= start or clock <= end


def _case_day(events: list[Event]) -> datetime:
    """The day questions are assumed to be about: where most evidence sits."""
    if not events:
        return datetime.now(timezone.utc)
    from collections import Counter

    days = Counter(e.timestamp.date() for e in events)
    top = days.most_common(1)[0][0]
    return datetime(top.year, top.month, top.day, tzinfo=timezone.utc)


class Retriever:
    def __init__(self, events: Iterable[Event]):
        self.events = list(events)
        self._corpus = [self._document(ev) for ev in self.events]
        self._vectoriser = TfidfVectorizer(
            lowercase=True,
            token_pattern=r"[A-Za-z0-9_.:\\/@-]{2,}",
            sublinear_tf=True,
        )
        self._matrix = (
            self._vectoriser.fit_transform(self._corpus) if self._corpus else None
        )

    @staticmethod
    def _document(ev: Event) -> str:
        parts = [
            ev.event_type.value.replace("_", " "),
            ev.stage,
            ev.action,
            ev.user or "", ev.host or "", ev.process or "", ev.cmdline or "",
            ev.path or "", ev.src_ip or "", ev.dst_ip or "", ev.domain or "",
            ev.url or "", ev.raw,
        ]
        return " ".join(p for p in parts if p)

    def search(self, query: Query, k: int = 20) -> list[tuple[Event, float]]:
        """Filter by hard constraints, then rank the remainder by text match."""
        if query.unknown_entities:
            return []
        candidates = [ev for ev in self.events if _matches(ev, query)]
        if not candidates:
            return []
        if self._matrix is None:
            return [(ev, 0.0) for ev in candidates[:k]]

        index = {id(ev): i for i, ev in enumerate(self.events)}
        rows = [index[id(ev)] for ev in candidates]
        query_vec = self._vectoriser.transform([query.text])
        scores = (self._matrix[rows] @ query_vec.T).toarray().ravel()

        ranked = sorted(
            zip(candidates, scores), key=lambda pair: (-pair[1], pair[0].timestamp)
        )
        # When the question carries real constraints, a zero text score still
        # means "inside the window the investigator asked about" -- keep those.
        return ranked[:k]


def _matches(ev: Event, query: Query) -> bool:
    if query.start and ev.timestamp < query.start:
        return False
    if query.end and ev.timestamp > query.end:
        return False
    if query.tod_start and query.tod_end and not _in_time_of_day(
        ev.timestamp.timetz().replace(tzinfo=None), query.tod_start, query.tod_end
    ):
        return False
    if query.users and (ev.user or "").lower() not in query.users:
        return False
    if query.ips and ev.dst_ip not in query.ips and ev.src_ip not in query.ips:
        return False
    if query.paths and not any(p in (ev.path or "").lower() for p in query.paths):
        return False
    if query.event_types and ev.event_type not in query.event_types:
        return False
    return True
