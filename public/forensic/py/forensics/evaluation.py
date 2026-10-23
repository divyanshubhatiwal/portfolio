"""Evaluation against ground truth.

The research claim of this project is not "the tool runs". It is that each
stage does something measurable, so every stage is scored separately against a
case whose answer is known by construction:

* normalisation -- how close the recovered clock skew is to the planted offset;
* detection -- precision/recall of anomaly flags over planted incident events;
* correlation -- how completely each planted chain is recovered as one chain;
* ordering -- whether the reconstructed sequence matches the true sequence;
* retrieval -- precision@k for questions about the incident window;
* grounding -- the share of generated statements that cited nothing real.

Reporting these separately matters: a system can score well on detection and
still reconstruct the story wrongly, and averaging that away would hide it.
"""

from __future__ import annotations

import json
from dataclasses import dataclass, field
from pathlib import Path

from .pipeline import CaseAnalysis


@dataclass
class Metric:
    name: str
    value: float
    detail: str = ""

    def __str__(self) -> str:
        return f"{self.name:<34} {self.value:>7.3f}  {self.detail}"


@dataclass
class EvaluationResult:
    case_id: str
    metrics: list[Metric] = field(default_factory=list)
    notes: list[str] = field(default_factory=list)

    def add(self, name: str, value: float, detail: str = "") -> None:
        self.metrics.append(Metric(name, value, detail))

    def get(self, name: str) -> float | None:
        for metric in self.metrics:
            if metric.name == name:
                return metric.value
        return None

    def render(self) -> str:
        lines = [f"evaluation -- {self.case_id}", "=" * 64]
        lines.extend(str(m) for m in self.metrics)
        if self.notes:
            lines.append("")
            lines.extend(f"note: {n}" for n in self.notes)
        return "\n".join(lines)


def evaluate(analysis: CaseAnalysis, ground_truth_path) -> EvaluationResult:
    truth = json.loads(Path(ground_truth_path).read_text(encoding="utf-8"))
    result = EvaluationResult(case_id=analysis.case_id)

    _score_normalisation(analysis, truth, result)
    _score_detection(analysis, truth, result)
    _score_correlation(analysis, truth, result)
    _score_ordering(analysis, truth, result)
    _score_retrieval(analysis, truth, result)
    _score_grounding(analysis, truth, result)
    return result


def _truth_event_ids(truth: dict) -> set[str]:
    return {eid for inc in truth["incidents"] for eid in inc["event_ids"]}


def _score_normalisation(analysis: CaseAnalysis, truth: dict, result: EvaluationResult) -> None:
    """How accurately was the planted clock skew recovered?"""
    expected = truth.get("clock_skew_s", {})
    if not expected:
        return
    errors = []
    for source, true_skew in expected.items():
        applied = -analysis.ingest_report.skew_applied.get(source, 0.0)
        errors.append(abs(applied - true_skew))
        result.notes.append(
            f"{source}: true skew {true_skew:+.0f}s, recovered {applied:+.1f}s "
            f"from {analysis.ingest_report.skew_anchors.get(source, 0)} anchors"
        )
    result.add(
        "skew_recovery_error_s",
        sum(errors) / len(errors),
        "mean absolute error, seconds (lower is better)",
    )

    parsed = sum(analysis.ingest_report.per_source.values())
    result.add(
        "mean_timestamp_confidence",
        analysis.summary()["mean_timestamp_confidence"],
        f"over {parsed} parsed records",
    )


def _score_detection(analysis: CaseAnalysis, truth: dict, result: EvaluationResult) -> None:
    """Precision/recall of anomaly flags, treating planted events as positives.

    Recall matters far more than precision in this setting: a missed event can
    end an investigation, while a false positive costs an examiner a minute.
    Both are reported rather than folded into one number.
    """
    positives = _truth_event_ids(truth)
    flagged = {a.event_id for a in analysis.anomalies}
    if not positives:
        return

    true_positives = len(flagged & positives)
    precision = true_positives / len(flagged) if flagged else 0.0
    recall = true_positives / len(positives)
    f1 = 2 * precision * recall / (precision + recall) if (precision + recall) else 0.0

    result.add("anomaly_precision", precision, f"{true_positives}/{len(flagged)} flagged are planted")
    result.add("anomaly_recall", recall, f"{true_positives}/{len(positives)} planted are flagged")
    result.add("anomaly_f1", f1)

    ranked = [a.event_id for a in analysis.anomalies]
    for k in (10, 25):
        top = ranked[:k]
        if top:
            result.add(
                f"anomaly_precision_at_{k}",
                sum(1 for e in top if e in positives) / len(top),
                f"top {len(top)} by score",
            )

    benign_flagged = len(flagged - positives)
    result.add(
        "false_positive_rate",
        benign_flagged / max(len(analysis.events) - len(positives), 1),
        f"{benign_flagged} benign events flagged of {len(analysis.events) - len(positives)}",
    )


