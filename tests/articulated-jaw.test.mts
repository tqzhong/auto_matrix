import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import { ArticulatedJaw } from '../packages/client/src/agents/ArticulatedJaw.js';

test('dental articulation remains rigid at intermediate opening and independent of soft lip closure', () => {
  const root = new THREE.Group(), head = new THREE.Bone(), jaw = new THREE.Bone();
  head.name = 'head'; jaw.name = 'jaw'; jaw.position.set(0, .1, .05); root.add(head); head.add(jaw);
  const face = new THREE.Mesh(new THREE.BufferGeometry()); face.name = 'face';
  face.morphTargetDictionary = { jawOpen: 0, mouthClose: 1, jawLeft: 2 };
  face.morphTargetInfluences = [0, 0, 0]; root.add(face);
  const open = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), .6);
  const side = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), .04);
  const driver = new ArticulatedJaw({ root, bones: new Map([['head', head], ['jaw', jaw]]) }, {
    bone: 'jaw', sourceMesh: 'face', poses: {
      jawOpen: { rotation: open.toArray(), translation: [0, -.01, .005] },
      jawLeft: { rotation: side.toArray(), translation: [.01, 0, 0] },
    },
  });
  const points = [new THREE.Vector3(-.04, -.12, .18), new THREE.Vector3(.04, -.12, .18), new THREE.Vector3(0, -.1, .2)];
  for (const amount of [0, .25, .5, .75, 1]) {
    face.morphTargetInfluences[0] = amount; face.morphTargetInfluences[1] = 0; driver.update(); root.updateMatrixWorld(true);
    const before = points.map(p => jaw.localToWorld(p.clone()));
    assert.ok(jaw.quaternion.angleTo(new THREE.Quaternion().slerp(open, amount)) < 1e-7);
    assert.ok(Math.abs(before[0].distanceTo(before[1]) - .08) < 1e-12, 'teeth cannot shrink while interpolating');
    face.morphTargetInfluences[1] = amount; driver.update(); root.updateMatrixWorld(true);
    points.forEach((p, i) => assert.ok(jaw.localToWorld(p.clone()).distanceTo(before[i]) < 1e-12, 'soft lip closure cannot drag the jaw back to rest'));
    driver.update(); root.updateMatrixWorld(true);
    points.forEach((p, i) => assert.ok(jaw.localToWorld(p.clone()).distanceTo(before[i]) < 1e-12, 'repeated frames must not accumulate articulation'));
  }
  face.morphTargetInfluences = [.5, .5, 1]; driver.update(); root.updateMatrixWorld(true);
  const local = jaw.worldToLocal(points[0].clone()); head.rotation.y = .7; root.updateMatrixWorld(true);
  assert.ok(head.worldToLocal(jaw.localToWorld(local)).distanceTo(points[0]) < 1e-10, 'the head transform is applied once');
  face.morphTargetInfluences.fill(0); driver.update();
  assert.ok(jaw.position.distanceTo(new THREE.Vector3(0, .1, .05)) < 1e-12);
  assert.ok(jaw.quaternion.angleTo(new THREE.Quaternion()) < 1e-12);
});

test('authored closure correctives follow jaw/lip controls on both surfaces and clear on release', () => {
  const root=new THREE.Group(),jaw=new THREE.Bone();jaw.name='jaw';root.add(jaw);
  const face=new THREE.Mesh(new THREE.BufferGeometry()),lining=new THREE.Mesh(new THREE.BufferGeometry());
  face.name='face';lining.name='lining';root.add(face,lining);
  face.morphTargetDictionary={jawOpen:0,mouthClose:1,closeA:2,closeB:3};face.morphTargetInfluences=[0,0,0,0];
  lining.morphTargetDictionary={closeB:0,closeA:1};lining.morphTargetInfluences=[0,0];
  const driver=new ArticulatedJaw({root,bones:new Map([['jaw',jaw]])},{bone:'jaw',sourceMesh:'face',poses:{jawOpen:{rotation:[0,0,0,1],translation:[0,-.1,0]}},closureCorrectives:{meshNames:['face','lining'],samples:[{amount:0,target:'closeA'},{amount:1,target:'closeB'}]}});
  for(const opening of [0,.25,.5,.75,1])for(const close of [0,.5,1]){
    face.morphTargetInfluences[0]=opening;face.morphTargetInfluences[1]=close;driver.update();
    const expected=[opening*close*(1-opening),opening*close*opening];
    assert.ok(face.morphTargetInfluences.slice(2).every((v,i)=>v===expected[i]));
    assert.ok(lining.morphTargetInfluences.every((v,i)=>v===expected[1-i]),'each mesh uses its own dictionary');
    assert.ok(Math.abs(jaw.position.y+.1*opening)<1e-12,'correctives cannot move the dental jaw');
    driver.update();assert.ok(face.morphTargetInfluences.slice(2).every((v,i)=>v===expected[i]),'no accumulated correction');
  }
  face.morphTargetInfluences[0]=0;face.morphTargetInfluences[1]=1;driver.update();
  assert.deepEqual(face.morphTargetInfluences.slice(2),[0,0]);assert.deepEqual(lining.morphTargetInfluences,[0,0]);
});

