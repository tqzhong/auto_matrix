import * as THREE from 'three';

/** Receiver and earpieces; the wall base stays in the shop when Neo lifts it. */
export class HardlineHandset {
  readonly root=new THREE.Group();
  private shell=new THREE.MeshStandardMaterial({color:0x272b22,roughness:.55});
  private rubber=new THREE.MeshStandardMaterial({color:0x121611,roughness:.9});
  constructor(){
    this.root.name='hardline-handset';
    const bar=new THREE.Mesh(new THREE.CapsuleGeometry(.07,.46,5,12),this.shell);this.root.add(bar);
    const plate=new THREE.Shape();plate.absarc(0,0,.105,0,Math.PI*2,false);
    for(let row=-2;row<=2;row++)for(let col=-2;col<=2;col++){
      if(row*row+col*col>5)continue;
      const hole=new THREE.Path();hole.absarc(col*.029,row*.029,.008,0,Math.PI*2,true);plate.holes.push(hole);
    }
    const faceGeometry=new THREE.ExtrudeGeometry(plate,{depth:.019,curveSegments:12,bevelEnabled:false});
    for(const y of [-.31,.31]){
      const cup=new THREE.Mesh(new THREE.SphereGeometry(.14,14,10),this.shell);cup.position.set(0,y,.045);cup.scale.set(1,1,.65);this.root.add(cup);
      const face=new THREE.Mesh(faceGeometry,this.rubber);
      face.position.set(0,y,.1235);this.root.add(face);
    }
    this.root.traverse(object=>{if(object instanceof THREE.Mesh)object.castShadow=object.receiveShadow=true;});
  }
  dispose(){
    const geometries=new Set<THREE.BufferGeometry>();
    this.root.traverse(object=>{if(object instanceof THREE.Mesh)geometries.add(object.geometry);});
    geometries.forEach(geometry=>geometry.dispose());
    this.shell.dispose();this.rubber.dispose();this.root.removeFromParent();
  }
}
