from pathlib import Path
import json,os,subprocess,time,urllib.request
u=Path(__file__).resolve().parent;c=u/'candidate-release';data=u/'qa-data'
for port in [5200,5201]:
 assert subprocess.run(['lsof',f'-tiTCP:{port}','-sTCP:LISTEN'],capture_output=True).returncode!=0
rows=[('backend',5200,c,['node','packages/server/dist/index.js']),('client',5201,c/'packages/client',['node',str(c/'node_modules/vite/bin/vite.js'),'--host','127.0.0.1','--port','5201','--strictPort'])]
for kind,port,cwd,command in rows:
 env=os.environ.copy();env.update({'HOST':'127.0.0.1','PORT':str(port),'MATRIX_DATA_DIR':str(data),'MATRIX_SERVER_URL':'http://127.0.0.1:5200','MATRIX_CLOUD_SAVE':'','SUPABASE_URL':'','SUPABASE_SECRET_KEY':'','LLM_API_KEY':'','DATABASE_PATH':str(data/'auto_matrix.db')})
 with (u/f'qa-{kind}.log').open('ab') as log:p=subprocess.Popen(command,cwd=cwd,env=env,stdin=subprocess.DEVNULL,stdout=log,stderr=subprocess.STDOUT,start_new_session=True)
 info={'pid':p.pid,'port':port,'command':command,'cwd':str(cwd)};(u/f'qa-{kind}-process.json').write_text(json.dumps(info,indent=2)+'\n')
 for attempt in range(100):
  try:
   with urllib.request.urlopen(f'http://127.0.0.1:{port}/'+('api/world' if kind=='backend' else ''),timeout=3) as response:assert response.status==200
   break
  except OSError:
   assert p.poll() is None,'Inspect recorded QA process and log';time.sleep(.1)
 else:raise RuntimeError('Readiness observation expired; inspect recorded PID')
 print(json.dumps(info))
