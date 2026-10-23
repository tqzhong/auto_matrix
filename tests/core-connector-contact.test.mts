import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import { coreConnector, wristSwing } from './helpers/core-connector.mjs';
import { handSurface } from './helpers/hand-surface.mjs';
import { crossings } from './helpers/hand-self-contact.mjs';
import { actor } from './helpers/fighting-hand-fixture.mjs';
import { advanceMotion, newMotion } from '../packages/client/src/agents/CharacterMotion.js';

function interior(point: THREE.Vector3, mesh: THREE.Mesh): number {
  const parameters = (mesh.geometry as THREE.CylinderGeometry).parameters;
  let depth = parameters.height / 2 - Math.abs(point.y);
  for (let side = 0; side < parameters.radialSegments; side++) {
    const angle = (side + .5) * Math.PI * 2 / parameters.radialSegments;
    depth = Math.min(depth, parameters.radiusTop * Math.cos(Math.PI / parameters.radialSegments) - point.x * Math.sin(angle) - point.z * Math.cos(angle));
  }
  return depth;
}

test('Morpheus reaches, inserts and releases the core connector without folding his wrist backwards', async t => {
  const h = await coreConnector(t), failures: unknown[] = [];
  let maximum = 0, previous: THREE.Vector3[] | undefined, largestStep = 0, largestAt: unknown;
  for (let frame = 0; frame <= 800; frame++) {
    const elapsed = frame / 100; h.at(elapsed);
    const angle = wristSwing(h.morpheus.rig.bones.get('wrist_R')!); maximum = Math.max(maximum, angle);
    if (angle > 70) failures.push({ elapsed, angle });
    const points = ['elbow_R', 'wrist_R'].map(name => h.morpheus.rig.bones.get(name)!.getWorldPosition(new THREE.Vector3()));
    if (previous) points.forEach((p, i) => { const step = p.distanceTo(previous![i]); if (step > largestStep) { largestStep = step; largestAt = { elapsed, joint: ['elbow_R','wrist_R'][i] }; } });
    previous = points;
  }
  t.diagnostic(JSON.stringify({ maximumWristSwing: maximum, largestJointStepPer10ms: largestStep, largestAt }));
  assert.deepEqual(failures, [], 'keep the same 70-degree wrist swing limit used for Neo’s physical tube grip');
  assert.ok(largestStep < .05, `a connector arm joint jumps ${largestStep} units in 10ms`);
});

test('the delivered hand surrounds the visible connector rather than passing through its grip or shaft', async t => {
  const h = await coreConnector(t), surface = handSurface(h.morpheus.rig, 'R'), failures: unknown[] = [], gaps: unknown[] = [];
  for (let frame = 44; frame <= 136; frame++) {
    const elapsed = frame / 20;
    const { plug } = h.at(elapsed), skin = h.groups.skin;
    const parts = plug.children.filter(o => o instanceof THREE.Mesh) as THREE.Mesh[];
    const fingertips = [Infinity,Infinity,Infinity,Infinity,Infinity];
    let maximumDepth = 0;
    for (const index of surface.vertices) {
      const world = skin.localToWorld(skin.getVertexPosition(index, new THREE.Vector3()));
      for (const mesh of parts) {
        const p = mesh.worldToLocal(world.clone()), depth = interior(p, mesh); maximumDepth = Math.max(maximumDepth, depth);
        const parameters = (mesh.geometry as THREE.CylinderGeometry).parameters;
        const distance = Math.hypot(Math.max(0,Math.hypot(p.x,p.z)-parameters.radiusTop),Math.max(0,Math.abs(p.y)-parameters.height/2));
        h.groups.tips.forEach((ids,digit) => { if (ids.includes(index)) fingertips[digit] = Math.min(fingertips[digit],distance); });
      }
    }
    if (maximumDepth > .003) failures.push({ elapsed, maximumDepth });
    if (elapsed >= 3 && elapsed <= 5.8 && fingertips.some(gap => gap > .04)) gaps.push({ elapsed, fingertips });
  }
  assert.deepEqual(failures, [], 'actual skinned vertices must stay outside the rendered cylinder faces within 0.003 world units');
  assert.deepEqual(gaps, [], 'all five delivered fingertip surfaces must reach the visible connector within 0.04 world units');
});

test('a saved connection clock reconstructs the same arm and fingers after out-of-order viewing', async t => {
  const h = await coreConnector(t), names = ['shoulder_R','elbow_R','wrist_R',...Array.from({length:5},(_,i)=>[1,2,3].map(j=>`finger${i+1}-${j}_R`)).flat()];
  const pose = (elapsed: number) => { h.at(elapsed); return names.map(name=>h.morpheus.rig.bones.get(name)!.quaternion.toArray()); };
  const expected = pose(4);
  for (const elapsed of [8,2.4,5.8,0,6.4,3]) pose(elapsed);
  const restored = pose(4);
  for (let i=0;i<names.length;i++) assert.ok(new THREE.Quaternion().fromArray(expected[i]).angleTo(new THREE.Quaternion().fromArray(restored[i])) < 1e-6, names[i]);
  const cold = await actor('morpheus'); t.after(() => cold.models.dispose());
  cold.rig.root.position.copy(h.morpheus.rig.root.position); cold.rig.root.quaternion.copy(h.morpheus.rig.root.quaternion);
  const { operatorInput } = h.at(4), motion = newMotion();
  cold.models.animate(cold.rig, advanceMotion(motion, operatorInput, 0), motion, operatorInput, 0); cold.rig.root.updateMatrixWorld(true);
  for (const [i,name] of names.entries()) assert.ok(cold.rig.bones.get(name)!.quaternion.angleTo(new THREE.Quaternion().fromArray(expected[i])) < 1e-6, `cold ${name}`);
});

