"""Parser plumbing: case manifests, source specs, and the parser registry."""

from __future__ import annotations

import json
from dataclasses import dataclass, field
from datetime import datetime, timezone
from pathlib import Path
from typing import Callable, Iterator, Optional

from ..schema import Event, SourceKind

#: Filename hints used when a case ships without a manifest.
_KIND_HINTS = {
    SourceKind.AUTH: ("auth", "secure", "login", "wineventlog"),
    SourceKind.PROCESS: ("process", "proc", "sysmon", "exec"),
    SourceKind.FILE: ("file", "fs", "mft", "filesystem"),
    SourceKind.NETWORK: ("network", "net", "conn", "flow", "firewall"),
    SourceKind.BROWSER: ("browser", "history", "chrome", "firefox"),
}


@dataclass
class SourceSpec:
    """How to read one evidence file.

    Everything the normaliser cannot safely guess -- timezone, day/month order,
    which host the file came from -- lives here, supplied by the case manifest.
    """

    path: Path
    kind: SourceKind
    fmt: str = "auto"
    tz: str = "UTC"
    dayfirst: bool = False
    host: Optional[str] = None
    #: Clock offset the investigator already knows about, in seconds.
    #: Positive means this source's clock runs ahead of true time.
    known_skew_s: float = 0.0
    #: True when tz/dayfirst were assumed rather than declared.
    assumed: bool = False

    @property
    def name(self) -> str:
        return self.path.name


@dataclass
class Case:
    case_id: str
    root: Path
    reference_date: datetime
    sources: list[SourceSpec] = field(default_factory=list)


def load_case(root: str | Path) -> Case:
    """Load a case directory, with or without a `case.json` manifest.

    Without a manifest we still parse, but every source is flagged `assumed`
    and its events carry reduced timestamp confidence. That is the honest
    behaviour: a tool that silently assumes UTC is how timelines end up
    5.5 hours wrong.
    """
    root = Path(root)
    manifest_path = root / "case.json"

    if manifest_path.exists():
        manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
        reference = datetime.fromisoformat(
            manifest.get("reference_date", "").replace("Z", "+00:00")
        ) if manifest.get("reference_date") else _mtime_reference(root)
        sources = []
        for entry in manifest["sources"]:
            sources.append(
                SourceSpec(
                    path=root / entry["file"],
                    kind=SourceKind(entry["kind"]),
                    fmt=entry.get("format", "auto"),
                    tz=entry.get("tz", "UTC"),
                    dayfirst=bool(entry.get("dayfirst", False)),
                    host=entry.get("host"),
                    known_skew_s=float(entry.get("known_skew_s", 0.0)),
                )
            )
        return Case(
            case_id=manifest.get("case_id", root.name),
            root=root,
            reference_date=reference,
            sources=sources,
        )

    sources = []
    for path in sorted(root.iterdir()):
        if path.is_dir() or path.name == "ground_truth.json":
            continue
        kind = _guess_kind(path.name)
        if kind is None:
            continue
        sources.append(SourceSpec(path=path, kind=kind, assumed=True))
    return Case(
        case_id=root.name,
        root=root,
        reference_date=_mtime_reference(root),
        sources=sources,
    )


def _guess_kind(filename: str) -> Optional[SourceKind]:
    lowered = filename.lower()
    for kind, hints in _KIND_HINTS.items():
        if any(hint in lowered for hint in hints):
            return kind
    return None


def _mtime_reference(root: Path) -> datetime:
    """Fall back to the newest evidence mtime as the case reference date."""
    times = [p.stat().st_mtime for p in root.iterdir() if p.is_file()]
    if not times:
        return datetime.now(timezone.utc)
    return datetime.fromtimestamp(max(times), tz=timezone.utc)


ParserFn = Callable[[SourceSpec, Case], Iterator[Event]]
_REGISTRY: dict[SourceKind, ParserFn] = {}


def register(kind: SourceKind):
    def decorator(fn: ParserFn) -> ParserFn:
        _REGISTRY[kind] = fn
        return fn

    return decorator


def parser_for(kind: SourceKind) -> ParserFn:
    if kind not in _REGISTRY:
        raise KeyError(f"no parser registered for source kind {kind.value!r}")
    return _REGISTRY[kind]


def make_event_id(spec: SourceSpec, line_no: int) -> str:
    """Stable, human-traceable event id: source stem + line number.

    Stable ids matter for evaluation -- a ground-truth file written against one
    run has to still match the next run.
    """
    stem = spec.path.stem.upper().replace("-", "_")[:12]
    return f"{stem}-{line_no:05d}"
