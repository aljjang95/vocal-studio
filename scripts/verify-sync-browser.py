"""Actual Vocal Studio app against local Cloudflare Worker/SQLite DO/R2."""
import json
import shutil
import subprocess
import time
import urllib.error
import urllib.request
from pathlib import Path
from playwright.sync_api import sync_playwright

ROOT=Path(__file__).resolve().parents[1]
PORT=8799
ORIGIN=f'http://127.0.0.1:{PORT}'
PERSIST=ROOT/'tmp'/'cf-browser-state'
EVIDENCE=ROOT/'tmp'/'cf-evidence'
PROTO='vs-cf-1'
checks=[]
errors=[]

def check(name,condition):
    if not condition:
        raise AssertionError(name)
    checks.append(name)

def http(path,method='GET',payload=None,origin=True):
    headers={'X-VS-Protocol':PROTO}
    data=None
    if payload is not None:
        data=json.dumps(payload).encode('utf-8')
        headers['Content-Type']='application/json'
    if method not in ('GET','HEAD') and origin:
        headers['Origin']=ORIGIN
    req=urllib.request.Request(ORIGIN+path,data=data,headers=headers,method=method)
    try:
        with urllib.request.urlopen(req,timeout=4) as res:
            body=res.read()
            return res.status,dict(res.headers),body
    except urllib.error.HTTPError as exc:
        return exc.code,dict(exc.headers),exc.read()

def wait_server(proc):
    for _ in range(300):
        if proc.poll() is not None:
            raise RuntimeError('wrangler exited before ready')
        try:
            status,_,_=http('/api/session')
            if status==200:return
        except Exception:
            pass
        time.sleep(.1)
    raise RuntimeError('wrangler local server did not become ready')

def stop_tree(proc):
    if not proc:return
    if proc.poll() is None:
        subprocess.run(['taskkill','/PID',str(proc.pid),'/T','/F'],stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)

def wait_js(page,expression,timeout_ms=15000):
    deadline=time.time()+timeout_ms/1000
    while time.time()<deadline:
        try:
            if page.evaluate(f"() => Boolean({expression})"):
                return
        except Exception:
            pass
        time.sleep(.05)
    raise TimeoutError('browser condition timed out: '+expression)
shutil.rmtree(PERSIST,ignore_errors=True)
EVIDENCE.mkdir(parents=True,exist_ok=True)
subprocess.run(['node','scripts/build-worker.mjs'],cwd=ROOT,check=True)
command=['node',str(ROOT/'node_modules/wrangler/bin/wrangler.js'),'dev','--config','wrangler.local.jsonc','--ip','127.0.0.1','--port',str(PORT),'--local','--persist-to',str(PERSIST)]
worker_log=(EVIDENCE/'browser-worker.log').open('w',encoding='utf-8')
proc=subprocess.Popen(command,cwd=ROOT,stdout=worker_log,stderr=subprocess.STDOUT,text=True)

source={
    'students':[{'id':'s1','name':'QA'}],
    'logs':[],'consults':[],'payments':[],'inquiries':[],
    'weekOvr':{'w1':{'s1':{'time':'10:00'}}},
    'futureRoot':{'keep':True},
}

