import hashlib
import json
import os
from pathlib import Path
import shutil
import subprocess
import tempfile
import time
from urllib.request import build_opener, ProxyHandler
urlopen = build_opener(ProxyHandler({})).open
ROOT=Path(__file__).resolve().parents[1]
def run(*args,**kwargs):return subprocess.run(args,check=True,capture_output=True,text=True,**kwargs)
with tempfile.TemporaryDirectory(prefix='awen-lifecycle-') as tmp:
    temp=Path(tmp).resolve(); project=temp/'project';project.mkdir()
    for name in ['build.py','server.py','check_server.py','start.sh','sync.sh']:
        shutil.copy2(ROOT/name,project/name)
    shutil.copytree(ROOT/'src',project/'src');shutil.copytree(ROOT/'docs',project/'docs')
    before=(project/'docs/index.html').read_bytes()
    run('python3','build.py',cwd=project)
    assert (project/'docs/index.html').read_bytes()==before
    assert (project/'legacy-build/index.html').is_file()
    print('PASS: legacy build leaves active runtime byte-identical')
    # Isolated service on an ephemeral port, then restart at that same origin.
    import socket
    sock=socket.socket();sock.bind(('127.0.0.1',0));port=sock.getsockname()[1];sock.close()
    for attempt in range(2):
        process=subprocess.Popen(['python3','server.py','--port',str(port)],cwd=project,stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
        try:
            for _ in range(60):
                try:
                    with urlopen(f'http://127.0.0.1:{port}/api/health',timeout=1) as response:health=json.load(response)
                    break
                except OSError:time.sleep(.05)
            assert health['projectRoot']==str(project)
            run('python3','check_server.py','--port',str(port),cwd=project)
            with urlopen(f'http://127.0.0.1:{port}/') as response:assert response.read()==before
        finally:process.terminate();process.wait(timeout=5)
    print('PASS: same-origin restart + process identity + served runtime bytes')
    # Reproduce deployment with an unchanged HTML but missing, untracked JS.
    bare=temp/'deploy.git';seed=temp/'seed';seed.mkdir()
    run('git','init','--bare',str(bare));run('git','init',str(seed))
    run('git','config','user.email','test@example.invalid',cwd=seed);run('git','config','user.name','test',cwd=seed)
    (seed/'music').mkdir();(seed/'music/index.html').write_bytes(before)
    run('git','add','.',cwd=seed);run('git','commit','-m','fixture',cwd=seed)
    run('git','push',str(bare),'HEAD:master',cwd=seed)
    run('git','init',str(project));run('git','config','user.email','test@example.invalid',cwd=project);run('git','config','user.name','test',cwd=project)
    run('git','add','docs',cwd=project);run('git','commit','-m','fixture',cwd=project)
    env={**os.environ,'AWEN_DEPLOY_URL':str(bare)}
    run('bash','sync.sh',cwd=project,env=env)
    actual=subprocess.check_output(['git','--git-dir='+str(bare),'show','HEAD:music/reliability.js'])
    assert actual==(project/'docs/reliability.js').read_bytes()
    head=run('git','--git-dir='+str(bare),'rev-parse','HEAD').stdout
    run('bash','sync.sh',cwd=project,env=env)
    assert run('git','--git-dir='+str(bare),'rev-parse','HEAD').stdout==head
    print('PASS: local bare deployment includes new JS despite unchanged HTML; repeat creates no commit; no GitHub writes')
