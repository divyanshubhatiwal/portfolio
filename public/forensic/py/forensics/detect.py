"""Anomaly detection over normalised events.

Two layers, deliberately:

* An unsupervised model (Isolation Forest) over behavioural features, which
  finds odd events without being told what odd looks like.
* Rule-based *reasons*, which say why in language an investigator can check.

The model alone would produce a ranked list of event ids and no defensible
explanation; the rules alone would only ever find what was anticipated. The
score orders the queue, the reasons justify each entry, and an event flagged
by the model with no reason attached is reported as such rather than dressed
up in a post-hoc story.
"""

from __future__ import annotations

import math
from collections import Counter, defaultdict
from typing import Iterable

import numpy as np
from sklearn.ensemble import IsolationForest

from .schema import Anomaly, Event, EventType, SourceKind

#: Hours (local to the evidence's normalised UTC frame) treated as "business".
BUSINESS_HOURS = range(9, 20)

FEATURE_NAMES = [
    "hour_sin", "hour_cos", "off_hours", "is_weekend",
    "log_bytes_out", "log_bytes_in", "log_size",
    "process_rarity", "dst_rarity", "path_rarity",
    "user_burst", "failed_logins_before", "stage_rank",
]

_STAGE_RANK = {
    "access": 0, "escalation": 1, "browsing": 2, "execution": 3,
    "collection": 4, "network": 5, "exfiltration": 6, "cleanup": 7, "other": 8,
}


class Detector:
    def __init__(self, contamination: float = 0.02, random_state: int = 7):
        self.contamination = contamination
        self.random_state = random_state
        self.model: IsolationForest | None = None

    def fit_score(self, events: list[Event]) -> list[Anomaly]:
        """Fit on the case's own events and score them.

        Fitting and scoring on the same set is intentional: a forensic case is
        one closed population, and the question is 'which of *these* events
        stand out against *these* events', not 'do these generalise'. It also
        removes any need for a labelled baseline the investigator does not have.
        """
        if len(events) < 20:
            return []  # too little population for outlierness to mean anything

        context = _Context(events)
        matrix = np.array([_features(ev, context) for ev in events], dtype=float)

        self.model = IsolationForest(
            n_estimators=300,
            contamination=self.contamination,
            random_state=self.random_state,
        )
        self.model.fit(matrix)
        raw = -self.model.score_samples(matrix)  # higher = more anomalous

        lo, hi = float(raw.min()), float(raw.max())
        span = (hi - lo) or 1.0

        anomalies: list[Anomaly] = []
        for ev, raw_score in zip(events, raw):
            score = float((raw_score - lo) / span)
            reasons = explain(ev, context)
            if score < 0.5 and not reasons:
                continue
            if reasons:
                # Corroboration between an independent model and an explicit
                # rule is worth more than either alone.
                score = min(1.0, score + 0.08 * len(reasons))
            else:
                reasons = ["statistical outlier against this case's baseline; no matching rule"]
            anomalies.append(
                Anomaly(
                    event_id=ev.event_id,
                    score=round(score, 4),
                    severity=_severity(score),
                    reasons=reasons,
                )
            )
        anomalies.sort(key=lambda a: (-a.score, a.event_id))
        return anomalies


class _Context:
    """Case-wide baselines the features and rules are measured against."""

    def __init__(self, events: Iterable[Event]):
        events = list(events)
        self.n = len(events)
        self.process_counts = Counter(e.process.lower() for e in events if e.process)
        self.dst_counts = Counter(e.dst_ip for e in events if e.dst_ip)
        self.path_counts = Counter(e.path.lower() for e in events if e.path)
        self.user_hours: dict[str, Counter] = defaultdict(Counter)
        self.per_minute: Counter = Counter()
        self.failed_before: dict[str, int] = {}

        failures: dict[str, list] = defaultdict(list)
        for ev in sorted(events, key=lambda e: e.timestamp):
            if ev.user:
                self.user_hours[ev.user][ev.timestamp.hour] += 1
            self.per_minute[(ev.user, ev.timestamp.replace(second=0, microsecond=0))] += 1
            if ev.event_type is EventType.LOGIN_FAILURE and ev.user:
                failures[ev.user].append(ev.timestamp)
            if ev.event_type is EventType.LOGIN_SUCCESS and ev.user:
                recent = [
                    t for t in failures[ev.user]
                    if 0 <= (ev.timestamp - t).total_seconds() <= 600
                ]
                self.failed_before[ev.event_id] = len(recent)

    def rarity(self, counter: Counter, key) -> float:
        """0 = ubiquitous in this case, 1 = seen exactly once."""
        if key is None:
            return 0.0
        count = counter.get(key, 0)
        if count <= 0:
            return 1.0
        return 1.0 / math.sqrt(count)


