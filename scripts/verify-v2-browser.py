"""Actual V2 + local Wrangler/SQLite DO; synthetic data only, no production writes."""
import json, os, subprocess, time, urllib.request, shutil
from datetime import datetime, timedelta, timezone
from pathlib import Path
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/'tmp/v2-browser';OUT.mkdir(parents=True,exist_ok=True)
ORIGIN='http://127.0.0.1:18862';PROTO='vs-cf-1'
STATE=OUT/'worker-state'
if STATE.exists():shutil.rmtree(STATE)
checks=[];errors=[];browser=None;worker=None
TODAY=datetime.now(timezone(timedelta(hours=9))).date()
DAY=['월','화','수','목','금','토','일'][TODAY.weekday()]
def check(name,value=True):
    assert value,name
    checks.append(name)
def api(path,body=None):
    headers={'X-VS-Protocol':PROTO}
    if body is not None:headers.update({'Origin':ORIGIN,'Content-Type':'application/json'})
    req=urllib.request.Request(ORIGIN+path,data=None if body is None else json.dumps(body,ensure_ascii=False).encode(),headers=headers)
    with urllib.request.urlopen(req,timeout=15) as response:return json.load(response)
def wait(page,expression):page.wait_for_function(expression,timeout=20000)
def click(page,action):page.locator('[data-action="'+action+'"]:visible').first.click()
def fill(page,name,value):page.locator('#action-form [name="'+name+'"]').fill(str(value))
def save(page):page.locator('#action-form [type=submit]').click();wait(page,'!document.getElementById("editor").open')
def close(page):page.locator('#editor [data-action=close]').first.click()
fixture={'students':[
 {'id':'a','name':'검증 고객 A','ph':'010-0000-1001','status':'수강중','schedType':'fixed','days':[DAY],'times':{DAY:'14:00'},'st':'2026-01-01'},
 {'id':'b','name':'검증 고객 B','ph':'010-0000-1002','status':'수강중','schedType':'flex','days':[],'times':{},'st':'2026-01-01'},
 {'id':'c','name':'검증 고객 C','ph':'010-0000-1003','status':'수강중','schedType':'fixed','days':['월','수'],'times':{'월':'11:00','수':'12:00'},'st':'2026-01-01'}],
 'logs':[],'consults':[],'payments':[],'inquiries':[],'weekOvr':{},'futureRoot':{'mustRemain':True}}
