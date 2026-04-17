/* ═══════════════════════════════════════════════════════
   media-db.js — IndexedDB 미디어 저장소
   - _mediaDB: IndexedDB 인스턴스
   - _mediaQueue: DB 초기화 전 대기 중인 작업 큐
   - mediaSave(key, data, cb): 미디어 데이터 저장
   - mediaLoad(key, cb): 미디어 데이터 로드
   - mediaDelete(key): 미디어 데이터 삭제
   ═══════════════════════════════════════════════════════ */

/* ── IndexedDB 인스턴스 및 작업 큐 ── */
var _mediaDB=null;
var _mediaQueue=[];

/* ── IndexedDB 초기화 (즉시 실행) ── */
(function(){
  try{
    var req=indexedDB.open('vsMediaDB',2);
    req.onupgradeneeded=function(e){
      var db=e.target.result;
      if(!db.objectStoreNames.contains('media'))db.createObjectStore('media');
    };
    req.onsuccess=function(e){
      _mediaDB=e.target.result;
      /* 대기 중인 작업 처리 */
      _mediaQueue.forEach(function(fn){try{fn();}catch(e){}});
      _mediaQueue=[];
    };
    req.onerror=function(){console.warn('IndexedDB 초기화 실패');};
  }catch(e){console.warn('IndexedDB 미지원');}
})();

/* ── 미디어 데이터 저장 ── */
function mediaSave(key,data,cb){
  if(!_mediaDB){
    _mediaQueue.push(function(){mediaSave(key,data,cb);});
    return;
  }
  try{
    var tx=_mediaDB.transaction('media','readwrite');
    tx.objectStore('media').put(data,key);
    tx.oncomplete=function(){if(cb)cb(true);};
    tx.onerror=function(){if(cb)cb(false);};
  }catch(e){if(cb)cb(false);}
}

/* ── 미디어 데이터 로드 ── */
function mediaLoad(key,cb){
  if(!_mediaDB){
    _mediaQueue.push(function(){mediaLoad(key,cb);});
    return;
  }
  try{
    var tx=_mediaDB.transaction('media','readonly');
    var req=tx.objectStore('media').get(key);
    req.onsuccess=function(){cb(req.result||null);};
    req.onerror=function(){cb(null);};
  }catch(e){cb(null);}
}

/* ── 미디어 데이터 삭제 ── */
function mediaDelete(key){
  if(!_mediaDB){
    _mediaQueue.push(function(){mediaDelete(key);});
    return;
  }
  try{var tx=_mediaDB.transaction('media','readwrite');tx.objectStore('media').delete(key);}catch(e){}
}
