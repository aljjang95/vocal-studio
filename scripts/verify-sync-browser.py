"""Actual app + two isolated Chrome contexts; synthetic transport, no Firebase access."""
import copy, functools, json, threading, base64, io, wave
from datetime import datetime, timezone
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from playwright.sync_api import sync_playwright
import argparse
ROOT=Path(__file__).resolve().parents[1]
parser=argparse.ArgumentParser(description=__doc__)
parser.add_argument('--output',type=Path,default=ROOT/'tmp'/'sync-qa')
OUT=parser.parse_args().output.resolve()
OUT.mkdir(parents=True,exist_ok=True)
DATA={'students':[{'id':'qa-a','name':'합성 수강생 A','ph':'','sch':[],'status':'수강중','schedType':'flex','days':[],'times':{}},{'id':'qa-b','name':'합성 수강생 B','ph':'','sch':[],'status':'수강중','schedType':'flex','days':[],'times':{}}], 'logs':[],'consults':[],'payments':[],'inquiries':[],'weekOvr':{'2026-09-14':{'qa-a':[{'time':'10:00','day':'화','absent':False}]}},'_vsSyncRevision':0,'futureServerField':{'keep':True}}
state={'data':copy.deepcopy(DATA),'writes':0}
class Handler(SimpleHTTPRequestHandler):
    def log_message(self,*args): pass
server=ThreadingHTTPServer(('127.0.0.1',0),functools.partial(Handler,directory=str(ROOT)))
thread=threading.Thread(target=server.serve_forever,daemon=True);thread.start()
origin=f'http://127.0.0.1:{server.server_port}'
checks=[]; errors=[]; screens=[]; contexts=[]
def check(name,condition):
    checks.append({'name':name,'pass':bool(condition)})
    if not condition:
        if 'page' in globals():
            page.screenshot(path=str(OUT/'failure-screen.png'),full_page=True)
            boxes=page.evaluate('Array.from(document.querySelectorAll("body *")).map(el=>({tag:el.tagName,id:el.id,cls:String(el.className),left:el.getBoundingClientRect().left,right:el.getBoundingClientRect().right,width:el.getBoundingClientRect().width})).filter(x=>x.right>innerWidth+1||x.left< -1).sort((a,b)=>b.right-a.right).slice(0,24)')
            (OUT/'failure-layout.json').write_text(json.dumps(boxes,ensure_ascii=False,indent=2),encoding='utf-8')
        raise AssertionError(name)
def commit(source,request):
    if request['expected']!=state['data']['_vsSyncRevision']: return {'ok':False}
    state['data']=copy.deepcopy(request['data']);state['writes']+=1;return {'ok':True}
