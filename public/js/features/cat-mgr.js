// ── public/js/features/cat-mgr.js ─────────────────────────────────────────
// 분류 관리 바텀시트 (추가 / 수정 / 삭제 통합)
// room.js / write.js 칩에서 관리 기능 완전 분리

import { state, showToast, openConfirm } from '/public/js/common.js';

// ── 바텀시트 열기 ─────────────────────────────────────────────────────────
export function openCatMgr() {
  _injectStyles();
  document.getElementById('__catMgr')?.remove();

  const sheet = document.createElement('div');
  sheet.id = '__catMgr';
  sheet.innerHTML = `
    <div class="cm-backdrop" id="cmBackdrop"></div>
    <div class="cm-sheet" id="cmSheet">
      <div class="cm-handle"></div>
      <div class="cm-head">
        <div class="cm-title">분류 관리</div>
        <button class="cm-close" onclick="window._closeCatMgr()">✕</button>
      </div>

      <div class="cm-section-label">일반 분류</div>
      <div id="cmNormalList"></div>
      <button class="cm-add-btn" id="cmAddNormal" onclick="window._openCatForm('normal')">
        + 분류 추가
      </button>

      <div class="cm-divider"></div>

      <div class="cm-section-label">이벤트</div>
      <div id="cmEventList"></div>
      <button class="cm-add-btn cm-add-event" id="cmAddEvent" onclick="window._openCatForm('event')">
        + 이벤트 추가
      </button>

      <!-- 인라인 폼 -->
      <div id="cmForm" style="display:none;" class="cm-form">
        <input id="cmFormName" class="cm-input" placeholder="이름" maxlength="20">
        <input id="cmFormDate" class="cm-input" type="date" style="display:none;">
        <div class="cm-form-btns">
          <button class="cm-form-cancel" onclick="window._closeCatForm()">취소</button>
          <button class="cm-form-save"   id="cmFormSave">저장</button>
        </div>
      </div>
    </div>`;

  document.body.appendChild(sheet);
  requestAnimationFrame(() => {
    document.getElementById('cmSheet')?.classList.add('open');
  });

  document.getElementById('cmBackdrop').onclick = window._closeCatMgr;
  _renderCatLists();
}

// ── 리스트 렌더 ───────────────────────────────────────────────────────────
function _renderCatLists() {
  const normal = (state.categories || []).filter(c => !c.is_event);
  const events = (state.categories || []).filter(c =>  c.is_event);

  document.getElementById('cmNormalList').innerHTML =
    normal.length ? normal.map(_rowHtml).join('') :
    '<div class="cm-empty">일반 분류가 없어요</div>';

  document.getElementById('cmEventList').innerHTML =
    events.length ? events.map(_rowHtml).join('') :
    '<div class="cm-empty">이벤트가 없어요</div>';
}

function _rowHtml(c) {
  const dateStr = c.event_date
    ? `<span class="cm-row-date">${c.event_date.slice(5).replace('-','/')}</span>` : '';
  const dot = `<span class="cm-dot" style="background:${c.color||'#8FBFAB'};"></span>`;
  return `
    <div class="cm-row" data-id="${c.id}">
      ${dot}
      <span class="cm-row-name">${c.name}</span>
      ${dateStr}
      <div class="cm-row-actions">
        <button class="cm-row-btn" onclick="window._openCatForm('${c.is_event?'event':'normal'}','${c.id}','${c.name.replace(/'/g,"\\'")}','${c.event_date||''}')">✏️</button>
        <button class="cm-row-btn del" onclick="window._deleteCatMgr('${c.id}','${c.name.replace(/'/g,"\\'")}')">🗑️</button>
      </div>
    </div>`;
}

// ── 폼 열기 ───────────────────────────────────────────────────────────────
let _formMode = 'normal'; // 'normal' | 'event'
let _formEditId = null;

window._openCatForm = (mode, editId = null, editName = '', editDate = '') => {
  _formMode   = mode;
  _formEditId = editId;

  const form     = document.getElementById('cmForm');
  const nameInput = document.getElementById('cmFormName');
  const dateInput = document.getElementById('cmFormDate');
  const saveBtn   = document.getElementById('cmFormSave');

  nameInput.value = editName;
  dateInput.value = editDate;
  dateInput.style.display = mode === 'event' ? 'block' : 'none';
  saveBtn.textContent = editId ? '수정' : '추가';
  saveBtn.onclick = editId ? window._submitEditCatMgr : window._submitAddCatMgr;

  form.style.display = 'flex';
  nameInput.focus();

  // 스크롤 내려서 폼 보이게
  document.getElementById('cmSheet').scrollTop = 9999;
};

