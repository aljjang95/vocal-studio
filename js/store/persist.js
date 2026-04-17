/* ═══════════════════════════════════════════════════════
   persist.js — localStorage 저장/불러오기 + 앱 설정
   - saveAll(): 전체 데이터 localStorage 저장
   - _cfg / saveCfg() / loadCfg: 앱 설정 관리
   - 사진은 별도 localStorage 키로 분리 저장
   ═══════════════════════════════════════════════════════ */

/* ── saveAll: 전체 데이터 localStorage 저장 ── */
function saveAll(){
  try{
    /* 오디오/비디오 base64 데이터는 localStorage에서 제외 (용량 초과 방지) */
    var stripMedia=function(arr){
      if(!arr||!arr.length)return arr;
      return arr.map(function(a){
        if(a.data&&a.data.length>50000)return Object.assign({},a,{data:'[saved]'});
        return a;
      });
    };
    var stripConsent=function(cr){
      if(!cr)return cr;
      if(cr.data&&cr.data.length>50000)return Object.assign({},cr,{data:'[saved]'});
      return cr;
    };
    var _ss=students.map(function(x){return Object.assign({},x,{
      photo:x.photo&&x.photo.length>5000?'':x.photo,
      audios:stripMedia(x.audios),
      videos:stripMedia(x.videos),
      consentRec:stripConsent(x.consentRec)
    });});
    var _cs=consults.map(function(x){return Object.assign({},x,{
      photo:x.photo&&x.photo.length>5000?'':x.photo,
      audios:stripMedia(x.audios),
      videos:stripMedia(x.videos),
      consentRec:stripConsent(x.consentRec)
    });});
    localStorage.setItem('vsC_s',JSON.stringify(_ss));
    localStorage.setItem('vsC_l',JSON.stringify(logs));
    localStorage.setItem('vsC_wo',JSON.stringify(weekOvr));
    localStorage.setItem('vsC_c',JSON.stringify(_cs));
    localStorage.setItem('vsC_p',JSON.stringify(payments));
    localStorage.setItem('vsC_iq',JSON.stringify(inquiries));
  }catch(e){
    try{
      var _cs2=consults.map(function(x){return Object.assign({},x,{photo:'',audios:[],videos:[],consentRec:null});});
      var _ss2=students.map(function(x){return Object.assign({},x,{photo:'',audios:[],videos:[],consentRec:null});});
      localStorage.setItem('vsC_s',JSON.stringify(_ss2));
      localStorage.setItem('vsC_l',JSON.stringify(logs));
      localStorage.setItem('vsC_wo',JSON.stringify(weekOvr));
      localStorage.setItem('vsC_c',JSON.stringify(_cs2));
      localStorage.setItem('vsC_p',JSON.stringify(payments));
      localStorage.setItem('vsC_iq',JSON.stringify(inquiries));
      toast('⚠️ 저장 공간 부족으로 미디어가 제외되었습니다','⚠️');
    }catch(e2){toast('저장 실패: 저장 공간이 부족합니다','❌');}
  }
}

/* ── 앱 설정 객체 및 저장/불러오기 ── */
var _cfg={monOff:true,customHolidays:[],sunCollapsed:false,monCollapsed:false,sunHidden:false,monHidden:false};
try{var _craw=localStorage.getItem('vsC_cfg');if(_craw)_cfg=JSON.parse(_craw);}catch(e){}

function saveCfg(){localStorage.setItem('vsC_cfg',JSON.stringify(_cfg));}
