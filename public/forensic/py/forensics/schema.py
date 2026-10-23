"""Unified event and entity representation.

Every parser in this package converts its native format into `Event`. Nothing
downstream (graph, detection, correlation, retrieval) is allowed to look at raw
log text again -- if a field matters, it belongs here.
"""

from __future__ import annotations

from datetime import datetime
from enum import Enum
from typing import Optional

from pydantic import BaseModel, Field


class SourceKind(str, Enum):
    AUTH = "auth"
    PROCESS = "process"
    FILE = "file"
    NETWORK = "network"
    BROWSER = "browser"


class EventType(str, Enum):
    LOGIN_SUCCESS = "login_success"
    LOGIN_FAILURE = "login_failure"
    LOGOUT = "logout"
    PRIV_ESCALATION = "priv_escalation"

    PROCESS_START = "process_start"
    PROCESS_END = "process_end"

    FILE_READ = "file_read"
    FILE_WRITE = "file_write"
    FILE_CREATE = "file_create"
    FILE_DELETE = "file_delete"
    ARCHIVE_CREATE = "archive_create"

    NET_CONNECT = "net_connect"
    NET_TRANSFER = "net_transfer"
    DNS_QUERY = "dns_query"

    BROWSER_VISIT = "browser_visit"
    BROWSER_DOWNLOAD = "browser_download"


class EntityType(str, Enum):
    USER = "user"
    HOST = "host"
    PROCESS = "process"
    FILE = "file"
    IP = "ip"
    DOMAIN = "domain"


#: Coarse stage used by the correlation engine to recognise incident shapes.
#: Deliberately smaller than EventType -- correlation reasons about "access ->
#: execution -> collection -> exfiltration", not about individual syscalls.
#:
#: Two distinctions matter here and both were learned from false positives:
#:
#: * Opening a connection is not sending data. `net_connect` is ordinary --
#:   every web page produces several -- so it is `network`, context rather than
#:   arc. Only `net_transfer`, which the network parser reserves for flows
#:   above its volume threshold, is treated as egress.
#: * `browsing` is likewise context. Visiting a site is not a step in an
#:   intrusion, and counting it as one let routine web traffic look like a
#:   multi-stage incident.
STAGE_OF_EVENT_TYPE = {
    EventType.LOGIN_SUCCESS: "access",
    EventType.LOGIN_FAILURE: "access",
    EventType.LOGOUT: "access",
    EventType.PRIV_ESCALATION: "escalation",
    EventType.PROCESS_START: "execution",
    EventType.PROCESS_END: "execution",
    EventType.FILE_READ: "collection",
    EventType.FILE_WRITE: "collection",
    EventType.FILE_CREATE: "collection",
    EventType.FILE_DELETE: "cleanup",
    EventType.ARCHIVE_CREATE: "collection",
    EventType.NET_CONNECT: "network",
    EventType.NET_TRANSFER: "exfiltration",
    EventType.DNS_QUERY: "network",
    EventType.BROWSER_VISIT: "browsing",
    EventType.BROWSER_DOWNLOAD: "collection",
}

#: The escalation arc an incident is scored against, in order. A chain earns
#: its score from how much of *this* it covers.
ARC_STAGES = ("access", "escalation", "execution", "collection", "exfiltration", "cleanup")

#: Stages that are context, not arc. They still appear in a chain and are still
#: shown to the investigator -- they just do not, on their own, make a sequence
#: of events look like an incident.
CONTEXT_STAGES = ("browsing", "network", "other")


class Event(BaseModel):
    """One normalised observation from one evidence source.

    `timestamp` is always tz-aware UTC. `raw_timestamp` keeps the original
    string so a finding can always be traced back to the bytes on disk, which
    is the whole point of evidence grounding.
    """

    event_id: str
    timestamp: datetime
    raw_timestamp: str
    #: 1.0 = source declared an unambiguous absolute time; lower when the
    #: normaliser had to infer a year, a timezone, or correct clock skew.
    timestamp_confidence: float = 1.0
    #: Seconds of clock-skew correction applied to reach `timestamp`.
    skew_applied_s: float = 0.0

    event_type: EventType
    source_kind: SourceKind
    #: Evidence file this came from, relative to the case directory.
    source_file: str
    source_line: int

    action: str = ""
    outcome: Optional[str] = None

    user: Optional[str] = None
    host: Optional[str] = None
    process: Optional[str] = None
    pid: Optional[int] = None
    ppid: Optional[int] = None
    cmdline: Optional[str] = None
    path: Optional[str] = None
    src_ip: Optional[str] = None
    dst_ip: Optional[str] = None
    dst_port: Optional[int] = None
    domain: Optional[str] = None
    url: Optional[str] = None
    bytes_out: Optional[int] = None
    bytes_in: Optional[int] = None
    #: Size of the file an event acted on. Deliberately separate from
    #: `bytes_out`: an 800 MB file on disk and 800 MB sent to an external host
    #: are different facts, and conflating them manufactures exfiltration.
    size: Optional[int] = None

    raw: str = ""

    @property
    def stage(self) -> str:
        return STAGE_OF_EVENT_TYPE.get(self.event_type, "other")

    def cite(self) -> str:
        """Short citation string used everywhere a claim needs backing."""
        return f"[{self.event_id} {self.timestamp:%Y-%m-%d %H:%M:%S}Z {self.source_file}:{self.source_line}]"

    def summary(self) -> str:
        bits = [f"{self.timestamp:%H:%M:%S}", self.event_type.value]
        for label, value in (
            ("user", self.user),
            ("proc", self.process),
            ("file", self.path),
            ("dst", self.dst_ip),
            ("domain", self.domain),
        ):
            if value:
                bits.append(f"{label}={value}")
        if self.bytes_out:
            bits.append(f"bytes_out={self.bytes_out}")
        if self.size:
            bits.append(f"size={self.size}")
        return " ".join(bits)


class Entity(BaseModel):
    entity_id: str
    entity_type: EntityType
    value: str
    first_seen: datetime
    last_seen: datetime
    event_ids: list[str] = Field(default_factory=list)


class Anomaly(BaseModel):
    event_id: str
    score: float
    severity: str
    reasons: list[str] = Field(default_factory=list)


class Incident(BaseModel):
    """A correlated chain of events proposed for investigator attention."""

    incident_id: str
    start: datetime
    end: datetime
    event_ids: list[str]
    stages: list[str]
    entities: dict[str, list[str]] = Field(default_factory=dict)
    score: float = 0.0
    confidence: float = 0.0
    rationale: list[str] = Field(default_factory=list)


class Finding(BaseModel):
    """An assertion the system is willing to put in a report.

    A Finding without `evidence` is a bug, not a finding -- `report.py` refuses
    to render one.
    """

    statement: str
    tier: str  # "observed" | "correlated" | "interpretation"
    confidence: float
    evidence: list[str]
    reason: str = ""
