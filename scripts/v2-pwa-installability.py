import json, shutil, subprocess, time, urllib.request, urllib.error
from pathlib import Path
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parents[1]
PORT=8802
ORIGIN=f'http://127.0.0.1:{PORT}'
STATE=ROOT/'tmp'/'v2-pwa-state'
PROFILE=ROOT/'tmp'/'v2-pwa-chrome-profile'
PROTO='vs-cf-1'

def api(path,method='GET',payload=None):
    headers={'X-VS-Protocol':PROTO};data=None
    if payload is not None:
        data=json.dumps(payload).encode();headers['Content-Type']='application/json';headers['Origin']=ORIGIN
    req=urllib.request.Request(ORIGIN+path,data=data,headers=headers,method=method)
    try:
        with urllib.request.urlopen(req,timeout=5) as r:return r.status,r.read()
    except urllib.error.HTTPError as e:return e.code,e.read()

def wait_server(proc):
    for _ in range(300):
        if proc.poll() is not None:raise RuntimeError('wrangler exited')
        try:
            if api('/api/session')[0]==200:return
        except Exception:pass
        time.sleep(.1)
    raise RuntimeError('wrangler timeout')
for p in [STATE,PROFILE]:shutil.rmtree(p,ignore_errors=True)
subprocess.run(['node','scripts/build-worker.mjs'],cwd=ROOT,check=True)
log=(ROOT/'tmp'/'cf-evidence'/'v2-pwa-worker.log').open('w',encoding='utf-8')
cmd=['node',str(ROOT/'node_modules/wrangler/bin/wrangler.js'),'dev','--config','wrangler.local.jsonc',
     '--ip','127.0.0.1','--port',str(PORT),'--local','--persist-to',str(STATE)]
proc=subprocess.Popen(cmd,cwd=ROOT,stdout=log,stderr=subprocess.STDOUT,text=True)
ctx=None
try:
    wait_server(proc)
    source={'students':[],'logs':[],'weekOvr':{},'consults':[],'payments':[],'inquiries':[]}
    code,body=api('/api/import','POST',{'state':source});assert code==201
    h=json.loads(body)['hash'];code,_=api('/api/export');assert code==200
    code,_=api('/api/activate','POST',{'hash':h});assert code==200
    with sync_playwright() as pw:
        ctx=pw.chromium.launch_persistent_context(str(PROFILE),channel='chrome',headless=True,viewport={'width':1280,'height':800})
        page=ctx.pages[0] if ctx.pages else ctx.new_page()
        page.goto(ORIGIN+'/index.html',wait_until='domcontentloaded',timeout=30000)
        page.wait_for_function("() => window._vsSync && window._vsSync.ready",timeout=20000)
        page.evaluate("async()=>{await navigator.serviceWorker.ready}")
        cdp=ctx.new_cdp_session(page)
        manifest=cdp.send('Page.getAppManifest')
        errors=cdp.send('Page.getInstallabilityErrors').get('installabilityErrors',[])
        assert not manifest.get('errors'),manifest.get('errors')
        data=json.loads(manifest['data'])
        assert data['name']=='HLB Studio V2 관리자'
        assert data['short_name']=='HLB Studio'
        assert data['display']=='standalone'
        assert data['start_url']=='/index.html'
        assert not errors,errors
        assert page.locator('#pwaInstallBtn').is_visible()
        print(json.dumps({'ok':True,'manifest':{'name':data['name'],'short_name':data['short_name'],
            'display':data['display'],'start_url':data['start_url']},'installabilityErrors':errors},ensure_ascii=False))
finally:
    if ctx:
        try:ctx.close()
        except Exception:pass
    if proc.poll() is None:
        subprocess.run(['taskkill','/PID',str(proc.pid),'/T','/F'],stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
    log.close()
