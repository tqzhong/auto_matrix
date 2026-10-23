from pathlib import Path
import hashlib,json,os,signal,subprocess,sys,time,urllib.request

u=Path(__file__).resolve().parent;c=u/'candidate-release';label=sys.argv[1]
assert label in ['bedside', 'bedside-owned']
assert not (u/(label+'-before-world.json')).exists(),'Inspect the recorded attempt instead of repeating a restart'
info=json.loads((u/'qa-backend-process.json').read_text());pid=info['pid'];data=Path(info['dataDirectory'])
assert data==u/'qa-data' and info['cwd']==str(c) and info['port']==5200
assert subprocess.check_output(['lsof','-tiTCP:5200','-sTCP:LISTEN'],text=True).strip()==str(pid)
assert subprocess.check_output(['ps','-p',str(pid),'-o','command='],text=True).strip()=='node packages/server/dist/index.js'
assert 'n'+str(c) in subprocess.check_output(['lsof','-a','-p',str(pid),'-d','cwd','-Fn'],text=True).splitlines()
def fetch():
 with urllib.request.urlopen('http://127.0.0.1:5200/api/world',timeout=10) as r:return r.read()
def memories():return {p.name:hashlib.sha256(p.read_bytes()).hexdigest() for p in (data/'memories').glob('*.json')}
before=fetch();world=json.loads(before);assert not world['simulation']['running'];prior=memories()
(u/(label+'-before-world.json')).write_bytes(before)
(u/(label+'-before-memories.json')).write_text(json.dumps(prior,indent=2)+'\n')
os.kill(pid,signal.SIGTERM)
for _ in range(150):
 state=subprocess.run(['ps','-p',str(pid),'-o','stat='],capture_output=True,text=True)
 if state.returncode or state.stdout.lstrip().startswith('Z'):break
 time.sleep(.1)
else:raise RuntimeError('Recorded QA process remains alive; do not start a duplicate')
assert subprocess.run(['lsof','-tiTCP:5200','-sTCP:LISTEN'],capture_output=True).returncode!=0
env=os.environ.copy();env.update(HOST='127.0.0.1',PORT='5200',MATRIX_DATA_DIR=str(data),MATRIX_CLOUD_SAVE='',SUPABASE_URL='',SUPABASE_SECRET_KEY='',LLM_API_KEY='',DATABASE_PATH=str(data/'auto_matrix.db'))
with (u/'qa-backend.log').open('ab') as log:p=subprocess.Popen(['node','packages/server/dist/index.js'],cwd=c,env=env,stdin=subprocess.DEVNULL,stdout=log,stderr=subprocess.STDOUT,start_new_session=True)
info['pid']=p.pid;(u/'qa-backend-process.json').write_text(json.dumps(info,indent=2)+'\n')
for _ in range(150):
 try:after=fetch();break
 except (OSError,urllib.error.URLError):
  assert p.poll() is None,'QA process exited; inspect its log'
  time.sleep(.1)
else:raise RuntimeError('Readiness expired; poll the recorded live PID')
(u/(label+'-after-world.json')).write_bytes(after)
def comparable(raw):
 w=json.loads(raw)
 for a in w['agents'].values():a.pop('controller',None)
 if label=='crew-clearance':
  for id in ['trinity','dozer']:w['agents'].pop(id)
 return w
assert comparable(before)==comparable(after),'Unexpected persistent world change'
assert memories()==prior
report={'oldPid':pid,'newPid':p.pid,'tick':world['simulation']['tick'],'phase':'bedside-question','persistentWorldEqualExceptTransientController':True,'onlyAllowedMigrationActors':['trinity','dozer'] if label=='crew-clearance' else [],'memoryFilesUnchanged':len(prior),'cloudDisabled':True}
(u/(label+'-restart.json')).write_text(json.dumps(report,indent=2)+'\n');print(json.dumps(report))
