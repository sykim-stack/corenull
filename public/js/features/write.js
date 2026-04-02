// ── public/js/features/write.js ───────────────────────────────────────────
import { state, showToast, resizeImg } from '/public/js/common.js';
import { submitPost } from '/public/js/api.js';
import { uploadMany } from '/public/js/core/upload.js';

/* ── 분류 렌더 (일반 | 이벤트 구분) ── */
function _renderComposeCats() {
  const wrap = document.getElementById('composeCatWrap');
  if (!wrap) return;

  const normal = (state.categories || []).filter(c => !c.is_event);
  const events = (state.categories || []).filter(c =>  c.is_event);

  const makeChip = c =>
    `<span class="cat-sel" data-id="${c.id}"
       onclick="this.classList.toggle('on')"
       style="--cat-color:${c.color || 'var(--mint)'};">${c.name}</span>`;

  wrap.innerHTML = `
    <div class="cat-group">
      <div class="cat-chips" id="catNormalChips">
        ${normal.map(makeChip).join('') || '<span class="cat-empty">분류 없음</span>'}
        <button class="cat-add-btn" id="btnAddCat" onclick="window._openAddCat()">+ 분류</button>
      </div>
    </div>
    ${events.length ? `
    <div class="cat-divider"></div>
    <div class="cat-group">
      <div class="cat-chips" id="catEventChips">
        ${events.map(makeChip).join('')}
        <button class="cat-add-btn cat-add-event" id="btnAddEvent" onclick="window._openAddEvent()">+ 이벤트</button>
      </div>
    </div>` : `
    <div class="cat-divider"></div>
    <div class="cat-group">
      <div class="cat-chips">
        <button class="cat-add-btn cat-add-event" onclick="window._openAddEvent()">+ 이벤트</button>
      </div>
    </div>`}
    <div id="catInlineForm" style="display:none;" class="cat-inline-form">
      <input id="catInlineName" placeholder="분류 이름" maxlength="10" />
      <button onclick="window._submitAddCat()">추가</button>
      <button onclick="document.getElementById('catInlineForm').style.display='none'">✕</button>
    </div>
  `;
}

/* ── 인라인 분류 추가 ── */
window._openAddCat = () => {
  const form = document.getElementById('catInlineForm');
  form.dataset.mode = 'normal';
  form.style.display = 'flex';
  document.getElementById('catInlineName').focus();
};

window._openAddEvent = () => {
  const form = document.getElementById('catInlineForm');
  form.dataset.mode = 'event';
  form.style.display = 'flex';
  document.getElementById('catInlineName').focus();
};

window._submitAddCat = async () => {
  const input   = document.getElementById('catInlineName');
  const name    = input.value.trim();
  const isEvent = document.getElementById('catInlineForm').dataset.mode === 'event';
  if (!name) { showToast('이름을 입력해주세요'); return; }

  const res = await fetch('/api/categories', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Profile': 'corenull'
    },
    body: JSON.stringify({
      house_id:   state.houseId,
      name,
      color:      isEvent ? '#F7C59F' : '#A8D8A8',
      is_event:   isEvent,
      event_date: null,
      order_num:  (state.categories?.length || 0) + 1
    })
  });

  const data = await res.json();
  if (data.id || data.success) {
    // state.categories 갱신
    if (!state.categories) state.categories = [];
    state.categories.push({
      id:       data.id || data.data?.id,
      name,
      color:    isEvent ? '#F7C59F' : '#A8D8A8',
      is_event: isEvent
    });
    input.value = '';
    document.getElementById('catInlineForm').style.display = 'none';
    _renderComposeCats();
    showToast(`${isEvent ? '이벤트' : '분류'} 추가됐어요 ✅`);
  } else {
    showToast(data.error || '추가 실패');
  }
};

/* ── 모달 열기 ── */
export function openWriteModal(mode = 'write') {
  state.writeFiles = [];
  document.getElementById('composeContent').value          = '';
  document.getElementById('composePrevWrap').style.display = 'none';
  document.getElementById('composePrevCells').innerHTML    = '';
  document.getElementById('composeProgWrap').style.display = 'none';
  document.getElementById('composeCatInline').style.display = 'none';

  _renderComposeCats();
  document.getElementById('composeModal').classList.add('open');

  if (mode === 'write') {
    setTimeout(() => document.getElementById('composeContent').focus(), 120);
  } else {
    setTimeout(() => document.getElementById('composePhotoInput').click(), 120);
  }
}

export function openUploadModal(roomId) {
  if (roomId) state.currentRoomId = roomId;
  openWriteModal('photo');
}

/* ── 사진 미리보기 ── */
export async function handleWritePhoto(input) {
  const newFiles = [...input.files];
  state.writeFiles = [...(state.writeFiles || []), ...newFiles].slice(0, 10);
  const cells = document.getElementById('composePrevCells');
  for (const f of newFiles) {
    const b64  = await resizeImg(f);
    const cell = document.createElement('div');
    cell.className = 'prev-cell';
    cell.innerHTML = `<img src="${b64}"><button class="prev-rm" onclick="this.parentElement.remove()">✕</button>`;
    cells.appendChild(cell);
  }
  document.getElementById('composePrevWrap').style.display = 'block';
  input.value = '';
}

/* ── 제출 ── */
export async function submitWrite(reloadData) {
  const content = document.getElementById('composeContent').value.trim();
  const catIds  = [...document.querySelectorAll('#composeCatWrap .cat-sel.on')].map(el => el.dataset.id);
  const roomId  = state.currentRoomId || state.rooms?.find(r => r.room_type === 'room')?.id;

  if (!content && (!state.writeFiles || state.writeFiles.length === 0)) {
    showToast('내용이나 사진을 추가해주세요'); return;
  }

  let mediaUrls = [];
  if (state.writeFiles?.length) {
    document.getElementById('composeProgWrap').style.display = 'block';
    mediaUrls = await uploadMany(state.writeFiles, ({ current, total, percent }) => {
      document.getElementById('composeProgFill').style.width = `${percent}%`;
      document.getElementById('composeProgText').textContent = `${current}/${total} 업로드 중...`;
    });
    document.getElementById('composeProgText').textContent = '완료!';
  }

  const data = await submitPost({ content, mediaUrls, categoryIds: catIds, roomId });
  if (data.success) {
    showToast('등록됐어요 ✅');
    document.getElementById('composeModal').classList.remove('open');
    await reloadData();           // 데이터 갱신
    // 현재 활성 탭 재렌더
    const activeTab = document.querySelector('.tab-btn.active')?.dataset?.tab;
    if (activeTab && window.switchTab) window.switchTab(activeTab);
  }
}