test('lip pose correction preserves authored skinned displacement and clears after jaw or lip release', () => {
  const root=new THREE.Group(),head=new THREE.Bone(),jaw=new THREE.Bone();jaw.name='jaw';head.add(jaw);root.add(head);
  const skeleton=new THREE.Skeleton([head,jaw]);
  const deltas:Record<string,number[]>={jawOpen:[0,0,0],mouthClose:[0,0,0],mouthPucker:[0,0,.02],openLip:[0,.02,-.02],closedLip:[0,.01,-.02]};
  function surface(name:string,order:string[]){
    const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute([0,0,0,.01,0,0,0,.01,0],3));
    geometry.setAttribute('skinIndex',new THREE.Uint16BufferAttribute([1,0,0,0,1,0,0,0,1,0,0,0],4));geometry.setAttribute('skinWeight',new THREE.Float32BufferAttribute([1,0,0,0,1,0,0,0,1,0,0,0],4));
    geometry.morphTargetsRelative=true;geometry.morphAttributes.position=order.map(key=>new THREE.Float32BufferAttribute([...deltas[key],...deltas[key],...deltas[key]],3));
    const mesh=new THREE.SkinnedMesh(geometry);mesh.name=name;mesh.morphTargetDictionary=Object.fromEntries(order.map((key,i)=>[key,i]));mesh.morphTargetInfluences=order.map(()=>0);root.add(mesh);mesh.bind(skeleton);return mesh;
  }
  const face=surface('face',['jawOpen','mouthClose','mouthPucker','openLip','closedLip']),lining=surface('lining',['closedLip','mouthPucker','openLip','jawOpen','mouthClose']);
  const driver=new ArticulatedJaw({root,bones:new Map([['jaw',jaw]])},{bone:'jaw',sourceMesh:'face',poses:{jawOpen:{rotation:new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1,0,0),Math.PI/2).toArray(),translation:[0,0,0]}},lipPoseCorrectives:{meshNames:['face','lining'],openingSamples:[0,1],closingRatioSamples:[0,1],shapes:[{control:'mouthPucker',targets:[[null,null],['openLip','closedLip']]}]}});
  function pose(opening:number,closing:number,amount:number){
    for(const mesh of [face,lining])for(const [name,value]of Object.entries({jawOpen:opening,mouthClose:closing,mouthPucker:amount}))mesh.morphTargetInfluences![mesh.morphTargetDictionary![name]]=value;
    driver.update();root.updateMatrixWorld(true);skeleton.update();
    return [face,lining].map(mesh=>mesh.getVertexPosition(0,new THREE.Vector3()));
  }
  for(const amount of [1,.5])for(const closing of [0,.5,1]){
    const points=pose(1,closing,amount),depth=amount*(.02-.01*closing);
    for(const p of points)assert.ok(Math.abs(p.y)<1e-7&&Math.abs(p.z-depth)<1e-7,'the authored pose must correct the actual skinned lip, not rotate it through the jaw');
    assert.equal(face.morphTargetInfluences![2],amount,'the full lip control is retained');
    const repeated=pose(1,closing,amount);points.forEach((p,i)=>assert.ok(p.distanceTo(repeated[i])<1e-12));
  }
  for(const p of pose(.5,0,1))assert.ok(Math.abs(p.y)<1e-7&&Math.abs(p.z-Math.SQRT2*.01)<1e-7,'intermediate jaw samples blend their authored pose');
  for(const p of pose(0,1,1))assert.ok(Math.abs(p.y)<1e-7&&Math.abs(p.z-.02)<1e-7);
  for(const mesh of [face,lining])for(const name of ['openLip','closedLip'])assert.equal(mesh.morphTargetInfluences![mesh.morphTargetDictionary![name]],0,'jaw release clears old pose weights');
  pose(1,.5,1);for(const p of pose(1,.5,0))assert.ok(p.length()<1e-12,'lip release clears pose correction while the jaw remains open');
});

