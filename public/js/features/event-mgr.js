// ── features/event-mgr.js ──────────────────────────────────────────────────
import { state, showToast, fmtDate, openConfirm } from '/public/js/common.js';

// reloadData를 모듈 레벨에서 보관
let _reload = null;

export function openEventMgr() {
  document.getElementById('eventMgrModal').classList.add('open');
  setTimeout(() => renderEventRoomList(), 50);
}

export function renderEventRoomList() {
  const el = document.getElementById('eventRoomList');
  if (!el) return;
  const eventRooms = state.rooms.filter(r => r.room_type === 'event');
  if (!eventRooms.length) {
    el.innerHTML = '<div style="font-size:13px;color:var(--muted);text-align:center;padding:12px;">아직 이벤트가 없어요</div>';
    return;
  }
  el.innerHTML = '';
  eventRooms.forEach(r => {
    const diff  = r.event_date ? Math.ceil((new Date(r.event_date) - new Date()) / 86400000) : null;
    const badge = diff === null ? '' : diff > 0 ? `D-${diff}` : diff === 0 ? 'D-DAY 🎉' : '완료 🎂';
    const wrap  = document.createElement('div');
    wrap.style.cssText = 'background:white;border:1px solid rgba(139,94,60,.12);border-radius:12px;padding:12px 14px;margin-bottom:8px;';

    const row = document.createElement('div');
    row.style.cssText = 'display:flex;align-items:center;gap:8px;margin-bottom:8px;';
    row.innerHTML = `
      <div style="flex:1;">
        <div style="font-size:13px;font-weight:600;color:var(--dark);">${r.room_name}</div>
        <div style="font-size:11px;color:var(--muted);">${r.event_date ? fmtDate(r.event_date) : '날짜 미설정'}${badge ? ' · '+badge : ''}</div>
      </div>
      <a href="/event?slug=${state.slug}&room=${r.id}" target="_blank"
        style="background:var(--gold);color:white;border-radius:16px;padding:5px 12px;font-size:11px;text-decoration:none;">페이지</a>`;

    const editBtn = document.createElement('button');
    editBtn.textContent = '수정';
    editBtn.style.cssText = 'background:var(--warm);border:1px solid rgba(139,94,60,.2);border-radius:16px;padding:5px 12px;font-size:11px;cursor:pointer;font-family:"Gowun Dodum",serif;';
    editBtn.onclick = () => openEditEventRoom(r.id);

    const delBtn = document.createElement('button');
    delBtn.textContent = '🗑️';
    delBtn.style.cssText = 'background:none;border:none;font-size:16px;cursor:pointer;color:var(--muted);';
    delBtn.onclick = () => _deleteEventRoom(r.id);  // ← _reload는 모듈 레벨에서 참조

    row.appendChild(editBtn);
    row.appendChild(delBtn);

    const editForm = document.createElement('div');
    editForm.id = `editForm-${r.id}`;
    editForm.style.cssText = 'display:none;border-top:1px solid rgba(139,94,60,.1);padding-top:10px;margin-top:4px;';
    editForm.innerHTML = `
      <input class="modal-input" id="editName-${r.id}" value="${r.room_name}" placeholder="이벤트 이름" style="margin-bottom:8px;">
      <input class="modal-input" id="editDate-${r.id}" type="date" value="${r.event_date||''}" style="margin-bottom:8px;">
      <div style="font-size:11px;color:var(--muted);margin-bottom:6px;letter-spacing:1px;">📋 이벤트 공지 (선택)</div>
      <input class="modal-input" id="editInfoTitle-${r.id}" value="${r.info_title||''}" placeholder="제목" style="margin-bottom:8px;">
      <textarea class="modal-input" id="editInfoBody-${r.id}" placeholder="안내 문구" style="height:80px;margin-bottom:8px;">${r.info_body||''}</textarea>
      <input class="modal-input" id="editInfoAccount-${r.id}" value="${r.info_account||''}" placeholder="계좌번호" style="margin-bottom:8px;">
      <div style="display:flex;gap:8px;">
        <button onclick="saveEditEventRoom('${r.id}')"
          style="flex:1;background:var(--brown);color:white;border:none;border-radius:10px;padding:10px;font-family:'Gowun Dodum',serif;font-size:13px;cursor:pointer;">저장</button>
        <button onclick="document.getElementById('editForm-${r.id}').style.display='none'"
          style="background:var(--warm);border:none;border-radius:10px;padding:10px 14px;font-family:'Gowun Dodum',serif;font-size:13px;cursor:pointer;">취소</button>
      </div>`;

    wrap.appendChild(row);
    wrap.appendChild(editForm);
    el.appendChild(wrap);
  });
}

export function openEditEventRoom(roomId) {
  document.querySelectorAll('[id^="editForm-"]').forEach(el => el.style.display = 'none');
  document.getElementById(`editForm-${roomId}`).style.display = 'block';
}

export async function saveEditEventRoom(roomId, reloadData) {
  if (reloadData) _reload = reloadData;  // 최신 reload 저장
  const name        = document.getElementById(`editName-${roomId}`).value.trim();
  const date        = document.getElementById(`editDate-${roomId}`).value;
  const infoTitle   = document.getElementById(`editInfoTitle-${roomId}`).value.trim();
  const infoBody    = document.getElementById(`editInfoBody-${roomId}`).value.trim();
  const infoAccount = document.getElementById(`editInfoAccount-${roomId}`).value.trim();
  if (!name) { showToast('이름을 입력해주세요'); return; }
  const res = await fetch('/api/rooms', {
    method: 'PATCH', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      room_id: roomId, house_id: state.houseId, owner_key: state.ownerKey,
      room_name: name, event_date: date || null,
      info_title: infoTitle, info_body: infoBody, info_account: infoAccount
    })
  });
  const data = await res.json();
  if (data.success) { showToast('수정됐어요 ✅'); await _reload?.(); }
  else showToast(data.error || '수정 실패');
}

export async function createEventRoom(reloadData) {
  if (reloadData) _reload = reloadData;  // 최신 reload 저장
  const name = document.getElementById('newEventName').value.trim();
  const date = document.getElementById('newEventDate').value;
  if (!name) { showToast('이벤트 이름을 입력해주세요'); return; }
  const res = await fetch('/api/rooms', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      house_id: state.houseId, owner_key: state.ownerKey,
      room_name: name, event_date: date || null
    })
  });
  const data = await res.json();
  if (data.success) {
    showToast(`${name} 이벤트가 생성됐어요 🎂`);
    document.getElementById('newEventName').value = '';
    document.getElementById('newEventDate').value = '';
    document.getElementById('eventMgrModal').classList.remove('open');
    await _reload?.();
  } else showToast(data.error || '생성 실패');
}

async function _deleteEventRoom(roomId) {
  openConfirm('이벤트를 삭제할까요?', '삭제하면 되돌릴 수 없어요.', async () => {
    const res = await fetch('/api/rooms', {
      method: 'DELETE', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ room_id: roomId, house_id: state.houseId, owner_key: state.ownerKey })
    });
    const data = await res.json();
    if (data.success) { showToast('삭제됐어요'); await _reload?.(); }
    else showToast(data.error || '삭제 실패');
  });
}
export { _deleteEventRoom as deleteEventRoom };