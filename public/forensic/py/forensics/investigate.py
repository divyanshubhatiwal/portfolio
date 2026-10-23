"""The investigation layer: evidence-grounded answers.

Design rule: the language model is never the source of a fact. Retrieval and
correlation produce an evidence pack; the model may only rephrase, group and
prioritise what is in that pack, and every statement it returns must cite event
ids drawn from it. Statements citing anything else are dropped before the user
sees them, and counted -- that count is the `unsupported_claim_rate` the
evaluation reports.

Without a model configured the system still answers, deterministically, from
templates. That fallback is not a degraded mode for demos; it is the baseline
the LLM path is measured against.
"""

from __future__ import annotations

import json
from dataclasses import dataclass, field
from datetime import timedelta
from typing import Optional, Protocol

from .correlate import incident_for_event
from .retrieve import Query, Retriever, parse_query
from .schema import Event, Finding, Incident

#: Wording that would assert intent, identity or guilt. The evidence in scope
#: for this system can support none of these, so they are refused at the
#: boundary rather than argued about in a report.
FORBIDDEN_ASSERTIONS = (
    "the attacker", "the suspect", "stole", "theft", "guilty", "criminal",
    "deliberately", "intentionally", "proves", "proven", "confirms that",
    "hacker", "malicious actor", "insider threat was",
)


class LLMClient(Protocol):
    """Minimal adapter. Any provider that can return text satisfies this."""

    def complete(self, system: str, user: str) -> str: ...


@dataclass
class Answer:
    question: str
    findings: list[Finding]
    evidence: list[Event]
    query: Query
    #: Statements the model produced that cited nothing in the evidence pack.
    unsupported_claims: list[str] = field(default_factory=list)
    generator: str = "deterministic"

    @property
    def unsupported_claim_rate(self) -> float:
        total = len(self.findings) + len(self.unsupported_claims)
        return len(self.unsupported_claims) / total if total else 0.0

    def render(self) -> str:
        if not self.findings:
            return (
                f"No evidence in this case matches that question "
                f"({self.query.describe()}).\n"
                "Nothing is asserted where nothing was recorded."
            )
        lines = [f"Q: {self.question}", f"   retrieval: {self.query.describe()}", ""]
        for tier in ("observed", "correlated", "interpretation"):
            tier_findings = [f for f in self.findings if f.tier == tier]
            if not tier_findings:
                continue
            lines.append(f"{tier.upper()}")
            for finding in tier_findings:
                lines.append(f"  - {finding.statement}")
                if finding.reason:
                    lines.append(f"    reason: {finding.reason}")
                lines.append(
                    f"    confidence: {finding.confidence:.2f}   "
                    f"evidence: {', '.join(finding.evidence)}"
                )
            lines.append("")
        if self.unsupported_claims:
            lines.append(
                f"{len(self.unsupported_claims)} generated statement(s) were withheld "
                f"for citing no evidence in this case."
            )
        lines.append(f"[generator: {self.generator}]")
        return "\n".join(lines)


