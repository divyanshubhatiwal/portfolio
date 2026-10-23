"""End-to-end case analysis.

evidence -> normalised events -> entity graph -> anomalies -> incident chains
-> grounded investigation. Each stage is independently testable and independently
evaluable; this module only wires them together.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Optional

from .correlate import correlate
from .detect import Detector
from .graph import EvidenceGraph
from .investigate import Investigator, LLMClient
from .normalize import IngestReport, ingest
from .schema import Anomaly, Event, Incident


@dataclass
class CaseAnalysis:
    case_id: str
    events: list[Event]
    ingest_report: IngestReport
    graph: EvidenceGraph
    anomalies: list[Anomaly]
    incidents: list[Incident]
    investigator: Investigator

    def event(self, event_id: str) -> Optional[Event]:
        return self.investigator.by_id.get(event_id)

    def summary(self) -> dict:
        stats = self.graph.stats()
        return {
            "case_id": self.case_id,
            "events": len(self.events),
            "sources": len(self.ingest_report.per_source),
            "entities": stats["entities"],
            "relations": stats["relations"],
            "anomalies": len(self.anomalies),
            "high_severity": sum(1 for a in self.anomalies if a.severity == "high"),
            "incidents": len(self.incidents),
            "mean_timestamp_confidence": round(
                sum(e.timestamp_confidence for e in self.events) / len(self.events), 3
            ) if self.events else 0.0,
        }


def analyse(
    case_root,
    *,
    contamination: float = 0.02,
    llm: Optional[LLMClient] = None,
    correct_skew: bool = True,
) -> CaseAnalysis:
    events, report = ingest(case_root, correct_skew=correct_skew)
    graph = EvidenceGraph(events)
    anomalies = Detector(contamination=contamination).fit_score(events)
    incidents = correlate(events, anomalies)
    investigator = Investigator(events, incidents=incidents, anomalies=anomalies, llm=llm)
    return CaseAnalysis(
        case_id=report.case_id,
        events=events,
        ingest_report=report,
        graph=graph,
        anomalies=anomalies,
        incidents=incidents,
        investigator=investigator,
    )