try:
    subprocess.run(['node','scripts/build-worker.mjs'],cwd=ROOT,check=True)
    with (OUT/'worker.log').open('w',encoding='utf-8') as log:
        worker=subprocess.Popen(['node',str(ROOT/'node_modules/wrangler/bin/wrangler.js'),'dev','--config','wrangler.local.jsonc','--ip','127.0.0.1','--port','18862','--local','--persist-to',str(STATE)],cwd=ROOT,stdout=log,stderr=log)
        for _ in range(150):
            try:api('/api/session');break
            except Exception:time.sleep(.2)
        else:raise RuntimeError('Local Worker did not start')
        api('/api/import',{'state':fixture});export=api('/api/export');api('/api/activate',{'hash':export['hash']})
        with sync_playwright() as p:
            channel=os.environ.get('VS_BROWSER_CHANNEL','chrome')
            browser=p.chromium.launch(channel=channel,headless=True,timeout=30000)
            desktop=browser.new_context(viewport={'width':1440,'height':1040},locale='ko-KR')
            mobile=browser.new_context(viewport={'width':390,'height':844},is_mobile=True,has_touch=True,locale='ko-KR')
            page=desktop.new_page();phone=mobile.new_page()
            for client in [page,phone]:
                client.on('pageerror',lambda err:errors.append(str(err)))
                client.goto(ORIGIN+'/v2/',wait_until='domcontentloaded',timeout=30000)
                wait(client,'window.hlbV2?.controller?.ready && document.querySelector(".kpis")')
            check('independent desktop/mobile both loaded actual local server')
            click(page,'inquiry.save');fill(page,'phone','01012345678');fill(page,'name','검증 신규 문의');fill(page,'memo','테스트 전용 상담')
            close(page);click(page,'inquiry.save');check('same-account inquiry draft restores',page.locator('[name=phone]').input_value()=='01012345678')
            save(page);wait(phone,'hlbV2.state.inquiries.length===1');check('desktop inquiry reaches mobile without reload')
            phone.locator('#mobile-navigation [data-view=inquiries]').click();click(phone,'inquiry.book')
            fill(phone,'date',TODAY.isoformat());fill(phone,'time','18:30');fill(phone,'duration',30);save(phone)
            wait(page,'hlbV2.state.inquiries[0].visitTime==="18:30"');check('mobile consultation booking reaches desktop')
            check('booking visible in schedule',page.locator('.calendar-event').filter(has_text='검증 신규 문의').count()==1)
            click(phone,'inquiry');click(phone,'application.save');fill(phone,'goal','음정과 발성 개선');phone.locator('[name=confirmed]').check();save(phone)
            wait(page,'hlbV2.state.consults.length===1');check('application links inquiry once',bool(api('/api/state')['state']['inquiries'][0]['consultId']))
            check('application does not silently create customer',len(api('/api/state')['state']['students'])==3)
            click(page,'schedule.once');page.locator('[name=studentId]').select_option('b');fill(page,'date',TODAY.isoformat());fill(page,'time','16:30');fill(page,'duration',50);save(page)
            wait(phone,'Object.values(hlbV2.state.weekOvr).some(w=>w.b?.some(s=>s.time==="16:30"))');check('variable appointment syncs to mobile')
            revision=api('/api/state')['revision']
            click(page,'schedule.once');page.locator('[name=studentId]').select_option('b');fill(page,'date',TODAY.isoformat());fill(page,'time','14:30');fill(page,'duration',30)
            page.locator('#action-form [type=submit]').click();wait(page,'document.getElementById("form-error").textContent.includes("겹칩니다")');check('partial overlap rejected before write',api('/api/state')['revision']==revision);close(page)
            page.locator('.calendar-event').filter(has_text='검증 고객 B').click();click(page,'schedule.move');fill(page,'time','17:30');save(page)
            wait(phone,'Object.values(hlbV2.state.weekOvr).some(w=>w.b?.some(s=>s.time==="17:30"&&!s.absent))');check('move reaches the other device')
            page.locator('.calendar-event').filter(has_text='검증 고객 B').click();page.once('dialog',lambda dialog:dialog.accept());click(page,'cancel')
            wait(phone,'Object.values(hlbV2.state.weekOvr).some(w=>w.b?.filter(s=>!s.absent).length===0)');check('cancellation reaches other device')
            phone.reload(wait_until='domcontentloaded');wait(phone,'hlbV2?.controller?.ready');check('cancellation survives reload',phone.evaluate('Object.values(hlbV2.state.weekOvr).some(w=>w.b?.filter(s=>!s.absent).length===0)'))
            page.locator('#navigation [data-view=customers]').click();click(page,'student.create');fill(page,'name','검증 전용 수강생');fill(page,'phone','01055556666');save(page)
            wait(phone,'hlbV2.state.students.length===4');check('explicit customer creation syncs')
            page.locator('#navigation [data-view=home]').click();click(page,'schedule.fixed');page.locator('[name=studentId]').select_option('b');fill(page,'start',TODAY.isoformat());fill(page,'end',(TODAY+timedelta(days=21)).isoformat());page.locator('[name=days][value="토"]').check();fill(page,'time','10:00');save(page)
            wait(phone,'hlbV2.state.students.find(s=>s.id==="b").v2FixedRules?.length===1');check('fixed recurrence is synchronized')
            for client,label,widths in [(page,'desktop',[1440]),(phone,'mobile',[390,360])]:
                for width in widths:
                    client.set_viewport_size({'width':width,'height':1040 if width==1440 else 844})
                    for tab in ['home','schedule','inquiries','customers','settings']:
                        client.locator(('#navigation' if width==1440 else '#mobile-navigation')+' [data-view='+tab+']').click()
                        check(f'{label}-{width}-{tab}: no document overflow',client.evaluate('document.documentElement.scrollWidth<=innerWidth+1'))
                        if tab in ['home','schedule']:client.screenshot(path=str(OUT/f'v2-{label}-{width}-{tab}.png'),full_page=True)
                    check(f'{label}-{width}: no corrupt placeholder',not client.locator('body').inner_text().find('???')>=0)
            check('unknown root survives all V2 commits',api('/api/state')['state']['futureRoot']['mustRemain'])
            check('no page exceptions',len(errors)==0)
            browser.close();browser=None
finally:
    if browser:browser.close()
    if worker:
        if os.name=='nt':subprocess.run(['taskkill','/PID',str(worker.pid),'/T','/F'],stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
        else:worker.terminate()
    (OUT/'result.json').write_text(json.dumps({'checks':checks,'passed':len(checks),'errors':errors,'surface':'Actual app + local Worker/SQLite DO, installed headless browser; emulated mobile, not a physical phone'},ensure_ascii=False,indent=2),encoding='utf-8')
print(json.dumps({'passed':len(checks),'errors':errors},ensure_ascii=False))
