"""Single-variable bending control, keeping every body and garment contact active."""
from pathlib import Path

source = Path(__file__).parent.parent / 'morpheus-shoulder-release-2026-10-20/bake-cage-clearance.py'
code = source.read_text()
before = 'settings.bending_stiffness = .03'
assert code.count(before) == 1
code = code.replace(before, 'settings.bending_stiffness = .3')
exec(compile(code, str(source), 'exec'), {'__file__': str(source), '__name__': '__main__'})
