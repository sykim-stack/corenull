// ── public/js/features/write.js ───────────────────────────────────────────
import { state, showToast, apiFetch, resizeImg } from '/public/js/common.js';
import { submitPost } from '/public/js/api.js';
import { uploadMany } from '/public/js/core/upload.js';

// ── 편집 중인 post_id (null이면 새 글) ───────────────────────────────────
let _editPostId = null;

/* ── 분류 렌더 ── */
function _renderComposeCats(selectedIds = []) {
  const wrap = document.getElementById('composeCatWrap');
  if (!wrap) return;

  const normal = (state.categories || []).filter(c => !c.is_event);
  const events = (state.categories || []).filter(c =>  c.is_event);

  const makeChip = c =>
    `<span class="cat-sel${selectedIds.map(String).includes(String(c.id)) ? ' on' : ''}" data-id="${c.id}"
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
    headers: { 'Content-Type': 'application/json', 'Content-Profile': 'corenull' },
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

/* ── 모달 초기화 공통 ── */
function _resetModal() {
  state.writeFiles = [];
  document.getElementById('composeContent').value          = '';
  document.getElementById('composePrevWrap').style.display = 'none';
  document.getElementById('composePrevCells').innerHTML    = '';
  document.getElementById('composeProgWrap').style.display = 'none';
}

/* ── 새 글쓰기 모달 열기 ── */
export function openWriteModal(mode = 'write') {
  _editPostId = null;
  _resetModal();
  _renderComposeCats();

  // 모달 타이틀/버튼 초기화
  const modal = document.getElementById('composeModal');
  const titleEl = modal?.querySelector('.modal-title');
  if (titleEl) titleEl.textContent = '작성하기 ✏️';
  const submitEl = modal?.querySelector('.modal-submit');
  if (submitEl) submitEl.textContent = '등록';

  document.getElementById('composeModal').classList.add('open');
  if (mode === 'write') {
    setTimeout(() => document.getElementById('composeContent').focus(), 120);
  } else {
    setTimeout(() => document.getElementById('composePhotoInput').click(), 120);
  }
}

/* ── 수정 모달 열기 ── */
export function openPostEditModal(post) {
  _editPostId = post.id;
  _resetModal();

  // 기존 내용 채우기
  document.getElementById('composeContent').value = post.content || '';

  // 기존 카테고리 선택 상태로 렌더
  _renderComposeCats(post.category_ids || []);

  // 기존 이미지 미리보기
  if (post.media_urls?.length) {
    const cells = document.getElementById('composePrevCells');
    cells.innerHTML = post.media_urls.map(url =>
      `<div class="prev-cell" data-existing="${url}">
        <img src="${url}">
        <button class="prev-rm" onclick="this.parentElement.remove()">✕</button>
      </div>`
    ).join('');
    document.getElementById('composePrevWrap').style.display = 'block';
  }

  // 모달 타이틀/버튼 수정으로
  const modal = document.getElementById('composeModal');
  const titleEl = modal?.querySelector('.modal-title');
  if (titleEl) titleEl.textContent = '수정하기 ✏️';
  const submitEl = modal?.querySelector('.modal-submit');
  if (submitEl) submitEl.textContent = '수정 완료';

  document.getElementById('composeModal').classList.add('open');
  setTimeout(() => document.getElementById('composeContent').focus(), 120);
}

// window 노출 (인라인 onclick용)
window.openPostEditModal = openPostEditModal;

// house.html의 submitWrite() 인자 없는 호출 대응
// → window._reloadData 를 house.html에서 등록해두면 자동 호출
export function getReloadFn() {
  return typeof window._reloadData === 'function' ? window._reloadData : null;
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

/* ── 제출 (새 글 / 수정 공통) ── */
export async function submitWrite(reloadData) {
  const reload = typeof reloadData === 'function' ? reloadData : window._reloadData;
  const content = document.getElementById('composeContent').value.trim();
  const catIds  = [...document.querySelectorAll('#composeCatWrap .cat-sel.on')].map(el => el.dataset.id);
  const roomId  = state.currentRoomId || state.rooms?.find(r => r.room_type === 'room')?.id;

  if (!content && (!state.writeFiles || state.writeFiles.length === 0)) {
    showToast('내용이나 사진을 추가해주세요'); return;
  }

  // 기존 이미지 URL (삭제 안 된 것만)
  const existingUrls = [...document.querySelectorAll('#composePrevCells .prev-cell[data-existing]')]
    .map(el => el.dataset.existing);

  // 새 파일 업로드
  let newUrls = [];
  if (state.writeFiles?.length) {
    document.getElementById('composeProgWrap').style.display = 'block';
    newUrls = await uploadMany(state.writeFiles, ({ current, total, percent }) => {
      document.getElementById('composeProgFill').style.width = `${percent}%`;
      document.getElementById('composeProgText').textContent = `${current}/${total} 업로드 중...`;
    });
    document.getElementById('composeProgText').textContent = '완료!';
  }

  const mediaUrls = [...existingUrls, ...newUrls];

  // ── 수정 모드 ──
  if (_editPostId) {
    const data = await apiFetch('/api/posts', {
      method: 'PUT',
      body: {
        post_id:      _editPostId,
        house_id:     state.houseId,
        owner_key:    state.ownerKey,
        content,
        media_urls:   mediaUrls,
        category_ids: catIds,
      }
    });
    if (data) {
      // state.allPosts 즉시 반영
      const idx = state.allPosts.findIndex(p => p.id === _editPostId);
      if (idx !== -1) {
        state.allPosts[idx] = {
          ...state.allPosts[idx],
          content,
          media_urls:   mediaUrls,
          category_ids: catIds,
        };
      }
      showToast('수정됐어요 ✅', 'success');
      document.getElementById('composeModal').classList.remove('open');
      if (typeof reload === 'function') await reload();
    }
    return;
  }

  // ── 새 글 모드 ──
let emotion_tag = null;
if (content) {
  try {
    const emoRes = await fetch('/api/gemini', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'emotion', context: { content } })
    });
    const emoData = await emoRes.json();
    emotion_tag = emoData.emotion || null;
  } catch(e) { /* 실패해도 등록은 계속 */ }
}

const data = await submitPost({ content, mediaUrls, categoryIds: catIds, roomId, emotion_tag });
}
