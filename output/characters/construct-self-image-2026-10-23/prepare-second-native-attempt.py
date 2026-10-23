from pathlib import Path
import json,os,signal,subprocess,time,urllib.request,hashlib
u=Path(__file__).resolve().parent;root=u.parents[2];info=json.loads((u/'qa-backend-process.json').read_text());pid=info['pid'];c=u/'candidate-release'
assert info['port']==5200 and info['cwd']==str(c)
assert subprocess.check_output(['lsof','-tiTCP:5200','-sTCP:LISTEN'],text=True).strip()==str(pid)
assert subprocess.check_output(['ps','-p',str(pid),'-o','command='],text=True).strip()=='node packages/server/dist/index.js'
assert '\nn'+str(c)+'\n' in subprocess.check_output(['lsof','-a','-p',str(pid),'-d','cwd','-Fn'],text=True)
with urllib.request.urlopen('http://127.0.0.1:5200/api/world',timeout=10) as r:before=r.read()
world=json.loads(before);assert not world['simulation']['running'] and world['sandbox']['neoLife']['journey']['constructArrival']['phase']=='approach'
(u/'native-first-attempt-world.json').write_bytes(before)
os.kill(pid,signal.SIGTERM)
for _ in range(150):
 p=subprocess.run(['ps','-p',str(pid),'-o','stat='],capture_output=True,text=True)
 if p.returncode or p.stdout.strip().startswith('Z'):break
 time.sleep(.1)
else:raise RuntimeError('The exact old QA process is still alive; inspect it before proceeding')
assert subprocess.run(['lsof','-tiTCP:5200','-sTCP:LISTEN'],capture_output=True).returncode!=0
source=root/'output/characters/core-connector-grip-2026-10-23/qa-data';data=u/'qa-data-second-attempt';assert not data.exists();subprocess.run(['cp','-cR',str(source),str(data)],check=True)
env=os.environ.copy();env.update(HOST='127.0.0.1',PORT='5200',MATRIX_DATA_DIR=str(data),MATRIX_CLOUD_SAVE='',SUPABASE_URL='',SUPABASE_SECRET_KEY='',LLM_API_KEY='',DATABASE_PATH=str(data/'auto_matrix.db'))
with (u/'qa-backend.log').open('ab') as log:p=subprocess.Popen(['node','packages/server/dist/index.js'],cwd=c,env=env,stdin=subprocess.DEVNULL,stdout=log,stderr=subprocess.STDOUT,start_new_session=True)
info.update(pid=p.pid,dataDirectory=str(data));(u/'qa-backend-process.json').write_text(json.dumps(info,indent=2)+'\n')
for _ in range(150):
 try:
  with urllib.request.urlopen('http://127.0.0.1:5200/api/world',timeout=2) as r:after=r.read()
  break
 except (OSError,urllib.error.URLError):
  assert p.poll() is None,'The new QA process exited; inspect the recorded log';time.sleep(.1)
else:raise RuntimeError('Readiness observation expired; poll the recorded live PID, never restart on this observation alone')
a=json.loads(after);j=a['sandbox']['neoLife']['journey'];assert a['simulation']['tick']==7193 and not a['simulation']['running'] and j['constructArrival']['phase']=='ready'
report={'purpose':'Repeat the native six-second gesture after the first pause missed its held pose; intentionally start a second isolated branch from the same real checkpoint.','oldPid':pid,'newPid':p.pid,'firstAttemptRetained':True,'firstAttemptTick':world['simulation']['tick'],'firstAttemptPhase':'approach','source':'output/characters/core-connector-grip-2026-10-23/qa-data','sourceTick':7193,'newPhase':'ready','manualWorldFieldEdits':False,'mainServerRestarted':False,'worldSha256':hashlib.sha256(after).hexdigest()}
(u/'native-second-attempt-setup.json').write_text(json.dumps(report,indent=2)+'\n');print(json.dumps(report))
