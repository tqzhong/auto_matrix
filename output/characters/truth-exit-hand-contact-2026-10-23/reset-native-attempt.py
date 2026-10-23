from pathlib import Path
import hashlib,json,os,signal,subprocess,time,urllib.request
u=Path(__file__).resolve().parent;c=u/'candidate-release';data=u/'qa-data';archive=u/'qa-attempt-01-data';source=u.parent/'desert-guide-contact-2026-10-23/qa-data'
assert not archive.exists()
info=json.loads((u/'qa-backend-process.json').read_text());pid=info['pid'];assert info['dataDirectory']==str(data)
assert subprocess.check_output(['lsof','-tiTCP:5200','-sTCP:LISTEN'],text=True).strip()==str(pid)
assert subprocess.check_output(['ps','-p',str(pid),'-o','command='],text=True).strip()=='node packages/server/dist/index.js'
assert 'n'+str(c) in subprocess.check_output(['lsof','-a','-p',str(pid),'-d','cwd','-Fn'],text=True).splitlines()
with urllib.request.urlopen('http://127.0.0.1:5200/api/world')as response:raw=response.read()
w=json.loads(raw);assert not w['simulation']['running'];assert w['sandbox']['neoLife']['journey']['truthRecovery']['phase']=='question'
(u/'native-attempt-01-world.json').write_bytes(raw)
os.kill(pid,signal.SIGTERM)
for _ in range(150):
 state=subprocess.run(['ps','-p',str(pid),'-o','stat='],capture_output=True,text=True)
 if state.returncode or state.stdout.strip().startswith('Z'):break
 time.sleep(.1)
else:raise RuntimeError('Owned QA PID still live; do not reset its data')
assert subprocess.run(['lsof','-tiTCP:5200','-sTCP:LISTEN'],capture_output=True).returncode!=0
data.rename(archive);subprocess.run(['cp','-cR',str(source),str(data)],check=True)
env=os.environ.copy();env.update(HOST='127.0.0.1',PORT='5200',MATRIX_DATA_DIR=str(data),MATRIX_CLOUD_SAVE='',SUPABASE_URL='',SUPABASE_SECRET_KEY='',LLM_API_KEY='',DATABASE_PATH=str(data/'auto_matrix.db'))
with (u/'qa-backend.log').open('ab')as log:p=subprocess.Popen(['node','packages/server/dist/index.js'],cwd=c,env=env,stdin=subprocess.DEVNULL,stdout=log,stderr=subprocess.STDOUT,start_new_session=True)
info['pid']=p.pid;(u/'qa-backend-process.json').write_text(json.dumps(info,indent=2)+'\n')
for _ in range(150):
 try:
  with urllib.request.urlopen('http://127.0.0.1:5200/api/world',timeout=2)as response:after=response.read()
  break
 except (OSError,urllib.error.URLError):
  assert p.poll()is None;time.sleep(.1)
else:raise RuntimeError('Readiness observation expired; inspect same recorded PID, never restart due to this timeout')
current=json.loads(after);j=current['sandbox']['neoLife']['journey'];assert j['scene']=='m1_truth_exit'and j['truthRecovery']['phase']=='ready'and current['simulation']['tick']==7652
report={'purpose':'First normal play reached the bedside question before the intended kneeling pause. Preserve that entire QA data branch, then deliberately replay from the preceding real checkpoint for a mid-fall restore test.','firstAttempt':{'scene':w['sandbox']['neoLife']['journey']['scene'],'truthRecovery':w['sandbox']['neoLife']['journey']['truthRecovery'],'tick':w['simulation']['tick']},'oldPid':pid,'newPid':p.pid,'oldTerminalStateConfirmed':True,'archivedData':str(archive.relative_to(u)),'newSeed':'desert-guide-contact-2026-10-23/qa-data','newScene':j['scene'],'newTick':7652,'manualWorldFieldEdits':False,'mainPreviewTouched':False}
(u/'native-attempt-reset.json').write_text(json.dumps(report,indent=2)+'\n');print(json.dumps(report))