class Investigator:
    def __init__(
        self,
        events: list[Event],
        incidents: Optional[list[Incident]] = None,
        anomalies=None,
        llm: Optional[LLMClient] = None,
    ):
        self.events = events
        self.by_id = {ev.event_id: ev for ev in events}
        self.incidents = incidents or []
        self.anomalies = {a.event_id: a for a in (anomalies or [])}
        self.retriever = Retriever(events)
        self.llm = llm

    def ask(self, question: str, k: int = 25) -> Answer:
        query = parse_query(question, self.events)
        hits = self.retriever.search(query, k=k)
        evidence = [ev for ev, _ in hits]

        if not evidence:
            return Answer(question=question, findings=[], evidence=[], query=query)

        if self.llm is not None:
            findings, unsupported = self._ask_llm(question, evidence)
            generator = "llm+verified"
        else:
            findings, unsupported = self._synthesise(question, evidence), []
            generator = "deterministic"

        return Answer(
            question=question,
            findings=findings,
            evidence=evidence,
            query=query,
            unsupported_claims=unsupported,
            generator=generator,
        )

    # ---- deterministic path -------------------------------------------

    def _synthesise(self, question: str, evidence: list[Event]) -> list[Finding]:
        findings: list[Finding] = []
        ordered = sorted(evidence, key=lambda e: e.timestamp)

        span = ordered[-1].timestamp - ordered[0].timestamp
        # Show the end date whenever it differs from the start date. Abbreviating
        # it to a clock time makes a multi-day span read as a few minutes, which
        # is how someone misreads a window as one continuous session.
        same_day = ordered[0].timestamp.date() == ordered[-1].timestamp.date()
        end_text = (
            f"{ordered[-1].timestamp:%H:%M:%S}" if same_day
            else f"{ordered[-1].timestamp:%Y-%m-%d %H:%M:%S}"
        )
        findings.append(
            Finding(
                statement=(
                    f"{len(ordered)} matching events were recorded between "
                    f"{ordered[0].timestamp:%Y-%m-%d %H:%M:%S} and "
                    f"{end_text} UTC ({_span_text(span)})."
                ),
                tier="observed",
                confidence=round(
                    sum(e.timestamp_confidence for e in ordered) / len(ordered), 2
                ),
                evidence=[e.event_id for e in ordered[:6]],
                reason="direct restatement of matching evidence records",
            )
        )

        for ev in ordered[:8]:
            findings.append(
                Finding(
                    statement=_describe(ev),
                    tier="observed",
                    confidence=round(ev.timestamp_confidence, 2),
                    evidence=[ev.event_id],
                    reason=f"recorded in {ev.source_file} line {ev.source_line}",
                )
            )

        seen_incidents: set[str] = set()
        for ev in ordered:
            incident = incident_for_event(self.incidents, ev.event_id)
            if not incident or incident.incident_id in seen_incidents:
                continue
            seen_incidents.add(incident.incident_id)
            findings.append(
                Finding(
                    statement=(
                        f"These events form part of correlated chain "
                        f"{incident.incident_id}, which runs "
                        f"{incident.start:%H:%M:%S}-{incident.end:%H:%M:%S} UTC across "
                        f"stages {' -> '.join(incident.stages)}."
                    ),
                    tier="correlated",
                    confidence=incident.confidence,
                    evidence=incident.event_ids[:8],
                    reason="; ".join(incident.rationale),
                )
            )
            interpretation = _interpret(incident)
            if interpretation:
                findings.append(interpretation)

        flagged = [ev for ev in ordered if ev.event_id in self.anomalies]
        if flagged:
            top = max(flagged, key=lambda e: self.anomalies[e.event_id].score)
            anomaly = self.anomalies[top.event_id]
            findings.append(
                Finding(
                    statement=(
                        f"{len(flagged)} of the matching events were flagged as anomalous; "
                        f"the highest-scoring is {top.event_id} at "
                        f"{top.timestamp:%H:%M:%S} UTC."
                    ),
                    tier="correlated",
                    confidence=round(anomaly.score, 2),
                    evidence=[e.event_id for e in flagged[:8]],
                    reason="; ".join(anomaly.reasons),
                )
            )

        return [f for f in findings if _is_permissible(f.statement)]

    # ---- model path ----------------------------------------------------

    SYSTEM_PROMPT = (
        "You are assisting a digital forensic investigator.\n"
        "You will be given a numbered evidence pack of normalised log events.\n"
        "Rules you must follow:\n"
        "1. Every statement you make must cite one or more event_ids from the pack.\n"
        "2. Never state intent, identity, motive or guilt. The evidence cannot support it.\n"
        "3. Separate what was observed from what is inferred. Use tier 'observed' for\n"
        "   direct restatements, 'correlated' for relationships between events, and\n"
        "   'interpretation' for what a sequence might indicate - phrased as a\n"
        "   possibility that warrants investigation, never as a conclusion.\n"
        "4. If the pack does not answer the question, say so. Do not fill the gap.\n"
        'Return JSON only: {"findings": [{"statement": str, "tier": str, '
        '"confidence": float, "evidence": [event_id], "reason": str}]}'
    )

    def _ask_llm(self, question: str, evidence: list[Event]) -> tuple[list[Finding], list[str]]:
        pack = "\n".join(
            f"{ev.event_id} | {ev.timestamp:%Y-%m-%d %H:%M:%S}Z | {ev.event_type.value} | "
            f"user={ev.user} host={ev.host} process={ev.process} path={ev.path} "
            f"dst={ev.dst_ip} bytes_out={ev.bytes_out} | src={ev.source_file}:{ev.source_line}"
            for ev in sorted(evidence, key=lambda e: e.timestamp)
        )
        prompt = f"QUESTION: {question}\n\nEVIDENCE PACK:\n{pack}\n"
        raw = self.llm.complete(self.SYSTEM_PROMPT, prompt)
        return self._verify(raw, {ev.event_id for ev in evidence})

    def _verify(self, raw: str, allowed_ids: set[str]) -> tuple[list[Finding], list[str]]:
        """Drop anything the evidence pack does not back.

        Three ways a generated statement fails here: malformed output, a
        citation to an event id that is not in the pack (including ids the
        model invented), and forbidden assertions of intent or guilt. All three
        are counted as unsupported rather than repaired -- silently fixing a
        model's overreach would hide exactly the failure rate we want to report.
        """
        kept: list[Finding] = []
        rejected: list[str] = []

        text = raw.strip()
        if text.startswith("```"):
            text = text.strip("`")
            text = text.split("\n", 1)[1] if "\n" in text else text
        try:
            payload = json.loads(text)
        except json.JSONDecodeError:
            return [], [f"unparseable model output ({len(raw)} chars)"]

        for item in payload.get("findings", []):
            statement = str(item.get("statement", "")).strip()
            if not statement:
                continue
            cited = [c for c in item.get("evidence", []) if c in allowed_ids]
            invented = [c for c in item.get("evidence", []) if c not in allowed_ids]
            if not cited or invented or not _is_permissible(statement):
                rejected.append(statement)
                continue
            tier = item.get("tier", "interpretation")
            kept.append(
                Finding(
                    statement=statement,
                    tier=tier if tier in ("observed", "correlated", "interpretation") else "interpretation",
                    confidence=_clamp(item.get("confidence", 0.5)),
                    evidence=cited,
                    reason=str(item.get("reason", "")),
                )
            )
        return kept, rejected


