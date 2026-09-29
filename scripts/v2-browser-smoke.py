import json, shutil, subprocess, time, urllib.request, urllib.error
from pathlib import Path
from playwright.sync_api import sync_playwright

ROOT=Path(__file__).resolve().parents[1]
PORT=8801
ORIGIN=f'http://127.0.0.1:{PORT}'
PERSIST=ROOT/'tmp'/'v2-browser-state'
PROTO='vs-cf-1'

def http(path,method='GET',payload=None):
    headers={'X-VS-Protocol':PROTO};data=None
    if payload is not None:
        data=json.dumps(payload).encode();headers['Content-Type']='application/json'
        if method not in ('GET','HEAD'):headers['Origin']=ORIGIN
    req=urllib.request.Request(ORIGIN+path,data=data,headers=headers,method=method)
    try:
        with urllib.request.urlopen(req,timeout=4) as r:return r.status,r.read()
    except urllib.error.HTTPError as e:return e.code,e.read()

def wait_server(proc):
    for _ in range(240):
        if proc.poll() is not None:raise RuntimeError('wrangler exited')
        try:
            if http('/api/session')[0]==200:return
        except Exception:pass
        time.sleep(.1)
    raise RuntimeError('wrangler timeout')
shutil.rmtree(PERSIST,ignore_errors=True)
subprocess.run(['node','scripts/build-worker.mjs'],cwd=ROOT,check=True)
cmd=['node',str(ROOT/'node_modules/wrangler/bin/wrangler.js'),'dev','--config','wrangler.local.jsonc',
     '--ip','127.0.0.1','--port',str(PORT),'--local','--persist-to',str(PERSIST)]
log=(ROOT/'tmp'/'cf-evidence'/'v2-browser-worker.log').open('w',encoding='utf-8')
proc=subprocess.Popen(cmd,cwd=ROOT,stdout=log,stderr=subprocess.STDOUT,text=True)
browser=None
try:
    wait_server(proc)
    state={'students':[],'logs':[],'weekOvr':{},'consults':[],'payments':[],'inquiries':[]}
    code,body=http('/api/import','POST',{'state':state});assert code==201
    staged=json.loads(body);code,body=http('/api/export');assert code==200
    exported=json.loads(body);assert exported['hash']==staged['hash']
    code,_=http('/api/activate','POST',{'hash':exported['hash']});assert code==200
    with sync_playwright() as pw:
        browser=pw.chromium.launch(channel='chrome',headless=True)
        ctx=browser.new_context(viewport={'width':1440,'height':900})
        page=ctx.new_page();errors=[]
        page.on('pageerror',lambda e:errors.append(str(e)))
        page.goto(ORIGIN+'/',wait_until='domcontentloaded',timeout=30000)
        page.wait_for_function("() => window._vsSync && window._vsSync.ready",timeout=20000)
        assert page.locator('#v2OpsCenter').is_visible()
        assert page.locator('#v2CallCapture').is_visible()
        assert page.locator('#pwaInstallBtn').is_visible()
        workspace=page.locator('#pwaWorkspace').inner_text()
        assert '? ??' not in workspace
        bg=page.evaluate("getComputedStyle(document.getElementById('vocalAdmin')).backgroundColor")
        assert bg not in ('rgb(247, 244, 239)','rgba(0, 0, 0, 0)')

        page.click('#v2CallCapture')
        page.fill('#v2-phone','010-1234-5678')
        page.fill('#v2-name','V2 QA')
        page.fill('#v2-memo','전화 문의 즉시 저장 QA')
        page.get_by_role('button',name='문의만 저장').click()
        page.wait_for_function("() => inquiries.some(q => q.phone === '010-1234-5678')")
        item=page.evaluate("inquiries.find(q => q.phone === '010-1234-5678')")
        assert item['channel']=='phone' and len(item['callHistory'])==1
        page.wait_for_timeout(500)
        remote=page.evaluate("async()=>{const r=await fetch('/api/state',{headers:{'X-VS-Protocol':'vs-cf-1'}});return await r.json()}")
        assert any(q.get('phone')=='010-1234-5678' for q in remote['state']['inquiries'])

        page.click('#v2ConsultIntake')
        page.wait_for_selector('#ci-nm',state='visible')
        page.evaluate("go('today')")
        page.click('#v2FixedSchedule')
        page.wait_for_selector('#mS.open',state='visible')
        assert page.locator('#s-stype-fixed').evaluate("e=>e.classList.contains('on')")
        page.evaluate("cm('mS')")
        page.click('#v2FlexSchedule')
        page.wait_for_selector('#mS.open',state='visible')
        assert page.locator('#s-stype-flex').evaluate("e=>e.classList.contains('on')")
        assert not errors,errors
        print(json.dumps({'ok':True,'checks':10,'errors':errors},ensure_ascii=False))
finally:
    if browser:
        try:browser.close()
        except Exception:pass
    if proc.poll() is None:
        subprocess.run(['taskkill','/PID',str(proc.pid),'/T','/F'],stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
    log.close()
