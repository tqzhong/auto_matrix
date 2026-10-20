"""Control: bind the original lapel facing to its front panel, without independent cloth."""
import json
from pathlib import Path

base = Path(__file__).parent
source = json.loads((base.parent/'morpheus-shoulder-release-2026-10-20/cage-fit-4.json').read_text())
lapel = set(source['parts'][1]['vertices'])
assert not lapel.intersection(source['mappedControls'].values())
retained = [i for i in range(len(source['points'])) if i not in lapel]
mapped = {old:new for new,old in enumerate(retained)}
indices = []
for start in range(0,len(source['indices']),3):
    face = source['indices'][start:start+3]
    inside = [vertex in lapel for vertex in face]
    assert all(inside) or not any(inside), 'a physical face spans independent panels'
    if not any(inside):
        indices.extend(mapped[vertex] for vertex in face)
result = {
    'points':[source['points'][i] for i in retained],
    'indices':indices,
    'mappedControls':{key:mapped[value] for key,value in source['mappedControls'].items()},
    'parts':[{'name':part['name'],'vertices':[mapped[i] for i in part['vertices'] if i in mapped]} for part in source['parts']],
    'metadata':{'control':'Original displayed lapel faces remain. Their motion comes from the front panel rather than a separate sewn physics strip.',
                'independentLapelPointsRemoved':len(lapel),'originalControls':len(source['mappedControls'])}
}
(base/'front-bound-cage.json').write_text(json.dumps(result))
print(json.dumps({'vertices':len(result['points']),'faces':len(indices)//3,**result['metadata']}))
