"""Evidence-grounded digital forensic analysis.

Pipeline: parse -> normalise -> extract entities -> graph -> detect -> correlate
-> investigate -> report. Each stage is separately testable and separately
evaluable; see `evaluation.py`.
"""

from .pipeline import CaseAnalysis, analyse  # noqa: F401

__version__ = "0.1.0"
__all__ = ["analyse", "CaseAnalysis"]
