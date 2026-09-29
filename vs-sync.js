/* Vocal Studio synchronization protocol. No network access without an injected adapter. */
(function(root,factory){
  var api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  else root.VSSync=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';
  /* lz-string 1.5.0, unmodified npm libs/lz-string.min.js, isolated UMD scope.
   * MIT License
   *
   * Copyright (c) 2013 pieroxy
   *
   * Permission is hereby granted, free of charge, to any person obtaining a copy
   * of this software and associated documentation files (the "Software"), to deal
   * in the Software without restriction, including without limitation the rights
   * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
   * copies of the Software, and to permit persons to whom the Software is
   * furnished to do so, subject to the following conditions:
   *
   * The above copyright notice and this permission notice shall be included in all
   * copies or substantial portions of the Software.
   *
   * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
   * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
   * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
   * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
   * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
   * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
   * SOFTWARE.
   */
  var backupCompression=(function(){var module={exports:{}},define,angular;
var LZString=function(){var r=String.fromCharCode,o="ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=",n="ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+-$",e={};function t(r,o){if(!e[r]){e[r]={};for(var n=0;n<r.length;n++)e[r][r.charAt(n)]=n}return e[r][o]}var i={compressToBase64:function(r){if(null==r)return"";var n=i._compress(r,6,function(r){return o.charAt(r)});switch(n.length%4){default:case 0:return n;case 1:return n+"===";case 2:return n+"==";case 3:return n+"="}},decompressFromBase64:function(r){return null==r?"":""==r?null:i._decompress(r.length,32,function(n){return t(o,r.charAt(n))})},compressToUTF16:function(o){return null==o?"":i._compress(o,15,function(o){return r(o+32)})+" "},decompressFromUTF16:function(r){return null==r?"":""==r?null:i._decompress(r.length,16384,function(o){return r.charCodeAt(o)-32})},compressToUint8Array:function(r){for(var o=i.compress(r),n=new Uint8Array(2*o.length),e=0,t=o.length;e<t;e++){var s=o.charCodeAt(e);n[2*e]=s>>>8,n[2*e+1]=s%256}return n},decompressFromUint8Array:function(o){if(null==o)return i.decompress(o);for(var n=new Array(o.length/2),e=0,t=n.length;e<t;e++)n[e]=256*o[2*e]+o[2*e+1];var s=[];return n.forEach(function(o){s.push(r(o))}),i.decompress(s.join(""))},compressToEncodedURIComponent:function(r){return null==r?"":i._compress(r,6,function(r){return n.charAt(r)})},decompressFromEncodedURIComponent:function(r){return null==r?"":""==r?null:(r=r.replace(/ /g,"+"),i._decompress(r.length,32,function(o){return t(n,r.charAt(o))}))},compress:function(o){return i._compress(o,16,function(o){return r(o)})},_compress:function(r,o,n){if(null==r)return"";var e,t,i,s={},u={},a="",p="",c="",l=2,f=3,h=2,d=[],m=0,v=0;for(i=0;i<r.length;i+=1)if(a=r.charAt(i),Object.prototype.hasOwnProperty.call(s,a)||(s[a]=f++,u[a]=!0),p=c+a,Object.prototype.hasOwnProperty.call(s,p))c=p;else{if(Object.prototype.hasOwnProperty.call(u,c)){if(c.charCodeAt(0)<256){for(e=0;e<h;e++)m<<=1,v==o-1?(v=0,d.push(n(m)),m=0):v++;for(t=c.charCodeAt(0),e=0;e<8;e++)m=m<<1|1&t,v==o-1?(v=0,d.push(n(m)),m=0):v++,t>>=1}else{for(t=1,e=0;e<h;e++)m=m<<1|t,v==o-1?(v=0,d.push(n(m)),m=0):v++,t=0;for(t=c.charCodeAt(0),e=0;e<16;e++)m=m<<1|1&t,v==o-1?(v=0,d.push(n(m)),m=0):v++,t>>=1}0==--l&&(l=Math.pow(2,h),h++),delete u[c]}else for(t=s[c],e=0;e<h;e++)m=m<<1|1&t,v==o-1?(v=0,d.push(n(m)),m=0):v++,t>>=1;0==--l&&(l=Math.pow(2,h),h++),s[p]=f++,c=String(a)}if(""!==c){if(Object.prototype.hasOwnProperty.call(u,c)){if(c.charCodeAt(0)<256){for(e=0;e<h;e++)m<<=1,v==o-1?(v=0,d.push(n(m)),m=0):v++;for(t=c.charCodeAt(0),e=0;e<8;e++)m=m<<1|1&t,v==o-1?(v=0,d.push(n(m)),m=0):v++,t>>=1}else{for(t=1,e=0;e<h;e++)m=m<<1|t,v==o-1?(v=0,d.push(n(m)),m=0):v++,t=0;for(t=c.charCodeAt(0),e=0;e<16;e++)m=m<<1|1&t,v==o-1?(v=0,d.push(n(m)),m=0):v++,t>>=1}0==--l&&(l=Math.pow(2,h),h++),delete u[c]}else for(t=s[c],e=0;e<h;e++)m=m<<1|1&t,v==o-1?(v=0,d.push(n(m)),m=0):v++,t>>=1;0==--l&&(l=Math.pow(2,h),h++)}for(t=2,e=0;e<h;e++)m=m<<1|1&t,v==o-1?(v=0,d.push(n(m)),m=0):v++,t>>=1;for(;;){if(m<<=1,v==o-1){d.push(n(m));break}v++}return d.join("")},decompress:function(r){return null==r?"":""==r?null:i._decompress(r.length,32768,function(o){return r.charCodeAt(o)})},_decompress:function(o,n,e){var t,i,s,u,a,p,c,l=[],f=4,h=4,d=3,m="",v=[],g={val:e(0),position:n,index:1};for(t=0;t<3;t+=1)l[t]=t;for(s=0,a=Math.pow(2,2),p=1;p!=a;)u=g.val&g.position,g.position>>=1,0==g.position&&(g.position=n,g.val=e(g.index++)),s|=(u>0?1:0)*p,p<<=1;switch(s){case 0:for(s=0,a=Math.pow(2,8),p=1;p!=a;)u=g.val&g.position,g.position>>=1,0==g.position&&(g.position=n,g.val=e(g.index++)),s|=(u>0?1:0)*p,p<<=1;c=r(s);break;case 1:for(s=0,a=Math.pow(2,16),p=1;p!=a;)u=g.val&g.position,g.position>>=1,0==g.position&&(g.position=n,g.val=e(g.index++)),s|=(u>0?1:0)*p,p<<=1;c=r(s);break;case 2:return""}for(l[3]=c,i=c,v.push(c);;){if(g.index>o)return"";for(s=0,a=Math.pow(2,d),p=1;p!=a;)u=g.val&g.position,g.position>>=1,0==g.position&&(g.position=n,g.val=e(g.index++)),s|=(u>0?1:0)*p,p<<=1;switch(c=s){case 0:for(s=0,a=Math.pow(2,8),p=1;p!=a;)u=g.val&g.position,g.position>>=1,0==g.position&&(g.position=n,g.val=e(g.index++)),s|=(u>0?1:0)*p,p<<=1;l[h++]=r(s),c=h-1,f--;break;case 1:for(s=0,a=Math.pow(2,16),p=1;p!=a;)u=g.val&g.position,g.position>>=1,0==g.position&&(g.position=n,g.val=e(g.index++)),s|=(u>0?1:0)*p,p<<=1;l[h++]=r(s),c=h-1,f--;break;case 2:return v.join("")}if(0==f&&(f=Math.pow(2,d),d++),l[c])m=l[c];else{if(c!==h)return null;m=i+i.charAt(0)}v.push(m),l[h++]=i+m.charAt(0),i=m,0==--f&&(f=Math.pow(2,d),d++)}}};return i}();"function"==typeof define&&define.amd?define(function(){return LZString}):"undefined"!=typeof module&&null!=module?module.exports=LZString:"undefined"!=typeof angular&&null!=angular&&angular.module("LZString",[]).factory("LZString",function(){return LZString});
    return module.exports;})();
  var LISTS=['students','logs','consults','payments','inquiries'];
  var own=function(object,key){return Object.prototype.hasOwnProperty.call(object,key);};
  function clone(value){return JSON.parse(JSON.stringify(value));}
  function stable(value){
    if(Array.isArray(value))return value.map(stable);
    if(value&&typeof value==='object'){
      var out=Object.create(null);
      Object.keys(value).sort().forEach(function(key){out[key]=stable(value[key]);});
      return out;
    }
    return value;
  }
  function equal(a,b){return JSON.stringify(stable(a))===JSON.stringify(stable(b));}
  function put(object,key,value){Object.defineProperty(object,key,{value:value,writable:true,enumerable:true,configurable:true});}
  function safeMedia(entry){
    if(!entry||typeof entry!=='object')return entry;
    var out=Object.assign({},entry);delete out._mediaKey;delete out._photoKey;
    if(typeof out.data==='string'&&out.data.length>50000)out.data='[saved]';
    return out;
  }
  function safeRow(row){
    if(!row||typeof row!=='object')return row;
    var out=Object.assign({},row);delete out._photoKey;delete out._mediaKey;
    if(typeof out.photo==='string'&&out.photo.length>5000)out.photo='';
    ['audios','videos'].forEach(function(field){if(Array.isArray(out[field]))out[field]=out[field].map(safeMedia);});
    if(out.consentRec)out.consentRec=safeMedia(out.consentRec);
    return out;
  }
  function retainLocal(row,previous){
    if(!row||typeof row!=='object'||!previous)return row;
    var out=Object.assign({},row);
    ['_photoKey','_mediaKey'].forEach(function(key){if(!out[key]&&previous[key])out[key]=previous[key];});
    function carry(entry,old){
      if(!entry||!old||rowKey(entry)===null||rowKey(entry)!==rowKey(old))return entry;
      var item=Object.assign({},entry);
      if(old._mediaKey)item._mediaKey=old._mediaKey;
      if(item.data==='[saved]'&&typeof old.data==='string'&&old.data.length>50000)item.data=old.data;
      return item;
    }
    ['audios','videos'].forEach(function(field){
      var old=indexed(previous[field]||[]);if(!old||!Array.isArray(out[field]))return;
      out[field]=out[field].map(function(entry){return carry(entry,old.get(rowKey(entry)));});
    });
    if(out.consentRec)out.consentRec=carry(out.consentRec,previous.consentRec);
    return out;
  }
  function normalize(data){
    var out={};
    LISTS.forEach(function(field){
      if(data[field]!=null&&!Array.isArray(data[field]))throw Error('invalid-collection:'+field);
      out[field]=clone(data[field]||[]).map(safeRow);
    });
    if(data.weekOvr!=null&&(typeof data.weekOvr!=='object'||Array.isArray(data.weekOvr)))throw Error('invalid-week-map');
    out.weekOvr=clone(data.weekOvr||{});
    Object.keys(out.weekOvr).forEach(function(week){
      if(!out.weekOvr[week]||typeof out.weekOvr[week]!=='object'||Array.isArray(out.weekOvr[week]))throw Error('invalid-week');
    });
    return out;
  }
  function rowKey(row){return row&&['string','number'].indexOf(typeof row.id)>=0&&String(row.id)!==''?typeof row.id+':'+row.id:null;}
  function indexed(list){
    var map=new Map();
    for(var i=0;i<list.length;i++){var key=rowKey(list[i]);if(key===null||map.has(key))return null;map.set(key,list[i]);}
    return map;
  }
  function diff(base,local){
    base=normalize(base);local=normalize(local);var operations=[];
    function add(kind,field,key,before,after,beforeExists,afterExists,week){
      if(beforeExists===afterExists&&equal(before,after))return;
      operations.push({kind:kind,field:field,key:key,week:week,before:before,after:after,beforeExists:beforeExists,afterExists:afterExists});
    }
    LISTS.forEach(function(field){
      var a=indexed(base[field]),b=indexed(local[field]);
      if(!a||!b){add('field',field,null,base[field],local[field],true,true);return;}
      new Set(Array.from(a.keys()).concat(Array.from(b.keys()))).forEach(function(key){add('row',field,key,a.get(key),b.get(key),a.has(key),b.has(key));});
    });
    new Set(Object.keys(base.weekOvr).concat(Object.keys(local.weekOvr))).forEach(function(week){
      var a=own(base.weekOvr,week)?base.weekOvr[week]:{},b=own(local.weekOvr,week)?local.weekOvr[week]:{};
      new Set(Object.keys(a).concat(Object.keys(b))).forEach(function(key){add('week','weekOvr',key,a[key],b[key],own(a,key),own(b,key),week);});
    });
    return operations;
  }
  function apply(remote,operations){
    var value=normalize(remote),conflicts=[];
    operations.forEach(function(op){
      var target=value,key=op.field,index=-1,exists=true,current;
      if(op.kind==='row'){
        target=value[op.field];index=target.findIndex(function(row){return rowKey(row)===op.key;});
        key=index;exists=index>=0;current=target[index];
        if(indexed(target)===null){conflicts.push(op);return;}
      }else if(op.kind==='week'){
        target=own(value.weekOvr,op.week)?value.weekOvr[op.week]:{};key=op.key;
        exists=own(target,key);current=target[key];
      }else current=target[key];
      if(exists===op.afterExists&&equal(current,op.after))return;
      if(exists!==op.beforeExists||!equal(current,op.before)){conflicts.push(op);return;}
      if(op.kind==='row'){
        if(!op.afterExists)target.splice(index,1);
        else if(index<0)target.push(clone(op.after));
        else target[index]=clone(op.after);
      }else{
        if(op.kind==='week'&&!own(value.weekOvr,op.week))put(value.weekOvr,op.week,target);
        if(op.afterExists)put(target,key,clone(op.after));else delete target[key];
      }
    });
    return {value:value,conflicts:conflicts};
  }
  function revision(data){
    var value=data._vsSyncRevision==null?0:data._vsSyncRevision;
    if(!Number.isSafeInteger(value)||value<0)throw Error('invalid-revision');return value;
  }
  function backupChecksum(text){
    var hash=2166136261;
    for(var i=0;i<text.length;i++){hash^=text.charCodeAt(i);hash=Math.imul(hash,16777619);}
    return (hash>>>0).toString(16);
  }
  function decodeBackup(raw){
    if(raw===null)return raw;
    var packed;try{packed=JSON.parse(raw);}catch(error){return raw;}
    if(!packed||packed.encoding!=='vs-lz-utf16-1')return raw;
    if(packed.version!==2||!Number.isSafeInteger(packed.length)||packed.length<0||
       typeof packed.data!=='string'||typeof packed.checksum!=='string')throw Error('invalid-backup-envelope');
    var text=backupCompression.decompressFromUTF16(packed.data);
    if(packed.layout==='repeat-base'){
      var split=JSON.parse(text);
      if(!split||typeof split.piece!=='string'||!Array.isArray(split.parts)||split.parts.length<3||
         !split.parts.every(function(part){return typeof part==='string';}))throw Error('invalid-backup-parts');
      text=split.parts.join(split.piece);
    }else if(packed.layout==='json-tree'){text=expandBackupTree(JSON.parse(text),packed.length);
    }else if(packed.layout!=='raw')throw Error('invalid-backup-layout');
    if(typeof text!=='string'||text.length!==packed.length||backupChecksum(text)!==packed.checksum)throw Error('backup-integrity');
    return text;
  }
  /* Share identical JSON subtrees, not just whole snapshots. Editing multiple fields
     leaves unchanged rows/media/metadata stored once across base, local, recovery and ACK.
     Every node is tagged, so user data can never be mistaken for a dictionary reference. */
  function backupTree(value){
    var table=[],seen=new Map();
    function visit(value){
      var raw=JSON.stringify(value),shared=raw.length>=256;
      if(shared&&seen.has(raw))return [3,seen.get(raw)];
      var index=table.length;
      if(shared){seen.set(raw,index);table.push(null);}
      var node;
      if(Array.isArray(value))node=[1,value.map(visit)];
      else if(value&&typeof value==='object')node=[2,Object.keys(value).map(function(key){return [key,visit(value[key])];})];
      else node=[0,value];
      if(shared){table[index]=node;return [3,index];}return node;
    }
    var root=visit(value);return {table:table,root:root};
  }
  function expandBackupTree(tree,length){
    if(!tree||!Array.isArray(tree.table))throw Error('invalid-backup-tree');
    var visiting=new Set(),cache=new Map(),cost=new Map();
    function visit(node){
      if(!Array.isArray(node)||node.length!==2)throw Error('invalid-backup-node');
      var type=node[0],value=node[1],result,size;
      if(type===3){
        if(!Number.isSafeInteger(value)||value<0||value>=tree.table.length||visiting.has(value))throw Error('invalid-backup-reference');
        if(cache.has(value))return {value:cache.get(value),size:cost.get(value)};
        visiting.add(value);var item=visit(tree.table[value]);visiting.delete(value);
        cache.set(value,item.value);cost.set(value,item.size);return item;
      }
      if(type===0){
        if(value!==null&&typeof value!=='string'&&typeof value!=='number'&&typeof value!=='boolean')throw Error('invalid-backup-value');
        result=value;size=JSON.stringify(value).length;
      }else if(type===1||type===2){
        if(!Array.isArray(value))throw Error('invalid-backup-collection');
        result=type===1?[]:Object.create(null);size=2;
        value.forEach(function(entry,i){
          if(type===2&&(!Array.isArray(entry)||entry.length!==2||typeof entry[0]!=='string'||own(result,entry[0])))throw Error('invalid-backup-property');
          var item=visit(type===1?entry:entry[1]);
          size+=item.size+(i?1:0)+(type===2?JSON.stringify(entry[0]).length+1:0);
          if(size>length)throw Error('invalid-backup-length');
          if(type===1)result.push(item.value);else put(result,entry[0],item.value);
        });
      }else throw Error('invalid-backup-tag');
      if(size>length)throw Error('invalid-backup-length');return {value:result,size:size};
    }
    return JSON.stringify(visit(tree.root).value);
  }
  function encodeBackup(text){
    // Only a quota fallback for large journals. Historical backups are not rewritten.
    if(text.length<65536)return text;
    var layout='raw',payload=text,candidate=JSON.stringify(backupTree(JSON.parse(text)));
    if(candidate.length<payload.length){layout='json-tree';payload=candidate;}
    var packed=JSON.stringify({version:2,encoding:'vs-lz-utf16-1',layout:layout,length:text.length,
      checksum:backupChecksum(text),data:backupCompression.compressToUTF16(payload)});
    if(packed.length>=text.length||decodeBackup(packed)!==text)return text;
    return packed;
  }
  function Controller(adapter){
    this.a=adapter;this.epoch=0;this.state=null;this.owner=null;this.unsubscribe=null;
    this.flight=null;this.deferred=null;this.latest=null;this.ready=false;this.blocked=false;this.hold=null;
    var instanceKey='vsC_sync_instance_v1:'+encodeURIComponent(adapter.namespace);
    this.instance=adapter.forkInstance?null:adapter.store.getItem(instanceKey);
    if(!this.instance){
      this.instance=adapter.instanceId||String(Date.now())+'-'+Math.random().toString(36).slice(2);
      adapter.store.setItem(instanceKey,this.instance);
    }
  }
  Controller.prototype.status=function(mode,detail){this.mode=mode;this.a.status(mode,detail);};
  Controller.prototype.unready=function(){this.ready=false;if(this.a.ready)this.a.ready(false);};
  Controller.prototype.guard=function(epoch){return epoch===this.epoch&&this.owner&&this.a.owner()===this.owner;};
  /* A retained anchor can be rewritten by another tab: Web Storage has no compare-and-delete.
     Keep the exact removed bytes in this tab's journal storage before relying on that anchor.
     These copies survive reloads and are included in the device export; never overwrite one. */
  Controller.prototype.preserveReclaimedBackup=function(raw){
    var store=this.a.store,prefix=this.key+':reclaimed:',limit=store?store.length+1:0;
    if(!store||store===this.a.backupStore)return false;
    try{
      for(var i=0;i<limit;i++){
        var key=prefix+i,saved=store.getItem(key);
        if(saved===raw)return true;
        if(saved===null){store.setItem(key,raw);return store.getItem(key)===raw;}
      }
    }catch(error){}
    return false;
  };
  /* Only replace this instance's backup. Another tab can update its key between any read and
     removeItem: Web Storage has no atomic compare-and-delete. Preserve all foreign backups,
     even apparent duplicates or confirmed copies. The adapter may prune its own app cache;
     if this instance's compressed write still does not fit, fail closed. */
  Controller.prototype.writeBackup=function(next,text,backupKey){
    var store=this.a.backupStore,self=this;
    try{store.setItem(backupKey,text);return;}catch(error){}
    // Compress only this tab's own new write. Historical/unsent backups stay in place byte for byte;
    // there is no cross-tab migration or compare-and-replace of another writer's journal.
    var stored=encodeBackup(text);
    if(stored!==text){try{store.setItem(backupKey,stored);return;}catch(error){}}
    var freed=0;try{freed=self.a.reclaim?Number(self.a.reclaim())||0:0;}catch(error){freed=0;}
    if(freed){try{store.setItem(backupKey,stored);return;}catch(error){}}
    throw Error('backup-quota');
  };
  Controller.prototype.persist=function(next){
    var text=JSON.stringify(next);
    try{
      this.a.store.setItem(this.key,text);
      if(this.a.store.getItem(this.key)!==text)throw Error('journal-readback');
      if(this.a.backupStore){
        var store=this.a.backupStore,backupKey=this.key+':backup:'+this.instance;
        // A new clean tab can use its verified session journal plus the confirmed server copy.
        // Never remove or replace an existing backup through this exception. The first edit,
        // ACK, recovery snapshot or unknown metadata still requires a full durable write.
        var fields=['version','namespace','owner','revision','base','local','recovery'];
        var confirmedOnly=next.version===1&&this.guard(this.epoch)&&next.owner===this.owner&&next.namespace===this.a.namespace&&
           Number.isSafeInteger(next.revision)&&next.revision>=0&&
           Object.keys(next).length===fields.length&&Object.keys(next).every(function(k){return fields.indexOf(k)>=0;})&&
           Array.isArray(next.recovery)&&next.recovery.length===0&&equal(next.base,next.local)&&
           this.latest&&revision(this.latest)===next.revision&&equal(normalize(this.latest),next.base);
        if(!confirmedOnly||store.getItem(backupKey)!==null){
          this.writeBackup(next,text,backupKey);
          if(decodeBackup(store.getItem(backupKey))!==text)throw Error('backup-readback');
        }
      }
      this.state=next;this.blocked=false;this.hold=null;return true;
    }catch(error){this.blocked=true;this.hold='storage';this.status('storage-error');return false;}
  };
  Controller.prototype.display=function(){
    if(this.a.editing&&this.a.editing())return;
    try{this.a.setData(clone(this.state.local));this.a.render();}
    catch(error){this.blocked=true;this.hold='apply';this.status('apply-error');}
  };
  Controller.prototype.disconnect=function(){
    this.epoch++;if(this.unsubscribe)try{this.unsubscribe();}catch(error){}
    this.unsubscribe=null;this.ready=false;this.blocked=false;this.hold=null;this.doc=null;this.state=null;this.flight=null;this.deferred=null;this.latest=null;this.owner=null;
    if(this.a.ready)this.a.ready(false);
  };
  Controller.prototype.pending=function(){return this.state?diff(this.state.base,this.state.local).length:0;};
  Controller.prototype.connect=function(){
    var owner=this.a.owner();if(owner===this.owner&&this.unsubscribe&&!this.unbound)return;
    this.disconnect();if(!owner){this.status('auth-required');return;}
    this.owner=owner;this.key='vsC_sync_v1:'+encodeURIComponent(this.a.namespace+':'+owner);
    var epoch=this.epoch,self=this;
    try{
      var hydrated=this.a.hydrated?!!this.a.hydrated():true;
      var durable=(!hydrated&&this.a.resumeData)?this.a.resumeData(owner):null;
      var resumeFromDurable=!!durable;
      var startup=normalize(resumeFromDurable?durable:(hydrated?this.a.getData():{}));
      var raw=this.a.store.getItem(this.key);
      if(raw){
        var saved=JSON.parse(raw);
        if(saved.version!==1||saved.owner!==owner||saved.namespace!==this.a.namespace)throw Error('invalid-journal');
        saved.base=normalize(saved.base);saved.local=normalize(saved.local);
        if(!Number.isSafeInteger(saved.revision)||saved.revision<0)throw Error('invalid-journal-revision');
        if(!Array.isArray(saved.recovery))throw Error('invalid-recovery');
        if(resumeFromDurable&&!equal(startup,saved.local)){
          if(!saved.recovery.some(function(data){return equal(data,saved.local);}))saved.recovery.push(clone(saved.local));
          saved.local=startup;saved.resumeConflict=true;
          if(!this.persist(saved))return;
        }else if(!equal(startup,saved.local)){
          if(!saved.recovery.some(function(data){return equal(data,startup);}))saved.recovery.push(startup);
          if(saved.ack||diff(saved.base,saved.local).length)saved.resumeConflict=true;
          if(!this.persist(saved))return;
        }
        this.state=saved;if(saved.ack&&!saved.resumeConflict)this.finishAck();
        if(!this.unbound&&!this.blocked&&(!saved.resumeConflict||resumeFromDurable))this.display();
      }else if(resumeFromDurable){
        try{this.a.setData(clone(startup));this.a.render();}
        catch(error){this.blocked=true;this.hold='apply';this.status('apply-error');return;}
      }
      this.initialLocal=startup;
      this.doc=this.a.database().collection('studio').doc('data');
      if(this.a.doc)this.a.doc(this.doc);
      var unsubscribe=this.doc.onSnapshot({includeMetadataChanges:true},function(snapshot){
        if(!self.guard(epoch))return;
        var meta=snapshot.metadata||{};
        if(meta.fromCache!==false||meta.hasPendingWrites!==false){self.status('unconfirmed');return;}
        if(!snapshot.exists){self.unready();self.status('missing-remote');return;}
        try{self.receive(snapshot.data());}catch(error){self.unready();self.blocked=true;self.status('invalid-remote');}
      },function(){if(!self.guard(epoch))return;self.unready();self.status('offline');});
      if(this.guard(epoch))this.unsubscribe=unsubscribe;else unsubscribe();
    }catch(error){this.blocked=true;this.status('storage-error');}
  };
  Controller.prototype.receive=function(data){
    var rev=revision(data),remote=normalize(data),self=this;
    if(this.state&&rev<this.state.revision)return;
    this.latest=clone(data);
    if(this.state&&this.state.resumeConflict){this.blocked=true;this.status('conflict');return;}
    if(this.hold){this.deferred=clone(data);return;}
    if(this.flight||(this.state&&this.state.ack)||(this.blocked&&(this.mode==='storage-error'||this.mode==='apply-error'))||(this.a.editing&&this.a.editing())){this.deferred=clone(data);this.status('deferred');return;}
    var next;
    if(!this.state){
      var previous=normalize(this.a.getData());
      next={version:1,namespace:this.a.namespace,owner:this.owner,revision:rev,base:remote,local:remote,recovery:equal(previous,remote)?[]:[previous]};
    }else{
      if(rev===this.state.revision&&!equal(remote,this.state.base)){this.blocked=true;this.status('legacy-conflict');return;}
      var merged=apply(remote,diff(this.state.base,this.state.local));
      if(merged.conflicts.length){this.blocked=true;this.status('conflict',merged.conflicts.length);return;}
      next=Object.assign({},this.state,{revision:rev,base:remote,local:merged.value});
    }
    var changed=!this.state||!equal(this.state.local,next.local);
    if(!this.persist(next))return;
    this.ready=true;this.unbound=false;if(this.a.ready)this.a.ready(true);
    if(changed)this.display();if(this.blocked)return;
    this.status(this.pending()?'pending':(this.state.recovery.length?'recovery':'synced'));
    if(this.pending()&&!this.scheduled){this.scheduled=true;var scheduledEpoch=this.epoch;this.a.later(function(){self.scheduled=false;if(self.guard(scheduledEpoch))self.flush();});}
  };
  Controller.prototype.drain=function(){
    if(this.a.editing&&this.a.editing())return;
    if(this.state&&this.state.ack)this.finishAck();
    if(this.flight||this.blocked)return;
    if(this.deferred){var data=this.deferred;this.deferred=null;this.receive(data);}
    this.flush();
  };
  Controller.prototype.save=function(){
    if(!this.state||this.a.owner()!==this.owner){this.unbound=true;this.status('local-only');return Promise.resolve(false);}
    var next=Object.assign({},this.state,{local:normalize(this.a.getData())});
    if(!this.persist(next))return Promise.resolve(false);
    if(this.state.resumeConflict){this.blocked=true;this.status('conflict');return Promise.resolve(false);}
    this.status(this.pending()?'pending':(this.ready?'synced':'unconfirmed'));
    return this.flush();
  };
  Controller.prototype.flush=function(){
    var self=this,epoch=this.epoch;
    if(!this.guard(epoch)||!this.state||this.state.resumeConflict||!this.ready||this.blocked||this.flight)return Promise.resolve(false);
    if(this.a.editing&&this.a.editing())return Promise.resolve(false);
    if(this.a.frozen()){this.status('frozen');return Promise.resolve(false);}
    var base=clone(this.state.base),sent=clone(this.state.local),operations=diff(base,sent),baseRevision=this.state.revision;
    if(!operations.length)return Promise.resolve(true);
    var token={};this.flight=token;this.status('saving');
    var request=Promise.resolve().then(function(){return self.a.database().runTransaction(async function(transaction){
      if(!self.guard(epoch)||self.a.frozen())throw Error('session-or-freeze');
      var snapshot=await transaction.get(self.doc);
      if(!self.guard(epoch)||self.a.frozen())throw Error('session-or-freeze');
      if(!snapshot.exists)throw Error('missing-remote');
      var raw=snapshot.data(),rev=revision(raw),remote=normalize(raw);
      if(rev<baseRevision||(rev===baseRevision&&!equal(remote,base)))throw Error('legacy-conflict');
      var merged=apply(remote,operations);
      if(merged.conflicts.length)throw Error('write-conflict');
      if(equal(remote,merged.value))return {value:remote,revision:rev};
      if(rev===Number.MAX_SAFE_INTEGER)throw Error('revision-exhausted');
      transaction.set(self.doc,{...raw,...merged.value,_vsSyncRevision:rev+1,updatedAt:self.a.timestamp()});
      return {value:merged.value,revision:rev+1};
    });});
    return request.then(function(committed){
      if(!self.guard(epoch)||self.flight!==token)return false;
      var next=Object.assign({},self.state,{ack:{sent:sent,value:committed.value,revision:committed.revision}});
      if(!self.persist(next)){self.flight=null;return false;}
      self.status('deferred');self.finishAck();self.drain();return true;
    },function(error){
      if(!self.guard(epoch)||self.flight!==token)return false;
      self.flight=null;self.status(error.message==='write-conflict'||error.message==='legacy-conflict'?'conflict':'write-error');
      if(self.deferred){var deferred=self.deferred;self.deferred=null;self.receive(deferred);}
      return false;
    });
  };
  Controller.prototype.finishAck=function(){
    if(!this.state||this.state.resumeConflict||!this.state.ack||(this.a.editing&&this.a.editing()))return false;
    var ack=this.state.ack,rebased=apply(ack.value,diff(ack.sent,this.state.local));
    if(rebased.conflicts.length){this.flight=null;this.blocked=true;this.status('conflict',rebased.conflicts.length);return false;}
    var next=Object.assign({},this.state,{base:ack.value,local:rebased.value,revision:ack.revision});delete next.ack;
    if(!this.persist(next)){this.flight=null;return false;}
    this.flight=null;this.display();
    if(!this.blocked)this.status(this.pending()?'pending':(this.state.recovery.length?'recovery':'synced'));
    return true;
  };
  Controller.prototype.retry=function(){
    if(!this.a.owner()){this.status('auth-required');return Promise.resolve(false);}
    if(this.a.owner()!==this.owner||!this.unsubscribe)this.connect();
    if(this.hold==='storage'&&this.state){
      if(!this.persist(Object.assign({},this.state,{local:normalize(this.a.getData())})))return Promise.resolve(false);
    }
    if(this.hold==='apply'&&this.state){this.hold=null;this.blocked=false;this.display();}
    if(!this.doc||this.hold)return Promise.resolve(false);
    var self=this,epoch=this.epoch;
    return this.doc.get({source:'server'}).then(function(snapshot){
      if(!self.guard(epoch))return false;
      if(!snapshot.exists){self.unready();self.status('missing-remote');return false;}
      self.receive(snapshot.data());self.drain();return self.flush();
    }).catch(function(){if(self.guard(epoch)){self.unready();self.status('offline');}return false;});
  };
  Controller.prototype.useServer=function(){
    if(!this.latest||!this.guard(this.epoch)||(this.flight&&!this.state.ack)||(this.a.editing&&this.a.editing()))return false;
    var remote=normalize(this.latest),recovery=this.state?(this.state.recovery||[]).filter(function(data){return !equal(data,remote);}):[];
    /* The selected server data is stored in both base and local. Retain each different local variant
       once, without a third full-size copy of that same confirmed server data. */
    if(this.state&&!equal(this.state.local,remote)&&!recovery.some(function(data){return equal(data,this.state.local);},this))recovery.push(clone(this.state.local));
    var next={version:1,namespace:this.a.namespace,owner:this.owner,revision:revision(this.latest),base:remote,local:remote,recovery:recovery};
    if(!this.persist(next))return false;
    this.flight=null;this.deferred=null;this.ready=true;this.display();
    if(this.blocked)return false;
    this.status('recovery');return true;
  };
  Controller.prototype.exportData=function(){
    var result={version:1,current:this.state,backups:[],reclaimedBackups:[]},store=this.a.backupStore;
    if(store&&this.key)for(var i=0;i<store.length;i++){
      var key=store.key(i);if(key&&key.indexOf(this.key+':backup:')===0){
        try{result.backups.push(JSON.parse(decodeBackup(store.getItem(key))));}catch(error){result.backups.push({unreadable:true});}
      }
    }
    store=this.a.store;
    if(store&&this.key)for(var j=0;j<store.length;j++){
      var savedKey=store.key(j);if(savedKey&&savedKey.indexOf(this.key+':reclaimed:')===0){
        try{result.reclaimedBackups.push(JSON.parse(decodeBackup(store.getItem(savedKey))));}catch(error){result.reclaimedBackups.push({unreadable:true});}
      }
    }
    return clone(result);
  };
  return {normalize:normalize,retainLocal:retainLocal,equal:equal,diff:diff,apply:apply,Controller:Controller,create:function(adapter){return new Controller(adapter);}};
});
