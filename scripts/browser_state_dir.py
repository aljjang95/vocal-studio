"""Allocate isolated Wrangler state without deleting an operator-supplied path."""
import tempfile
from pathlib import Path


def create_browser_state(root: Path, requested: str | None = None) -> Path:
    root = root.resolve()
    allowed = root / 'tmp'
    if allowed.resolve() != allowed:
        raise ValueError('Browser state tmp directory must not redirect outside the repository')
    if requested is not None and not requested.strip():
        raise ValueError('VS_BROWSER_PERSIST must not be empty')
    parent = Path(requested) if requested is not None else allowed / 'cf-browser-state'
    if not parent.is_absolute():
        parent = root / parent
    parent = parent.resolve()
    if parent == allowed or not parent.is_relative_to(allowed):
        raise ValueError('VS_BROWSER_PERSIST must be a dedicated directory below repository tmp/')
    parent.mkdir(parents=True, exist_ok=True)
    # Every invocation owns only a fresh child. Existing state is never removed.
    return Path(tempfile.mkdtemp(prefix='run-', dir=parent))