window._closeCatForm = () => {
  document.getElementById('cmForm').style.display = 'none';
  _formEditId = null;
};

// ── 추가 ─────────────────────────────────────────────────────────────────
window._submitAddCatMgr = async () => {
  const name  = document.getElementById('cmFormName').value.trim();
  const date  = document.getElementById('cmFormDate').value || null;
  const isEv  = _formMode === 'event';

  if (!name) { showToast('이름을 입력해주세요'); return; }
  if (isEv && !date) { showToast('이벤트 날짜를 선택해주세요'); return; }

  const saveBtn = document.getElementById('cmFormSave');
  saveBtn.disabled = true;

  try {
    const res  = await fetch('/api/categories', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Profile': 'corenull' },
      body: JSON.stringify({
        house_id:   state.houseId,
        name,
        color:      isEv ? '#F7C59F' : '#A8D8A8',
        is_event:   isEv,
        event_date: isEv ? date : null,
        order_num:  (state.categories?.length || 0) + 1,
      })
    });
    const data = await res.json();
    if (data.id || data.success) {
      state.categories = state.categories || [];
      state.categories.push({
        id: data.id || data.data?.id,
        name,
        color:      isEv ? '#F7C59F' : '#A8D8A8',
        is_event:   isEv,
        event_date: isEv ? date : null,
      });
      showToast(`${isEv ? '이벤트' : '분류'} 추가됐어요 ✅`);
      window._closeCatForm();
      _renderCatLists();
      _refreshRoomChips();
    } else {
      showToast(data.error || '추가 실패');
    }
  } finally {
    saveBtn.disabled = false;
  }
};

// ── 수정 ─────────────────────────────────────────────────────────────────
window._submitEditCatMgr = async () => {
  const name  = document.getElementById('cmFormName').value.trim();
  const date  = document.getElementById('cmFormDate').value || null;
  const isEv  = _formMode === 'event';
  const id    = _formEditId;

  if (!name) { showToast('이름을 입력해주세요'); return; }
  if (isEv && !date) { showToast('날짜를 선택해주세요'); return; }

  const saveBtn = document.getElementById('cmFormSave');
  saveBtn.disabled = true;

  try {
    const res  = await fetch('/api/categories', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', 'Content-Profile': 'corenull' },
      body: JSON.stringify({ category_id: id, house_id: state.houseId, name, event_date: date })
    });
    const data = await res.json();
    if (data.success) {
      const cat = state.categories.find(c => String(c.id) === String(id));
      if (cat) { cat.name = name; cat.event_date = date; }
      showToast('수정됐어요 ✅');
      window._closeCatForm();
      _renderCatLists();
      _refreshRoomChips();
    } else {
      showToast(data.error || '수정 실패');
    }
  } finally {
    saveBtn.disabled = false;
  }
};

// ── 삭제 ─────────────────────────────────────────────────────────────────
window._deleteCatMgr = (id, name) => {
  openConfirm(`"${name}" 분류를 삭제할까요?`, '삭제하면 되돌릴 수 없어요.', async () => {
    const res  = await fetch('/api/categories', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json', 'Content-Profile': 'corenull' },
      body: JSON.stringify({ category_id: id, house_id: state.houseId })
    });
    const data = await res.json();
    if (data.success) {
      state.categories = state.categories.filter(c => String(c.id) !== String(id));
      showToast('삭제됐어요 🗑️');
      _renderCatLists();
      _refreshRoomChips();
    } else {
      showToast(data.error || '삭제 실패');
    }
  });
};

// ── 닫기 ─────────────────────────────────────────────────────────────────
window._closeCatMgr = () => {
  const sheet = document.getElementById('cmSheet');
  if (!sheet) return;
  sheet.classList.remove('open');
  setTimeout(() => document.getElementById('__catMgr')?.remove(), 300);
};

// ── room.js의 칩 새로고침 트리거 ─────────────────────────────────────────
function _refreshRoomChips() {
  // room.js의 filterCat을 통해 현재 활성 room 탭 re-render
  if (typeof window._reloadData === 'function') window._reloadData();
}

