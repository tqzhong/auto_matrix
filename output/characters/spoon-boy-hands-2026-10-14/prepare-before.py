"""Recreate the exact starting performers for the offline comparison."""
from pathlib import Path
import re
import subprocess
folder=Path(__file__).parent
original=folder/'original';original.mkdir(exist_ok=True)
for name in ['CharacterModel','SpoonPerformance','OracleParkHands']:
    text=subprocess.check_output(['git','show',f'ffb5726:packages/client/src/agents/{name}.ts'],text=True)
    def rewrite(match):
        file=match[1]
        if file in ['SpoonPerformance.js','OracleParkHands.js']:
            return "from './"+file.replace('.js','.mjs')+"'"
        return "from '../../../../packages/client/src/agents/"+file+"'"
    text=re.sub(r"from '\./([^']+)'",rewrite,text)
    text=text.replace("from '../engine/","from '../../../../packages/client/src/engine/")
    (original/f'{name}.mts').write_text(text)
