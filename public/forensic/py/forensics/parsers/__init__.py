"""Evidence parsers.

Importing this package registers every built-in parser. Adding a new evidence
type means adding a module here and decorating its function with
`@register(SourceKind.X)` -- nothing else in the pipeline changes.
"""

from .base import Case, SourceSpec, load_case, parser_for, register  # noqa: F401
from . import auth, browser, filesystem, network, process  # noqa: F401

__all__ = ["Case", "SourceSpec", "load_case", "parser_for", "register"]