test('independent closure uses authored linear poses at every jaw opening without moving the dental joint', () => {
  const root=new THREE.Group(),head=new THREE.Bone(),jaw=new THREE.Bone();jaw.name='jaw';head.add(jaw);root.add(head);
  const skeleton=new THREE.Skeleton([head,jaw]),base=new THREE.Vector3(0,-.03,.02),compression=new THREE.Vector3(0,0,-.001),closed=base.clone().add(compression);
  const knots=[0,.5,1],controls=['jawOpen','mouthClose','close0','closeHalf','closeFull'];
  const deltas=[new THREE.Vector3(),compression,...knots.map(opening=>closed.clone().applyAxisAngle(new THREE.Vector3(1,0,0),-Math.PI/2*opening).sub(base).sub(compression))];
  function surface(name:string,order:number[]){
    const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute([...base.toArray(),0,-.02,.02,.01,-.03,.02],3));
    geometry.setAttribute('skinIndex',new THREE.Uint16BufferAttribute([1,0,0,0,1,0,0,0,1,0,0,0],4));geometry.setAttribute('skinWeight',new THREE.Float32BufferAttribute([1,0,0,0,1,0,0,0,1,0,0,0],4));
    geometry.morphTargetsRelative=true;geometry.morphAttributes.position=order.map(i=>new THREE.Float32BufferAttribute([...deltas[i].toArray(),...deltas[i].toArray(),...deltas[i].toArray()],3));
    const mesh=new THREE.SkinnedMesh(geometry);mesh.name=name;mesh.morphTargetDictionary=Object.fromEntries(order.map((i,k)=>[controls[i],k]));mesh.morphTargetInfluences=order.map(()=>0);root.add(mesh);mesh.bind(skeleton);return mesh;
  }
  const face=surface('face',[0,1,2,3,4]),lining=surface('lining',[4,1,3,0,2]);
  const driver=new ArticulatedJaw({root,bones:new Map([['jaw',jaw]])},{bone:'jaw',sourceMesh:'face',poses:{jawOpen:{rotation:new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1,0,0),Math.PI/2).toArray(),translation:[0,0,0]}},closureCorrectives:{meshNames:['face','lining'],interpolation:'linear',samples:knots.map((amount,i)=>({amount,target:controls[i+2]}))}});
  for(const opening of knots)for(const closing of [0,.5,1]){
    for(const mesh of [face,lining])for(const [name,value]of Object.entries({jawOpen:opening,mouthClose:closing}))mesh.morphTargetInfluences![mesh.morphTargetDictionary![name]]=value;
    driver.update();root.updateMatrixWorld(true);skeleton.update();
    const expected=base.clone().applyAxisAngle(new THREE.Vector3(1,0,0),Math.PI/2*opening).lerp(closed,closing);
    for(const mesh of [face,lining])assert.ok(mesh.getVertexPosition(0,new THREE.Vector3()).distanceTo(expected)<2e-8,'full lip closure must work independently of the jaw amount');
    assert.ok(jaw.quaternion.angleTo(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1,0,0),Math.PI/2*opening))<1e-7,'the jaw stays open while the lips close');
    const previous=face.morphTargetInfluences!.slice();driver.update();assert.deepEqual(face.morphTargetInfluences,previous);
  }
  face.morphTargetInfluences![1]=0;driver.update();for(const mesh of [face,lining])for(const name of controls.slice(2))assert.equal(mesh.morphTargetInfluences![mesh.morphTargetDictionary![name]],0,'closing release clears every pose target');
});

test('lip pose tables can use independent closing amount rather than closing divided by opening', () => {
  const root=new THREE.Group(),jaw=new THREE.Bone(),face=new THREE.Mesh(new THREE.BufferGeometry());jaw.name='jaw';face.name='face';root.add(jaw,face);face.morphTargetDictionary={jawOpen:0,mouthClose:1,mouthPucker:2,restClose:3,open:4,closed:5};face.morphTargetInfluences=[.25,.5,1,0,0,0];
  const driver=new ArticulatedJaw({root,bones:new Map([['jaw',jaw]])},{bone:'jaw',sourceMesh:'face',poses:{jawOpen:{rotation:[0,0,0,1],translation:[0,0,0]}},lipPoseCorrectives:{meshNames:['face'],openingSamples:[0,1],closingRatioSamples:[0,1],closingParameter:'amount',shapes:[{control:'mouthPucker',targets:[[null,'restClose'],['open','closed']]}]}});
  driver.update();assert.deepEqual(face.morphTargetInfluences.slice(3),[.375,.125,.125]);face.morphTargetInfluences[1]=0;driver.update();assert.deepEqual(face.morphTargetInfluences.slice(3),[0,.25,0]);
});
