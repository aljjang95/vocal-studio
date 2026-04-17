/**
 * effects.js — 계절 파티클 + 리플 이펙트 + 모바일 탭바 빌더
 */
/* ═══ Vocal Studio 감성 이펙트 ═══ */
(function(){

  /* ── 계절 감지 및 적용 ── */
  var month = new Date().getMonth() + 1;
  var season = month >= 3 && month <= 5 ? 'spring'
             : month >= 6 && month <= 8 ? 'summer'
             : month >= 9 && month <= 11 ? 'autumn'
             : 'winter';
  document.body.classList.add('season-' + season);
  // html 배경도 계절색으로
  var htmlBg = {spring:'#eef3ea',summer:'#f4f6fa',autumn:'#f7f4ef',winter:'#f2f4f7'};
  document.documentElement.style.background = htmlBg[season] || '#0a0804';
  // select option 배경도 계절색으로
  var styleEl = document.createElement('style');
  var optBg = {spring:'#eef3ea',summer:'#f4f6fa',autumn:'#f7f4ef',winter:'#f2f4f7'};
  styleEl.textContent = 'select option{background:' + (optBg[season]||'#141420') + '!important;}';
  document.head.appendChild(styleEl);

  /* ── 파티클 생성 (계절별 SVG) ── */
  var container = document.createElement('div');
  container.id = 'vs-particles';
  document.body.insertBefore(container, document.body.firstChild);

  var brushSVGs = [
    /* 붓획 1 — 긴 흘림 */
    '<svg xmlns="http://www.w3.org/2000/svg" width="6" height="90" viewBox="0 0 6 90"><defs><linearGradient id="b1" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="rgba(255,255,255,0)"/><stop offset="20%" stop-color="rgba(255,240,180,.8)"/><stop offset="60%" stop-color="rgba(200,160,80,.6)"/><stop offset="100%" stop-color="rgba(180,130,50,0)"/></linearGradient></defs><path d="M3 2 C2.2 20 3.8 40 2.5 60 C2 72 3.5 82 3 88" stroke="url(#b1)" stroke-width="1.8" fill="none" stroke-linecap="round"/></svg>',
    /* 붓획 2 — 짧고 굵은 */
    '<svg xmlns="http://www.w3.org/2000/svg" width="8" height="60" viewBox="0 0 8 60"><defs><linearGradient id="b2" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="rgba(255,255,255,0)"/><stop offset="25%" stop-color="rgba(255,248,200,.9)"/><stop offset="55%" stop-color="rgba(220,180,100,.7)"/><stop offset="100%" stop-color="rgba(180,140,60,0)"/></linearGradient></defs><path d="M4 2 C2.5 12 5.5 25 3 38 C2 48 4.5 55 4 58" stroke="url(#b2)" stroke-width="2.8" fill="none" stroke-linecap="round" opacity=".85"/></svg>',
    /* 붓획 3 — 가는 금빛 */
    '<svg xmlns="http://www.w3.org/2000/svg" width="4" height="75" viewBox="0 0 4 75"><defs><linearGradient id="b3" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="rgba(255,255,255,0)"/><stop offset="15%" stop-color="rgba(255,250,210,.75)"/><stop offset="50%" stop-color="rgba(200,165,90,.55)"/><stop offset="100%" stop-color="rgba(160,120,50,0)"/></linearGradient></defs><path d="M2 1 C1.5 15 2.8 30 1.8 50 C1.5 62 2.2 70 2 74" stroke="url(#b3)" stroke-width="1.2" fill="none" stroke-linecap="round"/></svg>',
    /* 붓획 4 — 살짝 휜 */
    '<svg xmlns="http://www.w3.org/2000/svg" width="10" height="80" viewBox="0 0 10 80"><defs><linearGradient id="b4" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="rgba(255,255,255,0)"/><stop offset="20%" stop-color="rgba(255,245,190,.8)"/><stop offset="45%" stop-color="rgba(215,175,95,.65)"/><stop offset="75%" stop-color="rgba(180,140,60,.3)"/><stop offset="100%" stop-color="rgba(140,100,30,0)"/></linearGradient></defs><path d="M5 2 C7 15 3 30 6 48 C8 60 4 70 5 78" stroke="url(#b4)" stroke-width="2.2" fill="none" stroke-linecap="round" opacity=".8"/></svg>',
  ];
  var petalSVGs = ['<svg xmlns="http://www.w3.org/2000/svg" width="18" height="22" viewBox="0 0 18 22"><path d="M9 2 C14 2 17 8 16 13 C15 18 12 21 9 21 C6 21 3 18 2 13 C1 8 4 2 9 2Z" fill="rgba(180,210,160,.85)" stroke="rgba(80,140,60,.25)" stroke-width=".5"/></svg>','<svg xmlns="http://www.w3.org/2000/svg" width="16" height="24" viewBox="0 0 16 24"><path d="M8 1 C12 4 15 10 14 15 C13 20 11 23 8 23 C5 23 3 20 2 15 C1 10 4 4 8 1Z" fill="rgba(160,200,140,.8)" stroke="rgba(60,130,50,.2)" stroke-width=".5"/></svg>','<svg xmlns="http://www.w3.org/2000/svg" width="14" height="18" viewBox="0 0 14 18"><ellipse cx="7" cy="9" rx="5" ry="8" fill="rgba(200,230,180,.9)" transform="rotate(-10,7,9)"/></svg>','<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 20 20"><path d="M10 2 C15 5 18 8 17 12 C16 16 13 19 10 19 C7 19 4 16 3 12 C2 8 5 5 10 2Z" fill="rgba(140,190,120,.75)"/></svg>'];
  var dropSVGs  = ['<svg xmlns="http://www.w3.org/2000/svg" width="10" height="14" viewBox="0 0 10 14"><path d="M5 1 C5 1 1 7 1 9.5 C1 12 2.8 13 5 13 C7.2 13 9 12 9 9.5 C9 7 5 1 5 1Z" fill="rgba(100,220,255,.7)" stroke="rgba(0,180,220,.3)" stroke-width=".5"/></svg>','<svg xmlns="http://www.w3.org/2000/svg" width="8" height="11" viewBox="0 0 8 11"><circle cx="4" cy="7" r="3.5" fill="rgba(150,235,255,.65)"/><path d="M4 1 L4 4" stroke="rgba(0,200,240,.4)" stroke-width="1.5" stroke-linecap="round"/></svg>'];
  var leafSVGs  = ['<svg xmlns="http://www.w3.org/2000/svg" width="20" height="22" viewBox="0 0 20 22"><path d="M10 2 C16 4 19 9 18 14 C17 19 14 21 10 21 C6 21 3 19 2 14 C1 9 4 4 10 2Z" fill="rgba(200,100,20,.8)"/><path d="M10 21 C10 21 10 14 10 10" stroke="rgba(120,60,10,.5)" stroke-width="1" stroke-linecap="round"/></svg>','<svg xmlns="http://www.w3.org/2000/svg" width="22" height="18" viewBox="0 0 22 18"><path d="M2 9 C4 3 10 1 14 3 C18 5 21 9 19 14 C17 17 13 18 9 16 C5 14 0 15 2 9Z" fill="rgba(220,130,30,.75)"/><path d="M2 9 L19 9" stroke="rgba(140,70,10,.4)" stroke-width=".8"/></svg>','<svg xmlns="http://www.w3.org/2000/svg" width="18" height="20" viewBox="0 0 18 20"><path d="M9 1 C14 3 17 8 15 14 C13 18 10 20 7 19 C4 18 2 15 3 10 C4 5 4 -1 9 1Z" fill="rgba(180,80,10,.8)"/></svg>'];
  var snowChars = ['❄','❅','❆','✦','·','∗'];

  window.makeParticle = function makeParticle(season){
    var el = document.createElement('div');
    var drift  = (Math.random() - .5) * 120;
    var drift2 = drift + (Math.random() - .5) * 80;
    var drift3 = drift2 + (Math.random() - .5) * 60;
    el.style.setProperty('--drift',  drift  + 'px');
    el.style.setProperty('--drift2', drift2 + 'px');
    el.style.setProperty('--drift3', drift3 + 'px');
    el.style.left = (Math.random() * 110 - 5) + 'vw';

    if(season === 'spring'){
      var useBrush = Math.random() < .4; /* 40% 확률로 붓획 */
      if(useBrush){
        el.className = 'vs-brush';
        el.innerHTML = brushSVGs[Math.floor(Math.random() * brushSVGs.length)];
        el.style.setProperty('--rot', (Math.random()*40-20) + 'deg');
        var bsz = .5 + Math.random() * .7;
        el.style.transform = 'scale(' + bsz + ') rotate(' + (Math.random()*30-15) + 'deg)';
        var bdur = 6 + Math.random() * 10;
        el.style.animationDuration = bdur + 's';
        el.style.animationDelay    = (Math.random() * bdur) + 's';
      } else {
        el.className = 'vs-petal';
        el.innerHTML = petalSVGs[Math.floor(Math.random() * petalSVGs.length)];
        var sz = .6 + Math.random() * .8;
        el.style.transform = 'scale(' + sz + ')';
        var dur = 8 + Math.random() * 14;
        el.style.animationDuration = dur + 's';
        el.style.animationDelay    = (Math.random() * dur) + 's';
      }
    } else if(season === 'summer'){
      el.className = 'vs-drop';
      el.innerHTML = dropSVGs[Math.floor(Math.random() * dropSVGs.length)];
      var sz2 = .7 + Math.random() * .9;
      el.style.transform = 'scale(' + sz2 + ')';
      var dur2 = 5 + Math.random() * 9;
      el.style.animationDuration = dur2 + 's';
      el.style.animationDelay    = (Math.random() * dur2) + 's';
    } else if(season === 'autumn'){
      el.className = 'vs-leaf';
      el.innerHTML = leafSVGs[Math.floor(Math.random() * leafSVGs.length)];
      var sz3 = .7 + Math.random() * .7;
      el.style.transform = 'scale(' + sz3 + ')';
      var dur3 = 7 + Math.random() * 12;
      el.style.animationDuration = dur3 + 's';
      el.style.animationDelay    = (Math.random() * dur3) + 's';
    } else {
      el.className = 'vs-snow';
      el.textContent = snowChars[Math.floor(Math.random() * snowChars.length)];
      el.style.fontSize = (10 + Math.random() * 16) + 'px';
      var dur4 = 6 + Math.random() * 10;
      el.style.animationDuration = dur4 + 's';
      el.style.animationDelay    = (Math.random() * dur4) + 's';
    }
    el.style.opacity = '0';
    container.appendChild(el);
  }

  var particleCount = {spring:16, summer:10, autumn:12, winter:18};
  var count = particleCount[season] || 12;
  for(var i = 0; i < count; i++){
    (function(i){ setTimeout(function(){ makeParticle(season); }, i * 200); })(i);
  }

  /* ── 파문(Ripple) 이펙트 ── */
  document.addEventListener('click', function(e){
    var target = e.target.closest('.btn, .ni, .mtab-item, .lc, .ci');
    if(!target) return;
    var rect = target.getBoundingClientRect();
    var dot = document.createElement('div');
    dot.className = 'ripple-dot';
    dot.style.left = (e.clientX - rect.left) + 'px';
    dot.style.top  = (e.clientY - rect.top)  + 'px';
    // 계절별 색상
    var rippleColors = {
      spring:'rgba(45,90,39,.3)',
      summer:'rgba(26,48,96,.3)',
      autumn:'rgba(122,62,10,.3)',
      winter:'rgba(36,48,96,.3)'
    };
    dot.style.setProperty('--ripple-color', rippleColors[season] || 'rgba(255,255,255,.5)');
    target.appendChild(dot);
    setTimeout(function(){ dot.remove(); }, 600);
  }, true);

  /* ── 스케줄 설정 버튼 표시 관리 ── */
  document.addEventListener('click', function(ev){
    var cfgPanel = document.getElementById('vs-sched-cfg');
    var cfgBtn   = document.getElementById('vs-sched-cfg-btn');
    if(!cfgPanel) return;
    // 패널 외부 클릭 시 닫기
    if(cfgPanel.classList.contains('open') && !cfgPanel.contains(ev.target)){
      cfgPanel.classList.remove('open');
    }
  }, true);

  /* ── 탭바 DOM 버그 수정 ── */
  function buildTabBar(){
    var tabs=[
      {id:'consult',  icon:'📋', label:'상담'},
      {id:'students', icon:'🎵', label:'레슨생'},
      {id:'logs',     icon:'✏️',  label:'기록'},
      {id:'payment',  icon:'💰', label:'입금'},
      {id:'today',    icon:'⏰', label:'오늘'},
      {id:'schedule', icon:'📅', label:'스케줄'}
    ];
    var bar=document.getElementById('mobileTabBar');
    if(!bar||bar.children.length>0)return;
    tabs.forEach(function(t){
      var el=document.createElement('div');
      el.id='mTab_'+t.id;
      el.className='mtab-item';
      el.innerHTML='<span class="mtab-ic">'+t.icon+'</span><span class="mtab-lb">'+t.label+'</span>';
      el.addEventListener('click',function(){go(t.id);});
      bar.appendChild(el);
    });
  }
  if(document.readyState==='loading'){document.addEventListener('DOMContentLoaded',buildTabBar);}
  else{buildTabBar();}

})();