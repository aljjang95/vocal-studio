"""Synthetic new-student schedule and compact week view in a local Worker."""
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
PORT=8805
ORIGIN=f'http://127.0.0.1:{PORT}'
EVIDENCE=ROOT/'work'/'new-student-week-evidence'
EVIDENCE.mkdir(parents=True,exist_ok=True)
STATE=create_browser_state(ROOT,None)
HEADERS={'X-VS-Protocol':'vs-cf-1'}

def api(path,method='GET',body=None):
    headers=HEADERS.copy()
    data=None
    if body is not None:
        headers['Content-Type']='application/json'
        data=json.dumps(body).encode('utf-8')
    if method!='GET':headers['Origin']=ORIGIN
    req=urllib.request.Request(ORIGIN+path,data=data,headers=headers,method=method)
    try:
        with urllib.request.urlopen(req,timeout=5) as response:
            return response.status,json.loads(response.read())
    except urllib.error.HTTPError as error:
        return error.code,json.loads(error.read())

def wait_js(page,expression):
    page.wait_for_function('() => Boolean('+expression+')',timeout=15000)

def check(label,condition):
    if not condition:raise AssertionError(label)
    checks.append(label)

with socket.socket() as probe:
    if probe.connect_ex(('127.0.0.1',PORT))==0:raise RuntimeError(f'port {PORT} in use')

today=date.today()
monday=today-timedelta(days=today.weekday())
def week_key(mon):
    # Mirrors the app's persisted legacy key, including its Sunday-based offset.
    first=date(mon.year,1,1)
    js_day=(first.weekday()+1)%7
    delta=(mon-first).days
    import math
    return f'{mon.year}-W{math.ceil((delta+js_day+1)/7):02d}'

wk=week_key(monday)
off_wk=week_key(monday+timedelta(days=14))
fixture={
    'students':[
        {'id':'qa-new','name':'오늘등록 QA','status':'수강중','st':today.isoformat(),
         'schedType':'fixed','freq':2,'days':['화','금'],'times':{'화':'16:00','금':'16:00'}},
        {'id':'qa-existing','name':'기존 QA','status':'수강중','st':(today-timedelta(days=14)).isoformat(),
         'schedType':'fixed','freq':1,'days':['화'],'times':{'화':'18:00'}}],
    'consults':[{'id':'qa-early','name':'오전 상담 QA','status':'상담','converted':False,'hold':False,
                 'confirmedDates':[{'date':(monday+timedelta(days=2)).isoformat(),'time':'09:30'}]}],
    'inquiries':[],'logs':[],'payments':[],
    'weekOvr':{wk:{'qa-new':[{'day':'화','time':'16:00','absent':False},
                              {'day':'일','time':'16:00','absent':False}]},
               off_wk:{'qa-new':[]}}
}

subprocess.run(['node','scripts/build-worker.mjs'],cwd=ROOT,check=True)
log=(EVIDENCE/'worker.log').open('w',encoding='utf-8')
proc=subprocess.Popen(['node',str(ROOT/'node_modules/wrangler/bin/wrangler.js'),'dev',
    '--config','wrangler.local.jsonc','--ip','127.0.0.1','--port',str(PORT),
    '--local','--persist-to',str(STATE)],cwd=ROOT,stdout=log,stderr=subprocess.STDOUT,text=True)