test('the complete hand surface stays intact through the core grip and withdrawal', async t => {
  const h = await coreConnector(t), surface = handSurface(h.morpheus.rig, 'R');
  for (const elapsed of [2.2,2.35,2.5,2.65,2.8,2.9,3,3.4,4,4.6,5.8,5.9,6.05,6.2,6.4,6.6,6.8]) {
    const { plug } = h.at(elapsed), result = surface.draw();
    assert.equal(surface.vertices.length, 6673); assert.equal(surface.triangles.length, 12472);
    assert.equal(result.self.count, 0, `${elapsed}: ${JSON.stringify(result.self)}`);
    const inverse = h.morpheus.rig.bones.get('wrist_R')!.matrixWorld.clone().invert();
    for (const object of plug.children) if (object instanceof THREE.Mesh) {
      const geometry=object.geometry,index=geometry.index!,matrix=inverse.clone().multiply(object.matrixWorld);
      const faces=Array.from({length:index.count/3},(_,face)=>{
        const ids=[0,1,2].map(k=>index.getX(face*3+k)),points=ids.map(id=>new THREE.Vector3().fromBufferAttribute(geometry.attributes.position,id).applyMatrix4(matrix));
        return {face,ids,points,box:new THREE.Box3().setFromPoints(points)};
      });
      assert.equal(crossings(result.faces,faces,false).count,0,`${elapsed}: the actual connector triangles cut the hand surface`);
    }
  }
});

test('Morpheus’s connecting forearm does not pass through Neo’s physical chair', async t => {
  const h = await coreConnector(t), failures: unknown[] = [];
  for (let frame=44;frame<=136;frame++) {
    const elapsed=frame/20; h.at(elapsed);
    const elbow=h.morpheus.rig.bones.get('elbow_R')!.getWorldPosition(new THREE.Vector3());
    const wrist=h.morpheus.rig.bones.get('wrist_R')!.getWorldPosition(new THREE.Vector3()), direction=wrist.clone().sub(elbow);
    const hits=new THREE.Raycaster(elbow,direction.clone().normalize(),.02,direction.length()-.02).intersectObject(h.room.getObjectByName('neb-core-chair-neo')!,true);
    if(hits.length)failures.push({elapsed,objects:hits.map(hit=>hit.object.name||hit.object.parent!.name)});
  }
  assert.deepEqual(failures,[],'the connector approach and withdrawal need a clear route around the chair');
});

test('the core grip leaves the unrelated left-hand skin in its original binding', async t => {
  const h=await coreConnector(t),left=handSurface(h.morpheus.rig,'L');h.at(0);
  const snapshot=()=>Object.fromEntries(['position','normal','skinIndex','skinWeight'].map(name=>{
    const a=h.groups.skin.geometry.attributes[name];return[name,left.vertices.flatMap(id=>Array.from({length:a.itemSize},(_,k)=>a.getComponent(id,k)))];
  }));
  const original=snapshot();h.at(4);const current=snapshot();
  for(const name of Object.keys(original))assert.ok(current[name].every((value,i)=>value===original[name][i]),`${name}: the core grip must not reshape the other hand`);
});

test('the delivered outfit clears the backrest during Morpheus’s added lean', async t => {
  const h=await coreConnector(t),back=h.room.getObjectByName('neb-core-chair-neo-backrest') as THREE.Mesh;
  back.geometry.computeBoundingBox();const bounds=back.geometry.boundingBox!,failures:unknown[]=[];let vertices=0;
  for(const elapsed of [2,2.25,2.5,2.8,3,3.8,4.6,5.8,6.2,6.8]){
    h.at(elapsed);let maximumDepth=0;
    for(const part of h.morpheus.rig.wardrobe)if(part.mesh.visible&&part.mesh instanceof THREE.SkinnedMesh){
      const mesh=part.mesh;mesh.skeleton.update();
      for(let index=0;index<mesh.geometry.attributes.position.count;index++){
        const p=back.worldToLocal(mesh.localToWorld(mesh.getVertexPosition(index,new THREE.Vector3())));vertices++;
        maximumDepth=Math.max(maximumDepth,Math.min(p.x-bounds.min.x,bounds.max.x-p.x,p.y-bounds.min.y,bounds.max.y-p.y,p.z-bounds.min.z,bounds.max.z-p.z));
      }
    }
    if(maximumDepth>.003)failures.push({elapsed,maximumDepth});
  }
  assert.ok(vertices>10000,'check the delivered skinned outfit, not an empty proxy');
  assert.deepEqual(failures,[],'the closer shoulder must come from a clear body lean rather than clipping the backrest');
});
