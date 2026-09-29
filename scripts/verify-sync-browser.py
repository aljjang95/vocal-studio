"""Actual Vocal Studio app against local Cloudflare Worker/SQLite DO/R2."""
import json
import os
import subprocess
import time
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path
from playwright.sync_api import sync_playwright
from browser_state_dir import create_browser_state

ROOT=Path(__file__).resolve().parents[1]
PORT=int(os.environ.get('VS_BROWSER_PORT','8799'))
ORIGIN=f'http://127.0.0.1:{PORT}'
PERSIST=create_browser_state(ROOT,os.environ.get('VS_BROWSER_PERSIST'))
EVIDENCE=Path(os.environ.get('VS_BROWSER_EVIDENCE',str(ROOT/'tmp'/'cf-evidence')))
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
    last_error=None
    while time.time()<deadline:
        try:
            if page.evaluate(f"() => Boolean({expression})"):
                return
        except Exception as exc:
            last_error=repr(exc)
        time.sleep(.05)
    detail='; last browser evaluation error: '+last_error if last_error else ''
    raise TimeoutError('browser condition timed out: '+expression+detail)

def wait_visual_settled(page):
    page.wait_for_function("""() => {
      const nodes=[...document.querySelectorAll('#content .card,.mobile-week-day')].filter(e=>{
        const s=getComputedStyle(e);return s.display!=='none'&&s.visibility!=='hidden'&&e.getClientRects().length>0;
      });
      return nodes.length>0&&nodes.every(e=>Number(getComputedStyle(e).opacity)>=.999&&!e.getAnimations().some(a=>a.playState==='running'));
    }""",timeout=5000)

def dismiss_today_alert(page):
    alert=page.locator('#mTodayAlert')
    if alert.count() and alert.is_visible():
        confirm=alert.get_by_role('button',name='확인',exact=True)
        if confirm.count():confirm.click(timeout=5000)

# Local-only QA portrait: a tiny valid JPEG stored in the local simulated R2 under the same key shape
# as migrated legacy portraits, so both a direct /api/media pointer and a legacy Firebase URL render it.
QA_PHOTO_KEY='studio/photos/qa-portrait.jpg'
QA_PHOTO_PATH='/api/media/'+urllib.parse.quote(QA_PHOTO_KEY,safe='')
QA_LEGACY_URL='https://firebasestorage.googleapis.com/v0/b/hlbvocalstudio-72481.firebasestorage.app/o/studio%2Fphotos%2Fqa-portrait.jpg?alt=media&token=qa-local-only'

def put_local_media(key,data,content_type):
    headers={'X-VS-Protocol':PROTO,'Origin':ORIGIN,'Content-Type':content_type}
    req=urllib.request.Request(ORIGIN+'/api/media/'+urllib.parse.quote(key,safe=''),data=data,headers=headers,method='PUT')
    try:
        with urllib.request.urlopen(req,timeout=4) as res:return res.status
    except urllib.error.HTTPError as exc:return exc.code

# Flags large light panels (the washed-out legacy look) and any element whose own text has
# contrast below 3:1 against its own opaque background.
LIGHT_SURFACE_JS="""() => {
  const parse=c=>{const m=String(c).match(/rgba?\\(([\\d.]+),\\s*([\\d.]+),\\s*([\\d.]+)(?:,\\s*([\\d.]+))?/);return m?{r:+m[1],g:+m[2],b:+m[3],a:m[4]===undefined?1:+m[4]}:null;};
  const lum=c=>{const f=v=>{v/=255;return v<=.03928?v/12.92:Math.pow((v+.055)/1.055,2.4);};return .2126*f(c.r)+.7152*f(c.g)+.0722*f(c.b);};
  const ratio=(x,y)=>{const a=lum(x),b=lum(y);return (Math.max(a,b)+.05)/(Math.min(a,b)+.05);};
  const roots=[document.querySelector('.main'),document.querySelector('.sb'),document.querySelector('.mobile-tab-bar')].filter(Boolean);
  const found=[];
  for(const root of roots){
    for(const e of [root,...root.querySelectorAll('*')]){
      const r=e.getBoundingClientRect();if(r.width<8||r.height<8||r.bottom<0||r.top>innerHeight*3)continue;
      const s=getComputedStyle(e);if(s.display==='none'||s.visibility==='hidden'||Number(s.opacity)<.5)continue;
      if(e.closest('.ov,.modal,.person-avatar,.profile-photo,img,svg,canvas,.toast'))continue;
      const bg=parse(s.backgroundColor);if(!bg||bg.a<.5)continue;
      const ownText=[...e.childNodes].some(n=>n.nodeType===3&&n.textContent.trim());
      const fg=parse(s.color);
      if(ownText&&fg&&ratio(fg,bg)<3)found.push({kind:'low-contrast',tag:e.tagName,id:e.id,cls:String(e.className).slice(0,60),bg:s.backgroundColor,color:s.color,text:(e.textContent||'').trim().slice(0,30)});
      if(found.length>=12)return found;
    }
  }
  return found;
}"""

EVIDENCE.mkdir(parents=True,exist_ok=True)
subprocess.run(['node','scripts/build-worker.mjs'],cwd=ROOT,check=True)
command=['node',str(ROOT/'node_modules/wrangler/bin/wrangler.js'),'dev','--config','wrangler.local.jsonc','--ip','127.0.0.1','--port',str(PORT),'--local','--persist-to',str(PERSIST)]
worker_log=(EVIDENCE/'browser-worker.log').open('w',encoding='utf-8')
proc=subprocess.Popen(command,cwd=ROOT,stdout=worker_log,stderr=subprocess.STDOUT,text=True)

