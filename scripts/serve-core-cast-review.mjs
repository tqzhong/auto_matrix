import {createServer} from 'vite';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {stabilizeReviewLayout} from '../output/characters/core-cast-six-hour-2026-10-25/neutral-head-workflow/trinity-reference-performance/review-layout-fix.mjs';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const folder='output/characters/core-cast-six-hour-2026-10-25/neutral-head-workflow/core-cast-closeout-2026-10-30';
const manifest=JSON.parse(await readFile(path.join(root,folder,'manifest.json'),'utf8'));
const basePort=Number(process.argv.find(arg=>arg.startsWith('--port='))?.slice(7)??5290);
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
const profiles=Object.fromEntries(manifest.actors.map((actor,i)=>[actor.id,`http://127.0.0.1:${basePort+i}/${path.posix.dirname(actor.model.path)}/review.html?variant=after&frame=face&view=front&motion=idle&faceTime=0&poseTime=0`]));
const servers=[];
async function checked(record){
 const bytes=await readFile(path.join(root,record.path));if(hash(bytes)!==record.sha256)throw Error('Changed retained source: '+record.path);return bytes;
}
try{
 for(const [i,actor]of manifest.actors.entries()){
  await checked(actor.model);await checked(actor.native);
  const overrides=new Map();for(const source of actor.runtime.sources)overrides.set(path.join(root,'packages/client/src/agents',source.name+'.ts'),(await checked(source)).toString());
  const reviewPath='/'+path.posix.dirname(actor.model.path)+'/review.html',endpoint=new URL(actor.runtime.endpoint).pathname;
  const server=await createServer({configFile:false,root,publicDir:path.join(root,'packages/client/public'),cacheDir:path.join(root,'output/.runtime-cache/published-'+actor.id),optimizeDeps:{entries:[path.join(root,reviewPath.slice(1))]},
   plugins:[{name:'retained-core-cast-'+actor.id,
    resolveId(source,importer){
     let candidate=source.startsWith('/packages/')?path.join(root,source):source.startsWith('.')&&importer?path.resolve(path.dirname(importer.split('?')[0]),source):source;
     candidate=candidate.replace(/\.js$/,'.ts');return overrides.has(candidate)?candidate:null;
    },
    load(id){return overrides.get(id.split('?')[0]);},
    transformIndexHtml:{order:'pre',handler(html,context){
     if(context.path!==reviewPath)return html;
     if(actor.id==='trinity')html=stabilizeReviewLayout(html);
     // Keep the frozen candidate intact without presenting a missing old trial
     // as a working before/after comparison in a fresh checkout.
     return html.replace(/<a id="beforeLink"[^>]*>[^<]*<\/a>/,'<span id="beforeLink" title="历史试修未纳入收尾交付">历史对照未打包</span>');
    }},
    configureServer(vite){vite.middlewares.use(async(req,res,next)=>{
     const url=new URL(req.url??'/','http://127.0.0.1');
     if(url.pathname==='/__core_cast_profiles'){
      res.setHeader('Content-Type','application/json');res.end(JSON.stringify(profiles));return;
     }
     if(url.pathname!==endpoint)return next();
     if(url.searchParams.get('variant')==='before'){res.statusCode=410;res.end('Historical trial not included. Open variant=after.');return;}
     try{
      for(const source of actor.runtime.sources)await checked(source);
      res.setHeader('Cache-Control','no-store');res.setHeader('Content-Type','application/json');
      res.end(JSON.stringify({variant:'after',candidate:actor.model,sources:actor.runtime.sources,accepted:false,phase:'frozen-closeout-candidate',scope:'Exact retained model and actor-specific renderer. Historical trials are excluded; likeness and unresolved contact checks remain unaccepted.'}));
     }catch(error){res.statusCode=409;res.end(String(error));}
    });},
   }],server:{watch:null,hmr:false,host:'127.0.0.1',port:basePort+i,strictPort:true,fs:{allow:[root]}}});
  await server.listen();servers.push(server);
 }
 console.log(`Core cast review: http://127.0.0.1:${basePort}/${folder}/index.html`);
 console.log('The four review ports load separate pinned renderer versions; game defaults are unchanged.');
}catch(error){await Promise.all(servers.map(server=>server.close()));throw error;}
for(const signal of ['SIGINT','SIGTERM'])process.once(signal,async()=>{await Promise.all(servers.map(server=>server.close()));process.exit(0);});