def _span_text(span) -> str:
    """Express a duration in a unit that stays readable past a day."""
    seconds = span.total_seconds()
    if seconds < 90:
        return f"span {seconds:.0f} seconds"
    if seconds < 5400:
        return f"span {seconds / 60:.0f} minutes"
    if seconds < 172800:
        return f"span {seconds / 3600:.1f} hours"
    return f"span {seconds / 86400:.1f} days"


def _describe(ev: Event) -> str:
    base = f"At {ev.timestamp:%H:%M:%S} UTC, {ev.event_type.value.replace('_', ' ')}"
    if ev.user:
        base += f" involving user {ev.user}"
    if ev.process:
        base += f" via process {ev.process}"
    if ev.path:
        base += f" on {ev.path}"
    if ev.dst_ip:
        base += f" to {ev.dst_ip}"
        if ev.dst_port:
            base += f":{ev.dst_port}"
    if ev.bytes_out and ev.bytes_out > 1_000_000:
        base += f", carrying {ev.bytes_out / 1e6:.1f} MB outbound"
    elif ev.size and ev.size > 1_000_000:
        base += f" ({ev.size / 1e6:.1f} MB on disk)"
    suffix = ""
    if ev.timestamp_confidence < 0.85:
        suffix = f" (timestamp derived; confidence {ev.timestamp_confidence:.2f})"
    return base + "." + suffix


def _interpret(incident: Incident) -> Optional[Finding]:
    """Name the pattern a chain resembles -- as a hypothesis, never a verdict."""
    stages = set(incident.stages)
    if {"collection", "exfiltration"} <= stages:
        statement = (
            "The sequence of file collection followed by outbound network transfer "
            "is consistent with data staging and egress, and warrants investigation "
            "as a possible data-exfiltration event. This is an interpretation of the "
            "recorded sequence, not a determination of what was transferred or why."
        )
    elif {"access", "escalation"} <= stages:
        statement = (
            "Authentication followed by privilege escalation warrants review against "
            "the account's expected entitlements. Whether the escalation was "
            "authorised cannot be determined from these logs alone."
        )
    elif {"access", "execution"} <= stages:
        statement = (
            "A login followed closely by interpreter execution warrants review "
            "against the user's normal working pattern."
        )
    else:
        return None
    return Finding(
        statement=statement,
        tier="interpretation",
        confidence=incident.confidence,
        evidence=incident.event_ids[:8],
        reason=f"stage pattern {' -> '.join(incident.stages)} in {incident.incident_id}",
    )


def _is_permissible(statement: str) -> bool:
    lowered = statement.lower()
    return not any(phrase in lowered for phrase in FORBIDDEN_ASSERTIONS)


def _clamp(value) -> float:
    try:
        return max(0.0, min(1.0, float(value)))
    except (TypeError, ValueError):
        return 0.5