source={
    'students':[{'id':'s1','name':'QA','photo':'/api/media/studios/photos/qa-missing.jpg'},
                {'id':'s-photo','name':'Photo QA','status':'휴강','photo':QA_PHOTO_PATH},
                {'id':'s-legacy','name':'Legacy QA','status':'휴강','photo':QA_LEGACY_URL},
                {'id':'s-remote','name':'Remote QA','status':'휴강','photo':'https://images.example.invalid/blocked.jpg'}],
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
        # Generate a real JPEG in the browser and store it in local simulated R2 only.
        maker=browser.new_page()
        jpeg_b64=maker.evaluate("""()=>{const c=document.createElement('canvas');c.width=c.height=64;const g=c.getContext('2d');
          const grad=g.createLinearGradient(0,0,64,64);grad.addColorStop(0,'#ffcc66');grad.addColorStop(1,'#3366ff');g.fillStyle=grad;g.fillRect(0,0,64,64);
          g.fillStyle='#fff';g.beginPath();g.arc(32,26,12,0,Math.PI*2);g.fill();g.fillRect(14,42,36,22);
          return c.toDataURL('image/jpeg',.9).split(',')[1];}""")
        maker.close()
        import base64
        check('local QA portrait stored in simulated R2',put_local_media(QA_PHOTO_KEY,base64.b64decode(jpeg_b64),'image/jpeg') in (200,201))
        status,_,_=http(QA_PHOTO_PATH,'HEAD')
        check('local QA portrait readable through /api/media',status==200)
        context=browser.new_context(viewport={'width':1440,'height':900})
        page=context.new_page()
        page.on('pageerror',lambda exc: errors.append('desktop: '+str(exc)))
        csp_errors=[]
        page.on('console',lambda msg: csp_errors.append(msg.text) if 'Content Security Policy' in msg.text else None)
        page.goto(ORIGIN+'/',wait_until='domcontentloaded',timeout=60000)
        wait_js(page,"window._cfSession && window._vsSync && window._vsSync.ready")
        check('desktop actual app hydrated',page.evaluate("weekOvr.w1.s1.time==='10:00'"))
        check('desktop opens today view',page.evaluate("page==='today'&&document.getElementById('pt').textContent==='오늘 스케줄'"))
        check('desktop Cloudflare principal bound',page.evaluate("_cfSession.principal.length>0"))
        page.screenshot(path=str(EVIDENCE/'browser-desktop.png'),full_page=True)
        page.evaluate("go('students')")
        wait_js(page,"page==='students'&&document.getElementById('studentsGrid')")
        page.wait_for_function("""()=>{const pick=n=>[...document.querySelectorAll('#studentsGrid .person-avatar')].find(a=>a.getAttribute('aria-label')===n);
          const ok=n=>{const a=pick(n),i=a&&a.querySelector('img');return !!i&&i.complete&&i.naturalWidth>0&&!i.hidden;};return ok('Photo QA')&&ok('Legacy QA');}""",timeout=10000)
        portrait=page.evaluate("""()=>{const pick=n=>[...document.querySelectorAll('#studentsGrid .person-avatar')].find(a=>a.getAttribute('aria-label')===n);
          const info=n=>{const a=pick(n),i=a&&a.querySelector('img'),f=a&&a.querySelector('.schedule-avatar-fallback'),ar=a&&a.getBoundingClientRect(),ir=i&&i.getBoundingClientRect();
            return {src:i?i.getAttribute('src'):null,loaded:!!i&&i.naturalWidth>0&&!i.hidden,fill:!!ir&&Math.abs(ir.width-ar.width)<=2&&Math.abs(ir.height-ar.height)<=2,fallbackVisible:!!f&&!f.hidden,initial:f&&f.textContent};};
          return {photo:info('Photo QA'),legacy:info('Legacy QA'),remote:info('Remote QA')};}""")
        print('portrait diagnostics: '+json.dumps(portrait,ensure_ascii=False))
        check('stored /api/media portrait loads and fills its avatar',portrait['photo']['loaded'] and portrait['photo']['fill'] and not portrait['photo']['fallbackVisible'])
        check('legacy Firebase portrait displays from same-origin R2',portrait['legacy']['loaded'] and portrait['legacy']['src']==QA_PHOTO_PATH+'?portrait=daylight-v1' and not portrait['legacy']['fallbackVisible'])
        check('unknown remote portrait falls back to initial without an image request',portrait['remote']['src'] is None and portrait['remote']['fallbackVisible'] and portrait['remote']['initial']=='R')
        check('stored legacy reference is unchanged in canonical state',page.evaluate("students.find(s=>s.id==='s-legacy').photo")==QA_LEGACY_URL)
        # Opening and saving the edit form must keep each stored photo reference exactly.
        for sid,expected in [('s-legacy',QA_LEGACY_URL),('s-photo',QA_PHOTO_PATH)]:
            page.evaluate('(sid)=>openSModal(sid)',sid)
            wait_js(page,"document.getElementById('mS')&&document.getElementById('mS').classList.contains('open')")
            preview=page.evaluate("()=>{const i=document.querySelector('#s-photo-preview img');return {data:document.getElementById('s-photo-data').value,src:i&&i.getAttribute('src')}}")
            check('edit form keeps stored photo reference for '+sid,preview['data']==expected and preview['src']==QA_PHOTO_PATH)
            page.evaluate("async()=>{await saveStudent();}")
            wait_js(page,"!document.getElementById('mS').classList.contains('open')")
            check('saving '+sid+' leaves its stored photo unchanged',page.evaluate('(sid)=>students.find(s=>s.id===sid).photo',sid)==expected)
        page.wait_for_timeout(300)
        check('no Content Security Policy image violations',not [m for m in csp_errors if 'img-src' in m])
        page.evaluate("go('today')")

        loading_context=browser.new_context(viewport={'width':390,'height':844},is_mobile=True)
        loading_page=loading_context.new_page()
        loading_page.on('pageerror',lambda exc: errors.append('loading-mobile-390: '+str(exc)))
        loading_page.add_init_script("""(()=>{
          const original=window.fetch.bind(window);
          const pending=window.__vsPendingLoadingPaths=Object.create(null);
          const passThrough=window.__vsPassThroughLoadingPaths=new Set();
          window.__vsReleaseLoadingPath=(path)=>{
            const queue=pending[path]||[],release=queue.shift();
            if(!release)return false;
            if(!queue.length)delete pending[path];
            release.pass();return true;
          };
          window.__vsFailLoadingPath=(path)=>{
            const queue=pending[path]||[],failure=queue.shift();
            if(!failure)return false;
            if(!queue.length)delete pending[path];
            passThrough.add(path);failure.fail();return true;
          };
          window.fetch=(input,init)=>{
            const raw=typeof input==='string'?input:(input&&input.url)||'';
            let path='';try{path=new URL(raw,location.href).pathname;}catch(_){return original(input,init);}
            if((path!=='/api/session'&&path!=='/api/state')||passThrough.has(path))return original(input,init);
            return new Promise((resolve,reject)=>{
              const queue=pending[path]||(pending[path]=[]);
              queue.push({pass:()=>original(input,init).then(resolve,reject),fail:()=>reject(new TypeError('injected-loading-failure'))});
            });
          };
        })();""")
        loading_page.goto(ORIGIN+'/',wait_until='domcontentloaded')
        def loading_snapshot():
            return loading_page.evaluate("""()=>{const e=document.getElementById('topSyncStatus'),p=document.getElementById('vsSyncPanel'),a=document.getElementById('vsSyncActions'),h=document.querySelector('.topbar'),c=document.getElementById('content'),f=c&&c.firstElementChild,z=document.getElementById('v2InitialSyncState'),q=window.__vsPendingLoadingPaths,rect=x=>{if(!x)return null;const r=x.getBoundingClientRect();return {top:r.top,bottom:r.bottom,width:r.width,height:r.height}};return {readyState:document.readyState,page:window.page,bodyClass:document.body&&document.body.className,transport:typeof VCFTransport,sync:typeof _vsSync,syncReady:!!(window._vsSync&&_vsSync.ready),syncMode:window._vsSync&&_vsSync.mode,statusText:e&&e.textContent,statusRole:e&&e.getAttribute('role'),statusLive:e&&e.getAttribute('aria-live'),statusDisplay:e&&getComputedStyle(e).display,panelMode:p&&p.dataset.mode,actionsDisplay:a&&getComputedStyle(a).display,contentChildren:c&&c.childElementCount,contentTextLength:c&&c.textContent.trim().length,contentBusy:c&&c.getAttribute('aria-busy'),firstChildTag:f&&f.tagName,firstChildClass:f&&String(f.className),firstChildOpacity:f&&getComputedStyle(f).opacity,firstChildVisibility:f&&getComputedStyle(f).visibility,firstChildDisplay:f&&getComputedStyle(f).display,firstChildRect:rect(f),hasLoadingPane:!!z,loadingRole:z&&z.getAttribute('role'),loadingBusy:z&&z.getAttribute('aria-busy'),loadingTextLength:z&&z.textContent.trim().length,topbar:rect(h),status:rect(e),pending:q&&Object.keys(q).reduce((o,k)=>(o[k]=q[k].length,o),{}),releaseType:typeof window.__vsReleaseLoadingPath}}""")
        try:
            wait_js(loading_page,"(()=>{const e=document.getElementById('topSyncStatus'),p=document.getElementById('vsSyncPanel'),a=document.getElementById('vsSyncActions'),h=document.querySelector('.topbar'),q=window.__vsPendingLoadingPaths; if(!e||!p||!a||!h||!q||!q['/api/session']||!q['/api/session'].length)return false;const er=e.getBoundingClientRect(),hr=h.getBoundingClientRect();return e.textContent.includes('연결 확인 중')&&getComputedStyle(e).display!=='none'&&e.getAttribute('role')==='status'&&p.dataset.mode==='checking-session'&&getComputedStyle(a).display==='none'&&er.top>=hr.bottom})()")
        except TimeoutError:
            print('cold-start status timeout snapshot:',json.dumps(loading_snapshot(),ensure_ascii=False))
            raise
        check('cold session loading request is held before response',loading_page.evaluate("window.__vsPendingLoadingPaths['/api/session'].length>0"))
        wait_js(loading_page,"getComputedStyle(document.getElementById('content')).opacity==='1'")
        loading_page.screenshot(path=str(EVIDENCE/'loading-session-mobile-390.png'))
        check('injected initial Access failure is released',loading_page.evaluate("window.__vsFailLoadingPath('/api/session')"))
        wait_js(loading_page,"document.getElementById('vsSyncPanel').dataset.mode==='auth-required'&&document.getElementById('v2InitialSyncState')?.getAttribute('role')==='alert'")
        check('Access failure exposes a visible retry action',loading_page.evaluate("()=>{const a=document.getElementById('vsSyncActions'),b=document.getElementById('vsSyncRetry'),p=document.getElementById('v2InitialSyncState');return !!a&&getComputedStyle(a).display==='flex'&&!!b&&!b.hidden&&!!p&&p.classList.contains('is-error')&&p.getAttribute('role')==='alert'}"))
        loading_page.screenshot(path=str(EVIDENCE/'loading-error-mobile-390.png'))
        loading_page.locator('#vsSyncRetry').click()
        wait_js(loading_page,"(()=>{const e=document.getElementById('topSyncStatus'),p=document.getElementById('vsSyncPanel'),a=document.getElementById('vsSyncActions'),q=window.__vsPendingLoadingPaths;return e&&p&&a&&q&&q['/api/state']&&q['/api/state'].length&&e.textContent.includes('서버 자료 확인 중')&&e.getAttribute('role')==='status'&&p.dataset.mode==='checking-server'&&getComputedStyle(e).display!=='none'&&getComputedStyle(a).display==='none'})()")
        loading_pane_ready=loading_page.evaluate("()=>{const p=document.getElementById('v2InitialSyncState'),c=document.getElementById('content');return !!p&&p.getAttribute('role')==='status'&&p.getAttribute('aria-busy')==='true'&&c.getAttribute('aria-busy')==='true'&&!p.classList.contains('is-error')&&p.textContent.includes('공용 자료를 불러오는 중')&&!c.querySelector('.admin-today')}")
        if not loading_pane_ready:print('cold server loading snapshot:',json.dumps(loading_snapshot(),ensure_ascii=False))
        check('retry returns the error panel to accessible loading state',loading_pane_ready)
        wait_js(loading_page,"getComputedStyle(document.getElementById('content')).opacity==='1'")
        loading_page.screenshot(path=str(EVIDENCE/'loading-state-mobile-390.png'))
        check('server state request released after visible loading state',loading_page.evaluate("window.__vsReleaseLoadingPath('/api/state')"))
        wait_js(loading_page,"window._cfSession&&window._vsSync&&window._vsSync.ready&&['synced','recovery'].includes(window._vsSync.mode)")
        check('retry recovers to confirmed server state',loading_page.evaluate("_vsSync.ready&&['synced','recovery'].includes(_vsSync.mode)&&document.getElementById('topSyncStatus').textContent.indexOf('동기화됨')===0"))
        check('cold loading pane clears after server hydration',loading_page.evaluate("()=>!document.getElementById('v2InitialSyncState')&&!document.getElementById('content').hasAttribute('aria-busy')"))
        loading_context.close()

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
        day=page.evaluate("""()=>{
          const cell=[...document.querySelectorAll('.sg-cell[data-h="16:00"]')]
            .find(el=>getComputedStyle(el).display!=='none'&&!isOffDay(el.dataset.date));
          return cell?.dataset.day||'';
        }""")
        check('schedule fixture has a visible non-holiday 16:00 cell',bool(day))
        desktop_cell=page.locator(f'.sg-cell[data-day="{day}"][data-h="16:00"]').first
        desktop_cell.click(position={'x':3,'y':3})
        page.locator('#qsr-s1').click()
        page.locator('#mQS button[onclick="saveQS()"]').click()
        has_slot="(weekOvr[getWK(getMon(new Date()))]?.s1||[]).some(x=>x.time==='16:00')"
        wait_js(phone,has_slot)
        check('calendar cell assignment reaches mobile schedule engine',True)
        page.screenshot(path=str(EVIDENCE/'admin-week-desktop.png'),full_page=True)
        phone.evaluate("mobileSchedView='week';renderScheduleContent()")
        wait_js(phone,"document.querySelector('.mobile-week-agenda')")
        week_day_index=page.evaluate(f"ALL7.indexOf({json.dumps(day)})")
        check('mobile schedule assignment uses desktop fixture weekday',week_day_index>=0)
        phone.locator('.mobile-week-day').nth(week_day_index).locator('.mobile-week-add').click()
        wait_js(phone,"mobileSchedView==='day'&&document.querySelector('[data-cell=\"1\"]')")
        phone.locator(f'[data-cell="1"][data-day="{day}"][data-time="17:00"]').first.click(position={'x':3,'y':3})
        phone.locator('#qsr-s1').click()
        phone.locator('#mQS button[onclick="saveQS()"]').click()
        has_second="(weekOvr[getWK(getMon(new Date()))]?.s1||[]).some(x=>x.time==='17:00')"
        wait_js(page,has_second)
        check('mobile calendar assignment reaches desktop',True)
        phone.evaluate("mSchedWeek()")
        wait_js(phone,"document.querySelector('.mobile-week-agenda')")
        page.wait_for_function("() => {const images=[...document.querySelectorAll('.schedule-card .schedule-avatar img')];return images.length>0&&images.every(img=>img.complete&&img.naturalWidth===0&&img.hidden&&!img.nextElementSibling.hidden)}",timeout=10000)
        check('missing R2 photo shows initials in schedule cards',True)
        check('schedule cards omit customer contact fields',page.evaluate("![...document.querySelectorAll('.schedule-card')].some(card=>card.textContent.includes('QA-MOBILE'))"))
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
                    dismiss_today_alert(client)
                    light=client.evaluate(LIGHT_SURFACE_JS)
                    if light:print(label+' '+tab+' light/low-contrast surfaces: '+json.dumps(light,ensure_ascii=False))
                    check(label+' '+tab+' has no low-contrast text on daylight surfaces',not light)
                    page_bottom=client.evaluate("""async()=>{window.scrollTo(0,document.documentElement.scrollHeight);await new Promise(r=>setTimeout(r,80));
                      const probe=document.elementFromPoint(innerWidth-4,innerHeight-4);const rootBg=getComputedStyle(document.documentElement).backgroundColor;window.scrollTo(0,0);
                      return {rootBg};}""")
                    check(label+' '+tab+' page root retains daylight surface below the fold',page_bottom['rootBg']=='rgb(244, 241, 235)')
                if tab=='today':
                    ops=client.evaluate("""()=>{const w=document.getElementById('pwaWorkspace');if(!w||getComputedStyle(w).display==='none')return {shown:false};
                      const wr=w.getBoundingClientRect(),tiles=[...w.querySelectorAll('.v2-kpi,.v2-action-card')].map(e=>e.getBoundingClientRect());
                      return {shown:true,height:Math.round(wr.height),scrollHeight:w.scrollHeight,clientHeight:w.clientHeight,style:w.getAttribute('style')||'',clipped:tiles.filter(r=>r.bottom>wr.bottom+1||r.right>wr.right+1).length,tiles:tiles.length};}""")
                    print(label+' operations card diagnostics: '+json.dumps(ops,ensure_ascii=False))
                    check(label+' operations card shows every tile without clipping',ops.get('shown') is False or ops['clipped']==0)
                if tab in ['today','schedule','students']:
                    client.evaluate('window.scrollTo(0,0)')
                    client.wait_for_timeout(100)
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
                client.evaluate("go('today')")
                wait_js(client,"page==='today'&&getComputedStyle(document.getElementById('content')).opacity==='1'")
                dismiss_today_alert(client)
                client.locator('#pwaGo'+view).click()
                wait_js(client,'page==='+json.dumps(view))
                dismiss_today_alert(client)
                check('PWA '+label+' quick action '+view,True)
                if view=='schedule':
                    check('PWA '+label+' weekly work area hides clipped launcher',client.locator('#pwaWorkspace').evaluate("e=>getComputedStyle(e).display==='none'"))
            client.evaluate("go('today')")
            wait_js(client,"page==='today'&&getComputedStyle(document.getElementById('content')).opacity==='1'")
            client.locator('#pwaInstallHelp summary').click()
            check('PWA '+label+' installation instructions expand',client.locator('#pwaInstallHelp').get_attribute('open') is not None)
            check('PWA '+label+' help fits viewport',client.evaluate('document.documentElement.scrollWidth<=innerWidth+1'))
            sizes=client.locator('#pwaWorkspace button').evaluate_all('(nodes)=>nodes.map(n=>n.getBoundingClientRect().height)')
            check('PWA '+label+' quick actions have 44px targets',min(sizes)>=44)
            client.screenshot(path=str(EVIDENCE/('pwa-'+label+'-install.png')),full_page=True)
            client.locator('#pwaInstallHelp summary').click()
        dismiss_today_alert(page)
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
            phone.evaluate("go('today')")
            wait_js(phone,"page==='today'&&getComputedStyle(document.getElementById('content')).opacity==='1'")
            dismiss_today_alert(phone)
            phone.locator('#pwaGotoday').click()
            wait_js(phone,"page==='today'&&getComputedStyle(document.getElementById('content')).opacity==='1'")
            check('PWA home '+str(width)+' fits viewport',phone.evaluate('document.documentElement.scrollWidth<=innerWidth+1'))
            phone.screenshot(path=str(EVIDENCE/('pwa-mobile-'+str(width)+'.png')),full_page=True)
            dismiss_today_alert(phone)
            phone.locator('#pwaGoschedule').click()
            wait_js(phone,"page==='schedule'&&mobileSchedView==='week'&&document.querySelectorAll('.mobile-week-day').length===7&&getComputedStyle(document.getElementById('content')).opacity==='1'")
            check('mobile schedule action opens weekly agenda '+str(width),phone.evaluate("mobileSchedView==='week'&&document.querySelectorAll('.mobile-week-day').length===7"))
            phone.locator('div[onclick="mSchedWeek()"]',).click()
            wait_js(phone,"document.querySelector('.mobile-week-agenda')&&document.querySelectorAll('.mobile-week-day').length===7")
            check('mobile weekly agenda '+str(width)+' fits viewport',phone.evaluate("document.documentElement.scrollWidth<=innerWidth+1&&document.querySelector('.mobile-week-agenda').scrollWidth<=innerWidth"))
            check('mobile weekly view shows readable names and current-day marker '+str(width),phone.locator('.mobile-week-day.is-today').count()==1 and phone.locator('.mobile-week-day .schedule-card-name').count()>0)
            check('mobile weekly cards omit contact fields '+str(width),phone.evaluate("![...document.querySelectorAll('.mobile-week-slot')].some(card=>/\\b\\d{2,4}-\\d{3,4}-\\d{4}\\b/.test(card.textContent))"))
            current_week=phone.locator('#wkLbl').inner_text()
            phone.get_by_role('button',name='다음 주',exact=True).click()
            wait_js(phone,'document.getElementById("wkLbl")&&document.getElementById("wkLbl").textContent!=='+json.dumps(current_week))
            check('mobile weekly next navigation '+str(width),phone.evaluate('wkOfs===1'))
            check('mobile weekly empty state '+str(width),phone.locator('.mobile-week-empty').count()==7)
            if width==390:
                phone.evaluate('window.scrollTo(0,0)')
                phone.screenshot(path=str(EVIDENCE/'visual-week-empty-mobile-390.png'),full_page=True)
            phone.get_by_role('button',name='이번 주로 이동',exact=True).click()
            wait_js(phone,'document.getElementById("wkLbl")&&document.getElementById("wkLbl").textContent==='+json.dumps(current_week))
            check('mobile weekly today navigation '+str(width),phone.evaluate('wkOfs===0'))
            phone.screenshot(path=str(EVIDENCE/('admin-week-mobile-'+str(width)+'.png')),full_page=True)
            phone.evaluate("go('students')")
            wait_js(phone,"page==='students'&&document.getElementById('studentsGrid')")
            phone.wait_for_function("() => {const images=[...document.querySelectorAll('#studentsGrid .person-avatar img')];return images.some(img=>img.complete&&img.naturalWidth===0&&img.hidden&&!img.nextElementSibling.hidden)}",timeout=10000)
            check('missing R2 photo shows initials in roster at '+str(width),True)
            check('student roster '+str(width)+' fits viewport',phone.evaluate('document.documentElement.scrollWidth<=innerWidth+1'))
            phone.evaluate("go('schedule');mobileSchedView='week';renderScheduleContent()")
            wait_js(phone,"document.querySelector('.mobile-week-agenda')&&document.querySelectorAll('.mobile-week-day').length===7")
        cdp.detach()

        visual_storage_state=context.storage_state()
        peer.close()
        context.close()

        for width,height,label in [(390,844,'mobile-390'),(360,800,'mobile-360')]:
            mobile=browser.new_context(viewport={'width':width,'height':height},is_mobile=True)
            mobile_page=mobile.new_page()
            mobile_page.on('pageerror',lambda exc,label=label: errors.append(label+': '+str(exc)))
            mobile_page.goto(ORIGIN+'/',wait_until='domcontentloaded')
            wait_js(mobile_page,"window._cfSession && window._vsSync && window._vsSync.ready")
            check(label+' actual app hydrated',mobile_page.evaluate("weekOvr.w1.s1.time==='10:00'"))
            wait_js(mobile_page,"page==='schedule'&&mobileSchedView==='week'&&document.querySelectorAll('.mobile-week-day').length===7")
            check(label+' opens weekly schedule with selected navigation',mobile_page.evaluate("document.getElementById('pt').textContent==='주간 스케줄'&&document.body.dataset.activePage==='schedule'&&document.querySelector('.ni[data-p=schedule]').classList.contains('on')"))
            check(label+' document fits viewport',mobile_page.evaluate("document.documentElement.scrollWidth<=window.innerWidth+1"))
            mobile_page.screenshot(path=str(EVIDENCE/(f'browser-{label}.png')),full_page=True)
            mobile.close()

        # Reproduce the production quota failure: a closed tab left a same-as-server sync backup
        # and several recovery snapshots that together fill localStorage. The new tab must reclaim
        # only superseded copies and keep syncing.
        quota_context=browser.new_context(viewport={'width':1440,'height':900},storage_state=visual_storage_state)
        quota_page=quota_context.new_page()
        quota_page.on('pageerror',lambda exc: errors.append('quota: '+str(exc)))
        quota_page.goto(ORIGIN+'/',wait_until='domcontentloaded')
        wait_js(quota_page,"window._cfSession&&window._vsSync&&window._vsSync.ready&&_vsSync.mode==='synced'")
        quota_seed=quota_page.evaluate("""()=>{
          const s=_vsSync,text=JSON.stringify(s.state),prefix=s.key+':backup:';
          for(let i=localStorage.length-1;i>=0;i--){const k=localStorage.key(i);if(k&&k.indexOf(prefix)===0)localStorage.removeItem(k);}
          localStorage.setItem(prefix+'closed-tab-00000000-0000-0000-0000-000000000000',text);
          const older=JSON.parse(JSON.stringify(s.state.base));older.students=older.students.map(r=>Object.assign({},r,{name:(r.name||'')+' (old)'}));
          localStorage.setItem(prefix+'closed-tab-11111111-1111-1111-1111-111111111111',JSON.stringify({version:1,namespace:s.state.namespace,owner:s.state.owner,revision:0,base:older,local:s.state.base,recovery:[older],resumeConflict:true}));
          for(let i=localStorage.length-1;i>=0;i--){const k=localStorage.key(i);if(/^vsC_recovery_\\d+$/.test(k))localStorage.removeItem(k);}
          for(let i=0;i<3;i++)localStorage.setItem('vsC_recovery_'+(4000000000000+i),'r'.repeat(60000));
          let filled=0,seq=0;
          for(const size of [200000,20000,2000,200]){const pad='x'.repeat(size);for(let i=0;i<200;i++){try{localStorage.setItem('vsC_qa_fill_'+seq,pad);seq++;filled++;}catch(e){break;}}}
          let freeProbe=true;try{localStorage.setItem('__vs_quota_probe__',text);localStorage.removeItem('__vs_quota_probe__');}catch(e){freeProbe=false;}
          return {filled,freeProbe,stateLen:text.length};}""")
        print('quota seed: '+json.dumps(quota_seed))
        check('quota fixture fills local storage before reload',quota_seed['filled']>0 and not quota_seed['freeProbe'])
        quota_page.reload(wait_until='domcontentloaded')
        wait_js(quota_page,"window._cfSession&&window._vsSync&&window._vsSync.ready")
        quota_after=quota_page.evaluate("""()=>{const s=_vsSync,prefix=s.key+':backup:';let backups=0,snapshots=0;
          for(let i=0;i<localStorage.length;i++){const k=localStorage.key(i);if(k.indexOf(prefix)===0)backups++;if(/^vsC_recovery_\\d+$/.test(k))snapshots++;}
          return {mode:s.mode,blocked:s.blocked,panel:document.getElementById('vsSyncPanel').dataset.mode,own:localStorage.getItem(prefix+s.instance)!==null,
            closed:localStorage.getItem(prefix+'closed-tab-00000000-0000-0000-0000-000000000000')!==null,superseded:localStorage.getItem(prefix+'closed-tab-11111111-1111-1111-1111-111111111111')!==null,backups,snapshots};}""")
        print('quota after reload: '+json.dumps(quota_after))
        # A same-sized write can succeed without reclaiming the older, non-identical copy.
        # The following edit/readback proves that a later write can still reclaim space.
        check('full local storage keeps a current backup and sync running',quota_after['mode'] in ('synced','recovery') and not quota_after['blocked'] and quota_after['own'] and not quota_after['closed'])
        quota_page.evaluate("()=>{weekOvr.w1=weekOvr.w1||{};weekOvr.w1.s1={time:'10:30'};saveAll();}")
        wait_js(quota_page,"_vsSync.pending()===0&&(_vsSync.mode==='synced'||_vsSync.mode==='recovery')")
        status,_,body=http('/api/export')
        check('edit after quota recovery reaches the server',status==200 and json.loads(body)['state']['weekOvr']['w1']['s1']['time']=='10:30')
        quota_page.evaluate("()=>{weekOvr.w1.s1={time:'10:00'};saveAll();}")
        wait_js(quota_page,"_vsSync.pending()===0")
        quota_page.evaluate("()=>{for(let i=localStorage.length-1;i>=0;i--){const k=localStorage.key(i);if(k.indexOf('vsC_qa_fill_')===0||/^vsC_recovery_4000000000\\d{3}$/.test(k))localStorage.removeItem(k);}}")
        reclaim_check=quota_page.evaluate("""()=>{const count=()=>{let n=0;for(let i=0;i<localStorage.length;i++)if(/^vsC_recovery_\\d+$/.test(localStorage.key(i)))n++;return n;};
          for(let i=0;i<3;i++)localStorage.setItem('vsC_recovery_'+(4100000000000+i),'q');const before=count();const removed=_vsSync.a.reclaim();const after=count();
          for(let i=localStorage.length-1;i>=0;i--){const k=localStorage.key(i);if(/^vsC_recovery_41000000000\\d{2}$/.test(k))localStorage.removeItem(k);}
          return {before,removed,after};}""")
        print('adapter reclaim: '+json.dumps(reclaim_check))
        check('sync adapter reclaim prunes local recovery snapshots to one',reclaim_check['before']>=3 and reclaim_check['after']==1 and reclaim_check['removed']==reclaim_check['before']-1)
        quota_context.close()

        visual_context=browser.new_context(viewport={'width':1440,'height':900},storage_state=visual_storage_state)
        visual_page=visual_context.new_page()
        visual_page.on('pageerror',lambda exc: errors.append('visual-desktop: '+str(exc)))
        visual_page.goto(ORIGIN+'/',wait_until='domcontentloaded')
        wait_js(visual_page,"window._cfSession&&window._vsSync&&window._vsSync.ready")
        dismiss_today_alert(visual_page)
        visual_page.locator('#pwaGoschedule').click()
        wait_js(visual_page,"page==='schedule'&&document.querySelector('.sg-cell')")
        wait_js(visual_page,"window._vsSync&&_vsSync.ready&&_vsSync.mode==='synced'")
        wait_js(visual_page,"getComputedStyle(document.getElementById('content')).opacity==='1'")
        dismiss_today_alert(visual_page)
        wait_js(visual_page,"!document.querySelector('.ov.open')")
        wait_visual_settled(visual_page)
        check('desktop weekly cards finish entrance animations',visual_page.evaluate("()=>[...document.querySelectorAll('#content .card')].filter(e=>e.getClientRects().length>0).every(e=>Number(getComputedStyle(e).opacity)>=.999&&!e.getAnimations().some(a=>a.playState==='running'))"))
        weekly_style_diagnostics=visual_page.evaluate("""() => {
          const normalLabel=document.querySelector('.sg-hd:not(.td):not(.off-day) .dn'),today=document.querySelector('.sg-hd.td'),todayCell=document.querySelector('.sg-cell.td-col'),holidayLabel=today&&today.querySelector('div[style*="font-size:9px"]'),cardHeader=document.querySelector('#content .card .ch'),cardTitle=cardHeader&&cardHeader.querySelector('.ct'),card=[...document.querySelectorAll('.sg .schedule-card')].find(x=>x.textContent.includes('QA Desktop'));
          const style=(e)=>e?getComputedStyle(e):null;
          const normal=style(normalLabel),todayStyle=style(today),todayDate=style(today&&today.querySelector('.dd')),cell=style(todayCell),head=style(cardHeader),title=style(cardTitle);
          const name=style(card&&card.querySelector('.schedule-card-name')),time=style(card&&card.querySelector('.schedule-card-time')),kind=style(card&&card.querySelector('.schedule-card-kind')),status=style(card&&card.querySelector('.schedule-status'));
          return {normalHeader:{background:normalLabel&&style(normalLabel.parentElement).backgroundColor,color:normal&&normal.color},todayHeader:{background:todayStyle&&todayStyle.backgroundColor,labelColor:today&&style(today.querySelector('.dn')).color,dateColor:todayDate&&todayDate.color,holidayLabelColor:holidayLabel&&style(holidayLabel).color},todayCell:cell&&cell.backgroundColor,cardHeader:{background:head&&head.backgroundColor,titleColor:title&&title.color},desktopLabels:{name:name&&name.fontSize,time:time&&time.fontSize,kind:kind&&kind.fontSize,status:status&&status.fontSize}};
        }""")
        print('desktop weekly style diagnostics: '+json.dumps(weekly_style_diagnostics,ensure_ascii=False))
        check('weekday header uses daylight surface and dark text',weekly_style_diagnostics['normalHeader']['background']=='rgb(240, 237, 229)' and weekly_style_diagnostics['normalHeader']['color']=='rgb(52, 73, 59)')
        check('today and holiday remain distinct on daylight schedule',weekly_style_diagnostics['todayHeader']['background']=='rgb(225, 235, 223)' and weekly_style_diagnostics['todayHeader']['labelColor']=='rgb(44, 85, 59)' and weekly_style_diagnostics['todayHeader']['dateColor']=='rgb(44, 85, 59)' and weekly_style_diagnostics['todayHeader']['holidayLabelColor'] in (None,'rgb(165, 71, 89)') and '223, 235, 217' in weekly_style_diagnostics['todayCell'])
        holiday_labels=visual_page.evaluate("()=>[...document.querySelectorAll('.sg-hd.off-day > div[style*=\"font-size:9px\"][style*=\"color:var(--r)\"]')].map(e=>getComputedStyle(e).color)")
        check('holiday labels on weekly header stay readable rose',len(holiday_labels)>0 and all(c=='rgb(165, 71, 89)' for c in holiday_labels))
        check('schedule card header uses daylight surface and dark title',weekly_style_diagnostics['cardHeader']['background']=='rgb(240, 237, 229)' and weekly_style_diagnostics['cardHeader']['titleColor']=='rgb(38, 55, 47)')
        check('desktop schedule card labels use readable sizes',weekly_style_diagnostics['desktopLabels']=={'name':'13px','time':'11.5px','kind':'11.5px','status':'11px'})
        check('clean desktop visual sync state settled',visual_page.evaluate("_vsSync.ready&&_vsSync.mode==='synced'&&document.getElementById('vsSyncPanel').dataset.mode==='synced'"))
        check('clean desktop visual capture has no alert',visual_page.locator('#mTodayAlert').count()==0)
        check('clean desktop visual capture has no open modal',visual_page.locator('.ov.open').count()==0)
        check('clean desktop visual capture fits 1440 viewport',visual_page.evaluate('document.documentElement.scrollWidth<=innerWidth+1'))
        grid=visual_page.evaluate("""()=>{const sc=document.querySelector('.sg-scroll'),hd=[...document.querySelectorAll('.sg-hd')].slice(1).filter(e=>getComputedStyle(e).visibility!=='hidden').map(e=>Math.round(e.getBoundingClientRect().width));
          return {client:sc.clientWidth,scroll:sc.scrollWidth,cols:hd};}""")
        print('desktop grid diagnostics: '+json.dumps(grid))
        check('desktop weekly grid has no inner horizontal overflow at 1440',grid['scroll']<=grid['client']+1)
        check('desktop weekly day columns share equal width',max(grid['cols'][1:6])-min(grid['cols'][1:6])<=2)
        check('desktop weekly title has daylight contrast',visual_page.evaluate("getComputedStyle(document.getElementById('pt')).color==='rgb(38, 55, 47)'"))
        check('desktop weekly work area hides clipped launcher',visual_page.locator('#pwaWorkspace').evaluate("e=>getComputedStyle(e).display==='none'"))
        visual_page.evaluate('window.scrollTo(0,0)')
        check('desktop visual capture starts at top',visual_page.evaluate('window.scrollY===0'))
        visual_page.screenshot(path=str(EVIDENCE/'visual-week-desktop-1440.png'))
        check('desktop visual capture is 1440x900',visual_page.evaluate('innerWidth===1440&&innerHeight===900'))
        desktop_card=visual_page.locator('.sg .schedule-card').filter(has_text='QA Desktop').first
        check('desktop weekly visual fixture card exists',desktop_card.count()>0)
        if desktop_card.count():
            desktop_card.scroll_into_view_if_needed()
            wait_visual_settled(visual_page)
            wait_js(visual_page,"getComputedStyle(document.getElementById('content')).opacity==='1'&&!document.querySelector('.ov.open')")
            check('desktop weekly student, time, lesson kind, and status are separate',visual_page.evaluate("()=>{const c=[...document.querySelectorAll('.sg .schedule-card')].find(x=>x.textContent.includes('QA Desktop'));return !!c&&!!c.querySelector('.schedule-card-name')&&!!c.querySelector('.schedule-card-time')&&!!c.querySelector('.schedule-card-kind')&&!!c.querySelector('.schedule-status')&&!c.textContent.includes('QA-MOBILE') }"))
            check('desktop weekly card is visible inside 1440x900 viewport',visual_page.evaluate("()=>{const c=[...document.querySelectorAll('.sg .schedule-card')].find(x=>x.textContent.includes('QA Desktop'));if(!c)return false;const r=c.getBoundingClientRect();return r.width>0&&r.height>0&&r.top>=0&&r.bottom<=innerHeight&&r.left>=0&&r.right<=innerWidth}"))
            visual_page.screenshot(path=str(EVIDENCE/'visual-week-desktop-card-1440.png'))
            collision_date=desktop_card.get_attribute('data-date')
            collision_time=desktop_card.get_attribute('data-time')
            collision_hour=f"{int(collision_time.split(':')[0]):02d}:00"
            visual_page.evaluate("""({date,time})=>{
              window.__v2QaOriginalStudents=students;
              const dow=(parseDateLocal(date).getDay()+6)%7,day=ALL7[dow],base=students[0]||{};
              const fixture=Object.assign({},base,{id:'qa-concurrent',name:'QA Concurrent',status:'수강중',schedType:'fixed',days:[day],times:{[day]:time},st:'2026-01-01',cls:'hob',lessonType:'solo',groupId:'',groupMembers:[]});
              const photoRow=students.find(s=>s.id==='s-photo')||{};
              const withPhoto=Object.assign({},photoRow,{id:'qa-photo-card',name:'김하늘바다 보컬 그룹 레슨',status:'수강중',schedType:'fixed',days:[day],times:{[day]:time},st:'2026-01-01',cls:'pro',lessonType:'solo',groupId:'',groupMembers:[]});
              students=students.concat([fixture,withPhoto]);render();
            }""",{'date':collision_date,'time':collision_time})
            wait_js(visual_page,"[...document.querySelectorAll('.sg-cell .schedule-card')].some(c=>c.dataset.sid==='qa-concurrent')")
            visual_page.wait_for_function("()=>{const c=document.querySelector('.sg .schedule-card[data-sid=\"qa-photo-card\"]'),i=c&&c.querySelector('.person-avatar img');return !!i&&i.complete&&i.naturalWidth>0&&!i.hidden}",timeout=10000)
            desktop_photo=visual_page.evaluate("""()=>{const c=document.querySelector('.sg .schedule-card[data-sid="qa-photo-card"]'),a=c.querySelector('.person-avatar'),i=a.querySelector('img'),n=c.querySelector('.schedule-card-name'),ar=a.getBoundingClientRect(),ir=i.getBoundingClientRect(),cr=c.getBoundingClientRect(),cell=c.closest('.sg-cell').getBoundingClientRect(),sc=document.querySelector('.sg-scroll');
              return {avatar:[Math.round(ar.width),Math.round(ar.height)],inner:[a.clientWidth,a.clientHeight],img:[Math.round(ir.width),Math.round(ir.height)],nameClipped:n.scrollWidth>n.clientWidth+1||n.scrollHeight>n.clientHeight+1,nameText:n.textContent,cardInsideCell:cr.left>=cell.left-1&&cr.right<=cell.right+1,gridOverflow:sc.scrollWidth-sc.clientWidth};}""")
            print('desktop photo card diagnostics: '+json.dumps(desktop_photo,ensure_ascii=False))
            check('desktop schedule card shows the loaded photo at full avatar size',desktop_photo['img']==desktop_photo['inner'] and desktop_photo['avatar'][0]>=28)
            check('desktop long student name wraps inside its day column',not desktop_photo['nameClipped'] and desktop_photo['cardInsideCell'])
            check('desktop grid stays within 1440 with long names',desktop_photo['gridOverflow']<=1)
            collision_cell=visual_page.locator(f'.sg-cell[data-date="{collision_date}"][data-h="{collision_hour}"]').first
            collision_cell.scroll_into_view_if_needed()
            collision_layout=visual_page.evaluate("""({date,time,hour})=>{
              const cell=[...document.querySelectorAll('.sg-cell')].find(x=>x.dataset.date===date&&x.dataset.h===hour);
              if(!cell)return null;
              const cards=[...cell.querySelectorAll('.schedule-card')].filter(x=>x.dataset.time===time),cellRect=cell.getBoundingClientRect(),rects=cards.map(x=>x.getBoundingClientRect());
              return {date,time,hour,count:cards.length,names:cards.map(x=>x.querySelector('.schedule-card-name')?.textContent||''),fixture:cards.some(x=>x.dataset.sid==='qa-concurrent'),height:cellRect.height,cardRects:rects.map(x=>({top:x.top,bottom:x.bottom,height:x.height})),cellRect:{top:cellRect.top,bottom:cellRect.bottom},inside:rects.every(x=>x.top>=cellRect.top&&x.bottom<=cellRect.bottom+1),stacked:rects.every((x,i)=>i===0||rects[i-1].bottom<=x.top+1),gridRows:getComputedStyle(cell.parentElement).gridTemplateRows};
            }""",{'date':collision_date,'time':collision_time,'hour':collision_hour})
            if not (collision_layout and collision_layout['count']>=2 and collision_layout['fixture'] and collision_layout['height']>110 and collision_layout['inside'] and collision_layout['stacked']):
                print('same-time desktop layout diagnostic:',json.dumps(collision_layout,ensure_ascii=False))
            visual_page.screenshot(path=str(EVIDENCE/'visual-week-desktop-multi-card-1440.png'))
            check('same-time desktop cards expand the row and stay stacked',bool(collision_layout and collision_layout['count']>=2 and collision_layout['fixture'] and collision_layout['height']>110 and collision_layout['inside'] and collision_layout['stacked']))
            visual_page.evaluate("()=>{if(window.__v2QaOriginalStudents){students=window.__v2QaOriginalStudents;delete window.__v2QaOriginalStudents;render();}}")
        visual_context.close()

        roster_diagnostics={}
        for width,height,label in [(390,844,'390'),(360,800,'360')]:
            visual_mobile=browser.new_context(viewport={'width':width,'height':height},is_mobile=True,storage_state=visual_storage_state)
            visual_phone=visual_mobile.new_page()
            visual_phone.on('pageerror',lambda exc,label=label: errors.append('visual-mobile-'+label+': '+str(exc)))
            visual_phone.goto(ORIGIN+'/',wait_until='domcontentloaded')
            wait_js(visual_phone,"window._cfSession&&window._vsSync&&window._vsSync.ready")
            dismiss_today_alert(visual_phone)
            wait_js(visual_phone,"page==='schedule'&&mobileSchedView==='week'&&document.querySelectorAll('.mobile-week-day').length===7")
            wait_js(visual_phone,"window._vsSync&&_vsSync.ready&&_vsSync.mode==='synced'")
            wait_js(visual_phone,"getComputedStyle(document.getElementById('content')).opacity==='1'")
            dismiss_today_alert(visual_phone)
            wait_js(visual_phone,"!document.querySelector('.ov.open')")
            wait_visual_settled(visual_phone)
            check('weekly cards finish entrance animations '+label,visual_phone.evaluate("()=>[...document.querySelectorAll('#content .card,.mobile-week-day')].filter(e=>e.getClientRects().length>0).every(e=>Number(getComputedStyle(e).opacity)>=.999&&!e.getAnimations().some(a=>a.playState==='running'))"))
            check('clean weekly visual '+label+' sync state settled',visual_phone.evaluate("_vsSync.ready&&_vsSync.mode==='synced'&&document.getElementById('vsSyncPanel').dataset.mode==='synced'"))
            check('clean weekly visual '+label+' has no alert',visual_phone.locator('#mTodayAlert').count()==0)
            check('clean weekly visual '+label+' has no open modal',visual_phone.locator('.ov.open').count()==0)
            check('clean weekly visual '+label+' fits viewport',visual_phone.evaluate('document.documentElement.scrollWidth<=innerWidth+1&&document.querySelector(".mobile-week-agenda").scrollWidth<=innerWidth'))
            check('weekly title '+label+' has daylight contrast',visual_phone.evaluate("getComputedStyle(document.getElementById('pt')).color==='rgb(38, 55, 47)'"))
            check('weekly work area '+label+' hides clipped launcher',visual_phone.locator('#pwaWorkspace').evaluate("e=>getComputedStyle(e).display==='none'"))
            check('weekly visual '+label+' shows today marker and schedule card',visual_phone.locator('.mobile-week-day.is-today').count()==1 and visual_phone.locator('.mobile-week-slot .schedule-card-name').count()>0)
            check('week actions stay above agenda '+label,visual_phone.evaluate("()=>{const a=document.querySelector('.mobile-week-actions'),g=document.querySelector('.mobile-week-agenda'),q=document.querySelector('.mobile-week-quick-add');if(!a||!g||!q||document.querySelector('.mobile-week-fab'))return false;const ar=a.getBoundingClientRect(),gr=g.getBoundingClientRect();return getComputedStyle(a).position==='static'&&ar.bottom<=gr.top+1}"))
            visual_phone.wait_for_function("() => [...document.querySelectorAll('.mobile-week-slot .person-avatar img')].some(img=>img.complete&&img.naturalWidth===0&&img.hidden&&!img.nextElementSibling.hidden&&img.nextElementSibling.textContent.trim()==='Q')",timeout=10000)
            check('weekly visual '+label+' shows fallback initial',True)
            visual_phone.evaluate("""()=>{
              window.__v2QaMobileOriginal={students,inquiries};
              const today=new Date(),dow=(today.getDay()+6)%7,day=ALL7[dow],photoRow=students.find(s=>s.id==='s-photo')||{};
              const withPhoto=Object.assign({},photoRow,{id:'qa-photo-mobile',name:'Photo QA',status:'수강중',schedType:'fixed',days:[day],times:{[day]:'15:00'},st:'2026-01-01',cls:'pro',lessonType:'solo',groupId:'',groupMembers:[]});
              const absentRow=Object.assign({},photoRow,{id:'qa-absent',name:'Absent QA',photo:'',status:'수강중',schedType:'fixed',days:[day],times:{[day]:'19:00'},st:'2026-01-01',cls:'hob',lessonType:'solo',groupId:'',groupMembers:[]});
              students=students.concat([withPhoto,absentRow]);
              const wk=getWK(getMon(today));weekOvr[wk]=weekOvr[wk]||{};window.__v2QaWeekKey=wk;window.__v2QaWeekPrev=weekOvr[wk]['qa-absent'];
              weekOvr[wk]['qa-absent']=[{day,time:'19:00',absent:true}];
              inquiries=[{id:'qa-inq',name:'010-5555-1234',phone:'010-5555-1234',visitDate:toDS(today),visitTime:'20:00'}].concat(inquiries);
              renderScheduleContent();
            }""")
            visual_phone.wait_for_function("()=>{const c=document.querySelector('.mobile-week-slot[data-sid=\"qa-photo-mobile\"]'),i=c&&c.querySelector('.person-avatar img');return !!i&&i.complete&&i.naturalWidth>0&&!i.hidden}",timeout=10000)
            mobile_cards=visual_phone.evaluate("""()=>{const q=s=>document.querySelector('.mobile-week-slot[data-sid="'+s+'"]');
              const p=q('qa-photo-mobile'),a=p.querySelector('.person-avatar'),i=a.querySelector('img'),ar=a.getBoundingClientRect(),ir=i.getBoundingClientRect();
              const inq=q('qa-inq'),abs=q('qa-absent');
              return {avatar:[Math.round(ar.width),Math.round(ar.height)],inner:[a.clientWidth,a.clientHeight],img:[Math.round(ir.width),Math.round(ir.height)],
                inquiryName:inq&&inq.querySelector('.schedule-card-name').textContent,inquiryText:inq&&inq.textContent,
                absentStatus:abs&&abs.querySelector('.schedule-status').textContent,fits:document.documentElement.scrollWidth<=innerWidth+1};}""")
            print('mobile card diagnostics '+label+': '+json.dumps(mobile_cards,ensure_ascii=False))
            check('mobile weekly card '+label+' shows the loaded photo at full avatar size',mobile_cards['img']==mobile_cards['inner'] and mobile_cards['avatar'][0]>=36)
            check('mobile weekly inquiry '+label+' hides the phone number',mobile_cards['inquiryName']=='문의자 (방문)' and '5555' not in (mobile_cards['inquiryText'] or ''))
            check('mobile weekly absent slot '+label+' is labeled 결석',mobile_cards['absentStatus']=='결석')
            check('mobile weekly '+label+' still fits with photo and inquiry cards',mobile_cards['fits'])
            visual_phone.locator('.mobile-week-slot[data-sid="qa-photo-mobile"]').scroll_into_view_if_needed()
            visual_phone.wait_for_timeout(150)
            visual_phone.screenshot(path=str(EVIDENCE/('visual-week-mobile-'+label+'-photo.png')))
            visual_phone.evaluate("""()=>{const o=window.__v2QaMobileOriginal;if(o){students=o.students;inquiries=o.inquiries;}
              const wk=window.__v2QaWeekKey;if(wk&&weekOvr[wk]){if(window.__v2QaWeekPrev===undefined)delete weekOvr[wk]['qa-absent'];else weekOvr[wk]['qa-absent']=window.__v2QaWeekPrev;}
              delete window.__v2QaMobileOriginal;renderScheduleContent();}""")
            visual_phone.evaluate('window.scrollTo(0,0)')
            visual_phone.screenshot(path=str(EVIDENCE/('visual-week-mobile-'+label+'-top.png')))
            visual_phone.locator('.mobile-week-day.is-today').evaluate("el=>el.scrollIntoView({block:'center'})")
            wait_js(visual_phone,"getComputedStyle(document.getElementById('content')).opacity==='1'&&!document.querySelector('.ov.open')")
            visual_phone.wait_for_timeout(150)
            check('today card '+label+' clears fixed tab bar',visual_phone.evaluate("()=>{const d=document.querySelector('.mobile-week-day.is-today'),n=document.querySelector('.mobile-tab-bar'),r=d.getBoundingClientRect(),b=n.getBoundingClientRect();return r.top>=0&&r.bottom<=innerHeight&&r.bottom<=b.top}"))
            check('today card '+label+' is unobscured',visual_phone.evaluate("()=>{const d=document.querySelector('.mobile-week-day.is-today'),r=d.getBoundingClientRect(),hit=document.elementFromPoint(r.left+r.width/2,r.top+r.height/2);return !!hit&&d.contains(hit)}"))
            visual_phone.screenshot(path=str(EVIDENCE/('visual-week-mobile-'+label+'-today.png')))
            visual_phone.evaluate('window.scrollTo(0,document.documentElement.scrollHeight)')
            wait_js(visual_phone,"getComputedStyle(document.getElementById('content')).opacity==='1'&&!document.querySelector('.ov.open')")
            visual_phone.wait_for_timeout(150)
            check('last day '+label+' clears fixed tab bar',visual_phone.evaluate("()=>{const d=document.querySelector('.mobile-week-day:last-of-type'),n=document.querySelector('.mobile-tab-bar'),r=d.getBoundingClientRect(),b=n.getBoundingClientRect();return r.top>=0&&r.bottom<=b.top}"))
            check('last day '+label+' is unobscured',visual_phone.evaluate("()=>{const d=document.querySelector('.mobile-week-day:last-of-type'),r=d.getBoundingClientRect(),hit=document.elementFromPoint(r.left+r.width/2,r.top+r.height/2);return !!hit&&d.contains(hit)}"))
            visual_phone.screenshot(path=str(EVIDENCE/('visual-week-mobile-'+label+'-bottom.png')))
            visual_phone.evaluate("go('students')")
            wait_js(visual_phone,"page==='students'&&document.getElementById('studentsGrid')&&getComputedStyle(document.getElementById('content')).opacity==='1'&&!document.querySelector('.ov.open')")
            dismiss_today_alert(visual_phone)
            visual_phone.wait_for_function("() => [...document.querySelectorAll('#studentsGrid .person-avatar img')].some(img=>img.complete&&img.naturalWidth===0&&img.hidden&&!img.nextElementSibling.hidden&&img.nextElementSibling.textContent.trim()==='Q')",timeout=10000)
            check('roster visual '+label+' shows fallback initial',True)
            visual_phone.evaluate('window.scrollTo(0,0)')
            roster_diagnostics[label]=visual_phone.evaluate("""() => {
              const avatar=[...document.querySelectorAll('#studentsGrid .person-avatar')].find(a=>a.getAttribute('aria-label')==='QA'||a.getAttribute('aria-label')==='QA Desktop')||document.querySelector('#studentsGrid .person-avatar');
              if(!avatar)return {found:false};
              const card=avatar.closest('.card')||avatar.parentElement;
              const describe=e=>{
                const s=getComputedStyle(e),r=e.getBoundingClientRect();
                return {tag:e.tagName,id:e.id||'',className:typeof e.className==='string'?e.className:'',opacity:s.opacity,filter:s.filter,backdropFilter:s.backdropFilter,visibility:s.visibility,display:s.display,position:s.position,zIndex:s.zIndex,backgroundColor:s.backgroundColor,inlineStyle:e.getAttribute('style')||'',animations:e.getAnimations().map(a=>({name:a.animationName||a.constructor.name,playState:a.playState,currentTime:a.currentTime,duration:a.effect&&a.effect.getComputedTiming?a.effect.getComputedTiming().duration:null})),rect:{x:Math.round(r.x),y:Math.round(r.y),width:Math.round(r.width),height:Math.round(r.height)}};
              };
              const chain=[];
              for(let e=card;e&&e!==document.documentElement;e=e.parentElement){chain.push(describe(e));}
              const ar=avatar.getBoundingClientRect(),cr=card.getBoundingClientRect();
              const stackAt=(x,y)=>document.elementsFromPoint(x,y).slice(0,8).map(describe);
              const candidates=[...document.querySelectorAll('[class*="overlay"],[class*="modal"],[class*="loading"],[class*="mask"],[class*="backdrop"],[id*="overlay"],[id*="loading"],[id*="mask"],#mTodayAlert,[role="dialog"]')]
                .filter(e=>{const r=e.getBoundingClientRect(),s=getComputedStyle(e);return r.width>0&&r.height>0&&s.display!=='none'&&s.visibility!=='hidden'&&Number(s.opacity)>0})
                .slice(0,24).map(describe);
              return {found:true,card:describe(card),chain,avatarStack:stackAt(ar.left+ar.width/2,ar.top+ar.height/2),cardStack:stackAt(cr.left+Math.min(30,cr.width/2),cr.top+Math.min(30,cr.height/2)),visibleCandidates:candidates};
            }""")
            print('roster visual diagnostic '+label+': '+json.dumps(roster_diagnostics[label],ensure_ascii=False))
            visual_phone.wait_for_function("() => {const c=document.querySelector('#studentsGrid')?.closest('.card');return !!c&&getComputedStyle(c).opacity==='1'&&!c.getAnimations().some(a=>a.playState==='running')}",timeout=5000)
            roster_diagnostics[label]['afterAnimation']=visual_phone.evaluate("() => {const c=document.querySelector('#studentsGrid')?.closest('.card');return {found:!!c,opacity:c?getComputedStyle(c).opacity:null,activeAnimations:c?c.getAnimations().filter(a=>a.playState==='running').length:null}}")
            check('roster visual '+label+' card animation settled',roster_diagnostics[label]['afterAnimation']['found'] and roster_diagnostics[label]['afterAnimation']['opacity']=='1' and roster_diagnostics[label]['afterAnimation']['activeAnimations']==0)
            check('roster visual '+label+' is unobscured',visual_phone.evaluate("()=>{const a=document.querySelector('#studentsGrid .person-avatar');if(!a)return false;a.scrollIntoView({block:'center'});const r=a.getBoundingClientRect(),hit=document.elementFromPoint(r.left+r.width/2,r.top+r.height/2);return !!hit&&a.contains(hit)&&getComputedStyle(document.getElementById('content')).opacity==='1'&&!document.querySelector('.ov.open')}"))
            roster_photos=visual_phone.evaluate("""()=>{const pick=n=>[...document.querySelectorAll('#studentsGrid .person-avatar')].find(a=>a.getAttribute('aria-label')===n);
              const loaded=n=>{const a=pick(n),i=a&&a.querySelector('img');return !!i&&i.complete&&i.naturalWidth>0&&!i.hidden;};
              return {photo:loaded('Photo QA'),legacy:loaded('Legacy QA'),fits:document.documentElement.scrollWidth<=innerWidth+1};}""")
            check('roster visual '+label+' shows loaded portraits for stored and legacy photos',roster_photos['photo'] and roster_photos['legacy'] and roster_photos['fits'])
            visual_phone.evaluate('window.scrollTo(0,0)')
            visual_phone.screenshot(path=str(EVIDENCE/('visual-roster-mobile-'+label+'.png')))
            visual_mobile.close()

        browser.close();browser=None
        check('zero JavaScript page errors',len(errors)==0)
        result={
            'ok':True,'checkedAt':time.strftime('%Y-%m-%dT%H:%M:%SZ',time.gmtime()),
            'surface':'Actual index.html against local Wrangler Worker + SQLite Durable Object + R2; Chrome desktop and emulated mobile viewports; not a physical phone',
            'checks':checks,'checkCount':len(checks),'pageErrors':errors,
            'rosterDiagnostics':roster_diagnostics,
            'weeklyStyleDiagnostics':weekly_style_diagnostics,
            'screenshots':['browser-desktop.png','browser-desktop-after-recovery.png','loading-session-mobile-390.png','loading-error-mobile-390.png','loading-state-mobile-390.png','browser-mobile-390.png','browser-mobile-360.png','visual-week-desktop-1440.png','visual-week-desktop-card-1440.png','visual-week-desktop-multi-card-1440.png','visual-week-empty-mobile-390.png','visual-week-mobile-390-top.png','visual-week-mobile-390-today.png','visual-week-mobile-390-bottom.png','visual-roster-mobile-390.png','visual-week-mobile-360-top.png','visual-week-mobile-360-today.png','visual-week-mobile-360-bottom.png','visual-roster-mobile-360.png'],
            'visualViewportSizes':{'desktop':'1440x900','mobile-390':'390x844','mobile-360':'360x800'},
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
