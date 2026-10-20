"""Verify the displayed complete cuffs and neckline still follow authored paths."""
import json
import sys
from pathlib import Path
import numpy as np

base = Path(__file__).parent
folder = base/(sys.argv[1] if len(sys.argv)>1 else 'ipc-display-physics')
partial = '--partial' in sys.argv
frames = json.loads((folder/('progress.json' if partial else 'summary.json')).read_text())
data = json.loads((base/'input/manifest.json').read_text())
cuffs = json.loads((base.parent/'morpheus-shoulder-release-2026-10-20/boundary-controls.json').read_text())['cuffs']
guide = json.loads((base/'lifted-band/collar-guide.json').read_text())
rest = np.c_[np.asarray(data['points']), np.ones(len(data['points']))]
times = np.asarray([frame['time'] for frame in data['frames']])
rows=[]
for frame in frames:
    number=frame['frame']
    p=np.fromfile(folder/f'cloth-{number}.bin',np.float32).reshape(-1,3)[:,[0,2,1]]/[.4,.4,-.4]
    at=frame['time']
    assert times[0]-1e-9 <= at <= times[-1]+1e-9
    upper=min(int(np.searchsorted(times,at,side='right')),len(times)-1)
    lower=max(0,upper-1)
    blend=float(np.clip((at-times[lower])/(times[upper]-times[lower]),0,1))
    worst=0.
    for cuff in cuffs:
        matrix=lambda index: np.asarray(next(v for v in data['frames'][index]['cuffs'] if v['side']==cuff['side'])['matrix']).reshape(4,4,order='F')
        expected=(rest[cuff['ring']]@((1-blend)*matrix(lower)+blend*matrix(upper)).T)[:,:3]
        worst=max(worst,float(np.linalg.norm(p[cuff['ring']]-expected,axis=1).max())*.4)
    neck_expected=(1-blend)*np.asarray(guide['frames'][lower]['points'])+blend*np.asarray(guide['frames'][upper]['points'])
    neck=float(np.linalg.norm(p[guide['ids']]-neck_expected,axis=1).max())*.4
    rows.append({'frame':number,'time':frame['time'],'maximumCuffErrorMetres':worst,'maximumNeckErrorMetres':neck})
(folder/('partial-boundary-results.json' if partial else 'boundary-results.json')).write_text(json.dumps(rows,indent=2))
print(json.dumps(rows,indent=2))
assert all(max(r['maximumCuffErrorMetres'],r['maximumNeckErrorMetres'])<.0001 for r in rows), 'the displayed boundaries left their validated paths'
