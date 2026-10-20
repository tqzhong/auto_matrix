"""Transport the existing collar facing; retain the baseline cloth material and body."""
from pathlib import Path
import sys

source = Path(__file__).parent.parent / 'morpheus-shoulder-release-2026-10-20/bake-cage-clearance.py'
code = source.read_text()
changes = {
    "pin.add(collar_ids,1,'REPLACE')": """pin.add(collar_ids,1,'REPLACE')
facing = json.loads((work/'band-guide.json').read_text())
assert facing['originalRim'] == collar_ids
pin.add(facing['ids'],1,'REPLACE')""",
    "coordinates[collar_ids] = np.asarray(frame['points'])[:,[0,2,1]]*[40,-40,40]":
        "coordinates[facing['ids']] = np.asarray(facing['frames'][frame['frame']-1]['points'])[:,[0,2,1]]*[40,-40,40]",
    "released.add(collar_ids,1,'REPLACE')": "released.add(facing['ids'],1,'REPLACE')",
    "'stitches':len(stitches),": "'stitches':len(stitches),'collarFacingVertices':len(facing['ids']),",
    "('collar',collar_ids)": "('collar',collar_ids),('facing',facing['ids'])",
}
if '--stiff-inplane' in sys.argv:
    changes.update({
        'settings.tension_stiffness = settings.tension_stiffness_max = 35':
            'settings.tension_stiffness = settings.tension_stiffness_max = 3500',
        'settings.compression_stiffness = settings.compression_stiffness_max = 35':
            'settings.compression_stiffness = settings.compression_stiffness_max = 3500',
        'settings.shear_stiffness = settings.shear_stiffness_max = 15':
            'settings.shear_stiffness = settings.shear_stiffness_max = 1500',
    })
for before, after in changes.items():
    assert code.count(before) == 1, before
    code = code.replace(before, after)
exec(compile(code, str(source), 'exec'), {'__file__': str(source), '__name__': '__main__'})
