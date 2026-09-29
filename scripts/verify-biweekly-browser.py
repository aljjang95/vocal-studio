"""Local-only consultation -> biweekly student browser journey against Wrangler."""
import json
import socket
import subprocess
import time
import urllib.error
import urllib.request
from datetime import date, timedelta
from pathlib import Path
from playwright.sync_api import sync_playwright
from browser_state_dir import create_browser_state

ROOT=Path(__file__).resolve().parents[1]
PORT=8802
ORIGIN=f'http://127.0.0.1:{PORT}'
EVIDENCE=ROOT/'work'/'biweekly-browser-evidence'
EVIDENCE.mkdir(parents=True,exist_ok=True)
STATE=create_browser_state(ROOT,None)
HEADERS={'X-VS-Protocol':'vs-cf-1'}

def api(path,method='GET',body=None):
    headers=HEADERS.copy()
    data=None
    if body is not None:
        data=json.dumps(body).encode('utf-8')
        headers['Content-Type']='application/json'
    if method not in ('GET','HEAD'):
        headers['Origin']=ORIGIN
    request=urllib.request.Request(ORIGIN+path,data=data,headers=headers,method=method)
    try:
        with urllib.request.urlopen(request,timeout=5) as response:
            return response.status,json.loads(response.read())
    except urllib.error.HTTPError as error:
        return error.code,json.loads(error.read())

def wait_ready(proc):
    for _ in range(300):
        if proc.poll() is not None:raise RuntimeError('local Worker exited')
        try:
            if api('/api/session')[0]==200:return
        except Exception:pass
        time.sleep(.1)
    raise RuntimeError('local Worker did not start')

def wait_js(page,expression):
    deadline=time.time()+15
    while time.time()<deadline:
        try:
            if page.evaluate(f'() => Boolean({expression})'):return
        except Exception:pass
        time.sleep(.05)
    raise AssertionError('browser condition: '+expression)

with socket.socket() as probe:
    if probe.connect_ex(('127.0.0.1',PORT))==0:
        raise RuntimeError(f'port {PORT} is already in use')

today=date.today()
monday=today-timedelta(days=today.weekday())
first=monday+timedelta(days=29)  # Tuesday in four weeks
second=monday+timedelta(days=31) # Thursday in the same week
consult={'id':'qa-biweekly-consult','name':'격주 브라우저 QA','status':'상담','converted':False,
         'cls':'pro','gd':'여성','days':['화','목'],'time':'20:00','schedTime2':'21:00',
         'schedPref':'fixed','freq':2,'freq2':True,'intervalWeeks':2,'firstDate':first.isoformat(),
         'confirmedDates':[{'date':first.isoformat(),'time':'20:30'},
                           {'date':second.isoformat(),'time':'21:30'}]}
flex_consult={'id':'qa-flex-consult','name':'변동 브라우저 QA','status':'상담','converted':False,
              'cls':'hob','schedPref':'flex','freq':1,'firstDate':first.isoformat(),
              'confirmedDates':[{'date':first.isoformat(),'time':'15:30'},
                                {'date':second.isoformat(),'time':'16:30'}]}
legacy_consult={'id':'qa-legacy-consult','name':'기존 첫 수업 QA','status':'상담','converted':False,
                'cls':'hob','schedPref':'fixed','freq':2,'freq2':True,'intervalWeeks':2,
                'days':['화','목'],'time':'10:30','schedTime2':'11:30',
                'firstDate':second.isoformat(),'firstTime':'12:30','confirmedDates':[]}
edit_consult={'id':'qa-edit-consult','name':'상담 수정 QA','status':'상담','converted':False,
              'cls':'hob','schedPref':'fixed','freq':2,'freq2':True,'intervalWeeks':2,
              'days':['화','목'],'time':'10:30','schedTime2':'11:30',
              'confirmedDates':[{'date':second.isoformat(),'time':'12:30'}]}
fixture={'students':[],'logs':[],'consults':[consult,flex_consult,legacy_consult,edit_consult],
         'payments':[],'inquiries':[],'weekOvr':{}}