browser=None
try:
    wait_server(proc)
    status,_,body=http('/api/import','POST',{'state':source})
    check('browser fixture staged',status==201)
    staged=json.loads(body)
    status,_,body=http('/api/export')
    exported=json.loads(body)
    check('browser fixture private readback',status==200 and exported['hash']==staged['hash'])
    status,_,body=http('/api/activate','POST',{'hash':exported['hash']})
    check('browser fixture activated',status==200)

    with sync_playwright() as playwright:
        browser=playwright.chromium.launch(channel='chrome',headless=True)
        context=browser.new_context(viewport={'width':1440,'height':900})
        page=context.new_page()
        page.on('pageerror',lambda exc: errors.append('desktop: '+str(exc)))
        page.goto(ORIGIN+'/',wait_until='domcontentloaded',timeout=60000)
        wait_js(page,"window._cfSession && window._vsSync && window._vsSync.ready")
        check('desktop actual app hydrated',page.evaluate("weekOvr.w1.s1.time==='10:00'"))
        check('desktop Cloudflare principal bound',page.evaluate("_cfSession.principal.length>0"))
        page.screenshot(path=str(EVIDENCE/'browser-desktop.png'),full_page=True)

        base=page.evaluate("JSON.parse(JSON.stringify(_vsSync.state.base))")
        old=copy=json.loads(json.dumps(base))
        old['weekOvr']['w1']['s1']['time']='11:00'
        page.evaluate("""({base,old})=>{
          const owner=_cfSession.principal;
          localStorage.setItem('vsC_cf_owner_v1',owner);
          localStorage.setItem('vsC_s',JSON.stringify(base.students));
          localStorage.setItem('vsC_l',JSON.stringify(base.logs));
          localStorage.setItem('vsC_wo',JSON.stringify(base.weekOvr));
          localStorage.setItem('vsC_c',JSON.stringify(base.consults));
          localStorage.setItem('vsC_p',JSON.stringify(base.payments));
          localStorage.setItem('vsC_iq',JSON.stringify(base.inquiries));
          const key='vsC_sync_v1:'+encodeURIComponent('vocal-studio:'+owner);
          sessionStorage.setItem(key,JSON.stringify({version:1,namespace:'vocal-studio',owner,revision:0,base,local:old,recovery:[]}));
        }""",{'base':base,'old':old})
        page.reload(wait_until='domcontentloaded')
        wait_js(page,"window._vsSync && _vsSync.mode==='conflict'")
        check('High reload keeps durable undo 10:00',page.evaluate("weekOvr.w1.s1.time==='10:00'"))
        recovery=page.evaluate("_vsSync.state.recovery.map(x=>x.weekOvr&&x.weekOvr.w1&&x.weekOvr.w1.s1&&x.weekOvr.w1.s1.time)")
        check('High old pending 11:00 is recovery only','11:00' in recovery)
        status,_,body=http('/api/state')
        server=json.loads(body)
        check('High reload never auto-writes old pending',status==200 and server['revision']==0 and server['state']['weekOvr']['w1']['s1']['time']=='10:00')
        check('High retry remains write-blocked',page.evaluate("async()=>{await _vsSync.retry();return _vsSync.mode==='conflict';}"))
        time.sleep(.2)
        status,_,body=http('/api/state')
        server=json.loads(body)
        check('High explicit retry still leaves server 10:00',server['revision']==0 and server['state']['weekOvr']['w1']['s1']['time']=='10:00')
        page.evaluate("_vsSync.useServer()")
        check('server-choice restores canonical 10:00',page.evaluate("weekOvr.w1.s1.time==='10:00'"))

        wait_js(page,"window._mediaDB !== null",10000)
        media_result=page.evaluate("""async()=>{
          const data='data:application/octet-stream;base64,AAECAwQ=';
          await new Promise(resolve=>mediaSave('qa-media-retry',data,resolve));
          queueMediaForStorage({localKey:'qa-media-retry',storagePath:'studios/default/media/qa/browser-retry.bin',ownerType:'student',ownerId:'s1',field:'audios',entryId:'qa-media',contentType:'application/octet-stream',status:'queued',attempts:0});
          window.__qaRealUpload=VCFTransport.uploadDataUrl;
          VCFTransport.uploadDataUrl=()=>Promise.reject(new Error('injected-media-put-failure'));
          const result=await processMediaDurabilityQueue(5);
          _vsSyncActions('synced');
          const rec=_mediaQueueRead().find(x=>x.localKey==='qa-media-retry');
          return {result,status:rec&&rec.status,actions:getComputedStyle(document.getElementById('vsSyncActions')).display,retryHidden:document.getElementById('vsMediaRetry').hidden};
        }""")
        check('Medium failed PUT stays retry',media_result['status']=='retry')
        check('Medium retry UI visible while sync says synced',media_result['actions']!='none' and media_result['retryHidden'] is False)
        recovered=page.evaluate("""async()=>{
          VCFTransport.uploadDataUrl=window.__qaRealUpload;
          await _cfDrainMedia();
          _vsSyncActions('synced');
          const rec=_mediaQueueRead().find(x=>x.localKey==='qa-media-retry');
          let size=-1;
          if(rec&&rec.url){const response=await fetch(rec.url);size=(await response.arrayBuffer()).byteLength;}
          return {status:rec&&rec.status,url:rec&&rec.url,size,lastError:rec&&rec.lastError,actions:getComputedStyle(document.getElementById('vsSyncActions')).display,retryHidden:document.getElementById('vsMediaRetry').hidden};
        }""")
        print('media-recovery-debug',json.dumps(recovered,ensure_ascii=False))
        check('Medium retry drains to uploaded',recovered['status']=='uploaded')
        check('Medium recovered bytes read from R2',recovered['size']==5)
        check('Medium retry action clears after recovery',recovered['retryHidden'] is True and recovered['actions']=='none')
        page.screenshot(path=str(EVIDENCE/'browser-desktop-after-recovery.png'),full_page=True)
        # Isolated synthetic QA customer; local Wrangler only, never production.
        peer=browser.new_context(viewport={'width':390,'height':844},is_mobile=True)
        phone=peer.new_page()
        phone.on('pageerror',lambda exc: errors.append('customer-sync-mobile: '+str(exc)))
        phone.goto(ORIGIN+'/',wait_until='domcontentloaded')
        wait_js(phone,"window._vsSync && _vsSync.ready")
        for client in [page,phone]: client.evaluate("VCFTransport.setPollMs(100)")
        page.evaluate("async()=>{students[0].name='QA Desktop';await _vsSync.save();}")
        wait_js(phone,"students[0].name==='QA Desktop'")
        check('desktop customer edit reaches independent mobile context',True)
        phone.evaluate("async()=>{students[0].ph='QA-MOBILE';await _vsSync.save();}")
        wait_js(page,"students[0].ph==='QA-MOBILE'")
        check('mobile customer edit reaches desktop',True)
        phone.reload(wait_until='domcontentloaded')
        wait_js(phone,"window._vsSync && _vsSync.ready && students[0].ph==='QA-MOBILE'")
        check('customer edits persist across mobile reload',True)
        _,_,customer_bytes=http('/api/state')
        canonical=json.loads(customer_bytes)
        check('server confirms both customer fields',canonical['state']['students'][0]['name']=='QA Desktop' and canonical['state']['students'][0]['ph']=='QA-MOBILE')
        page.evaluate("""async()=>{
          Object.assign(students[0],{status:'수강중',schedType:'flex',days:[],times:{},cls:'hob',freq:1,fee:0,st:'2026-01-01'});
          await _vsSync.save();go('schedule');
        }""")
        wait_js(phone,"students[0].status==='수강중'")
        phone.evaluate("go('schedule')")
        wait_js(page,"document.querySelector('.sg-cell')")
        day=page.evaluate("JSDOW[new Date().getDay()]")
        desktop_cell=page.locator(f'.sg-cell[data-day="{day}"][data-h="16:00"]').first
        desktop_cell.click(position={'x':3,'y':3})
        page.locator('#qsr-s1').click()
        page.locator('#mQS button[onclick="saveQS()"]').click()
        has_slot="(weekOvr[getWK(getMon(new Date()))]?.s1||[]).some(x=>x.time==='16:00')"
        wait_js(phone,has_slot)
        check('calendar cell assignment reaches mobile schedule engine',True)
        page.screenshot(path=str(EVIDENCE/'admin-week-desktop.png'),full_page=True)
        phone.evaluate("mobileSchedView='week';renderScheduleContent()")
        wait_js(phone,"document.querySelector('[data-cell=\"1\"]')")
        phone.locator(f'[data-cell="1"][data-day="{day}"][data-time="17:00"]').first.click(position={'x':3,'y':3})
        phone.locator('#qsr-s1').click()
        phone.locator('#mQS button[onclick="saveQS()"]').click()
        has_second="(weekOvr[getWK(getMon(new Date()))]?.s1||[]).some(x=>x.time==='17:00')"
        wait_js(page,has_second)
        check('mobile calendar assignment reaches desktop',True)
        phone.screenshot(path=str(EVIDENCE/'admin-week-mobile.png'),full_page=True)
        desktop_cell.click(position={'x':3,'y':3})
        page.locator('#qsr-s1').click()
        page.locator('#mQS button[onclick="saveQS()"]').click()
        wait_js(phone,'!'+has_slot)
        check('removed appointment stays removed on mobile',True)
        phone.reload(wait_until='domcontentloaded')
        wait_js(phone,"window._vsSync&&_vsSync.ready&&"+has_second)
        check('mobile reload retains remaining appointment and deletion',phone.evaluate('!'+has_slot))
        page.route('**/api/state',lambda route:route.fulfill(status=200,content_type='text/html',body='<html>Sign in</html>'))
        page.evaluate("_vsSync.retry()")
        check('expired-login HTML does not erase loaded customers',page.evaluate("students[0].id==='s1'"))
        check('invalid server response does not report synchronized',page.evaluate("_vsSync.mode!=='synced'"))
        page.unroute('**/api/state')
        page.evaluate("_vsSync.retry()")
        for client,label in [(page,'desktop'),(phone,'mobile')]:
            for tab in ['today','schedule','students','logs','payment','consult']:
                client.evaluate('(tab)=>go(tab)',tab)
                client.wait_for_timeout(200)
                wait_js(client,"getComputedStyle(document.getElementById('content')).opacity==='1'&&!document.getElementById('content').classList.contains('fade')")
                check(label+' '+tab+' heading not clipped',client.evaluate("document.getElementById('pt').getBoundingClientRect().bottom<=document.querySelector('.topbar').getBoundingClientRect().bottom"))
                check(label+' '+tab+' populated layout fits',client.evaluate('document.documentElement.scrollWidth<=innerWidth+1'))
                check(label+' '+tab+' title matches',client.evaluate('document.getElementById("pt").textContent===PT[page]'))
                if tab in ['today','schedule','students']:
                    client.screenshot(path=str(EVIDENCE/('admin-'+label+'-'+tab+'.png')),full_page=True)

        # PWA behavior uses the real browser service worker and local protected Worker.
        page.evaluate('async()=>{await navigator.serviceWorker.ready;}')
        wait_js(page,'navigator.serviceWorker.controller!==null')
        cdp=context.new_cdp_session(page)
        app_manifest=cdp.send('Page.getAppManifest')
        check('PWA manifest is fetched without parsing errors',not app_manifest.get('errors'))
        manifest=json.loads(app_manifest['data'])
        check('PWA start identity remains stable',manifest['id']=='/index.html' and manifest['start_url']=='/index.html')
        check('PWA launches standalone without portrait-only lock',manifest['display']=='standalone' and manifest['orientation']=='any')
        installability=cdp.send('Page.getInstallabilityErrors')
        (EVIDENCE/'pwa-installability.json').write_text(json.dumps(installability,indent=2),encoding='utf-8')
        product_installability_errors=[e for e in installability.get('installabilityErrors',[]) if e.get('errorId')!='in-incognito']
        check('Chrome reports no product PWA installability errors',not product_installability_errors)
        for client,label in [(page,'desktop'),(phone,'mobile')]:
            for view in ['today','schedule','students']:
                client.locator('#pwaGo'+view).click()
                wait_js(client,'page==='+json.dumps(view))
                check('PWA '+label+' quick action '+view,True)
            client.locator('#pwaInstallHelp summary').click()
            check('PWA '+label+' installation instructions expand',client.locator('#pwaInstallHelp').get_attribute('open') is not None)
            check('PWA '+label+' help fits viewport',client.evaluate('document.documentElement.scrollWidth<=innerWidth+1'))
            sizes=client.locator('#pwaWorkspace button').evaluate_all('(nodes)=>nodes.map(n=>n.getBoundingClientRect().height)')
            check('PWA '+label+' quick actions have 44px targets',min(sizes)>=44)
            client.screenshot(path=str(EVIDENCE/('pwa-'+label+'-install.png')),full_page=True)
            client.locator('#pwaInstallHelp summary').click()
        page.locator('#pwaGotoday').click()
        wait_js(page,"page==='today'&&getComputedStyle(document.getElementById('content')).opacity==='1'")
        page.screenshot(path=str(EVIDENCE/'pwa-desktop-home.png'),full_page=True)
        current_name=page.evaluate('students[0].name')
        context.set_offline(True)
        offline=page.reload(wait_until='domcontentloaded')
        check('PWA offline cold launch shows a real 503 reconnect page',offline.status==503)
        check('PWA offline page contains no customer data',current_name not in page.locator('body').inner_text())
        check('PWA offline page offers reconnect',page.locator('a').inner_text()=='연결 후 다시 열기')
        check('PWA offline APIs are not fake successful replies',page.evaluate("async()=>{try{await fetch('/api/state');return false;}catch(_){return true;}}"))
        check('PWA keeps no Cache Storage customer entries',page.evaluate('async()=>{const names=await caches.keys();return names.length===0;}'))
        page.screenshot(path=str(EVIDENCE/'pwa-offline.png'),full_page=True)
        context.set_offline(False)
        page.goto(ORIGIN+'/index.html',wait_until='domcontentloaded')
        wait_js(page,'window._vsSync&&_vsSync.ready&&students[0].name==='+json.dumps(current_name))
        check('PWA reconnect restores the same canonical customer',True)
        for width in [360,390]:
            phone.set_viewport_size({'width':width,'height':844})
            phone.locator('#pwaGotoday').click()
            wait_js(phone,"page==='today'&&getComputedStyle(document.getElementById('content')).opacity==='1'")
            check('PWA home '+str(width)+' fits viewport',phone.evaluate('document.documentElement.scrollWidth<=innerWidth+1'))
            phone.screenshot(path=str(EVIDENCE/('pwa-mobile-'+str(width)+'.png')),full_page=True)
        cdp.detach()

        peer.close()
        context.close()

        for width,height,label in [(390,844,'mobile-390'),(360,800,'mobile-360')]:
            mobile=browser.new_context(viewport={'width':width,'height':height},is_mobile=True)
            mobile_page=mobile.new_page()
            mobile_page.on('pageerror',lambda exc,label=label: errors.append(label+': '+str(exc)))
            mobile_page.goto(ORIGIN+'/',wait_until='domcontentloaded')
            wait_js(mobile_page,"window._cfSession && window._vsSync && window._vsSync.ready")
            check(label+' actual app hydrated',mobile_page.evaluate("weekOvr.w1.s1.time==='10:00'"))
            check(label+' document fits viewport',mobile_page.evaluate("document.documentElement.scrollWidth<=window.innerWidth+1"))
            mobile_page.screenshot(path=str(EVIDENCE/(f'browser-{label}.png')),full_page=True)
            mobile.close()

        browser.close();browser=None
        check('zero JavaScript page errors',len(errors)==0)
        result={
            'ok':True,'checkedAt':time.strftime('%Y-%m-%dT%H:%M:%SZ',time.gmtime()),
            'surface':'Actual index.html against local Wrangler Worker + SQLite Durable Object + R2; Chrome desktop and emulated mobile viewports; not a physical phone',
            'checks':checks,'checkCount':len(checks),'pageErrors':errors,
            'screenshots':['browser-desktop.png','browser-desktop-after-recovery.png','browser-mobile-390.png','browser-mobile-360.png'],
        }
        (EVIDENCE/'browser-result.json').write_text(json.dumps(result,ensure_ascii=False,indent=2),encoding='utf-8')
        print(json.dumps(result,ensure_ascii=False,indent=2))
except Exception as exc:
    failure={'ok':False,'error':repr(exc),'checks':checks,'pageErrors':errors}
    EVIDENCE.mkdir(parents=True,exist_ok=True)
    (EVIDENCE/'browser-result.json').write_text(json.dumps(failure,ensure_ascii=False,indent=2),encoding='utf-8')
    raise
finally:
    if browser:
        try:browser.close()
        except Exception:pass
    stop_tree(proc)
    worker_log.close()
