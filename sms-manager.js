(function (root) {
  'use strict';
  // Owned standalone surface. Host supplies VCFTransport, _vsSync and canonical records.
  // Drafts live only in this page; pairing secrets live only in the password input.
  var modal, content, notice, previousFocus, previousOverflow, owner;
  var overview = null, drafts = new Map(), settingsDraft = null, relayDraft = null;
  var callSettingsDraft = null, callDrafts = new Map(), callReadback = null;
  var busy = false, generation = 0, feedback = '', feedbackKind = 'status';
  var readbackRevision = null;
  var boundSync, boundEpoch;
  var defaults = {enabled:false, mondayTime:'10:00', tuesdayTime:'14:00',
    mondayText:'{name}님, 이번 주 가능한 레슨 날짜와 시간을 알려 주세요.',
    tuesdayText:'{name}님, 이번 주 레슨 일정 확인 부탁드립니다. 편하실 때 답장 주세요.'};

  function sync() { return typeof _vsSync !== 'undefined' ? _vsSync : root._vsSync; }
  function ensureOwner() {
    var s = sync(), currentOwner = s && s.owner, epoch = s && s.epoch;
    if (owner === currentOwner && boundSync === s && boundEpoch === epoch) return true;
    owner = currentOwner; boundSync = s; boundEpoch = epoch; generation++;
    overview = null; drafts.clear(); settingsDraft = null; relayDraft = null; readbackRevision = null;
    callSettingsDraft = null; callDrafts.clear(); callReadback = null;
    feedback = ''; feedbackKind = 'status';
    if (modal) {
      // Wipe the actual input before detaching it: retained copy handlers must not retain the key.
      modal.querySelectorAll('input,textarea,select').forEach(function (el) { el.value = ''; el.checked = false; });
      var secret = modal.querySelector('[data-secret]'); if (secret) secret.replaceChildren();
      setBusy(false); renderModal();
      say(owner ? '관리자가 변경되었습니다. 새로고침으로 현재 자료를 확인해 주세요.' : '관리자 로그인 상태를 확인해 주세요.', 'error');
    }
    return false;
  }
  function requireOwner(wave) {
    if (!ensureOwner() || !owner || (wave !== undefined && wave !== generation)) throw fault('sync');
  }
  function records() {
    var s = sync();
    return s && s.state && s.state.base && Array.isArray(s.state.base.students) ? s.state.base.students : [];
  }
  function id(value) { return value == null ? '' : String(value); }
  function phone(value) {
    if (typeof value !== 'string' || value.length > 40 || !/^[+\d\s().-]+$/.test(value)) return '';
    var n = value.replace(/[\s().-]/g, '');
    if (n.slice(0,3) === '+82') n = '0' + n.slice(3).replace(/^0/, '');
    else if (n.slice(0,4) === '0082') n = '0' + n.slice(4).replace(/^0/, '');
    return /^0\d{8,10}$/.test(n) ? n : '';
  }
  function matches(number) {
    var n = phone(number);
    return n ? records().filter(function (s) { return phone(s.ph || s.phone) === n; }) : [];
  }
  function contactMatch(number) {
      const controller = sync(), state = controller && controller.state && controller.state.base, phoneNumber = phone(number);
      if (!state || !Array.isArray(state.students) || !phoneNumber) return {name:'',studentId:null,matchStatus:'unknown'};
      const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
      const callPhone = row => object(row) ? phone(row.ph || row.phone || '') : '';
    const contacts = [['student', state.students], ['consult', state.consults || []], ['inquiry', state.inquiries || []]]
      .flatMap(([kind, rows]) => rows.filter(row => callPhone(row) === phoneNumber).map(row => ({ kind, row })));
    if (!contacts.length) return { name: '', studentId: null, matchStatus: 'unknown' };
    const people = new Set();
    const consults = state.consults || [], inquiries = state.inquiries || [];
    const declared = value => value !== undefined && value !== null && value !== '';
    const unique = (rows, key, value) => {
      if (typeof value !== 'string' || !value) return null;
      const found = rows.filter(row => object(row) && row[key] === value);
      return found.length === 1 ? found[0] : null;
    };
    function inquiryStudent(row) {
      const ids = [row.convertedStudentId, row.studentId].filter(declared);
      if (!ids.length) return { student: null };
      if (ids.some(value => typeof value !== 'string') || new Set(ids).size !== 1) return null;
      const student = unique(state.students, 'id', ids[0]);
      return student && callPhone(student) === phoneNumber ? { student } : null;
    }
    function consultPerson(row) {
      if (unique(consults, 'id', row.id) !== row) return null;
      const students = state.students.filter(s => s.consultData?.id === row.id);
      if (students.length > 1 || students.length === 1 && callPhone(students[0]) !== phoneNumber) return null;
      let student = students[0] || null;
      const referring = inquiries.filter(q => object(q) && q.consultId === row.id);
      if (declared(row._inquiryId) || referring.length) {
        const inquiry = unique(inquiries, 'id', row._inquiryId);
        if (!inquiry || referring.length !== 1 || referring[0] !== inquiry || inquiry.consultId !== row.id ||
          consults.filter(c => object(c) && c._inquiryId === inquiry.id).length !== 1) return null;
        const direct = inquiryStudent(inquiry);
        if (!direct || student && direct.student && student.id !== direct.student.id) return null;
        student ||= direct.student;
      }
      return { key: student ? 'student:' + student.id : row, student };
    }
    let invalidLink = false;
    for (const { kind, row } of contacts) {
      if (kind === 'student') { people.add('student:' + row.id); continue; }
      let person;
      if (kind === 'consult') person = consultPerson(row);
      else if (unique(inquiries, 'id', row.id) === row) {
        const direct = inquiryStudent(row), referring = consults.filter(c => object(c) && c._inquiryId === row.id);
        if (declared(row.consultId) || referring.length) {
          const consult = unique(consults, 'id', row.consultId);
          if (consult && referring.length === 1 && referring[0] === consult && consult._inquiryId === row.id) person = consultPerson(consult);
          if (!direct || person?.student && direct.student && person.student.id !== direct.student.id) person = null;
        } else if (direct) person = { key: direct.student ? 'student:' + direct.student.id : row };
      }
      if (!person) invalidLink = true;
      else people.add(person.key);
    }
    // Only explicit IDs unify records. Same phone/name is never person-link evidence.
    if (invalidLink || people.size > 1) return { name: '', studentId: null, matchStatus: 'ambiguous' };
    const person = [...people][0], student = typeof person === 'string' && state.students.find(s => 'student:' + s.id === person);
    if (student) return { name: typeof student.name === 'string' ? student.name : '', studentId: student.id, matchStatus: 'matched' };
    const { kind } = contacts[0], row = object(person) ? person : contacts[0].row;
    return { name: typeof row.name === 'string' ? row.name : '', studentId: kind === 'student' ? row.id : null,
      matchStatus: kind === 'student' ? 'matched' : 'known-contact' };
  }
  function ready(revision) {
    var s = sync();
    return !!(s && s.ready === true && s.confirmed === true && !s.blocked && !s.hold && !s.flight &&
      !s.connectionError && typeof s.pending === 'function' && s.pending() === 0 && s.state &&
      Number.isSafeInteger(s.state.revision) && (revision == null || s.state.revision === revision));
  }
  function hostEditing() {
    var active = document.activeElement;
    return !!document.querySelector('.ov.open') || !!(active && (!modal || !modal.contains(active)) &&
      active.matches && active.matches('input,textarea,select,[contenteditable="true"]'));
  }
  function focusForSync() {
    // The host's _vsEditing contract remains intact. Only release our own input focus.
    if (modal && document.activeElement && modal.contains(document.activeElement)) modal.focus();
  }
  function fault(code, status) { return Object.assign(new Error(code), {code:code, status:status}); }
  function errorText(error) {
    if (error && error.code === 'schedule-unknown-occupancy') return '기존 일정의 날짜나 시간을 확인할 수 없습니다. 해당 일정을 먼저 확인해 주세요. 입력과 선택은 유지됩니다.';
    if (error && error.status === 409 && error.code === 'sms-schedule-conflict') {
      var c = error.conflict;
      return c ? c.date + ' ' + c.time + ' · ' + c.names.join(', ') + '의 일정이 겹칩니다. 날짜나 시간을 바꿔 주세요. 입력과 선택은 유지됩니다.'
        : '선택한 시간에 다른 학생의 일정이 있습니다. 날짜나 시간을 확인해 주세요. 입력과 선택은 유지됩니다.';
    }
    if (error && error.status === 409) return '자료가 변경되었거나 일정이 충돌했습니다. 입력과 선택은 유지됩니다. 새로고침 후 확인해 주세요.';
    if (error && (error.status === 401 || error.status === 403 || error.kind === 'auth')) return '관리자 로그인 상태를 확인해 주세요. 입력과 선택은 유지됩니다.';
    var codes = {
      'sync':'학생 정보를 확인해야 합니다. 다른 편집을 마친 뒤 새로고침해 주세요.',
      'host-edit':'다른 편집 화면을 먼저 저장하거나 닫아 주세요. 문자 입력과 선택은 유지됩니다.',
      'unique':'전화번호가 등록된 학생 한 명과 일치해야 합니다. 중복 번호를 확인하고 변동 레슨 학생을 선택해 주세요.',
      'selection':'등록할 문자를 선택하고 학생·날짜·시간을 확인해 주세요.',
      'date':'실제 미래 날짜와 시간을 입력해 주세요. 기준 시간대는 한국(Asia/Seoul)입니다.',
      'relay':'표시된 휴대폰 연결 주소를 사용해 주세요.',
      'settings':'요일별 시간과 문구를 확인해 주세요. 문구에는 {name}만 사용할 수 있습니다.',
      'call-name':'문의자 이름을 직접 입력해 주세요. 통화 번호로 이름을 추측하지 않습니다.',
      'call-known':'이미 등록된 연락처입니다. 기존 학생·상담·문의 정보를 확인해 주세요.',
      'options':'날짜와 가능한 시작·종료 시간을 확인해 주세요.',
      'readback':'등록 결과를 아직 확인하지 못했습니다. 새로고침 후 결과를 확인해 주세요. 입력과 선택은 유지됩니다.',
      'stale':'현재 자료에서 해당 항목을 확인할 수 없습니다. 입력과 선택은 유지됩니다.',
      'transport':'문자 연결 모듈을 사용할 수 없습니다. 페이지 연결 상태를 확인해 주세요.'
    };
    return codes[error && error.code] || '서버 결과를 확인하지 못했습니다. 처리 여부가 불확실하므로 새로고침으로 확인해 주세요. 입력과 선택은 유지됩니다.';
  }
  function say(text, kind) {
    feedback = text; feedbackKind = kind || 'status';
    if (notice) { notice.textContent = text; notice.setAttribute('role', feedbackKind === 'error' ? 'alert' : 'status'); }
  }
  async function api(path, body) {
    requireOwner();
    if (!root.VCFTransport || typeof root.VCFTransport.api !== 'function') throw fault('transport');
    var wave = generation;
    var result = await root.VCFTransport.api('/api/sms/' + path,
      body === undefined ? {allow:true} : {method:'POST', body:body, allow:true});
    requireOwner(wave);
    if (result instanceof Error) throw result;
    if (!result || !result.response || !result.response.ok || !result.data || result.data.ok !== true) {
      var status = result && result.response && result.response.status;
      var code = result && result.data && result.data.error;
      var error = fault(['sms-schedule-conflict','schedule-unknown-occupancy'].includes(code) ? code : 'response', status);
      var c = result && result.data && result.data.conflict;
      // Keep only the agreed, bounded conflict receipt. Never propagate raw server text/HTML.
      if (status === 409 && error.code === 'sms-schedule-conflict' && c && validDate(c.date) && validTime(c.time) &&
        Array.isArray(c.names) && c.names.length > 0 && c.names.length <= 10 && c.names.every(function (name) {
          return typeof name === 'string' && name.trim() && name.length <= 120 && !/[\u0000-\u001f]/.test(name);
        })) error.conflict = {date:c.date, time:c.time, names:c.names.slice()};
      throw error;
    }
    return result.data;
  }
  async function fresh() {
    var wave = generation;
    var data = await api('overview');
    requireOwner(wave);
    if (!Number.isSafeInteger(data.revision) || data.revision < 0 || !data.device || !data.settings ||
      !['messages','unassigned','outbox','aliasChanges','calls'].every(function (key) { return Array.isArray(data[key]); }) ||
      !data.callSettings || typeof data.callSettings.enabled !== 'boolean' || typeof data.callSettings.includeUnknown !== 'boolean' ||
      !data.calls.every(function (c) { return c && typeof c.id === 'string' && phone(c.phone) === c.phone &&
        Number.isSafeInteger(c.receivedAt) && c.receivedAt > 0 && typeof c.name === 'string' &&
        ['matched','known-contact','ambiguous','unknown'].includes(c.matchStatus) && ['pending','acknowledged'].includes(c.status); })) throw fault('response');
    overview = data;
    if (!settingsDraft) settingsDraft = Object.assign({}, defaults, data.settings);
    if (relayDraft === null) relayDraft = data.device.relayOrigin || '';
    if (!callSettingsDraft) callSettingsDraft = Object.assign({}, data.callSettings);
    data.calls.slice(0,200).forEach(function (c) {
      if (!callDrafts.has(id(c.id))) callDrafts.set(id(c.id), {name:'', memo:''});
    });
    data.messages.forEach(function (m) {
      if (m.status === 'scheduled') {
        var confirmed = validConfirmation(m.confirmation) ? m.confirmation : null;
        // A submitted adjustment is authoritative only in the server's confirmation receipt.
        // Without a receipt, leave registered fields blank rather than replay the old SMS proposal.
        drafts.set(id(m.id), {checked:false, studentId:confirmed ? id(confirmed.studentId) : '',
          date:confirmed ? confirmed.date : '', time:confirmed ? confirmed.time : ''});
        return;
      }
      if (drafts.has(id(m.id))) return;
      var found = matches(m.phone), proposal = m.proposal || {};
      drafts.set(id(m.id), {checked:false, studentId:found.length === 1 ? id(found[0].id) : '',
        date:validDate(proposal.date) ? proposal.date : '', time:validTime(proposal.time) ? proposal.time : '', startTime:'', endTime:'', options:null});
    });
    return data;
  }
  async function authoritative() {
    if (hostEditing()) throw fault('host-edit');
    if (!ready()) throw fault('sync');
    var data = await fresh();
    if (hostEditing()) throw fault('host-edit');
    if (!ready(data.revision)) throw fault('sync');
    return data;
  }
  function validTime(value) { return typeof value === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(value); }
  function validDate(value) {
    if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
    var date = new Date(value + 'T00:00:00Z');
    return Number.isFinite(date.getTime()) && date.toISOString().slice(0,10) === value;
  }
  function validConfirmation(value) {
    return !!(value && id(value.studentId) && validDate(value.date) && validTime(value.time));
  }
  function validateEntry(m, d) {
    var found = matches(m.phone), s = found[0];
    if (found.length !== 1 || id(s.id) !== d.studentId || s.status !== '수강중' || s.schedType !== 'flex' ||
      id(m.studentId) !== d.studentId || !['matched','unique'].includes(m.matchStatus)) throw fault('unique');
    if (!validDate(d.date) || !validTime(d.time) || new Date(d.date + 'T' + d.time + ':00+09:00').getTime() <= Date.now()) throw fault('date');
    if (m.status === 'scheduled' || m.status === 'dismissed') throw fault('stale');
    return {messageId:m.id, studentId:s.id, date:d.date, time:d.time};
  }
  function node(tag, className, text) {
    var el = document.createElement(tag);
    if (className) el.className = className;
    if (text !== undefined) el.textContent = String(text == null ? '' : text);
    return el;
  }
  function button(text, action, disabled, key) {
    var el = node('button', 'vs-sms-button', text); el.type = 'button'; el.disabled = busy || !!disabled;
    if (busy) el.dataset.wasDisabled = String(!!disabled);
    if (key) el.dataset.action = key;
    var wave = generation;
    el.addEventListener('click', function () {
      var sameOwner = ensureOwner(), shellAction = key === 'refresh' || key === 'close';
      if ((sameOwner && wave === generation || shellAction) && !el.disabled) { el.focus(); action(); }
    });
    return el;
  }
  function field(label, input) {
    var wrap = node('label', 'vs-sms-field'); wrap.appendChild(node('span', '', label)); wrap.appendChild(input); return wrap;
  }
  function input(type, value, change, key) {
    var el = node('input'); el.type = type; el.value = value || ''; el.disabled = busy;
    if (busy) el.dataset.wasDisabled = 'false';
    if (key) el.dataset.field = key;
    var wave = generation;
    el.addEventListener('input', function () { if (ensureOwner() && wave === generation) change(el.value); }); return el;
  }
  function invalidateOptions(draft, card) {
    var hadOffer = !!draft.options, list = card && card.querySelector('[data-schedule-options]');
    draft.options = null;
    if (list) {
      list.querySelectorAll('button').forEach(function (el) { el.disabled = true; el.dataset.wasDisabled = 'true'; });
      list.remove();
    }
    if (hadOffer || list) say('입력한 날짜·시간·학생이 변경되었습니다. 시간 후보를 다시 확인해 주세요.');
  }
  function section(title) {
    var el = node('section', 'vs-sms-section'); el.appendChild(node('h3', '', title)); content.appendChild(el); return el;
  }
  function setBusy(value, allowClose) {
    busy = value;
    if (modal) {
      modal.setAttribute('aria-busy', String(value));
      modal.querySelectorAll('button,input,textarea,select').forEach(function (el) {
        if (value) { el.dataset.wasDisabled = String(el.disabled); el.disabled = !(allowClose && el.dataset.action === 'close'); }
        else if ('wasDisabled' in el.dataset) { el.disabled = el.dataset.wasDisabled === 'true'; delete el.dataset.wasDisabled; }
      });
    }
  }
  async function action(task, success, allowOwnerChange, allowClose) {
    if (!ensureOwner() && !allowOwnerChange) return;
    if (busy) return;
    var wave = generation;
    setBusy(true, allowClose); say('서버에서 확인 중입니다…');
    try {
      requireOwner(wave); await task(); requireOwner(wave);
      if (wave === generation && success) say(success);
    } catch (error) {
      ensureOwner();
      if (wave === generation) say(errorText(error), 'error');
    } finally { if (wave === generation) { setBusy(false); renderModal(); } }
  }
  async function readback(revision) {
    requireOwner(); var wave = generation;
    readbackRevision = revision;
    var s = sync();
    if (!Number.isSafeInteger(revision) || !s || typeof s.retry !== 'function') throw fault('readback');
    if (hostEditing()) throw fault('readback');
    focusForSync();
    // VSSync may durably advance its journal while display() is deferred by a new edit.
    // Keep its existing display requirement set so a later explicit retry can apply that value.
    s.displayRequired = true;
    await s.retry();
    requireOwner(wave);
    // retry may return false or defer while another host form is editing; never equate ACK with display.
    if (hostEditing() || s !== sync() || !ready() || s.state.revision < revision || !displayReady(s)) {
      s.displayRequired = true; throw fault('readback');
    }
    if (callReadback) {
      var inquiries = s.state.base && s.state.base.inquiries;
      var rows = Array.isArray(inquiries) ? inquiries.filter(function (q) { return id(q.id) === callReadback.inquiryId; }) : [];
      if (rows.length !== 1 || rows[0].name !== callReadback.name || phone(rows[0].phone) !== callReadback.phone || rows[0].memo !== callReadback.memo) {
        s.displayRequired = true; throw fault('readback');
      }
      callReadback = null;
    }
    readbackRevision = null;
    if (typeof renderSidebarToday === 'function') renderSidebarToday();
    if (typeof render === 'function') render();
  }
  function displayReady(s) {
    var runtime = root.VSSync;
    try {
      return !!(runtime && s.a && typeof s.a.getData === 'function' && s.state.local && s.viewBase &&
        !s.displayRequired && !s.deferred && !s.state.ack && !(s.a.editing && s.a.editing()) &&
        // display() records the applied adapter value, including retained device-local media.
        runtime.equal(runtime.normalize(s.a.getData()), s.viewBase));
    } catch (error) { return false; }
  }
  function refresh() {
    return action(async function () {
      if (readbackRevision !== null) await readback(readbackRevision);
      else if (!hostEditing() && ready() && sync() && typeof sync().retry === 'function') {
        focusForSync();
        await sync().retry();
      }
      await fresh();
    }, '최신 문자 상태를 확인했습니다. 입력 초안은 유지됩니다.', true);
  }
  function confirmBatch() {
    return action(async function () {
      if (readbackRevision !== null) throw fault('readback');
      var data = await authoritative(), entries = [];
      drafts.forEach(function (d, key) {
        if (!d.checked) return;
        var m = data.messages.find(function (row) { return id(row.id) === key; });
        if (!m) throw fault('stale');
        entries.push(validateEntry(m, d));
      });
      if (!entries.length) throw fault('selection');
      if (!root.confirm('선택한 일정 ' + entries.length + '건을 등록할까요?')) { say('등록을 취소했습니다. 입력과 선택은 유지됩니다.'); return; }
      if (hostEditing()) throw fault('host-edit');
      if (!ready(data.revision)) throw fault('sync');
      var result = await api('confirm', {baseRevision:data.revision, entries:entries});
      await readback(result.revision);
      entries.forEach(function (e) { drafts.get(id(e.messageId)).checked = false; });
      await fresh(); say('일정 ' + entries.length + '건이 등록되었습니다.');
    });
  }
  function approveAlias(aliasId) {
    return action(async function () {
      if (readbackRevision !== null) throw fault('readback');
      var data = await authoritative();
      var alias = data.aliasChanges.find(function (a) { return id(a.id) === id(aliasId); });
      if (!alias) throw fault('stale');
      var student = records().find(function (s) { return id(s.id) === id(alias.studentId); });
      var found = student && matches(student.ph || student.phone);
      if (!student || found.length !== 1 || id(found[0].id) !== id(student.id) || alias.newName !== String(student.name || '').trim()) throw fault('unique');
      if (!root.confirm('상담·문의 이름을 “' + alias.oldName + '”에서 등록된 학생 이름 “' + student.name + '”으로 변경할까요?')) { say('이름 변경을 취소했습니다.'); return; }
      if (hostEditing()) throw fault('host-edit');
      if (!ready(data.revision)) throw fault('sync');
      var result = await api('alias', {aliasId:alias.id});
      await readback(result.revision); await fresh(); say('이름이 변경되었습니다.');
    });
  }
  function saveSettings() {
    return action(async function () {
      var next = Object.assign({}, settingsDraft);
      if (!validTime(next.mondayTime) || !validTime(next.tuesdayTime) ||
        !['mondayText','tuesdayText'].every(function (key) {
          return typeof next[key] === 'string' && next[key].trim() && next[key].length <= 3500 && !/[{}]/.test(next[key].replace(/\{name\}/g, ''));
        })) throw fault('settings');
      if (next.enabled && !overview.device.paired) throw fault('sync');
      if (next.enabled && !root.confirm('월요일 일정 요청과 화요일 미응답 안내를 활성화할까요? 설정한 한국 시간에 휴대폰에서 전송합니다.')) { say('활성화를 취소했습니다. 설정 초안은 유지됩니다.'); return; }
      await api('settings', next); await fresh();
      settingsDraft = Object.assign({}, defaults, overview.settings);
      say('문자 설정이 저장되었습니다.');
    });
  }
  function saveCallSettings() {
    return action(async function () {
      var next = Object.assign({}, callSettingsDraft);
      if (next.enabled && !overview.device.paired) throw fault('sync');
      if (next.enabled && !root.confirm('수신 통화의 번호와 시각을 관리자 수신함에 기록할까요? 휴대폰에서 발신자 표시 앱을 직접 선택해야 합니다.' +
        (next.includeUnknown ? ' 미등록 번호도 기록합니다.' : ' 등록된 연락처만 기록합니다.'))) {
        say('통화 수집 활성화를 취소했습니다. 설정 초안은 유지됩니다.'); return;
      }
      await api('call-settings', next); await fresh(); callSettingsDraft = Object.assign({}, overview.callSettings);
      say('통화 수집 설정이 저장되었습니다.');
    });
  }
  function registerCall(callId) {
    return action(async function () {
      if (readbackRevision !== null) throw fault('readback');
      var data = await authoritative(), c = data.calls.find(function (row) { return id(row.id) === id(callId); }), d = callDrafts.get(id(callId));
      if (!c || !d) throw fault('stale');
      if (c.matchStatus !== 'unknown' || contactMatch(c.phone).matchStatus !== 'unknown') throw fault('call-known');
      if (typeof d.name !== 'string' || !d.name.trim() || d.name.length > 80 || typeof d.memo !== 'string' || d.memo.length > 500 ||
        /[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(d.name + d.memo)) throw fault('call-name');
      if (!root.confirm('“' + d.name.trim() + '”을 ' + c.phone + ' 번호의 새 문의자로 등록할까요? 방문 일정은 별도로 지정합니다.')) {
        say('문의 등록을 취소했습니다. 입력은 유지됩니다.'); return;
      }
      if (hostEditing()) throw fault('host-edit');
      if (!ready(data.revision)) throw fault('sync');
      var submitted = {callId:c.id, baseRevision:data.revision, name:d.name, memo:d.memo};
      var result = await api('call-inquiry', submitted);
      callReadback = {callId:id(c.id), inquiryId:id(result.inquiryId), name:submitted.name.trim(), phone:c.phone, memo:submitted.memo.trim()};
      await readback(result.revision); await fresh(); say('문의자 등록 결과를 확인했습니다.');
    });
  }
  function scheduleOptions(messageId) {
    return action(async function () {
      if (readbackRevision !== null) throw fault('readback');
      var data = await authoritative(), m = data.messages.find(function (row) { return id(row.id) === id(messageId); }), d = drafts.get(id(messageId));
      if (!m || !d || m.status !== 'pending') throw fault('stale');
      var found = matches(m.phone);
      if (found.length !== 1 || id(found[0].id) !== d.studentId || id(m.studentId) !== d.studentId ||
        found[0].status !== '수강중' || found[0].schedType !== 'flex' || !['matched','unique'].includes(m.matchStatus)) throw fault('unique');
      if (!validDate(d.date) || !validTime(d.startTime) || !validTime(d.endTime) || d.startTime >= d.endTime ||
        d.time && !validTime(d.time)) throw fault('options');
      var startMinute = Number(d.startTime.slice(0,2)) * 60 + Number(d.startTime.slice(3));
      var endMinute = Number(d.endTime.slice(0,2)) * 60 + Number(d.endTime.slice(3));
      if (endMinute - startMinute < 60) throw fault('options');
      var signature = JSON.stringify([d.studentId, d.date, d.startTime, d.endTime, d.time]);
      var result = await api('options', {baseRevision:data.revision, messageId:m.id, studentId:d.studentId,
        date:d.date, startTime:d.startTime, endTime:d.endTime, ...(d.time ? {preferredTime:d.time} : {})});
      if (signature !== JSON.stringify([d.studentId, d.date, d.startTime, d.endTime, d.time])) throw fault('stale');
      if (result.revision !== data.revision || id(result.messageId) !== id(m.id) || !ready(result.revision) ||
        !Array.isArray(result.options) || result.options.length > 6 || !Array.isArray(result.warnings) ||
        !result.warnings.every(function (warning) { return typeof warning === 'string' && warning.length <= 500; }) ||
        !result.options.every(function (option) { return option && option.date === d.date && validTime(option.time) &&
          typeof option.reason === 'string' && option.reason.length <= 500; })) throw fault('response');
      d.options = {revision:result.revision, signature:signature, rows:result.options, warnings:result.warnings};
      say(result.options.length ? '가능한 시간 후보를 확인했습니다. 원하는 후보를 선택한 뒤 일정을 확정하세요.' : '가능한 시간 후보가 없습니다. 안내를 확인하고 날짜·시간 범위를 조정해 주세요.');
    });
  }
  function validRelay(value) {
    try {
      var url = new URL(value), local = root.location && /^(localhost|127\.0\.0\.1|\[::1\])$/.test(root.location.hostname);
      return !url.username && !url.password && !url.search && !url.hash && url.pathname === '/' &&
        (url.protocol === 'https:' || (local && url.protocol === 'http:' && /^(localhost|127\.0\.0\.1|\[::1\])$/.test(url.hostname))) ? url.origin : '';
    } catch (error) { return ''; }
  }
  function pair() {
    return action(async function () {
      var wave = generation, pairModal = modal;
      var copiedText = '연결 키를 이 기기의 클립보드에 복사했습니다. 휴대폰 앱에 붙여 넣으세요.';
      var fallbackText = '연결 키는 만들었지만 자동 복사하지 못했습니다. 연결 키 복사 버튼을 누르거나 키 입력란에서 직접 선택해 복사해 주세요.';
      function requireKey(password) {
        requireOwner(wave);
        if (modal !== pairModal || !pairModal.contains(password) || !password.value) throw fault('stale');
      }
      async function copyText(password) {
        requireKey(password);
        await root.navigator.clipboard.writeText(password.value);
        requireKey(password);
      }
      var origin = validRelay(relayDraft);
      if (!origin || origin !== validRelay(overview.device.relayOrigin)) throw fault('relay');
      if (!root.confirm('새 휴대폰 연결 키를 만들까요? 이전 키는 사용할 수 없게 됩니다. 새 키는 한 번만 표시됩니다.')) { say('연결을 취소했습니다.'); return; }
      var pendingKey = api('pair', {relayOrigin:origin}).then(function (data) {
        requireOwner(wave);
        if (modal !== pairModal) throw fault('stale');
        if (typeof data.token !== 'string' || !data.token || validRelay(data.relayOrigin) !== origin) throw fault('response');
        // No persistence, console output, model property or token-valued attribute.
        var secret = modal.querySelector('[data-secret]');
        secret.querySelectorAll('[data-field="token"]').forEach(function (el) { el.value = ''; });
        secret.replaceChildren();
        secret.appendChild(node('p', '', '연결 키는 한 번만 표시됩니다. 휴대폰 앱에 붙여 넣으세요. 화면 캡처·공유를 하지 마세요.'));
        var password = input('password', data.token, function () {}, 'token'); password.readOnly = true;
        password.autocomplete = 'new-password'; password.spellcheck = false;
        secret.appendChild(field('휴대폰 연결 키', password));
        secret.appendChild(button('연결 키 복사', async function () {
          try { await copyText(password); say(copiedText); }
          catch (error) {
            try { requireKey(password); say('연결 키를 복사하지 못했습니다. 키 입력란에서 직접 선택해 복사해 주세요.', 'error'); }
            catch (stale) { /* Owner/close isolation already wiped the key; keep its notice. */ }
          }
        }, false, 'copy-token'));
        secret.appendChild(button('연결 키 닫기', function () { password.value = ''; secret.replaceChildren(); }, false));
        return password;
      });
      var clipboard = root.navigator && root.navigator.clipboard, copyResult;
      if (clipboard && typeof clipboard.write === 'function' && typeof root.ClipboardItem === 'function' && typeof root.Blob === 'function') {
        // action() invokes this callback synchronously. Reserve the write in the generation
        // gesture, then supply text only after the API and owner/modal guards succeed.
        var text = pendingKey.then(function (password) {
          requireKey(password); return new root.Blob([password.value], {type:'text/plain'});
        });
        text.catch(function () {}); // Constructor failure must not leave an unhandled rejection.
        var item;
        try { item = new root.ClipboardItem({'text/plain':text}); }
        catch (error) { /* Older implementations can still support writeText below. */ }
        if (item) {
          try { copyResult = Promise.resolve(clipboard.write([item])).then(function () { return true; }, function () { return false; }); }
          catch (error) { copyResult = Promise.resolve(false); }
        }
      }
      var password = await pendingKey;
      requireKey(password);
      if (!copyResult) copyResult = copyText(password).then(function () { return true; }, function () { return false; });
      var copied = await copyResult;
      requireKey(password);
      var message = copied ? copiedText : fallbackText, kind = copied ? 'status' : 'error';
      say(message, kind);
      try {
        await fresh(); requireKey(password);
        settingsDraft.enabled = false; callSettingsDraft = Object.assign({}, overview.callSettings);
      } catch (error) {
        requireKey(password);
        say(message + ' 연결 상태를 확인하지 못했습니다. 새로고침으로 확인해 주세요.', 'error'); return;
      }
      say(message, kind);
    }, undefined, false, true);
  }
  function displayAt(value) {
    if (!value) return '기록 없음';
    var date = new Date(typeof value === 'string' && /^\d+$/.test(value) ? Number(value) : value);
    return Number.isFinite(date.getTime()) ? new Intl.DateTimeFormat('ko-KR', {timeZone:'Asia/Seoul',
      year:'numeric', month:'2-digit', day:'2-digit', hour:'2-digit', minute:'2-digit', hourCycle:'h23'}).format(date) + ' (한국 시간)' : '시간 확인 필요';
  }
  function renderModal() {
    if (!content) return;
    content.replaceChildren();
    if (!overview) { content.appendChild(node('p', '', '관리자 문자 상태를 불러오는 중입니다.')); return; }
    var wave = generation, data = overview, device = section('휴대폰 연결');
    device.appendChild(node('p', 'vs-sms-status', data.device.paired ? '휴대폰 등록됨 · 마지막 연결: ' + displayAt(data.device.lastSeen) : '휴대폰 연결 안 됨 · 설치와 연결이 필요합니다.'));
    device.appendChild(node('p', 'vs-sms-help', '앱 설치 후 문자 권한을 허용하고 연결을 시작하세요. 절전 모드에서는 전송이 늦어질 수 있습니다.'));
    var download = node('a', 'vs-sms-button', '휴대폰 앱 다운로드'); download.href = '/hlb-sms-relay.apk'; download.setAttribute('download', 'hlb-sms-relay.apk'); device.appendChild(download);
    var urlInput = input('url', relayDraft, function (value) { relayDraft = value; }, 'relayOrigin');
    urlInput.autocomplete = 'off'; device.appendChild(field('휴대폰 연결 주소', urlInput));
    device.appendChild(button('주소 복사', async function () {
      var origin = validRelay(relayDraft);
      if (!origin || origin !== validRelay(data.device.relayOrigin)) { say(errorText(fault('relay')), 'error'); return; }
      try { await root.navigator.clipboard.writeText(origin); say('휴대폰 연결 주소를 복사했습니다.'); }
      catch (error) { say('주소 입력란에서 직접 복사해 주세요.', 'error'); }
    }, !data.device.relayOrigin));
    device.appendChild(button('휴대폰 연결 키 만들기', pair, !data.device.relayOrigin, 'pair'));
    device.appendChild(button('연결 해제 · 대기 전송 중지', function () {
      if (!root.confirm('휴대폰 연결을 해제하고 대기 중인 문자 전송을 중지할까요?')) return;
      action(async function () {
        await api('revoke', {}); modal.querySelector('[data-secret]').replaceChildren();
        await fresh(); settingsDraft.enabled = false; callSettingsDraft = Object.assign({}, overview.callSettings);
        say('연결 해제와 대기 전송 중지를 확인했습니다.');
      });
    }, !data.device.paired, 'revoke'));

    var settings = section('월요일 요청 · 화요일 미응답 안내');
    settings.appendChild(node('p', 'vs-sms-help', '시간과 문구를 확인한 뒤 활성화하세요. 답장하거나 예약한 학생은 화요일 안내에서 제외됩니다. 한국 시간 기준입니다.'));
    var enable = input('checkbox', '', function () { settingsDraft.enabled = enable.checked; }, 'enabled'); enable.checked = settingsDraft.enabled === true;
    settings.appendChild(field('안내 문자 자동 준비 활성화', enable));
    ['monday','tuesday'].forEach(function (stage) {
      var timeKey = stage + 'Time', textKey = stage + 'Text', title = stage === 'monday' ? '월요일' : '화요일';
      settings.appendChild(field(title + ' 시간', input('time', settingsDraft[timeKey], function (value) { settingsDraft[timeKey] = value; }, timeKey)));
      var text = node('textarea'); text.value = settingsDraft[textKey]; text.maxLength = 3500; text.disabled = busy; text.dataset.field = textKey;
      var preview = node('pre', 'vs-sms-preview');
      function updatePreview() { preview.textContent = String(settingsDraft[textKey] || '').replace(/\{name\}/g, '학생 이름'); }
      text.addEventListener('input', function () { if (ensureOwner() && wave === generation) { settingsDraft[textKey] = text.value; updatePreview(); } }); updatePreview();
      settings.appendChild(field(title + ' 문구 · {name}은 학생 이름으로 바뀝니다', text));
      settings.appendChild(node('span', 'vs-sms-help', title + ' 미리보기 (예시 이름)')); settings.appendChild(preview);
    });
    settings.appendChild(button('설정 저장', saveSettings, false, 'settings'));
    var callSettings = section('수신 통화 수집 · 선택 동의');
    callSettings.appendChild(node('p', 'vs-sms-help', '기본값은 꺼짐입니다. 휴대폰에서도 발신자 표시 앱을 직접 선택해야 합니다. 선택하면 기존 발신자 표시 제공자가 변경됩니다. 전화는 즉시 허용하며 통화 내용·녹음·과거 통화기록·연락처 목록은 수집하지 않습니다.'));
    var callEnable = input('checkbox', '', function () { callSettingsDraft.enabled = callEnable.checked; }, 'callEnabled'); callEnable.checked = callSettingsDraft.enabled === true;
    callSettings.appendChild(field('새 수신 통화의 번호·시각 수집 허용', callEnable));
    var includeUnknown = input('checkbox', '', function () { callSettingsDraft.includeUnknown = includeUnknown.checked; }, 'includeUnknown'); includeUnknown.checked = callSettingsDraft.includeUnknown === true;
    callSettings.appendChild(field('미등록 번호도 수집 허용', includeUnknown));
    callSettings.appendChild(button('통화 설정 저장', saveCallSettings, false, 'call-settings'));
    var calls = section('최근 수신 통화');
    calls.appendChild(node('p', 'vs-sms-help', '최근 200건입니다. 통화 확인은 문자 답장이나 수업 예약으로 처리되지 않습니다.'));
    if (!data.calls.length) calls.appendChild(node('p', '', '수집된 수신 통화가 없습니다.'));
    data.calls.slice(0,200).forEach(function (c) {
      var card = node('article', 'vs-sms-card'), d = callDrafts.get(id(c.id)), current = contactMatch(c.phone);
      card.dataset.callId = id(c.id);
      var identityReady = ready(data.revision), sameIdentity = identityReady && current.matchStatus === c.matchStatus &&
        (c.matchStatus !== 'matched' || id(current.studentId) === id(c.studentId));
      var title = sameIdentity && current.name ? current.name : c.matchStatus === 'unknown' && sameIdentity ? '미등록 번호' :
        current.matchStatus === 'ambiguous' || c.matchStatus === 'ambiguous' ? '여러 연락처와 일치 · 직접 확인 필요' : '연락처 확인 필요';
      card.appendChild(node('h4', '', title));
      card.appendChild(node('p', 'vs-sms-help', c.phone + ' · ' + displayAt(c.receivedAt) + ' · ' + (c.status === 'acknowledged' ? '확인 완료' : '미확인')));
      card.appendChild(button('통화 확인', function () {
        action(async function () { await api('call-dismiss', {callId:c.id}); await fresh(); say('통화 확인을 반영했습니다.'); });
      }, c.status === 'acknowledged', 'call-dismiss'));
      if (c.matchStatus === 'unknown' && current.matchStatus === 'unknown' || callReadback && callReadback.callId === id(c.id)) {
        var name = input('text', d.name, function (value) { d.name = value; }, 'callName'); name.maxLength = 80;
        card.appendChild(field('문의자 이름 · 직접 입력', name));
        var memo = input('text', d.memo, function (value) { d.memo = value; }, 'callMemo'); memo.maxLength = 500;
        card.appendChild(field('문의 메모', memo));
        card.appendChild(button('이 번호로 문의 등록', function () { registerCall(c.id); }, !sameIdentity || readbackRevision !== null, 'call-inquiry'));
      }
      calls.appendChild(card);
    });
    var queue = section('이번 주 일괄 전송 준비');
    queue.appendChild(node('p', 'vs-sms-help', '미배정 변동 레슨 학생에게 안내를 준비합니다. 전송 상태는 아래에서 확인하세요.'));
    ['monday','tuesday'].forEach(function (stage) {
      queue.appendChild(button(stage === 'monday' ? '월요일 요청 일괄 준비' : '화요일 미응답 안내 일괄 준비', function () {
        if (!root.confirm('현재 설정으로 ' + (stage === 'monday' ? '월요일 요청' : '화요일 미응답 안내') + '를 일괄 준비할까요?')) return;
        action(async function () { var result = await api('prepare', {stage:stage}); await fresh(); say((Number.isSafeInteger(result.count) ? result.count : 0) + '건의 대기열 준비 결과를 확인했습니다.'); });
      }, !data.settings.enabled || !data.device.paired, 'prepare-' + stage));
    });
    var names = data.unassigned.map(function (row) {
      var canonical = records().find(function (s) { return id(s.id) === id(row.id); });
      return canonical ? canonical.name : '명단 확인 필요';
    });
    queue.appendChild(node('p', '', '미배정 변동 레슨 학생: ' + (names.join(', ') || '없음')));
    var outbox = node('ul', 'vs-sms-outbox');
    var states = {pending:'전송 대기', queued:'전송 대기', claimed:'전송 시도 중 · 재전송하지 않음', sent:'휴대폰 발신 처리 · 수신 여부 미확인', failed:'전송 실패 · 자동 재시도 없음', unknown:'전송 결과 불확실 · 자동 재시도 없음', cancelled:'취소', suppressed:'답장·예약 등으로 제외', expired:'발송일 만료'};
    data.outbox.forEach(function (row) {
      var student = records().find(function (s) { return id(s.id) === id(row.studentId); });
      outbox.appendChild(node('li', '', (student ? student.name : '명단 확인 필요') + ' · ' + (row.stage === 'monday' ? '월요일' : row.stage === 'tuesday' ? '화요일' : '안내') + ' · ' + (states[row.status] || '상태 확인 필요')));
    });
    if (!data.outbox.length) outbox.appendChild(node('li', '', '전송 대기·처리 기록 없음')); queue.appendChild(outbox);

    var messages = section('받고 보낸 문자');
    messages.appendChild(node('p', 'vs-sms-help', '문자를 확인하고 학생·날짜·시간을 선택하세요. 체크한 항목만 등록됩니다.'));
    if (!ready(data.revision)) messages.appendChild(node('p', 'vs-sms-warning', '최신 학생 정보를 확인해 주세요. 새로고침 후 일정을 등록할 수 있습니다.'));
    if (!data.messages.length) messages.appendChild(node('p', '', '등록된 번호의 새 문자 기록이 없습니다.'));
    data.messages.forEach(function (m) {
      var d = drafts.get(id(m.id)), found = matches(m.phone), closed = m.status === 'scheduled' || m.status === 'dismissed';
      var card = node('article', 'vs-sms-card'); card.dataset.messageId = id(m.id);
      var canonicalMatch = found.length === 1 && id(found[0].id) === id(m.studentId) && ['matched','unique'].includes(m.matchStatus);
      var registeredStudent = m.status === 'scheduled' && validConfirmation(m.confirmation) && records().find(function (s) { return id(s.id) === id(m.confirmation.studentId); });
      card.appendChild(node('h4', '', (registeredStudent ? registeredStudent.name : canonicalMatch ? found[0].name : '번호 일치 확인 필요') + ' · ' + (m.direction === 'sent' ? '발신' : '수신')));
      card.appendChild(node('p', 'vs-sms-help', String(m.phone || '') + ' · ' + displayAt(m.receivedAt) + (closed ? ' · ' + (m.status === 'scheduled' ? '일정 확정됨' : '확인 제외됨') : ' · 미확정')));
      card.appendChild(node('pre', 'vs-sms-raw', m.text));
      if (m.status === 'scheduled' && !validConfirmation(m.confirmation)) card.appendChild(node('p', 'vs-sms-warning', '등록된 날짜와 시간은 스케줄에서 확인해 주세요.'));
      if (m.proposal && Array.isArray(m.proposal.warnings)) m.proposal.warnings.forEach(function (warning) { card.appendChild(node('p', 'vs-sms-warning', warning)); });
      var fields = node('div', 'vs-sms-entry');
      var select = node('select'); select.disabled = busy || closed; select.dataset.field = 'studentId';
      var blank = node('option', '', '학생 선택'); blank.value = ''; select.appendChild(blank);
      var choices = found.slice();
      if (registeredStudent && !choices.some(function (s) { return id(s.id) === id(registeredStudent.id); })) choices.push(registeredStudent);
      choices.forEach(function (s) { var option = node('option', '', s.name + (s.status === '수강중' && s.schedType === 'flex' ? '' : ' · 확정 대상 아님')); option.value = id(s.id); select.appendChild(option); });
      select.value = d.studentId; select.addEventListener('change', function () { if (ensureOwner() && wave === generation) { d.studentId = select.value; invalidateOptions(d, card); } });
      fields.appendChild(field('학생', select));
      var date = input('date', d.date, function (value) { d.date = value; invalidateOptions(d, card); }, 'date'); date.disabled = busy || closed;
      var time = input('time', d.time, function (value) { d.time = value; invalidateOptions(d, card); }, 'time'); time.disabled = busy || closed; time.step = '60';
      fields.appendChild(field('레슨 날짜', date)); fields.appendChild(field('레슨 시간', time)); card.appendChild(fields);
      if (!closed) {
        var windows = node('div', 'vs-sms-entry');
        var start = input('time', d.startTime, function (value) { d.startTime = value; invalidateOptions(d, card); }, 'startTime'); start.step = '60';
        var end = input('time', d.endTime, function (value) { d.endTime = value; invalidateOptions(d, card); }, 'endTime'); end.step = '60';
        windows.appendChild(field('가능한 시간 시작', start)); windows.appendChild(field('가능한 시간 종료', end)); card.appendChild(windows);
        card.appendChild(node('p', 'vs-sms-help', '가능한 날짜와 범위를 직접 지정하세요. 요청한 시간이 가능하면 우선 제안하고, 유동적이면 기존 레슨에 이어지는 시간을 추천합니다. 겹치는 시간은 제외하며 레슨·피드백을 위해 60분을 확보합니다.'));
        card.appendChild(button('가능한 시간 추천', function () { scheduleOptions(m.id); }, !ready(data.revision) || readbackRevision !== null, 'options'));
        var offer = d.options;
        if (offer) {
          var recommendations = node('div'); recommendations.dataset.scheduleOptions = '';
          offer.warnings.forEach(function (warning) { recommendations.appendChild(node('p', 'vs-sms-warning', warning)); });
          offer.rows.forEach(function (option) {
            recommendations.appendChild(button(option.date + ' ' + option.time + ' · ' + option.reason, function () {
              if (d.options !== offer || !ready(offer.revision) || offer.signature !== JSON.stringify([d.studentId, d.date, d.startTime, d.endTime, d.time])) {
                say('자료나 가능 시간이 변경되었습니다. 시간 후보를 다시 확인해 주세요.', 'error'); return;
              }
              d.date = option.date; d.time = option.time; d.options = null; renderModal();
              say('시간 후보를 입력했습니다. 원문과 선택한 시간을 확인한 뒤 일정을 등록하세요.');
            }, !ready(offer.revision) || readbackRevision !== null, 'choose-option'));
          });
          card.appendChild(recommendations);
        }
      }
      var checked = input('checkbox', '', function () { d.checked = checked.checked; }, 'checked'); checked.checked = d.checked; checked.disabled = busy || closed;
      card.appendChild(field('이 일정 선택', checked));
      card.appendChild(button('이 문자 확인 제외', function () {
        action(async function () { await api('dismiss', {messageId:m.id}); await fresh(); d.checked = false; say('확인 제외를 반영했습니다. 일정은 추가되지 않았습니다.'); });
      }, closed, 'dismiss')); messages.appendChild(card);
    });
    messages.appendChild(button('선택한 일정 등록', confirmBatch, !ready(data.revision) || readbackRevision !== null, 'confirm'));
    var aliases = section('상담·문의 이름 변경 제안');
    if (!data.aliasChanges.length) aliases.appendChild(node('p', '', '확인할 이름 변경 제안이 없습니다.'));
    data.aliasChanges.forEach(function (alias) {
      var card = node('div', 'vs-sms-card');
      card.appendChild(node('p', '', String(alias.oldName || '') + ' → ' + String(alias.newName || '') + ' (등록된 학생 이름)'));
      card.appendChild(button('이름 변경 확인', function () { approveAlias(alias.id); }, !ready(data.revision) || readbackRevision !== null, 'alias')); aliases.appendChild(card);
    });
    say(feedback, feedbackKind);
  }
  function close() {
    ensureOwner();
    if (busy && modal && modal.querySelector('[data-action="close"]').disabled) return;
    setBusy(false);
    generation++;
    if (modal) {
      modal.querySelectorAll('[data-field="token"]').forEach(function (el) { el.value = ''; });
      modal.remove(); modal = content = notice = null; document.body.style.overflow = previousOverflow;
      document.removeEventListener('keydown', onKey);
      if (previousFocus && previousFocus.focus) previousFocus.focus();
    }
  }
  function onKey(event) {
    ensureOwner();
    if (event.key === 'Escape') { event.preventDefault(); close(); }
    if (event.key !== 'Tab' || !modal) return;
    var nodes = Array.from(modal.querySelectorAll('button,input,textarea,select,a[href]')).filter(function (el) { return !el.disabled; });
    var first = nodes[0], last = nodes[nodes.length - 1];
    if (!first) { event.preventDefault(); modal.focus(); }
    else if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
  }
  function open() {
    var sameOwner = ensureOwner();
    if (modal) { modal.focus(); return sameOwner ? Promise.resolve() : refresh(); }
    generation++; previousFocus = document.activeElement; previousOverflow = document.body.style.overflow;
    var backdrop = node('div', 'vs-sms-modal'); modal = backdrop; modal.tabIndex = -1;
    modal.setAttribute('role', 'dialog'); modal.setAttribute('aria-modal', 'true'); modal.setAttribute('aria-labelledby', 'vs-sms-title');
    var panel = node('div', 'vs-sms-panel'), header = node('header', 'vs-sms-header');
    var title = node('h2', '', '문자 일정 관리 · 통화 수신함'); title.id = 'vs-sms-title'; header.appendChild(title);
    header.appendChild(button('새로고침', refresh, false, 'refresh')); header.appendChild(button('닫기', close, false, 'close'));
    panel.appendChild(header); notice = node('p', 'vs-sms-notice'); notice.setAttribute('aria-live', 'polite'); header.appendChild(notice);
    var secret = node('section', 'vs-sms-secret'); secret.dataset.secret = ''; panel.appendChild(secret);
    content = node('div', 'vs-sms-content'); panel.appendChild(content); modal.appendChild(panel);
    document.body.appendChild(modal); document.body.style.overflow = 'hidden'; document.addEventListener('keydown', onKey); modal.focus();
    // Never display cached customer content before the current owner read succeeds.
    content.appendChild(node('p', '', '관리자 문자 상태를 불러오는 중입니다.'));
    return refresh();
  }
  root.VSSms = {open:open, close:close, refresh:refresh};
})(typeof globalThis !== 'undefined' ? globalThis : this);
