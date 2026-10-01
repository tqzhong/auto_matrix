import * as THREE from 'three';

/** Receiver and earpieces; the wall base stays in the shop when Neo lifts it. */
export class HardlineHandset {
  readonly root=new THREE.Group();
  private shell=new THREE.MeshStandardMaterial({color:0x272b22,roughness:.55});
  private rubber=new THREE.MeshStandardMaterial({color:0x121611,roughness:.9});
  constructor(){
    this.root.name='hardline-handset';
    const bar=new THREE.Mesh(new THREE.CapsuleGeometry(.07,.46,5,12),this.shell);this.root.add(bar);
    for(const y of [-.31,.31]){
      const cup=new THREE.Mesh(new THREE.SphereGeometry(.14,14,10),this.shell);cup.position.set(0,y,.045);cup.scale.set(1,1,.65);this.root.add(cup);
      const face=new THREE.Mesh(new THREE.CylinderGeometry(.105,.105,.025,12),this.rubber);face.rotation.x=Math.PI/2;face.position.set(0,y,.13);this.root.add(face);
    }
    this.root.traverse(object=>{if(object instanceof THREE.Mesh)object.castShadow=object.receiveShadow=true;});
  }
  dispose(){this.root.traverse(object=>{if(object instanceof THREE.Mesh)object.geometry.dispose();});this.shell.dispose();this.rubber.dispose();this.root.removeFromParent();}
}
