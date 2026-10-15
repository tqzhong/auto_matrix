"""Gloria-era kitchen wardrobe on CC0 anatomy, retaining existing performance joints.

Requires the published oracle-first-head.glb before final neck fitting. Anatomy is
MakeHuman's independently morphed older female base; no actor body/face is copied.
The runtime supplies the original imagegen textile atlas and reuses the shipped
30-joint anatomical Oracle hands at the two open forearm rims.
"""
import argparse
import hashlib
import importlib.util
import json
from pathlib import Path
import struct

import numpy as np

ROOT = Path(__file__).resolve().parents[1]
def module(name, filename):
    spec = importlib.util.spec_from_file_location(name, Path(__file__).with_name(filename))
    result = importlib.util.module_from_spec(spec); spec.loader.exec_module(result); return result
builder = module('character_builder', 'build-characters.py')
dock = module('dock_builder', 'build-digger-bodies.py')
TARGETS = {'macrodetails/african-female-old': .85, 'macrodetails/african-female-young': .15}


def main(source, output, head):
    head_bytes = head.read_bytes(); head_length = struct.unpack_from('<I', head_bytes, 12)[0]
    head_metadata = json.loads(head_bytes[20:20 + head_length])['extras']
    base, uv, faces, groups = builder.obj(source / 'base.obj')
    for name, amount in TARGETS.items():
        values = np.array([line.split() for line in (source / (name + '.target')).read_text().splitlines() if line and not line.startswith('#')], dtype=float)
        if len(values): base[values[:, 0].astype(int)] += values[:, 1:] * amount
    rig = json.loads((source / 'default.mhskel').read_text())
    source_weights = json.loads((source / 'default_weights.mhw').read_text())['weights']
    def pivot(name): return base[rig['joints'][rig['bones'][name]['head']]].mean(axis=0)
    names = ['pelvis', 'torso', 'neck']; rest = [[0, 1.86, 0], [0, 1.86, 0], [0, 3.44, 0]]
    source_pivots = [(pivot('upperleg01.L') + pivot('upperleg01.R')) / 2, pivot('spine03'), pivot('neck01')]
    shoulder_x = .62 * .87
    for side, sign in [('R', -1), ('L', 1)]:
        for name, ref, p in [('shoulder', 'upperarm01', [sign * shoulder_x, 3.25, 0]),
                             ('elbow', 'lowerarm01', [sign * shoulder_x, 2.44, 0]),
                             ('wrist', 'wrist', [sign * shoulder_x, 1.79, 0]),
                             ('hip', 'upperleg01', [sign * .225, 1.86, 0]),
                             ('knee', 'lowerleg01', [sign * .225, .92, 0]),
                             ('ankle', 'foot', [sign * .225, .02, 0])]:
            names.append(name + '_' + side); rest.append(p); source_pivots.append(pivot(ref + '.' + side))
    rest, source_pivots = np.array(rest), np.array(source_pivots)
    def mapped(name):
        side = name.split('.')[-1]
        for prefix, target in [('upperarm', 'shoulder'), ('lowerarm', 'elbow'), ('wrist', 'wrist'), ('finger', 'wrist'), ('metacarpal', 'wrist'), ('upperleg', 'hip'), ('lowerleg', 'knee'), ('toe', 'ankle'), ('foot', 'ankle')]:
            if name.startswith(prefix): return names.index(target + '_' + side)
        if name.startswith(('neck', 'head', 'jaw', 'special', 'eye', 'tongue', 'levator', 'orbicularis', 'oris', 'temporalis', 'oculi', 'risorius')): return 2
        if name.startswith(('spine', 'clavicle', 'shoulder', 'breast')): return 1
        return 0
    weights = np.zeros((len(base), len(names)))
    for name, entries in source_weights.items():
        for vertex, value in entries: weights[vertex, mapped(name)] += value
    weights /= np.maximum(weights.sum(axis=1, keepdims=True), 1e-10)
    hip_source = source_pivots[0]
    matrices = np.tile(np.diag([shoulder_x / pivot('upperarm01.L')[0], 1.39 / (pivot('upperarm01.L')[1] - hip_source[1]), .29]), (len(names), 1, 1))
    source_pivots[1] = hip_source
    for side in ['R', 'L']:
        for part, endpoint, width in [('shoulder', 'elbow', .28), ('elbow', 'wrist', .25), ('hip', 'knee', .27), ('knee', 'ankle', .26)]:
            i, j = names.index(part + '_' + side), names.index(endpoint + '_' + side)
            a, b = source_pivots[j] - source_pivots[i], rest[j] - rest[i]; axis = builder.normalize(a)
            matrices[i] = builder.align(a, b) @ (np.eye(3) * width + np.outer(axis, axis) * (np.linalg.norm(b) / np.linalg.norm(a) - width))
        matrices[names.index('wrist_' + side)] = matrices[names.index('elbow_' + side)]
        matrices[names.index('ankle_' + side)] = np.diag([.28, .25, .28])
    translation = rest - np.einsum('nij,nj->ni', matrices, source_pivots)
    points = sum((base @ matrices[i].T + translation[i]) * weights[:, i:i + 1] for i in range(len(names)))
    faces = [face for face, group in zip(faces, groups) if group == 'body']
    points, uv, faces, weights = builder.trim_neckline(points, uv, faces, weights, 3.54)
    points, uv, faces, weights = builder.subdivide(points, uv, faces, weights)
    center, angles, radii = dock.head_neck_section(head.stem.removesuffix('-head'), head.parent)
    blend = np.clip((points[:, 1] - 3.27) / .23, 0, 1); blend = blend * blend * (3 - 2 * blend)
    theta = np.arctan2(points[:, 0] - center[0], points[:, 2] - center[1])
    radius = np.interp(theta, angles, radii, period=2 * np.pi) * .99
    fitted = np.column_stack((np.sin(theta), np.cos(theta))) * radius[:, None] + center
    points[:, [0, 2]] = points[:, [0, 2]] * (1 - blend[:, None]) + fitted * blend[:, None]
    weights *= 1 - blend[:, None]; weights[:, 2] += blend
    normal = dock.normals(points, faces); x, y, z = points.T
    arm_ids = [i for i, name in enumerate(names) if name.startswith(('shoulder', 'elbow', 'wrist'))]
    arms = weights[:, arm_ids].sum(axis=1)
    binaries = bytearray()
    doc = {'asset': {'version': '2.0', 'generator': 'auto_matrix/build-oracle-first-body.py'}, 'scene': 0,
           'scenes': [{'nodes': []}], 'nodes': [], 'meshes': [], 'materials': [], 'accessors': [], 'bufferViews': [],
           'extras': {'role': 'oracle-first', 'sourceRevision': builder.REVISION, 'targets': TARGETS, 'joints': names,
                      'sourceSha256': {name: hashlib.sha256((source / name).read_bytes()).hexdigest() for name in ['base.obj', 'default.mhskel', 'default_weights.mhw', *[key + '.target' for key in TARGETS]]},
                      'headSha256': hashlib.sha256(head_bytes).hexdigest(), 'handAsset': 'oracle-park-hands.glb',
                      'neckSample': head_metadata.get('neckSample', [.25, .445]),
                      'fitting': 'Independent older female CC0 anatomy, film-reference kitchen tailoring; approximate likeness, not a scan.'}}
    def accessor(a, kind, component=5126):
        a = np.asarray(a, dtype={5126: '<f4', 5123: '<u2', 5125: '<u4'}[component]); binaries.extend(b'\x00' * (-len(binaries) % 4))
        view = len(doc['bufferViews']); doc['bufferViews'].append({'buffer': 0, 'byteOffset': len(binaries), 'byteLength': a.nbytes}); binaries.extend(a.tobytes())
        entry = {'bufferView': view, 'componentType': component, 'count': len(a), 'type': kind}
        if kind != 'MAT4': entry.update(min=np.atleast_1d(a.min(axis=0)).tolist(), max=np.atleast_1d(a.max(axis=0)).tolist())
        doc['accessors'].append(entry); return len(doc['accessors']) - 1
    for name, point in zip(names, rest):
        doc['scenes'][0]['nodes'].append(len(doc['nodes'])); doc['nodes'].append({'name': name, 'translation': point.tolist()})
    inverse = np.tile(np.eye(4), (len(names), 1, 1)); inverse[:, :3, 3] = -rest
    doc['skins'] = [{'joints': list(range(len(names))), 'inverseBindMatrices': accessor(inverse.transpose(0, 2, 1).reshape(-1, 16), 'MAT4')}]
    for name, color, roughness in [('Oracle first skin', [.32, .18, .11], .8), ('Oracle floral', [.06, .18, .12], .78),
                                  ('Oracle emerald', [.012, .115, .075], .70), ('Oracle apron', [.42, .19, .075], .91),
                                  ('Oracle trousers', [.022, .026, .021], .92), ('Oracle shoes', [.023, .019, .015], .66)]:
        doc['materials'].append({'name': name, 'pbrMetallicRoughness': {'baseColorFactor': color + [1], 'metallicFactor': 0, 'roughnessFactor': roughness}, 'doubleSided': True})
    def export(name, p, tex, polygons, w, material, projected=False):
        n = dock.normals(p, polygons); lookup, pairs, indices = {}, [], []
        for face in polygons:
            for i in range(1, len(face) - 1):
                for pair in [face[0], face[i], face[i + 1]]:
                    key = (pair[0], *np.round(tex[pair[1]], 7))
                    if key not in lookup: lookup[key] = len(pairs); pairs.append(pair)
                    indices.append(lookup[key])
        vi, ui = np.array(pairs).T; joint = np.argsort(-w[vi], axis=1)[:, :4]; value = np.take_along_axis(w[vi], joint, axis=1); value /= value.sum(axis=1, keepdims=True)
        fitted_uv = np.column_stack((p[vi, 0] / 1.8 + .5, (p[vi, 1] - 1.35) / 2.15)) if projected else tex[ui]
        if name == 'oracle-first-anatomical-body':
            neck_uv = np.column_stack(((.0175 + p[vi, 0] * .10) / .035, np.clip(3.69 - p[vi, 1], 0, .2) * .03 / .012))
            blend = np.clip((p[vi, 1] - 3.10) / .18, 0, 1)[:, None]
            fitted_uv = fitted_uv * (1 - blend) + neck_uv * blend
        attrs = {'POSITION': accessor(p[vi], 'VEC3'), 'NORMAL': accessor(n[vi], 'VEC3'), 'TEXCOORD_0': accessor(fitted_uv, 'VEC2'), 'JOINTS_0': accessor(joint, 'VEC4', 5123), 'WEIGHTS_0': accessor(value, 'VEC4')}
        doc['scenes'][0]['nodes'].append(len(doc['nodes'])); doc['nodes'].append({'name': name, 'mesh': len(doc['meshes']), 'skin': 0})
        doc['meshes'].append({'name': name, 'primitives': [{'attributes': attrs, 'indices': accessor(indices, 'SCALAR', 5125), 'material': material}]})
        print(name, len(pairs), 'vertices', len(indices) // 3, 'triangles')
    # Retain real neck/forearms, including an open anatomical wrist rim. The
    # separate original hand skeleton supplies all five three-bone fingers.
    skin_p, skin_u, skin_f, skin_w = builder.trim_neckline(points, uv, faces, weights, np.where(arms > .25, 1.88, 3.08), above=True)
    export('oracle-first-anatomical-body', skin_p, skin_u, skin_f, skin_w, 0)
    blouse = points + normal * .038
    heights, sections = dock.cloth_sections(points, faces, arms, bottom=1.80, top=3.18)
    theta = np.mod(np.arctan2(x, z), np.pi * 2) / (np.pi * 2) * sections.shape[1]
    for i in np.flatnonzero((arms < .2) & (y > 1.75) & (y < 3.18)):
        a, t = int(theta[i]) % sections.shape[1], theta[i] % 1
        radius = np.interp(y[i], heights, sections[:, a] * (1 - t) + sections[:, (a + 1) % sections.shape[1]] * t) + .055
        angle = theta[i] / sections.shape[1] * np.pi * 2
        # Loose kitchen blouse bridges the waist instead of inheriting the
        # donor's hourglass silhouette; its side panels hang from the ribs.
        loose = 1 / np.sqrt((np.sin(angle) / .48) ** 2 + (np.cos(angle) / .365) ** 2)
        radius = max(radius, loose * np.clip((3.05 - y[i]) / .30, 0, 1))
        radius += .022 * np.sin(theta[i] * .35 + y[i] * 3) * np.clip((2.6 - y[i]) / .7, 0, 1)
        blouse[i, [0, 2]] = points[i, [0, 2]] / max(np.hypot(x[i], z[i]), 1e-8) * radius
    # Sleeve cloth has ease, restrained folds and a soft V opening. It never
    # pulls the shoulders into the neckline or traces breast/navel anatomy.
    blouse += normal * (.006 * np.sin(y * 22 + x * 9) * np.clip(arms, 0, 1))[:, None]
    # Below the waist the loose shirt overlaps the separate trousers. A skin
    # offset alone becomes smaller than the trouser surface at the hip bend.
    blouse += normal * (.035 * np.clip((2.08 - y) / .24, 0, 1) * (arms < .2))[:, None]
    neck_height = 3.53 - .23 * np.clip(1 - np.abs(x) / .25, 0, 1) * np.clip((z + .06) / .20, 0, 1)
    covered = np.minimum(neck_height - y, y - np.where(arms > .25, 1.98, 1.61))
    bp, bu, bf, bw = builder.trim_neckline(blouse, uv, faces, weights, blouse[:, 1] + covered)
    # The loose waist fabric follows the apron, not the donor's thighs. Leaving
    # thigh skin weights here pulls the blouse through the apron during the
    # cookie-offer hip counter-rotation, despite neutral-pose clearance.
    waist = np.clip((2.65 - bp[:, 1]) / .25, 0, 1) * (bw[:, arm_ids].sum(axis=1) < .2)
    waist_weights = np.zeros_like(bw); waist_weights[:, 1] = np.clip((bp[:, 1] - 1.75) / .65, 0, 1)
    waist_weights[:, 0] = 1 - waist_weights[:, 1]
    bw = bw * (1 - waist[:, None]) + waist_weights * waist[:, None]
    # Separate true fabric panels, rather than green paint over one torso mesh.
    floral, plain = [], []
    for face in bf:
        vi = [a for a, _ in face]; p = bp[vi].mean(axis=0); arm = bw[vi][:, arm_ids].sum(axis=1).mean()
        (plain if abs(p[0]) > .31 and arm < .30 or arm > .35 and p[1] < 2.12 else floral).append(face)
    export('oracle-first-floral-blouse', bp, bu, floral, bw, 1, True)
    export('oracle-first-emerald-panels', bp, bu, plain, bw, 2, True)
    # Closed polygon collar follows the actual blouse front, in two soft folds.
    def patch(name, corners, material, lift=.018):
        p, tex, faces, w = [], [], [], []
        for row in range(17):
            v = row / 16
            for col in range(9):
                u = col / 8; a = np.array(corners[0]) * (1-u) + np.array(corners[1]) * u; b = np.array(corners[3]) * (1-u) + np.array(corners[2]) * u
                px, py = a * (1-v) + b * v
                distance = (bp[:, 0]-px)**2 + (bp[:, 1]-py)**2 + np.where(bp[:, 2] < .03, 100, 0)
                nearby = np.argsort(distance)[:6]; mix = 1 / np.maximum(distance[nearby], 1e-7); mix /= mix.sum()
                p.append([px, py, bp[nearby, 2] @ mix + lift + .012 * np.sin(u*np.pi)*np.sin(v*np.pi)]);tex.append([u,v]);w.append((bw[nearby] * mix[:,None]).sum(axis=0))
                if row and col:
                    i=len(p)-1; faces.append([(j,j) for j in [i-10,i-9,i,i-1]])
        export(name,np.array(p),np.array(tex),faces,np.array(w),material,True)
    for sign in [-1, 1]:
        patch('oracle-first-collar-' + str(sign), [[sign*.11,3.54],[sign*.27,3.43],[sign*.29,3.23],[sign*.08,3.31]],1,.035)
    # Actual waist apron: no chest bib or neck straps. The loose lower portion
    # follows pelvis motion and overlaps the tunic with a measured clearance.
    ap, au, af, aw = [], [], [], []
    for row in range(35):
        t=row/34; py=2.40-t*1.55; half=.43+.15*np.sin(t*np.pi*.7)
        for col in range(41):
            u=col/40; px=(u*2-1)*half; pz=.41*np.sqrt(max(.15,1-(px/(half*1.13))**2))+.04+.018*np.sin(u*10*np.pi)*np.sin(t*np.pi/2)
            near=np.argsort((bp[:,0]-px)**2+(bp[:,1]-max(py,1.7))**2+np.where(bp[:,2]<0,100,0))[:8]
            if py>1.61: pz=max(pz,float(bp[near,2].max())+.028)
            w=np.zeros(len(names));w[0]=min(1,(2.4-py)/.65);w[1]=1-w[0]
            ap.append([px,py,pz]);au.append([u,1-t]);aw.append(w)
            if row and col:
                i=len(ap)-1;af.append([(j,j) for j in [i-42,i-41,i,i-1]])
    export('oracle-first-waist-apron',np.array(ap),np.array(au),af,np.array(aw),3)
    # Anatomy-based dark trousers and low closed shoes, with shared hip and
    # ankle weights. Feet remain at the authored stance and floor height.
    pants=points+normal*.035
    leg_faces=[face for face in faces if arms[[i for i,_ in face]].max() < .25]
    pp,pu,pf,pw=builder.trim_neckline(pants,uv,leg_faces,weights,1.93)
    pp,pu,pf,pw=builder.trim_neckline(pp,pu,pf,pw,.22,above=True)
    export('oracle-first-trousers',pp,pu,pf,pw,4)
    fp,fu,ff,fw=[],[],[],[]
    sections=[(-.105,.157,.354,.17),(-.075,.161,.358,.17),(-.055,.161,.357,.17),(.015,.155,.35,.17),(.10,.14,.30,.14),(.16,.12,.20,.06),(.23,.105,.16,0)]
    for side,sign in [('R',-1),('L',1)]:
        start=len(fp); w=np.zeros(len(names));w[names.index('ankle_'+side)]=1
        for row,(py,rx,rz,cz) in enumerate(sections):
            for col in range(65):
                theta=col/64*np.pi*2
                fp.append([sign*.225+np.sin(theta)*rx,py,cz+np.cos(theta)*rz]);fu.append([col/64,row/(len(sections)-1)]);fw.append(w)
                if row and col:
                    i=len(fp)-1;ff.append([(j,j) for j in [i-66,i-65,i,i-1]])
        fp.append([sign*.225,-.105,.17]);fu.append([.5,.5]);fw.append(w);center=len(fp)-1
        for col in range(64):ff.append([(j,j) for j in [center,start+col+1,start+col]])
    export('oracle-first-shoes',np.array(fp),np.array(fu),ff,np.array(fw),5)
    doc['buffers']=[{'byteLength':len(binaries)}];encoded=json.dumps(doc,separators=(',',':')).encode();encoded+=b' '*(-len(encoded)%4);binaries+=b'\0'*(-len(binaries)%4)
    result=struct.pack('<III',0x46546c67,2,28+len(encoded)+len(binaries))+struct.pack('<II',len(encoded),0x4e4f534a)+encoded+struct.pack('<II',len(binaries),0x004e4942)+binaries
    output.mkdir(parents=True,exist_ok=True);(output/'oracle-first-body.glb').write_bytes(result);print('written',len(result),'bytes')

if __name__=='__main__':
    parser=argparse.ArgumentParser();parser.add_argument('--source',type=Path,required=True);parser.add_argument('--output',type=Path,required=True);parser.add_argument('--head',type=Path,required=True);args=parser.parse_args();main(args.source,args.output,args.head)
