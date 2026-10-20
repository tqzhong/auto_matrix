"""Reuse the existing offline posed-mesh renderer in this evidence directory."""
from pathlib import Path
source = Path(__file__).parent.parent/'morpheus-withdrawal-path-2026-10-20/render-body.py'
exec(compile(source.read_text(), str(source), 'exec'), {'__file__': __file__, '__name__': '__main__'})
