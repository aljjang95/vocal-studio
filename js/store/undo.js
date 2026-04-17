/* ═══════════════════════════════════════════════════════
   undo.js — 실행취소(Undo) / 다시실행(Redo) 시스템
   - _undoStack / _redoStack: 상태 스냅샷 스택
   - pushUndo(): 현재 상태를 undo 스택에 저장
   - undoAction(): 이전 상태로 복원
   - redoAction(): 앞으로 이동
   ═══════════════════════════════════════════════════════ */

/* ── 실행취소 스택 ── */
var _undoStack=[];
var _redoStack=[];
var _undoMaxSize=20;

function pushUndo(){
  _undoStack.push({
    weekOvr: JSON.parse(JSON.stringify(weekOvr)),
    students: JSON.parse(JSON.stringify(students)),
    logs: JSON.parse(JSON.stringify(logs)),
  });
  if(_undoStack.length>_undoMaxSize)_undoStack.shift();
  _redoStack=[];
}

function undoAction(){
  if(!_undoStack.length){toast('더 이상 되돌릴 수 없습니다','⚠️');return;}
  /* 현재 상태를 redo 스택에 저장 */
  _redoStack.push({
    weekOvr:JSON.parse(JSON.stringify(weekOvr)),
    students:JSON.parse(JSON.stringify(students)),
    logs:JSON.parse(JSON.stringify(logs)),
  });
  var prev=_undoStack.pop();
  weekOvr=prev.weekOvr;
  students=prev.students;
  logs=prev.logs;
  saveAll();renderSidebarToday();render();
  toast('↩️ 이전 (남은 '+_undoStack.length+'개)');
}

function redoAction(){
  if(!_redoStack.length){toast('앞으로 되돌릴 내용이 없습니다','⚠️');return;}
  _undoStack.push({
    weekOvr:JSON.parse(JSON.stringify(weekOvr)),
    students:JSON.parse(JSON.stringify(students)),
    logs:JSON.parse(JSON.stringify(logs)),
  });
  var next=_redoStack.pop();
  weekOvr=next.weekOvr;
  students=next.students;
  logs=next.logs;
  saveAll();renderSidebarToday();render();
  toast('↪️ 앞으로 (남은 '+_redoStack.length+'개)');
}

/* Ctrl+Z / Ctrl+Y / Ctrl+Shift+Z 키보드 단축키 */
document.addEventListener('keydown',function(e){
  if((e.ctrlKey||e.metaKey)&&e.key==='z'&&!e.shiftKey){
    e.preventDefault();undoAction();
  } else if((e.ctrlKey||e.metaKey)&&(e.key==='y'||(e.key==='z'&&e.shiftKey))){
    e.preventDefault();redoAction();
  }
});
