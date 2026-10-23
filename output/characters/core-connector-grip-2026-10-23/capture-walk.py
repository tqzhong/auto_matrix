from pathlib import Path
import json,sys,time,urllib.request
u=Path(__file__).resolve().parent
with urllib.request.urlopen('http://127.0.0.1:5200/api/world',timeout=10) as response:world=json.load(response)
j=world['sandbox']['neoLife']['journey'];neo=world['agents']['neo'];m=world['agents']['morpheus']
row={'label':sys.argv[1],'time':time.time(),'tick':world['simulation']['tick'],'running':world['simulation']['running'],
     'neo':{k:neo.get(k) for k in ['position','rotation','health','status']},'morpheus':{'position':m['position'],'rotation':m['rotation']},
     'journey':{k:j.get(k) for k in ['scene','step','cabinEscort','awakening']}}
with (u/'native-walk-trace.jsonl').open('a') as out:out.write(json.dumps(row)+'\n')
print(json.dumps(row))
