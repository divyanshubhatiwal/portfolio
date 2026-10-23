"""Report generation.

The report is the product. Two rules it enforces rather than merely follows:

* No finding renders without evidence ids. `_render_finding` raises instead of
  emitting an uncited claim, so an ungrounded statement fails loudly at build
  time rather than quietly reaching a reader.
* Every adjustment made to the evidence (skew correction, inferred timezone,
  inferred year, dropped duplicates) appears in the methodology section. An
  investigator has to be able to reproduce and challenge each one.
"""

from __future__ import annotations

from datetime import datetime, timezone

from . import timeline
from .pipeline import CaseAnalysis
from .schema import Finding


class UngroundedFinding(RuntimeError):
    pass


def build(analysis: CaseAnalysis, *, max_timeline_rows: int = 120) -> str:
    stats = analysis.summary()
    now = datetime.now(timezone.utc)
    out: list[str] = []

    out.append(f"# Forensic analysis report -- {analysis.case_id}")
    out.append("")
    out.append(f"Generated {now:%Y-%m-%d %H:%M:%S} UTC by an automated analysis pipeline.")
    out.append(
        "This report organises and correlates recorded evidence. It does not "
        "establish intent, attribution or culpability, and is not a substitute "
        "for examiner judgement."
    )
    out.append("")

    out.append("## 1. Summary")
    out.append("")
    out.append(f"- Events analysed: **{stats['events']}** from {stats['sources']} evidence sources")
    out.append(f"- Entities identified: **{stats['entities']}** across {stats['relations']} relations")
    out.append(f"- Events flagged anomalous: **{stats['anomalies']}** ({stats['high_severity']} high severity)")
    out.append(f"- Correlated incident chains: **{stats['incidents']}**")
    out.append(f"- Mean timestamp confidence: **{stats['mean_timestamp_confidence']:.3f}**")
    out.append("")

    out.append("## 2. Evidence handling and normalisation")
    out.append("")
    out.append("```")
    out.extend(analysis.ingest_report.lines())
    out.append("```")
    out.append("")
    if analysis.ingest_report.skew_applied:
        out.append(
            "Clock-skew corrections above were derived from anchor events recorded "
            "in two sources simultaneously. Corrected timestamps carry reduced "
            "confidence and are marked `~` in the timeline."
        )
        out.append("")

    out.append("## 3. Incident chains")
    out.append("")
    if not analysis.incidents:
        out.append("No event sequence met the correlation thresholds for this case.")
        out.append("")
    for incident in analysis.incidents:
        out.append(f"### {incident.incident_id}")
        out.append("")
        out.append(f"- Window: {incident.start:%Y-%m-%d %H:%M:%S} to {incident.end:%H:%M:%S} UTC")
        out.append(f"- Stages: {' -> '.join(incident.stages)}")
        out.append(f"- Events: {len(incident.event_ids)}")
        out.append(f"- Score {incident.score:.2f}, confidence {incident.confidence:.2f}")
        for kind, values in sorted(incident.entities.items()):
            out.append(f"- {kind.capitalize()}s: {', '.join(values[:8])}")
        out.append("")
        out.append("Basis for correlation:")
        for line in incident.rationale:
            out.append(f"  - {line}")
        out.append("")
        out.append("Constituent events:")
        out.append("")
        out.append("```")
        members = [analysis.event(i) for i in incident.event_ids]
        out.append(timeline.render(
            [m for m in members if m], analysis.anomalies, show_gaps=False
        ))
        out.append("```")
        out.append("")

    out.append("## 4. Anomalous events")
    out.append("")
    if not analysis.anomalies:
        out.append("No events exceeded the anomaly threshold.")
    else:
        out.append("| Event | Time (UTC) | Severity | Score | Basis |")
        out.append("| --- | --- | --- | --- | --- |")
        for anomaly in analysis.anomalies[:25]:
            ev = analysis.event(anomaly.event_id)
            if not ev:
                continue
            out.append(
                f"| `{ev.event_id}` | {ev.timestamp:%H:%M:%S} | {anomaly.severity} | "
                f"{anomaly.score:.2f} | {'; '.join(anomaly.reasons)} |"
            )
    out.append("")

    out.append("## 5. Timeline")
    out.append("")
    out.append("```")
    out.append(timeline.render(
        analysis.events, analysis.anomalies, max_rows=max_timeline_rows
    ))
    out.append("```")
    if len(analysis.events) > max_timeline_rows:
        out.append("")
        out.append(f"_Truncated to the first {max_timeline_rows} of {len(analysis.events)} events._")
    out.append("")

    out.append("## 6. Methodology and limitations")
    out.append("")
    out.extend(_methodology(analysis))
    return "\n".join(out)