// ── 스타일 주입 ───────────────────────────────────────────────────────────
function _injectStyles() {
  if (document.getElementById('__catMgrStyle')) return;
  const s = document.createElement('style');
  s.id = '__catMgrStyle';
  s.textContent = `
    #__catMgr { position:fixed;inset:0;z-index:9000; }
    .cm-backdrop {
      position:absolute;inset:0;
      background:rgba(0,0,0,.5);backdrop-filter:blur(2px);
    }
    .cm-sheet {
      position:absolute;bottom:0;left:0;right:0;
      max-height:80vh;overflow-y:auto;
      background:var(--cream,#FDF8F3);
      border-radius:20px 20px 0 0;
      padding:16px 20px 48px;
      transform:translateY(100%);
      transition:transform .3s cubic-bezier(.4,0,.2,1);
    }
    .cm-sheet.open { transform:translateY(0); }
    .cm-handle {
      width:40px;height:4px;background:rgba(139,94,60,.2);
      border-radius:2px;margin:0 auto 16px;
    }
    .cm-head {
      display:flex;align-items:center;justify-content:space-between;
      margin-bottom:20px;
    }
    .cm-title {
      font-family:'Noto Serif KR',serif;font-size:17px;
      font-weight:600;color:var(--dark,#2C1A0E);
    }
    .cm-close {
      background:rgba(139,94,60,.1);border:none;color:var(--dark,#2C1A0E);
      width:30px;height:30px;border-radius:50%;font-size:14px;cursor:pointer;
      display:flex;align-items:center;justify-content:center;
    }
    .cm-section-label {
      font-size:10px;letter-spacing:3px;color:var(--muted,#9B8B7E);
      text-transform:uppercase;margin-bottom:10px;margin-top:4px;
    }
    .cm-row {
      display:flex;align-items:center;gap:10px;
      background:white;border:1px solid rgba(139,94,60,.1);
      border-radius:12px;padding:12px 14px;margin-bottom:8px;
    }
    .cm-dot {
      width:10px;height:10px;border-radius:50%;flex-shrink:0;
    }
    .cm-row-name {
      flex:1;font-size:14px;color:var(--dark,#2C1A0E);font-weight:500;
    }
    .cm-row-date {
      font-size:11px;color:var(--muted,#9B8B7E);flex-shrink:0;
    }
    .cm-row-actions { display:flex;gap:4px;flex-shrink:0; }
    .cm-row-btn {
      background:none;border:1px solid rgba(139,94,60,.12);
      border-radius:8px;padding:4px 8px;font-size:13px;cursor:pointer;
      transition:background .15s;
    }
    .cm-row-btn:hover { background:var(--warm,#F7EEE3); }
    .cm-row-btn.del:hover { background:#FEE;border-color:#fcc; }
    .cm-empty {
      font-size:12px;color:var(--muted,#9B8B7E);
      text-align:center;padding:12px 0;
    }
    .cm-add-btn {
      width:100%;margin-top:4px;
      background:transparent;
      border:1.5px dashed rgba(139,94,60,.25);
      border-radius:12px;padding:10px;
      font-family:'Gowun Dodum',serif;font-size:13px;
      color:var(--muted,#9B8B7E);cursor:pointer;
      transition:all .15s;
    }
    .cm-add-btn:hover { border-color:var(--brown,#8B5E3C);color:var(--brown,#8B5E3C); }
    .cm-add-event { border-color:rgba(200,151,58,.3);color:#a07820; }
    .cm-add-event:hover { border-color:#c8973a;color:#c8973a; }
    .cm-divider { height:1px;background:rgba(139,94,60,.1);margin:16px 0; }
    .cm-form {
      display:none;flex-direction:column;gap:8px;
      background:var(--warm,#F7EEE3);border-radius:14px;
      padding:14px;margin-top:12px;
    }
    .cm-input {
      width:100%;background:white;border:1px solid rgba(139,94,60,.2);
      border-radius:10px;padding:10px 12px;
      font-family:'Gowun Dodum',serif;font-size:14px;
      color:var(--dark,#2C1A0E);outline:none;
    }
    .cm-input:focus { border-color:var(--brown,#8B5E3C); }
    .cm-form-btns { display:flex;gap:8px;margin-top:4px; }
    .cm-form-cancel {
      flex:1;background:white;border:1px solid rgba(139,94,60,.2);
      border-radius:10px;padding:10px;
      font-family:'Gowun Dodum',serif;font-size:13px;cursor:pointer;
    }
    .cm-form-save {
      flex:2;background:var(--brown,#8B5E3C);color:white;border:none;
      border-radius:10px;padding:10px;
      font-family:'Gowun Dodum',serif;font-size:13px;cursor:pointer;
    }
    .cm-form-save:disabled { opacity:.5;cursor:not-allowed; }
  `;
  document.head.appendChild(s);
}