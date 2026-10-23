from pathlib import Path
import json,os,subprocess,time,urllib.request

u=Path(__file__).resolve().parent;c=u/'candidate-release';data=u/'qa-play-data'
assert data.is_dir()
for port in [5200,5201]:assert subprocess.run(['lsof',f'-tiTCP:{port}','-sTCP:LISTEN'],capture_output=True).returncode!=0
for kind,port,cmd,cwd,extra in [('backend',5200,['node','packages/server/dist/index.js'],c,{'HOST':'127.0.0.1','PORT':'5200','MATRIX_DATA_DIR':str(data),'MATRIX_CLOUD_SAVE':'','SUPABASE_URL':'','SUPABASE_SECRET_KEY':'','LLM_API_KEY':'','DATABASE_PATH':str(data/'auto_matrix.db')}),('client',5201,['node',str(c/'node_modules/vite/bin/vite.js'),'--host','127.0.0.1','--port','5201','--strictPort'],c/'packages/client',{'MATRIX_SERVER_URL':'http://127.0.0.1:5200'})]:
 env=os.environ.copy();env.update(extra)
 with (u/('qa-'+kind+'.log')).open('ab') as log:p=subprocess.Popen(cmd,cwd=cwd,env=env,stdin=subprocess.DEVNULL,stdout=log,stderr=subprocess.STDOUT,start_new_session=True)
 (u/('qa-'+kind+'-process.json')).write_text(json.dumps({'pid':p.pid,'port':port,'command':cmd,'cwd':str(cwd),'dataDirectory':str(data),'cloudDisabled':True},indent=2)+'\n')
 for attempt in range(150):
  try:
   with urllib.request.urlopen(f'http://127.0.0.1:{port}/'+('api/world' if kind=='backend' else ''),timeout=2) as response:body=response.read()
   break
  except (OSError,urllib.error.URLError):
   assert p.poll() is None,'Process exited; inspect its log'
   time.sleep(.1)
 else:raise RuntimeError('Readiness observation expired; inspect the recorded process before any restart')
 print(json.dumps({'kind':kind,'pid':p.pid,'port':port,'ready':True}),flush=True)