def _methodology(analysis: CaseAnalysis) -> list[str]:
    return [
        "**Ordering.** The timeline is ordered solely by normalised evidence "
        "timestamps. No model was consulted about sequence. Where several events "
        "share a whole-second timestamp, ties break deterministically by "
        "investigative stage, then source file and line.",
        "",
        "**Correlation.** Events are linked when they share an entity (user, "
        "process, file or address) within a 20-minute window; chains are retained "
        "when they span at least two investigative stages. Linking is "
        "deterministic -- every link corresponds to a shared field in the "
        "evidence and can be checked by hand.",
        "",
        "**Stages.** Chains are scored against the arc access -> escalation -> "
        "execution -> collection -> exfiltration -> cleanup. Web browsing and the "
        "opening of network connections are recorded as context: they appear in "
        "the chain and are named in its rationale, but earn no score. Opening a "
        "connection is not sending data, and every page load produces several, so "
        "treating them as egress would place ordinary web traffic on the "
        "investigator's queue. Only a flow above the volume threshold in the "
        "network parser is treated as a transfer.",
        "",
        "**Anomaly scoring.** An Isolation Forest over behavioural features "
        "(time of day, entity rarity, transfer volume, burst rate, preceding "
        "authentication failures) ranks events; rule-based reasons are attached "
        "independently. An event flagged by the model with no matching rule is "
        "reported as such rather than given a narrative.",
        "",
        "**Confidence.** Incident confidence is the correlation score discounted "
        "by the mean timestamp confidence of its member events, so chains built "
        "on inferred timezones, inferred years or corrected clocks score lower "
        "than chains built on unambiguous absolute timestamps.",
        "",
        "**Limitations.** Log evidence records what was written, not what "
        "occurred: absence of an event is not evidence of absence of the "
        "activity, and logs can be incomplete, delayed, or altered. This "
        "pipeline does not verify evidence integrity, does not establish which "
        "human operated an account, and does not determine the content of any "
        "transferred data. All interpretations in this report are hypotheses "
        "for an examiner to test.",
    ]


def _render_finding(finding: Finding) -> list[str]:
    """Render one finding, refusing to emit it uncited."""
    if not finding.evidence:
        raise UngroundedFinding(
            f"finding without evidence cannot be reported: {finding.statement!r}"
        )
    lines = [f"- **[{finding.tier}]** {finding.statement}"]
    if finding.reason:
        lines.append(f"  - Basis: {finding.reason}")
    lines.append(f"  - Confidence: {finding.confidence:.2f}")
    lines.append(f"  - Evidence: {', '.join(f'`{e}`' for e in finding.evidence)}")
    return lines


def answer_section(answer) -> str:
    """Render an investigator Q&A exchange for inclusion in a report."""
    out = [f"### {answer.question}", ""]
    if not answer.findings:
        out.append("_No matching evidence; nothing asserted._")
        return "\n".join(out)
    for finding in answer.findings:
        out.extend(_render_finding(finding))
    if answer.unsupported_claims:
        out.append("")
        out.append(
            f"_{len(answer.unsupported_claims)} generated statement(s) withheld "
            f"for citing no evidence in this case._"
        )
    return "\n".join(out)