subprocess.run(['node','scripts/build-worker.mjs'],cwd=ROOT,check=True)
log=(EVIDENCE/'worker.log').open('w',encoding='utf-8')
command=['node',str(ROOT/'node_modules/wrangler/bin/wrangler.js'),'dev','--config','wrangler.local.jsonc',
         '--ip','127.0.0.1','--port',str(PORT),'--local','--persist-to',str(STATE)]
proc=subprocess.Popen(command,cwd=ROOT,stdout=log,stderr=subprocess.STDOUT,text=True)
checks=[]
errors=[]
def check(label,condition):
    if not condition:raise AssertionError(label)
    checks.append(label)

try:
    wait_ready(proc)
    status,staged=api('/api/import','POST',{'state':fixture})
    check('synthetic fixture staged',status==201)
    status,exported=api('/api/export')
    check('fixture read back',status==200 and exported['hash']==staged['hash'])
    check('fixture activated',api('/api/activate','POST',{'hash':exported['hash']})[0]==200)

    with sync_playwright() as playwright:
        browser=playwright.chromium.launch(channel='chrome',headless=True)
        page=browser.new_page(viewport={'width':390,'height':844},is_mobile=True)
        page.set_default_timeout(8000)
        page.on('pageerror',lambda exc:errors.append(str(exc)))
        page.goto(ORIGIN+'/',wait_until='domcontentloaded',timeout=60000)
        wait_js(page,"window._vsSync&&_vsSync.ready&&consults.some(c=>c.id==='qa-biweekly-consult')")
        page.evaluate("convertFromProfile('qa-biweekly-consult')")
        check('conversion modal opens',page.locator('#mS').evaluate("e=>e.classList.contains('open')"))
        check('biweekly choice restored',page.locator('#s-freq-biweekly').evaluate("e=>e.classList.contains('on')"))
        check('two days and separate times restored',page.evaluate("document.querySelectorAll('#s-dpick .dpb.on').length===2&&ge('ts-화').value==='20:00'&&ge('ts-목').value==='21:00'"))
        check('confirmed dates visible before registration',first.isoformat() in page.locator('#s-confirmed-hint').inner_text())
        page.wait_for_timeout(250)
        modal_geometry=page.evaluate("""() => {
          const ov=document.getElementById('mS'),modal=ov.querySelector('.modal'),a=ov.getBoundingClientRect(),b=modal.getBoundingClientRect();
          return {innerHeight,visualHeight:visualViewport.height,scrollY,overlay:{top:a.top,bottom:a.bottom,height:a.height,position:getComputedStyle(ov).position},modal:{top:b.top,bottom:b.bottom,height:b.height,scrollHeight:modal.scrollHeight,clientHeight:modal.clientHeight}};
        }""")
        print('modal geometry:',json.dumps(modal_geometry,ensure_ascii=False))
        check('mobile conversion modal stays inside viewport',modal_geometry['modal']['top']>=0 and modal_geometry['modal']['bottom']<=modal_geometry['innerHeight']-60)
        page.screenshot(path=str(EVIDENCE/'conversion-mobile.png'))
        page.locator('#s-confirmed-hint').scroll_into_view_if_needed()
        check('confirmed-date notice fits mobile width',page.locator('#s-confirmed-hint').evaluate("e=>{const r=e.getBoundingClientRect();return r.left>=0&&r.right<=innerWidth}"))
        page.screenshot(path=str(EVIDENCE/'confirmed-notice-mobile.png'))
        page.evaluate("document.querySelectorAll('#s-dpick .dpb.on')[1].classList.remove('on')")
        page.locator('#mS button[onclick="saveStudent()"]',).click()
        check('one-day biweekly student cannot be saved',page.evaluate("!students.some(s=>s.name==='격주 브라우저 QA')&&!consults.find(c=>c.id==='qa-biweekly-consult').converted"))
        page.evaluate("[...document.querySelectorAll('#s-dpick .dpb')].find(b=>b.textContent==='목').classList.add('on')")
        page.locator('#mS button[onclick="saveStudent()"]',).click()
        wait_js(page,"students.some(s=>s.name==='격주 브라우저 QA')&&consults.some(c=>c.id==='qa-biweekly-consult'&&c.converted)")
        snapshot=page.evaluate("""() => {
          const s=students.find(x=>x.name==='격주 브라우저 QA');
          const first=getMon(parseDateLocal(s.st));
          const slots=n=>Object.values(buildScheduleEngine(addDays(first,n*7)).slotsByKey).flat().filter(x=>x.s.id===s.id).map(x=>x.day+' '+x.time).sort();
          return {id:s.id,intervalWeeks:s.intervalWeeks,freq:s.freq,confirmed:s.confirmedDates.length,
            current:slots(0),off:slots(1),next:slots(2),cycle:cycleSizeOf(s)};
        }""")
        check('confirmed lessons replace fixed slots with exact minutes',snapshot['current']==['목 21:30','화 20:30'])
        check('off week has no lessons',snapshot['off']==[])
        check('next active week has two fixed lessons',snapshot['next']==['목 21:00','화 20:00'])
        check('biweekly billing cycle is four lessons',snapshot['cycle']==4)
        check('student stores confirmed dates',snapshot['confirmed']==2 and snapshot['intervalWeeks']==2 and snapshot['freq']==2)
        page.evaluate("go('schedule');wkOfs=4;mobileSchedView='week';renderScheduleContent()")
        wait_js(page,"page==='schedule'&&document.querySelectorAll('.mobile-week-day').length===7")
        check('mobile agenda displays two confirmed lessons',page.locator('.mobile-week-slot .schedule-card-name',).all_inner_texts().count('격주 브라우저 QA')==2)
        check('confirmed student lessons are labeled as confirmed',page.locator('.mobile-week-slot .schedule-status').all_inner_texts().count('확정')==2)
        check('mobile agenda fits 390px',page.evaluate('document.documentElement.scrollWidth<=innerWidth+1'))
        page.screenshot(path=str(EVIDENCE/'confirmed-week-mobile.png'))
        deadline=time.time()+10
        while time.time()<deadline:
            status,remote=api('/api/export')
            if status==200 and any(s.get('id')==snapshot['id'] for s in remote['state']['students']):break
            time.sleep(.1)
        else:raise AssertionError('converted student was not saved to local Worker')

        # Compare two independent browser stores after both have loaded the same canonical state.
        # The mobile agenda and desktop grid use different renderers, so compare their visible
        # cards as well as the schedule engine output for the exact same week.
        desktop=browser.new_page(viewport={'width':1440,'height':900})
        desktop.on('pageerror',lambda exc:errors.append('desktop: '+str(exc)))
        desktop.goto(ORIGIN+'/',wait_until='domcontentloaded',timeout=60000)
        wait_js(desktop,"window._vsSync&&_vsSync.ready&&students.some(s=>s.name==='격주 브라우저 QA')")
        for client in (page,desktop):
            client.evaluate("go('schedule');wkOfs=4;mobileSchedView='week';renderScheduleContent()")
        wait_js(page,"document.querySelectorAll('.mobile-week-day').length===7")
        wait_js(desktop,"document.querySelectorAll('.sg-hd').length===8")
        for client in (page,desktop):
            wait_js(client,"getComputedStyle(document.getElementById('content')).opacity==='1'&&!document.getElementById('content').classList.contains('fade')")
        cross_device_js="""() => {
          const engine=buildScheduleEngine(getViewMon());
          const slots=Object.values(engine.slotsByKey).flat().map(x=>
            [x.s.id,x.date,x.time,scheduleStatusLabel(x),scheduleKindKey(x)].join('|')).sort();
          const rendered=[...document.querySelectorAll(isMobile()?'.mobile-week-slot.schedule-card':'.sg .schedule-card')].map(x=>
            [x.dataset.sid,x.dataset.date,x.dataset.time,
             x.querySelector('.schedule-status')?.textContent.trim(),
             x.querySelector('.schedule-card-kind')?.dataset.kind].join('|')).sort();
          return {weekStart:engine.weekStart,weekEnd:engine.weekEnd,mode:_vsSync.mode,
            pending:_vsSync.pending(),blocked:_vsSync.blocked,revision:_vsSync.state.revision,
            mobile:isMobile(),slots,rendered};
        }"""
        mobile_week=page.evaluate(cross_device_js)
        desktop_week=desktop.evaluate(cross_device_js)
        check('independent mobile and desktop load the same server revision',
              mobile_week['revision']==desktop_week['revision'] and
              mobile_week['pending']==desktop_week['pending']==0 and
              not mobile_week['blocked'] and not desktop_week['blocked'])
        check('mobile and desktop select the same calendar week',
              mobile_week['weekStart']==desktop_week['weekStart'] and
              mobile_week['weekEnd']==desktop_week['weekEnd'])
        check('mobile and desktop engines agree on confirmed and recurring slots',
              mobile_week['slots']==desktop_week['slots'] and len(mobile_week['slots'])>=2)
        check('mobile and desktop show the same schedule cards',
              mobile_week['rendered']==desktop_week['rendered']==mobile_week['slots'])
        for client in (page,desktop):
            alert=client.locator('#mTodayAlert')
            if alert.count() and alert.is_visible():
                alert.get_by_role('button',name='확인',exact=True).click()
        check('paired schedule captures have no open dialog',
              page.locator('.ov.open').count()==desktop.locator('.ov.open').count()==0)
        wait_js(page,"!document.getElementById('toast').classList.contains('show')&&Number(getComputedStyle(document.getElementById('toast')).opacity)<.01")
        page.screenshot(path=str(EVIDENCE/'parity-mobile-390.png'),full_page=True)
        desktop.screenshot(path=str(EVIDENCE/'parity-desktop-1440.png'),full_page=True)
        check('desktop grid is settled before resize',desktop.locator('.sg .schedule-card').count()==len(desktop_week['slots']))
        desktop.set_viewport_size({'width':390,'height':844})
        wait_js(desktop,"isMobile()&&document.querySelectorAll('.mobile-week-day').length===7")
        resized_week=desktop.evaluate(cross_device_js)
        check('resizing desktop to mobile keeps the same schedule cards',
              resized_week['rendered']==mobile_week['rendered'])
        desktop.screenshot(path=str(EVIDENCE/'parity-resized-mobile-390.png'),full_page=True)
        desktop.set_viewport_size({'width':1440,'height':900})
        wait_js(desktop,"!isMobile()&&document.querySelectorAll('.sg .schedule-card').length>0")
        check('resizing back to desktop keeps the same schedule cards',
              desktop.evaluate(cross_device_js)['rendered']==mobile_week['rendered'])
        for client in (page,desktop):
            client.reload(wait_until='domcontentloaded')
            wait_js(client,"window._vsSync&&_vsSync.ready&&students.some(s=>s.name==='격주 브라우저 QA')")
            client.evaluate("go('schedule');wkOfs=4;mobileSchedView='week';renderScheduleContent()")
        wait_js(page,"document.querySelectorAll('.mobile-week-day').length===7")
        wait_js(desktop,"document.querySelectorAll('.sg-hd').length===8")
        reloaded_mobile=page.evaluate(cross_device_js)
        reloaded_desktop=desktop.evaluate(cross_device_js)
        check('reloaded mobile and desktop preserve the same confirmed week',
              reloaded_mobile['revision']==reloaded_desktop['revision'] and
              reloaded_mobile['slots']==reloaded_desktop['slots']==mobile_week['slots'] and
              reloaded_mobile['rendered']==reloaded_desktop['rendered']==mobile_week['rendered'])
        desktop.close()
        check('student and confirmed dates survive reload',page.evaluate("(()=>{let s=students.find(x=>x.name==='격주 브라우저 QA');return s&&s.confirmedDates.length===2&&consults.find(c=>c.id==='qa-biweekly-consult').converted})()"))
        page.evaluate("go('schedule')")
        wait_js(page,"page==='schedule'&&getComputedStyle(document.getElementById('content')).opacity==='1'")
        page.evaluate("wkOfs=4;mobileSchedView='week';renderScheduleContent();openWE()")
        check('weekly editor keeps both confirmed minute values',page.locator('#weBody select[id^="we-t-"]').evaluate_all("els=>els.map(e=>e.value).sort().join(',')")=='20:30,21:30')
        page.evaluate("cm('mWE')")
        page.evaluate("sid=>openTempReschedule(sid,'20:30','"+first.isoformat()+"')",snapshot['id'])
        check('single-slot editor keeps minute value',page.locator('#tr-time').input_value()=='20:30')
        page.evaluate("document.getElementById('mTempReschedule').remove()")
        page.evaluate("convertFromProfile('qa-flex-consult')")
        page.locator('#mS button[onclick="saveStudent()"]',).click()
        wait_js(page,"students.some(s=>s.name==='변동 브라우저 QA')&&consults.some(c=>c.id==='qa-flex-consult'&&c.converted)")
        flex_id=page.evaluate("students.find(s=>s.name==='변동 브라우저 QA').id")
        check('flex student displays both confirmed minute appointments',page.evaluate("sid=>Object.values(buildScheduleEngine(getMon(parseDateLocal('"+first.isoformat()+"'))).slotsByKey).flat().filter(x=>x.s.id===sid).map(x=>x.time).sort().join(',')",flex_id)=='15:30,16:30')
        page.evaluate("wkOfs=4;openFlexWeek()")
        check('flex weekly editor keeps confirmed minute times',page.locator('#flexWeekBody select[id^="fw-t-"]').evaluate_all("els=>els.map(e=>e.value).sort().join(',')")=='15:30,16:30')
        page.evaluate("cm('mFlexWeek')")
        page.evaluate("sid=>removeSlotFromMenu(sid,'15:30','"+first.isoformat()+"')",flex_id)
        check('removing one flex confirmation keeps the other',page.evaluate("sid=>Object.values(buildScheduleEngine(getMon(parseDateLocal('"+first.isoformat()+"'))).slotsByKey).flat().filter(x=>x.s.id===sid).map(x=>x.time).join(',')",flex_id)=='16:30')
        page.evaluate("convertFromProfile('qa-legacy-consult')")
        check('legacy first recurring time keeps minutes',page.locator('#ts-화').input_value()=='10:30')
        check('legacy second recurring time keeps minutes',page.locator('#ts-목').input_value()=='11:30')
        page.locator('#mS button[onclick="saveStudent()"]',).click()
        wait_js(page,"students.some(s=>s.consultData&&s.consultData.id==='qa-legacy-consult')")
        check('legacy firstDate with empty confirmed array survives conversion',page.evaluate("sid=>Object.values(buildScheduleEngine(getMon(parseDateLocal('"+second.isoformat()+"'))).slotsByKey).flat().filter(x=>x.s.id===sid).map(x=>x.time).join(',')",page.evaluate("students.find(s=>s.consultData&&s.consultData.id==='qa-legacy-consult').id"))=='12:30')
        page.evaluate("go('consult')")
        wait_js(page,"page==='consult'&&getComputedStyle(document.getElementById('content')).opacity==='1'")
        page.wait_for_timeout(180)
        page.evaluate("showConsultForm('qa-legacy-consult')")
        check('legacy date is editable as a confirmed row',page.locator('#ci-dates-list .ci-date-row').count()==1)
        page.locator('#ci-dates-list .ci-date-row button').click()
        page.wait_for_timeout(100)
        page.locator('[onclick="saveConsult()"]',).click()
        wait_js(page,"consults.find(c=>c.id==='qa-legacy-consult').firstDate===''&&consults.find(c=>c.id==='qa-legacy-consult').confirmedDates.length===0")
        check('removing legacy confirmation does not resurrect that time',page.evaluate("sid=>Object.values(buildScheduleEngine(getMon(parseDateLocal('"+second.isoformat()+"'))).slotsByKey).flat().filter(x=>x.s.id===sid).map(x=>x.time).join(',')",page.evaluate("students.find(s=>s.consultData&&s.consultData.id==='qa-legacy-consult').id"))=='11:30')
        page.wait_for_timeout(180)
        page.evaluate("showConsultForm('qa-edit-consult')")
        check('consultation edit loads second time',page.locator('#ci-time2').input_value()=='11:30')
        page.locator('#ci-time2').select_option('13:30')
        page.wait_for_timeout(100)
        page.locator('[onclick="saveConsult()"]',).click()
        wait_js(page,"consults.find(c=>c.id==='qa-edit-consult').schedTime2==='13:30'")
        check('consultation edit saves changed second time',True)
        page.evaluate("convertFromProfile('qa-edit-consult')")
        check('edited consultation prefills both exact recurring times',page.locator('#ts-화').input_value()=='10:30' and page.locator('#ts-목').input_value()=='13:30')
        page.locator('#mS button[onclick="saveStudent()"]',).click()
        wait_js(page,"students.some(s=>s.consultData&&s.consultData.id==='qa-edit-consult')")
        page.evaluate("go('consult')")
        wait_js(page,"page==='consult'&&getComputedStyle(document.getElementById('content')).opacity==='1'")
        page.wait_for_timeout(180)
        page.evaluate("showConsultForm()")
        page.locator('#ci-nm').fill('격주 폼 QA')
        page.evaluate("ciSetCadence(2);[...document.querySelectorAll('#ci-dpick .dpb')].find(b=>b.textContent==='화').classList.add('on')")
        page.evaluate("saveConsult()")
        check('one-day biweekly consultation cannot be saved',page.evaluate("!consults.some(c=>c.name==='격주 폼 QA')"))
        page.evaluate("[...document.querySelectorAll('#ci-dpick .dpb')].find(b=>b.textContent==='목').classList.add('on')")
        page.evaluate("saveConsult()")
        check('biweekly consultation requires both times',page.evaluate("!consults.some(c=>c.name==='격주 폼 QA')"))
        page.evaluate("""({first,second})=>{
          ge('ci-time').value='20:00';ge('ci-time2').value='21:00';
          ciAddDateRow(first,'20:00');ciAddDateRow(second,'21:00');
        }""",{'first':first.isoformat(),'second':second.isoformat()})
        page.evaluate("saveConsult()")
        wait_js(page,"consults.some(c=>c.name==='격주 폼 QA')")
        check('consultation form stores cadence and two dates',page.evaluate("(()=>{const c=consults.find(c=>c.name==='격주 폼 QA');return c&&c.intervalWeeks===2&&c.freq===2&&c.confirmedDates.length===2})()"))
        page.evaluate("ciClearDraft();go('consult')")
        page.wait_for_timeout(180)
        page.evaluate("showConsultForm()")
        page.locator('#ci-nm').fill('확정 초안 QA')
        page.evaluate("""({first,second})=>{
          ciSetCadence(2);
          document.querySelectorAll('#ci-dpick .dpb').forEach(b=>{if(['화','목'].includes(b.textContent))b.classList.add('on');});
          ge('ci-time').value='14:30';ge('ci-time2').value='15:30';
          ciAddDateRow(first,'14:30');ciAddDateRow(second,'15:30');ciSaveDraft();
        }""",{'first':first.isoformat(),'second':second.isoformat()})
        page.reload(wait_until='domcontentloaded')
        wait_js(page,"window._vsSync&&_vsSync.ready")
        page.evaluate("go('consult')")
        page.wait_for_timeout(180)
        page.evaluate("showConsultForm()")
        page.locator('[onclick="ciRestoreDraft()"]').click()
        check('confirmed dates and cadence survive draft reload',page.evaluate("ciGetConfirmedDates().length===2&&gv('ci-interval-weeks')==='2'&&gv('ci-time2')==='15:30'"))
        page.evaluate("saveConsultPending()")
        page.wait_for_timeout(180)
        page.evaluate("loadPendingConsult()")
        page.wait_for_timeout(400)
        check('confirmed dates and times survive pending restore',page.evaluate("ciGetConfirmedDates().length===2&&gv('ci-time')==='14:30'&&gv('ci-time2')==='15:30'&&gv('ci-interval-weeks')==='2'"))
        check('zero browser JavaScript errors',not errors)
        browser.close()
    print(json.dumps({'ok':True,'checks':checks,'snapshot':snapshot,'errors':errors},ensure_ascii=False))
finally:
    if proc.poll() is None:
        subprocess.run(['taskkill','/PID',str(proc.pid),'/T','/F'],stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
    log.close()