def _features(ev: Event, ctx: _Context) -> list[float]:
    hour = ev.timestamp.hour
    angle = 2 * math.pi * hour / 24
    return [
        math.sin(angle),
        math.cos(angle),
        0.0 if hour in BUSINESS_HOURS else 1.0,
        1.0 if ev.timestamp.weekday() >= 5 else 0.0,
        math.log1p(ev.bytes_out or 0),
        math.log1p(ev.bytes_in or 0),
        math.log1p(ev.size or 0),
        ctx.rarity(ctx.process_counts, ev.process.lower() if ev.process else None),
        ctx.rarity(ctx.dst_counts, ev.dst_ip),
        ctx.rarity(ctx.path_counts, ev.path.lower() if ev.path else None),
        float(ctx.per_minute[(ev.user, ev.timestamp.replace(second=0, microsecond=0))]),
        float(ctx.failed_before.get(ev.event_id, 0)),
        float(_STAGE_RANK.get(ev.stage, 7)),
    ]


#: Process names that are unremarkable on their own but notable as the *first*
#: thing a freshly-authenticated session runs. Kept short and explicit rather
#: than pretending to be a threat-intel feed.
_INTERPRETER_PROCESSES = {
    "powershell.exe", "pwsh.exe", "pwsh", "cmd.exe", "wscript.exe", "cscript.exe",
    "mshta.exe", "rundll32.exe", "certutil.exe", "bash", "sh", "python.exe",
    "python3", "python", "perl", "ruby",
}
_ARCHIVE_PROCESSES = {"7z.exe", "winrar.exe", "rar.exe", "tar", "tar.exe", "zip"}

LARGE_TRANSFER_BYTES = 100_000_000


def explain(ev: Event, ctx: _Context) -> list[str]:
    """Human-checkable reasons this event might deserve attention.

    Each string states an observation, not a conclusion. 'ran outside business
    hours' is checkable against the evidence; 'attacker established persistence'
    is not, and does not belong here.
    """
    reasons: list[str] = []
    hour = ev.timestamp.hour

    if hour not in BUSINESS_HOURS:
        reasons.append(f"occurred at {hour:02d}:xx UTC, outside business hours")

    if ev.user and ctx.user_hours[ev.user][hour] <= 1 and sum(ctx.user_hours[ev.user].values()) > 10:
        reasons.append(f"user {ev.user} has almost no other activity in this hour")

    failed = ctx.failed_before.get(ev.event_id, 0)
    if failed >= 3:
        reasons.append(f"successful login preceded by {failed} failures within 10 minutes")

    if ev.event_type is EventType.PRIV_ESCALATION:
        reasons.append("privilege escalation recorded")

    if ev.process:
        proc = ev.process.lower()
        if proc in _INTERPRETER_PROCESSES and ev.event_type is EventType.PROCESS_START:
            reasons.append(f"scripting/interpreter process started ({ev.process})")
        if proc in _ARCHIVE_PROCESSES:
            reasons.append(f"archiving utility used ({ev.process})")
        if ctx.process_counts[proc] == 1:
            reasons.append(f"process {ev.process} appears only once in this case")

    if ev.event_type is EventType.ARCHIVE_CREATE:
        size = f" ({ev.size / 1e6:.0f} MB on disk)" if ev.size else ""
        reasons.append(f"archive created at {ev.path}{size}")

    # Strictly a network observation. File size is reported separately above;
    # calling an 800 MB file an 800 MB transfer would invent the exfiltration.
    if ev.source_kind is SourceKind.NETWORK and ev.bytes_out and ev.bytes_out >= LARGE_TRANSFER_BYTES:
        reasons.append(f"outbound transfer of {ev.bytes_out / 1e6:.1f} MB")

    if ev.dst_ip and ctx.dst_counts[ev.dst_ip] == 1 and not _is_internal(ev.dst_ip):
        reasons.append(f"single connection to external address {ev.dst_ip}")

    if ev.event_type is EventType.FILE_DELETE and hour not in BUSINESS_HOURS:
        reasons.append("file deleted outside business hours")

    return reasons


def _is_internal(ip: str) -> bool:
    return ip.startswith(("10.", "192.168.", "172.16.", "172.17.", "127."))


def _severity(score: float) -> str:
    if score >= 0.85:
        return "high"
    if score >= 0.65:
        return "medium"
    return "low"