def _score_correlation(analysis: CaseAnalysis, truth: dict, result: EvaluationResult) -> None:
    """How well each planted chain is recovered as a single predicted chain.

    Scored per planted incident against its best-matching prediction, because
    the useful failure mode to see is 'the chain was found but split in two' --
    a set-level micro-average would blur that into a mediocre F1.
    """
    if not truth["incidents"]:
        return

    recalls, precisions, matched = [], [], 0
    for planted in truth["incidents"]:
        planted_ids = set(planted["event_ids"])
        best, best_overlap = None, 0
        for predicted in analysis.incidents:
            overlap = len(planted_ids & set(predicted.event_ids))
            if overlap > best_overlap:
                best, best_overlap = predicted, overlap
        if best is None:
            recalls.append(0.0)
            precisions.append(0.0)
            result.notes.append(f"{planted['incident_id']}: not recovered by any chain")
            continue
        matched += 1
        recall = best_overlap / len(planted_ids)
        precision = best_overlap / len(best.event_ids)
        recalls.append(recall)
        precisions.append(precision)
        result.notes.append(
            f"{planted['incident_id']} -> {best.incident_id}: "
            f"{best_overlap}/{len(planted_ids)} planted events recovered, "
            f"chain size {len(best.event_ids)}, confidence {best.confidence:.2f}"
        )

    n = len(truth["incidents"])
    result.add("incident_detection_rate", matched / n, f"{matched}/{n} planted chains found")
    result.add("chain_event_recall", sum(recalls) / n, "mean over planted chains")
    result.add(
        "chain_event_precision",
        sum(precisions) / n,
        "share of the matched chain that is planted (benign context lowers this)",
    )


def _score_ordering(analysis: CaseAnalysis, truth: dict, result: EvaluationResult) -> None:
    """Pairwise concordance between the true and reconstructed sequences.

    This is the number that would expose a timestamp-normalisation bug that
    every other metric survives: if a source's clock is wrong, its events land
    in the right chain but the wrong place in the story.
    """
    positions = {ev.event_id: i for i, ev in enumerate(analysis.events)}
    concordant = total = 0
    for planted in truth["incidents"]:
        ids = [e for e in planted["event_ids"] if e in positions]
        for i, a in enumerate(ids):
            for b in ids[i + 1:]:
                total += 1
                if positions[a] < positions[b]:
                    concordant += 1
    if total:
        result.add(
            "temporal_ordering_accuracy",
            concordant / total,
            f"{concordant}/{total} correctly ordered event pairs",
        )

    missing = sum(
        1 for planted in truth["incidents"]
        for e in planted["event_ids"] if e not in positions
    )
    if missing:
        result.notes.append(f"{missing} planted events never reached the timeline (parse or dedupe loss)")


def _score_retrieval(analysis: CaseAnalysis, truth: dict, result: EvaluationResult) -> None:
    """Precision@k for questions an investigator would actually ask."""
    if not truth["incidents"]:
        return
    planted = truth["incidents"][0]
    relevant = set(planted["event_ids"])
    questions = [
        f"what did user {planted['user']} do between 2 and 3 am",
        f"show network activity to {planted['external_ip']}",
        "was an archive created and then uploaded",
    ]

    scores = []
    for question in questions:
        answer = analysis.investigator.ask(question, k=10)
        retrieved = [ev.event_id for ev in answer.evidence]
        if not retrieved:
            scores.append(0.0)
            continue
        scores.append(sum(1 for e in retrieved if e in relevant) / len(retrieved))
    result.add(
        "retrieval_precision_at_10",
        sum(scores) / len(scores),
        f"mean over {len(questions)} investigator questions",
    )


def _score_grounding(analysis: CaseAnalysis, truth: dict, result: EvaluationResult) -> None:
    """Share of generated statements that cited no real evidence.

    On the deterministic path this is 0.0 by construction -- every statement is
    built from an event it cites. It is reported anyway, because it is the
    baseline the LLM path has to be compared against, and a non-zero value here
    would mean a genuine bug in the synthesis layer.
    """
    questions = [
        "what happened overnight",
        "which files were accessed before the outbound transfer",
        "who logged in after multiple failures",
    ]
    total_findings = unsupported = uncited = 0
    for question in questions:
        answer = analysis.investigator.ask(question)
        total_findings += len(answer.findings)
        unsupported += len(answer.unsupported_claims)
        uncited += sum(1 for f in answer.findings if not f.evidence)

    denominator = total_findings + unsupported
    result.add(
        "unsupported_claim_rate",
        unsupported / denominator if denominator else 0.0,
        f"{unsupported} withheld of {denominator} generated statements "
        f"({analysis.investigator.llm and 'llm' or 'deterministic'} path)",
    )
    result.add(
        "uncited_finding_rate",
        uncited / total_findings if total_findings else 0.0,
        "must be 0.000 -- an uncited finding is a bug, not a result",
    )
