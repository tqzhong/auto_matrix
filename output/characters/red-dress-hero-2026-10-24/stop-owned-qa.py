from pathlib import Path
import json,os,signal,subprocess,time
u=Path(__file__).resolve().parent
rows=[]
for kind in ['client','backend']:
 info=json.loads((u/f'qa-{kind}-process.json').read_text());pid=info['pid'];port=info['port']
 assert subprocess.check_output(['lsof',f'-tiTCP:{port}','-sTCP:LISTEN'],text=True).strip()==str(pid)
 assert subprocess.check_output(['ps','-p',str(pid),'-o','command='],text=True).strip()==' '.join(info['command'])
 cwd=subprocess.check_output(['lsof','-a','-p',str(pid),'-d','cwd','-Fn'],text=True).splitlines();assert 'n'+info['cwd'] in cwd
 os.kill(pid,signal.SIGTERM)
 for _ in range(100):
  present=subprocess.run(['ps','-p',str(pid),'-o','stat='],capture_output=True,text=True)
  if present.returncode or present.stdout.lstrip().startswith('Z'):break
  time.sleep(.05)
 else:raise RuntimeError(f'Owned PID {pid} remains alive; inspect it')
 assert subprocess.run(['lsof',f'-tiTCP:{port}','-sTCP:LISTEN'],capture_output=True).returncode!=0
 rows.append({'pid':pid,'port':port,'commandVerified':True,'cwdVerified':True,'terminalStateConfirmed':True,'portClosed':True})
(u/'qa-stop.json').write_text(json.dumps(rows,indent=2)+'\n');print(json.dumps(rows))
