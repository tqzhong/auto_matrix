from pathlib import Path
import hashlib,json,os,signal,subprocess,sys,time,urllib.request

u=Path(__file__).resolve().parent;c=u/'candidate-release';label=sys.argv[1]
assert label == 'desert-cold-checkpoint'
assert not (u/(label+'-before-world.json')).exists(),'This restart label was already attempted; inspect its recorded live process instead of rerunning it'
info=json.loads((u/'qa-backend-process.json').read_text());pid=info['pid'];data=Path(info['dataDirectory']);assert data==u/'qa-data'
assert info['port']==5200 and info['dataDirectory']==str(data) and info['cwd']==str(c)
assert subprocess.check_output(['lsof','-tiTCP:5200','-sTCP:LISTEN'],text=True).strip()==str(pid)
assert subprocess.check_output(['ps','-p',str(pid),'-o','command='],text=True).strip()=='node packages/server/dist/index.js'
assert '\nn'+str(c)+'\n' in subprocess.check_output(['lsof','-a','-p',str(pid),'-d','cwd','-Fn'],text=True)
def fetch():
    with urllib.request.urlopen('http://127.0.0.1:5200/api/world',timeout=10) as response:return response.read()
def memories():return {p.name:hashlib.sha256(p.read_bytes()).hexdigest() for p in (data/'memories').glob('*.json')}
before=fetch();world=json.loads(before);assert not world['simulation']['running'];prior_memories=memories()
(u/(label+'-before-world.json')).write_bytes(before)
os.kill(pid,signal.SIGTERM)
for attempt in range(150):
    state=subprocess.run(['ps','-p',str(pid),'-o','stat='],capture_output=True,text=True)
    if state.returncode or state.stdout.strip().startswith('Z'):break
    time.sleep(.1)
else:raise RuntimeError('The confirmed QA process is still alive; inspect the same PID before taking any further action')
assert subprocess.run(['lsof','-tiTCP:5200','-sTCP:LISTEN'],capture_output=True).returncode!=0
env=os.environ.copy();env.update(HOST='127.0.0.1',PORT='5200',MATRIX_DATA_DIR=str(data),MATRIX_CLOUD_SAVE='',SUPABASE_URL='',SUPABASE_SECRET_KEY='',LLM_API_KEY='',DATABASE_PATH=str(data/'auto_matrix.db'))
with (u/'qa-backend.log').open('ab') as log:
    process=subprocess.Popen(['node','packages/server/dist/index.js'],cwd=c,env=env,stdin=subprocess.DEVNULL,stdout=log,stderr=subprocess.STDOUT,start_new_session=True)
info['pid']=process.pid;(u/'qa-backend-process.json').write_text(json.dumps(info,indent=2)+'\n')
for attempt in range(150):
    try:after=fetch();break
    except (OSError,urllib.error.URLError):
        assert process.poll() is None,'The new QA process actually exited; inspect its log'
        time.sleep(.1)
else:raise RuntimeError('QA readiness observation expired; the process handle is still recorded and must be polled, not restarted')
(u/(label+'-after-world.json')).write_bytes(after)
assert after==before,'The complete saved world bytes changed during the QA restart'
assert memories()==prior_memories,'A saved memory changed during the QA restart'
report={'oldPid':pid,'newPid':process.pid,'reason':label,'byteIdenticalWorld':before==after,'completeWorldEqual':True,'changedPaths':[],'memoryFiles':len(prior_memories),'memoryBytesUnchanged':True,'tick':world['simulation']['tick'],'scene':world['sandbox']['neoLife']['journey']['scene'],'step':world['sandbox']['neoLife']['journey']['step'],'revelation':world['sandbox']['neoLife']['journey'].get('revelation'),'cloudDisabled':True}
(u/(label+'-restart.json')).write_text(json.dumps(report,indent=2)+'\n');print(json.dumps(report))
