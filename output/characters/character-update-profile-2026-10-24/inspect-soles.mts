import {actor} from './candidate-release/tests/helpers/fighting-hand-fixture.mjs';
for (const id of ['neo','morpheus'] as const) {
 const h=await actor(id), sole=h.rig.dojoSoles!, a=sole.mesh.geometry.attributes;
 const unique=new Set(sole.indices.map(i=>['position','skinIndex','skinWeight'].flatMap(name=>Array.from({length:a[name].itemSize},(_,k)=>a[name].getComponent(i,k))).join(',')));
 console.log(JSON.stringify({id,vertices:sole.indices.length,unique:unique.size,morphs:Object.keys(sole.mesh.geometry.morphAttributes)}));h.models.dispose();
}
