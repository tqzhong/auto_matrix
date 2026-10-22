from pathlib import Path
import json,os,subprocess,sys

unit=Path(__file__).resolve().parent;candidate=unit/'candidate-release'
assert json.loads((unit/'validation.json').read_text())['allGatesPassed']
assert sys.argv[1] in ['backend','client']
backend=sys.argv[1]=='backend';port=5200 if backend else 5201
assert subprocess.run(['lsof','-tiTCP:'+str(port),'-sTCP:LISTEN'],capture_output=True).returncode!=0,'QA port already in use'
env=os.environ.copy();env.update(HOST='127.0.0.1',PORT='5200',MATRIX_DATA_DIR=str(unit/'qa-data'),MATRIX_CLOUD_SAVE='',SUPABASE_URL='',SUPABASE_SECRET_KEY='',LLM_API_KEY='',DATABASE_PATH=str(unit/'qa-data/auto_matrix.db'),MATRIX_SERVER_URL='http://127.0.0.1:5200')
cmd=['node','packages/server/dist/index.js'] if backend else ['node','node_modules/vite/bin/vite.js','--host','127.0.0.1','--port','5201','--strictPort']
cwd=candidate if backend else candidate/'packages/client'
if not backend:cmd[1]=str(candidate/'node_modules/vite/bin/vite.js')
with (unit/('qa-backend.log' if backend else 'qa-client.log')).open('ab') as log:
    p=subprocess.Popen(cmd,cwd=cwd,env=env,stdin=subprocess.DEVNULL,stdout=log,stderr=subprocess.STDOUT,start_new_session=True)
report={'pid':p.pid,'port':port,'command':cmd,'cwd':str(cwd),'dataDirectory':str(unit/'qa-data'),'cloudDisabled':True}
(unit/('qa-backend-process.json' if backend else 'qa-client-process.json')).write_text(json.dumps(report,indent=2)+'\n')
print(json.dumps(report))