def emit(page): page.evaluate('data=>window.__qaEmit(data)',state['data'])
try:
    with sync_playwright() as p:
        browser=p.chromium.launch(channel='chrome',headless=True)
        pages=[]
        for label,width,height,mobile in [('desktop',1440,900,False),('mobile',390,844,True)]:
            context=browser.new_context(viewport={'width':width,'height':height},is_mobile=mobile,has_touch=mobile,service_workers='block')
            contexts.append(context)
            context.route('**/*',lambda route: route.continue_() if route.request.url.startswith(origin+'/') else route.abort())
            context.expose_binding('qaRead',lambda source: copy.deepcopy(state['data']))
            context.expose_binding('qaCommit',commit)
            context.add_init_script((Path(__file__).resolve().parent/'sync-browser-fixture.js').read_text(encoding='utf-8'))
            page=context.new_page();pages.append(page)
            page.on('pageerror',lambda error: errors.append(str(error)))
            page.goto(origin+'/index.html',wait_until='domcontentloaded')
            page.wait_for_function("typeof _vsSync!=='undefined' && _vsSync!==null")
            if label=='desktop':
                actual_week=page.evaluate('getWK(getViewMon())')
                actual_day=page.evaluate('JSDOW[new Date().getDay()]')
                slots=state['data']['weekOvr'].pop('2026-09-14');slots['qa-a'][0]['day']=actual_day
                state['data']['weekOvr'][actual_week]=slots
            page.evaluate("""data=>{
                _isFirebaseAdminUser=function(user){return !!user&&user.uid==='qa-synthetic-admin';};
                _DEFAULT_STUDENTS=[];_injectInitialInquiries=function(){};
                students=data.students;logs=data.logs;payments=data.payments;consults=data.consults;
                inquiries=data.inquiries;weekOvr=data.weekOvr;page='today';render();_startFirestoreListener();
            }""",state['data'])
            emit(page)
            check(label+' server-confirmed initialization',page.evaluate('_vsSync.ready'))
        desktop,mobile=pages
        desktop.evaluate("weekOvr[getWK(getViewMon())]['qa-a'][0].time='11:00';saveAll();")
        desktop.wait_for_function('_vsSync.pending()===0 && !_vsSync.flight')
        emit(mobile)
        check('desktop to mobile schedule change',mobile.evaluate("weekOvr[getWK(getViewMon())]['qa-a'][0].time")=='11:00')
        mobile.evaluate("weekOvr[getWK(getViewMon())]['qa-a'][0].time='12:00';saveAll();")
        mobile.wait_for_function('_vsSync.pending()===0 && !_vsSync.flight');emit(desktop)
        check('mobile to desktop schedule change',desktop.evaluate("weekOvr[getWK(getViewMon())]['qa-a'][0].time")=='12:00')
        desktop.evaluate("delete weekOvr[getWK(getViewMon())]['qa-a'];saveAll();")
        desktop.wait_for_function('_vsSync.pending()===0 && !_vsSync.flight');emit(mobile)
        mobile.evaluate("logs.push({id:'qa-log-1',sid:'qa-a',date:'2026-09-15'},{id:'qa-log-2',sid:'qa-a',date:'2026-09-16'});saveAll();")
        mobile.wait_for_function('_vsSync.pending()===0 && !_vsSync.flight');emit(desktop)
        check('deleted assignment stays deleted after unrelated mobile save',not desktop.evaluate("!!weekOvr[getWK(getViewMon())]['qa-a']"))
        check('two lesson records sharing one student preserved',desktop.evaluate('logs.length')==2)
        check('schedule engine confirms deletion',desktop.evaluate("!Object.values(getWeekSched(getViewMon())).flat().some(slot=>slot.s.id==='qa-a')"))
        opened=mobile.evaluate("""()=>{
            const input=Array.from(document.querySelectorAll('.ov input')).find(el=>['text','tel','email','search'].includes(el.type));
            if(!input)return false;input.closest('.ov').classList.add('open');input.value='합성 초안 유지';input.focus();window.__qaDraft=input;return true;
        }""")
        check('existing mobile form opened',opened)
        desktop.evaluate("students[1].name='합성 원격 수정';saveAll();")
        desktop.wait_for_function('_vsSync.pending()===0 && !_vsSync.flight');emit(mobile)
        check('remote update preserves existing focused form text',mobile.evaluate("window.__qaDraft.value==='합성 초안 유지'"))
        mobile.evaluate("window.__qaDraft.blur();document.querySelectorAll('.ov.open').forEach(el=>el.classList.remove('open'));_vsSync.drain();")
        check('remote data applied after form closes',mobile.evaluate("students[1].name==='합성 원격 수정'"))
        mobile.evaluate("go('schedule')");mobile.wait_for_timeout(200)
        mobile.locator('[data-cell][data-time="13:00"]').first.click()
        mobile.locator('#qsr-qa-a').click()
        mobile.locator('#mQS [onclick="saveQS()"] ').click()
        mobile.wait_for_function('_vsSync.pending()===0 && !_vsSync.flight');emit(desktop)
        check('real assignment dialog selection and save reaches desktop engine',desktop.evaluate("Object.values(getWeekSched(getViewMon())).flat().some(slot=>slot.s.id==='qa-a'&&slot.time==='13:00')"))
        check('mobile schedule renders the assigned synthetic student',mobile.locator('#content').get_by_text('합성 수강생 A',exact=False).count()>0)
        audio_buffer=io.BytesIO()
        with wave.open(audio_buffer,'wb') as audio_file:
            audio_file.setnchannels(1);audio_file.setsampwidth(2);audio_file.setframerate(22050)
            audio_file.writeframes(b'\x00'*44100)
        audio_uri='data:audio/wav;base64,'+base64.b64encode(audio_buffer.getvalue()).decode('ascii')
        check('actual IndexedDB media fixture saved',desktop.evaluate("data=>new Promise(resolve=>mediaSave('qa-audio-local',data,resolve))",audio_uri))
        desktop.evaluate("data=>{students[0].audios=[{id:'qa-audio',mediaType:'audio',type:'before',data:data,_mediaKey:'qa-audio-local'}];saveAll();}",audio_uri)
        desktop.wait_for_function('_vsSync.pending()===0 && !_vsSync.flight');emit(mobile)
        check('large inline audio excluded from server document',state['data']['students'][0]['audios'][0]['data']=='[saved]')
        desktop.evaluate("students[1].name='합성 미디어 후 수정';saveAll();")
        desktop.wait_for_function('_vsSync.pending()===0 && !_vsSync.flight')
        check('local playback pointer preserved after another save',desktop.evaluate("students[0].audios[0]._mediaKey==='qa-audio-local'"))
        stored_audio=desktop.evaluate("()=>new Promise(resolve=>mediaLoad(students[0].audios[0]._mediaKey,resolve))")
        check('actual IndexedDB media remains readable',stored_audio==audio_uri)
        duration=desktop.evaluate("data=>new Promise(resolve=>{const audio=new Audio();audio.onloadedmetadata=()=>resolve(audio.duration);audio.onerror=()=>resolve(0);audio.src=data;})",stored_audio)
        check('preserved local WAV decodes in Chrome',duration>0.9)
        instance_before=mobile.evaluate('_vsSync.instance')
        mobile.reload(wait_until='domcontentloaded');mobile.wait_for_function("typeof _vsSync!=='undefined' && _vsSync!==null")
        check('same-tab real reload preserves backup identity',mobile.evaluate('_vsSync.instance')==instance_before)
        mobile.evaluate("()=>{_isFirebaseAdminUser=user=>!!user&&user.uid==='qa-synthetic-admin';_DEFAULT_STUDENTS=[];_injectInitialInquiries=function(){};_startFirestoreListener();}")
        emit(mobile)
        for page,label,width,height in [(desktop,'desktop',1440,900),(mobile,'mobile',390,844),(mobile,'mobile-small',360,740)]:
            page.set_viewport_size({'width':width,'height':height})
            for route in ['today','schedule','students']:
                page.evaluate('value=>go(value)',route)
                page.wait_for_timeout(200)
                check(label+' '+route+' correct navigation title',page.evaluate("document.getElementById('pt').textContent===PT[page]"))
                layout=page.evaluate('({viewport:innerWidth,body:document.documentElement.scrollWidth})')
                check(label+' '+route+' no document overflow',layout['body']<=layout['viewport']+1)
                if route=='schedule':
                    path=OUT/(label+'-schedule-20260915.png');page.screenshot(path=str(path),full_page=True);screens.append(str(path))
        mobile.evaluate("_vsSync.status('conflict',1)")
        check('mobile conflict status remains legible',mobile.evaluate("parseFloat(getComputedStyle(document.getElementById('topSyncStatus')).fontSize)>=12"))
        for button in ['vsSyncRetry','vsSyncExport','vsSyncUseServer']:
            check('mobile '+button+' visible within viewport',mobile.locator('#'+button).is_visible() and mobile.locator('#'+button).evaluate('(el)=>{const r=el.getBoundingClientRect();return r.left>=0&&r.right<=innerWidth+1&&r.width>=44&&r.height>=44;}'))
        check('mobile conflict has no document overflow',mobile.evaluate('document.documentElement.scrollWidth<=innerWidth+1'))
        path=OUT/'mobile-conflict-20260915.png';mobile.screenshot(path=str(path),full_page=True);screens.append(str(path))
        check('unknown server field preserved',state['data'].get('futureServerField')=={'keep':True})
        check('no JavaScript page errors',not errors)
        browser.close()
except Exception as exc:
    failure=str(exc)
    print('BROWSER_QA_ERROR='+failure)
finally:
    server.shutdown();server.server_close();thread.join(timeout=3)
    report={'checkedAt':datetime.now(timezone.utc).isoformat(),'surface':'Actual index.html and vs-sync.js in isolated Chrome contexts; synthetic transaction transport; not Firebase emulator or physical phone','productionFirebaseRequests':0,'checks':checks,'pageErrors':errors,'screenshots':screens,'syntheticWrites':state['writes'],'failure':globals().get('failure')}
    report['pass']=bool(checks) and all(row['pass'] for row in checks) and not errors and not report['failure']
    (OUT/'browser-sync-results-20260915.json').write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf-8')
    print(json.dumps(report,ensure_ascii=False))
raise SystemExit(0 if report['pass'] else 1)
