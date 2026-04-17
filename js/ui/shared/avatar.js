/**
 * avatar.js — 공용 아바타 렌더링 (중복 4곳 → 여기로 통합)
 */
function renderAvatar(s, size){
  size = size || 44;
  var c = gc(s);
  var c2 = COLORS[(students.indexOf(s)+2) % COLORS.length];
  var photo = getStudentPhoto(s);
  var style = 'width:'+size+'px;height:'+size+'px;border-radius:50%;'
    +'background:linear-gradient(135deg,'+c+','+c2+');'
    +'display:flex;align-items:center;justify-content:center;'
    +'font-size:'+(size*0.4)+'px;font-weight:700;color:#08080d;'
    +'flex-shrink:0;overflow:hidden';
  if(photo){
    return '<div style="'+style+'"><img src="'+photo+'" style="width:100%;height:100%;object-fit:cover"></div>';
  }
  return '<div style="'+style+'">'+esc(s.name.slice(0,1))+'</div>';
}
