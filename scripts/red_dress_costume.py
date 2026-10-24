"""Film-reference halter dress on the shared CC0, finger-articulated body.

All garment surfaces are real, weighted geometry. The lower skirt has two thigh
influences instead of a rigid cylinder. Source skin and hair maps remain CC0.
"""
import numpy as np


def dress_costume(points, faces, weights, names, pivots, from_game, export, clothing, material, hair, eyes):
    arm_ids = [i for i, name in enumerate(names) if name.startswith(('shoulder', 'elbow', 'wrist', 'finger'))]
    trunk = weights[:, arm_ids].sum(axis=1) < .2
    triangles = np.array([[face[0][0], face[i][0], face[i + 1][0]] for face in faces for i in range(1, len(face) - 1)])
    skin_edges = np.unique(np.sort(np.concatenate([triangles[:, [0, 1]], triangles[:, [1, 2]], triangles[:, [2, 0]]]), axis=1), axis=0)
    skin_a, skin_b = points[skin_edges[:, 0]], points[skin_edges[:, 1]]
    triangles = triangles[trunk[triangles].all(axis=1)]
    edges = np.unique(np.sort(np.concatenate([triangles[:, [0, 1]], triangles[:, [1, 2]], triangles[:, [2, 0]]]), axis=1), axis=0)
    a, b = points[edges[:, 0]], points[edges[:, 1]]
    knee = pivots[names.index('knee.L'), 1]
    hip = pivots[0, 1]
    shoulder = pivots[names.index('shoulder.L'), 1]
    hem, waist, top = knee - .10, hip + .34, shoulder - .06
    angles = np.linspace(-np.pi, np.pi, 65)

    def section(y, collar=False):
        first, second = (skin_a, skin_b) if collar else (a, b)
        cross = ((first[:, 1] <= y) & (second[:, 1] > y)) | ((first[:, 1] > y) & (second[:, 1] <= y))
        aa, bb = first[cross], second[cross]
        t = (y - aa[:, 1]) / (bb[:, 1] - aa[:, 1])
        sample = aa + (bb - aa) * t[:, None]
        # A skirt encloses both legs. Sorting the individual leg rings by
        # polar angle samples the inside of the thighs and folds cloth into
        # the gap. Build the outer convex envelope before radial sampling.
        planar = sorted(set(map(tuple, sample[:, [0, 2]])))
        def cross(o, a, b): return (a[0]-o[0])*(b[1]-o[1])-(a[1]-o[1])*(b[0]-o[0])
        lower, upper = [], []
        for point in planar:
            while len(lower)>1 and cross(lower[-2],lower[-1],point)<=0: lower.pop()
            lower.append(point)
        for point in reversed(planar):
            while len(upper)>1 and cross(upper[-2],upper[-1],point)<=0: upper.pop()
            upper.append(point)
        hull = sample[:, [0, 2]] if collar else np.array(lower[:-1]+upper[:-1])
        theta = np.arctan2(hull[:, 0], hull[:, 1])
        radius = np.hypot(hull[:, 0], hull[:, 1])
        order = np.argsort(theta)
        return np.interp(angles, theta[order], radius[order], period=2 * np.pi)

    def body_weights(y, theta):
        if y < hip + .14:
            side = np.clip(.5 + np.sin(theta) / .22, 0, 1)
            legs = np.clip((hip + .14 - y) / .38, 0, 1)
            w = np.zeros(len(names)); w[0] = 1 - legs
            w[names.index('hip.L')] = legs * side
            w[names.index('hip.R')] = legs * (1 - side)
        else:
            w = np.zeros(len(names)); chest = np.clip((y - waist) / .65, 0, 1)
            lower = np.clip((waist - y) / .35, 0, 1)
            w[0], w[1], w[2] = lower, (1 - lower) * (1 - chest), (1 - lower) * chest
        return w

    p, uv, w, polygons = [], [], [], []
    for row in range(49):
        v = row / 48
        for col, theta in enumerate(angles):
            front, back = max(0, np.cos(theta)), max(0, -np.cos(theta))
            edge = top - .10 * front ** 2 - .30 * back ** 2
            y = hem + (edge - hem) * v
            radius = section(y)[col]
            # Extra room at the knees accommodates a normal walking stride.
            ease = .035 + .035 * np.clip((waist - y) / (waist - hem), 0, 1)
            radius += ease
            fold = .010 * np.sin(y * 19 + theta * 2) * front * np.sin(v * np.pi)
            p.append([np.sin(theta) * radius, y, np.cos(theta) * (radius + fold)])
            uv.append([col / 64, v]); w.append(body_weights(y, theta))
            if row and col:
                i = row * 65 + col
                polygons.append([(j, j) for j in [i - 66, i - 65, i, i - 1]])
    p, uv, w = np.array(p), np.array(uv), np.array(w)
    for row in range(49):
        p[row*65+64] = p[row*65]; w[row*65+64] = w[row*65]
    satin = material('Red satin', [.55, .009, .018, 1], .38)
    export('Red dress satin', from_game(p, w), uv, polygons, w, satin)

    # A separate soft cowl turns down from the neckline. Its draped horizontal
    # folds bridge the bust instead of painting a red area over the skin.
    cp, cu, cw, cf = [], [], [], []
    for row in range(9):
        v = row / 8
        for col in range(33):
            theta = -1.05 + col / 32 * 2.10
            ring = np.array([np.interp(theta, angles, p[-65:, axis]) for axis in range(3)])
            ring[1] -= .24 * v * np.cos(theta)
            outward = .014 + .048 * np.sin(v * np.pi * 2.4) ** 2 * np.cos(theta)
            radius = np.interp(theta, angles, section(ring[1])) + .04 + outward
            ring[[0, 2]] = np.array([np.sin(theta), np.cos(theta)]) * radius
            cp.append(ring); cu.append([col / 32, v]); cw.append(body_weights(ring[1], theta))
            if row and col:
                i = row * 33 + col; cf.append([(j, j) for j in [i - 34, i - 33, i, i - 1]])
    cp, cu, cw = np.array(cp), np.array(cu), np.array(cw)
    export('Red dress cowl', from_game(cp, cw), cu, cf, cw, satin)

    # The two straps lead around the neck, leaving the shoulders and upper
    # back bare. Samples have actual torso/head weights, never arm weights.
    for sign in [-1, 1]:
        theta = sign * .83
        start = np.array([np.interp(theta, angles, p[-65:, axis]) for axis in range(3)])
        sp, su, sw, sf = [], [], [], []
        for row in range(25):
            v = row / 24
            rise = min(1, v*2); rise = rise*rise*(3-2*rise)
            wrap = max(0, v*2-1); wrap = wrap*wrap*(3-2*wrap)
            y = start[1] + (shoulder+.30-start[1])*rise
            angle = sign * (.83 + (np.pi-.83)*wrap)
            radii = section(y, collar=True); radius = np.interp(angle, angles, radii)
            for col in range(3):
                theta = angle + (col/2-.5)*.09/radius
                distance = np.interp(theta, angles, radii, period=2*np.pi) + .025
                sp.append([np.sin(theta)*distance,y,np.cos(theta)*distance]); su.append([col/2, v])
                influence = np.zeros(len(names)); influence[2], influence[3] = 1 - v * .65, v * .65; sw.append(influence)
                if row and col:
                    i = row * 3 + col; sf.append([(j,j) for j in [i-4,i-3,i,i-1]])
        sp, su, sw = np.array(sp), np.array(su), np.array(sw)
        export('Red dress halter ' + str(sign), from_game(sp, sw), su, sf, sw, satin)

    # Smooth closed toe boxes, shaped openings and real heels. A skin offset
    # would reproduce every toe and look like a painted bare foot.
    leather = material('Red pumps', [.32,.004,.012,1], .27)
    sole = material('Pump soles', [.025,.018,.014,1], .78)
    pp, pu, pw, pf, sole_faces, heels, heel_uv, heel_w, heel_faces = [], [], [], [], [], [], [], [], []
    for side in ['R','L']:
        joint = names.index('ankle.'+side); cx = pivots[joint,0]
        influence = np.eye(len(names))[joint]
        start = len(pp)
        for row in range(33):
            z = -.15 + row / 32 * .73
            width = np.interp(z,[-.15,-.11,-.04,.08,.21,.33,.43,.51,.58],[.006,.10,.12,.115,.15,.155,.14,.09,.006])
            height = np.interp(z,[-.15,-.07,.08,.22,.4,.51,.58],[.08,.27,.26,.22,.16,.10,.03])
            center = cx + np.sign(cx) * .02 * np.clip(z / .2, 0, 1)
            for col in range(25):
                angle = col/24*np.pi*2
                p = np.array([center+np.sin(angle)*width, -.012 + (np.cos(angle)+1)*height/2,z])
                pp.append(p);pu.append([col/24,row/32]);pw.append(influence)
        for row in range(1,33):
            for col in range(1,25):
                i = start + row*25+col
                face = [i-26,i-25,i,i-1]
                # Clip the ankle opening along an ellipse, retaining the
                # rim rather than selecting whole jagged triangles.
                polygon = [(pp[j],pu[j]) for j in face]
                clipped = []
                def edge(p): return max(((p[0]-cx)/.105)**2+((p[2]+.005)/.145)**2-1,(.17-p[1])*15)
                for current,previous in zip(polygon,polygon[-1:]+polygon[:-1]):
                    a,b = edge(current[0]),edge(previous[0])
                    if (a>=0)!=(b>=0):
                        t=b/(b-a);clipped.append((previous[0]+(current[0]-previous[0])*t,np.array(previous[1])+(np.array(current[1])-previous[1])*t))
                    if a>=0:clipped.append(current)
                if len(clipped)>=3:
                    out=[]
                    for point,tex in clipped:
                        out.append((len(pp),len(pp)));pp.append(point);pu.append(tex);pw.append(influence)
                    (sole_faces if np.cos((col-.5)/24*np.pi*2)<-.82 else pf).append(out)
        for row in [0,32]:
            indices=[start+row*25+i for i in range(24)]
            if row==0:indices.reverse()
            pf.append([(i,i)for i in indices])
        hp=[];base=len(heels)
        for row in range(2):
            for col in range(13):
                theta=col/12*np.pi*2;radius=.040 if row==0 else .069
                hp.append([cx+np.sin(theta)*radius,-.18+row*.18,-.073+np.cos(theta)*radius])
                heel_uv.append([col/12,row]);heel_w.append(influence)
                if row and col:
                    i=base+row*13+col;heel_faces.append([(j,j)for j in [i-14,i-13,i,i-1]])
        heels.extend(hp)
        heel_faces.append([(base+i,base+i)for i in reversed(range(12))])
    pp,pu,pw=np.array(pp),np.array(pu),np.array(pw)
    # Rows advance along Z, unlike the dress's Y rows. Reverse the winding
    # so the opaque toe box presents its outside to the camera.
    export('Red dress pumps',from_game(pp,pw),pu,[list(reversed(f)) for f in pf],pw,leather)
    export('Red dress outsoles',from_game(pp,pw),pu,[list(reversed(f)) for f in sole_faces],pw,sole)
    hp,hu,hw=np.array(heels),np.array(heel_uv),np.array(heel_w)
    export('Red dress heels',from_game(hp,hw),hu,heel_faces,hw,leather)

    # Refit the CC0 long-hair cards to the film's shoulder-length waves. The
    # cap/parting stays in place; only lengths below the ears are shortened.
    hp, hu, hf, hw = clothing('hair/long01','long01')
    # Source coordinates are retained here; height is fitted before the
    # normal export transform, along the same anatomical head as the face.
    # Obtain the source head height using the inverse authoring transform.
    head_center = from_game(pivots[3:4],np.eye(len(names))[3:4])[0]
    low = hp[:,1] < head_center[1] - .25
    hp[low,1] = head_center[1] - .25 + (hp[low,1] - head_center[1] + .25) * .34
    wave = np.clip((head_center[1] + .1 - hp[:,1]) / 1.3,0,1)
    hp[:,0] += np.sign(hp[:,0]) * .11 * np.sin((hp[:,1]-head_center[1])*5.5) * wave
    hp[:,2] += .09 * np.sin((hp[:,1]-head_center[1])*6.1 + hp[:,0]) * wave
    export('Red dress hair',hp,hu,hf,hw,hair)
    ep, eu, ef, ew = clothing('eyes/high-poly','high-poly')
    export('Red dress eyes',ep,eu,ef,ew,eyes)