checks=[]
errors=[]
try:
    for _ in range(300):
        if proc.poll() is not None:raise RuntimeError('local Worker exited')
        try:
            if api('/api/session')[0]==200:break
        except Exception:pass
        time.sleep(.1)
    else:raise RuntimeError('local Worker did not start')
    status,staged=api('/api/import','POST',{'state':fixture})
    check('synthetic roster staged',status==201)
    status,exported=api('/api/export')
    check('synthetic roster read back',status==200 and exported['hash']==staged['hash'])
    check('synthetic roster activated',api('/api/activate','POST',{'hash':exported['hash']})[0]==200)

    with sync_playwright() as playwright:
        browser=playwright.chromium.launch(channel='chrome',headless=True)
        desktop=browser.new_page(viewport={'width':1440,'height':900})
        desktop.on('pageerror',lambda exc:errors.append('desktop: '+str(exc)))
        desktop.goto(ORIGIN+'/',wait_until='domcontentloaded')
        wait_js(desktop,"window._vsSync&&_vsSync.ready&&students.some(s=>s.id==='qa-new')")
        desktop.evaluate("localStorage.setItem('vsC_alertDismissed',toDS(new Date()))")
        if desktop.locator('#mTodayAlert').count():
            desktop.locator('#mTodayAlert').get_by_role('button',name='오늘 하루 닫기').click()
        check('server state supplies current-week override',desktop.evaluate("""() => {
          const slots=Object.values(buildScheduleEngine(getViewMon()).slotsByKey).flat()
            .filter(x=>x.s.id==='qa-new').map(x=>x.day+' '+x.time).sort();
          return slots.join(',')==='일 16:00,화 16:00';
        }"""))
        desktop.evaluate("go('students')")
        wait_js(desktop,"page==='students'&&document.querySelector('#studentsGrid>div[data-sid=\"qa-new\"]')")
        check('roster distinguishes this-week override from fixed days',desktop.evaluate("""() => {
          const card=document.querySelector('#studentsGrid>div[data-sid="qa-new"]');
          return card.textContent.includes('기본 화')&&card.textContent.includes('금')&&
            card.textContent.includes('이번 주')&&card.textContent.includes('일 16:00');
        }"""))
        desktop.evaluate("go('schedule')")
        wait_js(desktop,"page==='schedule'&&document.querySelector('.sg-cell')")
        wait_js(desktop,"getComputedStyle(document.getElementById('content')).opacity==='1'")
        check('desktop seven-day glance includes saved Sunday override',desktop.evaluate("""() => {
          const glance=document.querySelector('.week-glance');
          return !!glance&&glance.querySelectorAll('[data-glance-date]').length===7&&
            [...glance.querySelectorAll('[data-sid="qa-new"]')].some(x=>x.dataset.day==='일');
        }"""))
        check('desktop hourly grid includes confirmed time outside ordinary hours',desktop.locator('.sg .schedule-card[data-sid="qa-early"][data-time="09:30"]').count()==1)
        check('weekly override is labeled separately from fixed slots',desktop.locator('.sg .schedule-card[data-sid="qa-new"] .schedule-status').first.inner_text()=='이번 주 변경')
        desktop.screenshot(path=str(EVIDENCE/'desktop-week.png'),full_page=True)

        phone=browser.new_page(viewport={'width':390,'height':844},is_mobile=True)
        phone.on('pageerror',lambda exc:errors.append('mobile: '+str(exc)))
        phone.goto(ORIGIN+'/',wait_until='domcontentloaded')
        wait_js(phone,"window._vsSync&&_vsSync.ready&&students.some(s=>s.id==='qa-new')")
        wait_js(phone,"page==='schedule'&&document.querySelector('.mobile-week-day')")
        wait_js(phone,"getComputedStyle(document.getElementById('content')).opacity==='1'")
        check('mobile compact week includes all seven days and actual override',phone.evaluate("""() => {
          const glance=document.querySelector('.week-glance');
          return !!glance&&glance.querySelectorAll('[data-glance-date]').length===7&&
            [...glance.querySelectorAll('[data-sid="qa-new"]')].some(x=>x.dataset.day==='일')&&
            document.documentElement.scrollWidth<=innerWidth+1;
        }"""))
        check('mobile agenda includes confirmed time outside ordinary hours',phone.locator('.mobile-week-slot[data-sid="qa-early"][data-time="09:30"]').count()==1)
        phone.screenshot(path=str(EVIDENCE/'mobile-week-390.png'),full_page=True)
        phone.locator('.mobile-week-slot[data-sid="qa-new"] .schedule-card-time.is-editable').first.click()
        check('lesson time pill opens direct date and minute editor',
              phone.locator('#mTempReschedule').is_visible() and
              phone.locator('#tr-date').input_value()==(monday+timedelta(days=1)).isoformat() and
              phone.locator('#tr-time option[value="16:30"]').count()==1)
        phone.locator('#mTempReschedule .mc').click()

        desktop.evaluate("go('students')")
        wait_js(desktop,"page==='students'&&document.querySelector('#studentsGrid')")
        desktop.evaluate('openSModal()')
        desktop.locator('#s-nm').fill('겹침등록 QA')
        desktop.locator('#mS button[onclick="saveStudent()"]',).click()
        check('active fixed student without a weekday is not silently registered',
              desktop.locator('#s-schedule-error').is_visible() and
              desktop.evaluate("!students.some(s=>s.name==='겹침등록 QA')"))
        desktop.locator('#s-dpick .dpb').filter(has_text='화').click()
        desktop.locator('#ts-화').select_option('18:00')
        desktop.locator('#mS button[onclick="saveStudent()"]',).click()
        check('overlapping registration retains editable form with clear error',
              desktop.locator('#s-schedule-error').is_visible() and
              '등록되지 않았습니다' in desktop.locator('#s-schedule-error').inner_text() and
              desktop.locator('#mS').is_visible() and
              desktop.evaluate("!students.some(s=>s.name==='겹침등록 QA')"))
        desktop.locator('#ts-화').select_option('18:30')
        desktop.locator('#mS button[onclick="saveStudent()"]',).click()
        wait_js(desktop,"students.some(s=>s.name==='겹침등록 QA')")
        check('available time registers the student',desktop.evaluate("""() => {
          const s=students.find(x=>x.name==='겹침등록 QA');
          return !!s&&Object.values(buildScheduleEngine(getViewMon()).slotsByKey).flat()
            .some(x=>x.s.id===s.id&&x.day==='화'&&x.time==='18:30');
        }"""))
        desktop.evaluate("go('students');openSModal('qa-new')")
        check('student edit warns that this week differs from fixed weekdays',
              desktop.locator('#s-week-override-hint').is_visible() and
              '화 16:00' in desktop.locator('#s-week-override-hint').inner_text() and
              '금 16:00' in desktop.locator('#s-week-override-hint').inner_text() and
              '일 16:00' in desktop.locator('#s-week-override-hint').inner_text())
        alert=desktop.locator('#mTodayAlert')
        if alert.count() and alert.is_visible():alert.get_by_role('button',name='확인',exact=True).click()
        desktop.locator('#s-week-override-hint button').click()
        if alert.count() and alert.is_visible():alert.get_by_role('button',name='확인',exact=True).click()
        desktop.locator('#vsConfirmOk').click()
        wait_js(desktop,"!Object.prototype.hasOwnProperty.call(weekOvr[getWK(getViewMon())]||{},'qa-new')")
        check('explicit restore affects only this week',desktop.evaluate("""() => {
          const slots=Object.values(buildScheduleEngine(getViewMon()).slotsByKey).flat()
            .filter(x=>x.s.id==='qa-new').map(x=>x.day+' '+x.time).sort();
          const off=getWK(addDays(getViewMon(),14));
          return slots.join(',')==='금 16:00,화 16:00'&&
            Array.isArray(weekOvr[off]?.['qa-new'])&&weekOvr[off]['qa-new'].length===0;
        }"""))
        wait_js(desktop,"_vsSync.pending()===0")
        status,remote=api('/api/export')
        check('Worker keeps the intentionally empty later week',status==200 and
              'qa-new' not in remote['state']['weekOvr'].get(wk,{}) and
              remote['state']['weekOvr'][off_wk]['qa-new']==[])
        check('zero JavaScript page errors',not errors)
        browser.close()
    print(json.dumps({'ok':True,'checks':checks,'errors':errors,'week':wk},ensure_ascii=False))
finally:
    if proc.poll() is None:
        subprocess.run(['taskkill','/PID',str(proc.pid),'/T','/F'],stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
    log.close()
