"""Single-variable control: lower the neckline during the body's withdrawal phase."""
import json
import sys
from pathlib import Path

base = Path(__file__).parent
guide = json.loads((base.parent/'morpheus-shoulder-release-2026-10-20/collar-guide.json').read_text())
margin = '--margin' in sys.argv
start = 1.05 if margin else .8
output = Path(sys.argv[sys.argv.index('--output')+1]) if '--output' in sys.argv else base/'margin-collar' if margin else base
output.mkdir(exist_ok=True)
if '--input' in sys.argv:
    guide['source'] = sys.argv[sys.argv.index('--input')+1]
elif output != base:
    guide['source'] = '../../morpheus-withdrawal-path-2026-10-20/clearance-input'
def smooth(time,start,end):
    t = min(1,max(0,(time-start)/(end-start)))
    return t*t*t*(t*(t*6-15)+10)

for frame in guide['frames']:
    offset = -1.25*(smooth(frame['time'],start,3)-smooth(frame['time'],1.35,2.8))
    if margin:
        offset += .002*smooth(frame['time'],.8,.92)*(1-smooth(frame['time'],1,1.2))
    for point in frame['points']:
        point[1] += offset
guide['control'] = f'Vertical descent {start}–3 s instead of 1.35–2.8 s. Body, neckline edge lengths and backward opening unchanged.'
if margin:
    guide['control'] += ' A 0.8 mm vertical lift between 0.8 and 1.2 s provides clearance around the shoulder.'
(output/'collar-guide.json').write_text(json.dumps(guide))
print(json.dumps({'frames':len(guide['frames']),'controls':len(guide['ids']),'control':guide['control']}))
