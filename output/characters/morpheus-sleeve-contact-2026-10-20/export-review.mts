import { mkdir, readFile, writeFile } from 'node:fs/promises';

const base = new URL('./', import.meta.url), output = new URL('runtime-meshes/', base);
const folder = process.argv[2] ?? 'ipc-bound-physics';
const frame = Number(process.argv[3] ?? 7);
const data = JSON.parse(await readFile(new URL('input/manifest.json', base), 'utf8'));
const positions = async (name: string) => {
  const bytes = await readFile(new URL(`${folder}/${name}-${frame}.bin`, base));
  const a = new Float32Array(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset+bytes.byteLength));
  return Array.from({length:a.length/3}, (_,i) => [a[3*i]/.4,a[3*i+2]/.4,-a[3*i+1]/.4]);
};
const cloth = await positions('cloth'), body = await positions('body');
let offset = 0;
const surfaces = data.bodyInitial.map((part: {name: string; vertices: number[][]}) => {
  const surface = {...part, vertices:body.slice(offset,offset+part.vertices.length),
    color: /Anatomical/.test(part.name) ? [.55,.33,.2] : [.05,.18,.36], side:2};
  offset += part.vertices.length; return surface;
});
for (const [i,part] of data.parts.entries()) surfaces.push({...data.surfaces[i],
  vertices:part.vertices.map((id: number) => cloth[id]), color:[.19,.28,.11], side:2});
await mkdir(output,{recursive:true});
for (const [view,eye] of [['front',[5,3.6,8]],['rear',[-5,3.6,-8]]] as const) {
  const label=`${folder.replaceAll('/', '-')}-${frame}-${view}`;
  await writeFile(new URL(`${label}.json`,output),JSON.stringify({width:720,height:900,eye,target:[0,2.7,0],fov:29,surfaces,
    renderSource:'COMPLETE GARMENT + ALL BODY LAYERS / DIAGNOSTIC MATERIAL'}));
}
