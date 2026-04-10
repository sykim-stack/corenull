// ── public/js/features/write.js ───────────────────────────────────────────
import { state, showToast, apiFetch, resizeImg } from '/public/js/common.js';
import { submitPost } from '/public/js/api.js';
import { uploadMany } from '/public/js/core/upload.js';

// ── 편집 중인 post_id (null이면 새 글) ───────────────────────────────────
let _editPostId = null;

// 감정 칩 목록
const EMOTION_CHIPS = [
  { key: 'happy',    emoji: '😊', label: '행복' },
  { key: 'sad',      emoji: '😢', label: '슬픔' },
  { key: 'love',     emoji: '🥰', label: '사랑' },
  { key: 'funny',    emoji: '😂', label: '웃김' },
  { key: 'touching', emoji: '🥺', label: '뭉클' },
];

/* ── 감정 칩 렌더 ── */
function _renderEmotionChips(selectedKey = null) {
  const wrap = document.getElementById('composeEmotionWrap');
  if (!wrap) return;

  wrap.innerHTML = EMOTION_CHIPS.map(c =>
    `<button type="button"
       class="emotion-chip${selectedKey === c.key ? ' on' : ''}"
       data-emotion="${c.key}"
       onclick="window._toggleEmotion('${c.key}', this)">
       ${c.emoji} ${c.label}
     </button>`
  ).join('');
}

window._toggleEmotion = (key, el) => {
  const wrap = document.getElementById('composeEmotionWrap');
  wrap.querySelectorAll('.emotion-chip').forEach(c => c.classList.remove('on'));
  // 이미 선택된 것을 다시 누르면 선택 해제
  if (el.dataset.emotion === wrap.dataset.selected) {
    wrap.dataset.selected = '';
  } else {
    el.classList.add('on');
    wrap.dataset.selected = key;
  }
};

function _getSelectedEmotion() {
  const wrap = document.getElementById('composeEmotionWrap');
  return wrap?.dataset.selected || null;
}

/* ── 분류 렌더 ── */
function _renderComposeCats(selectedIds = []) {
  const wrap = document.getElementById('composeCatWrap');
  if (!wrap) return;

  const normal = (state.categories || []).filter(c => !c.is_event);
  const events = (state.categories || []).filter(c =>  c.is_event);

  // 일반 분류 칩 — owner면 수정/삭제 버튼 포함
  const makeNormalChip = c => {
    const sel = selectedIds.map(String).includes(String(c.id));
    if (state.isOwner) {
      return `<span class="cat-sel cat-editable${sel ? ' on' : ''}" data-id="${c.id}"
        style="--cat-color:${c.color || 'var(--mint)'};">
        <span onclick="this.parentElement.classList.toggle('on')">${c.name}</span>
        <button class="cat-edit-btn" onclick="event.stopPropagation();window._openEditCat('${c.id}','${c.name.replace(/'/g,"\\'")}')">✏️</button>
        <button class="cat-edit-btn" onclick="event.stopPropagation();window._deleteCat('${c.id}','${c.name.replace(/'/g,"\\'")}')">🗑️</button>
      </span>`;
    }
    return `<span class="cat-sel${sel ? ' on' : ''}" data-id="${c.id}"
      onclick="this.classList.toggle('on')"
      style="--cat-color:${c.color || 'var(--mint)'};">${c.name}</span>`;
  };

  // 이벤트 칩 — 날짜 표시 + owner면 수정/삭제
  const makeEventChip = c => {
    const sel = selectedIds.map(String).includes(String(c.id));
    const dateStr = c.event_date ? `<span style="font-size:10px;opacity:.7;margin-left:2px;">${c.event_date.slice(5).replace('-','/')}</span>` : '';
    if (state.isOwner) {
      return `<span class="cat-sel cat-event cat-editable${sel ? ' on' : ''}" data-id="${c.id}"
        style="--cat-color:${c.color || '#F7C59F'};">
        <span onclick="this.parentElement.classList.toggle('on')">🎉 ${c.name}${dateStr}</span>
        <button class="cat-edit-btn" onclick="event.stopPropagation();window._openEditEvent('${c.id}','${c.name.replace(/'/g,"\\'")}','${c.event_date||''}')">✏️</button>
        <button class="cat-edit-btn" onclick="event.stopPropagation();window._deleteCat('${c.id}','${c.name.replace(/'/g,"\\'")}')">🗑️</button>
      </span>`;
    }
    return `<span class="cat-sel cat-event${sel ? ' on' : ''}" data-id="${c.id}"
      onclick="this.classList.toggle('on')"
      style="--cat-color:${c.color || '#F7C59F'};">🎉 ${c.name}${dateStr}</span>`;
  };

  wrap.innerHTML = `
    <div class="cat-group">
      <div class="cat-chips" id="catNormalChips">
        ${normal.map(makeNormalChip).join('') || '<span class="cat-empty">분류 없음</span>'}
        ${state.isOwner ? '<button class="cat-add-btn" id="btnAddCat" onclick="window._openAddCat()">+ 분류</button>' : ''}
      </div>
    </div>
    ${events.length ? `
    <div class="cat-divider"></div>
    <div class="cat-group">
      <div class="cat-chips" id="catEventChips">
        ${events.map(makeEventChip).join('')}
        ${state.isOwner ? '<button class="cat-add-btn cat-add-event" id="btnAddEvent" onclick="window._openAddEvent()">+ 이벤트</button>' : ''}
      </div>
    </div>` : `
    <div class="cat-divider"></div>
    <div class="cat-group">
      <div class="cat-chips">
        ${state.isOwner ? '<button class="cat-add-btn cat-add-event" onclick="window._openAddEvent()">+ 이벤트</button>' : ''}
      </div>
    </div>`}
    <div id="catInlineForm" style="display:none;" class="cat-inline-form">
      <input id="catInlineName" placeholder="이름" maxlength="20" />
      <input id="catInlineDate" type="date" style="display:none;" />
      <button onclick="window._submitAddCat()">추가</button>
      <button onclick="document.getElementById('catInlineForm').style.display='none'">✕</button>
    </div>
    <div id="catEditForm" style="display:none;" class="cat-inline-form">
      <input id="catEditName" placeholder="이름" maxlength="20" />
      <input id="catEditDate" type="date" style="display:none;" />
      <button onclick="window._submitEditCat()">저장</button>
      <button onclick="document.getElementById('catEditForm').style.display='none'">✕</button>
    </div>
  `;
}

/* ── 인라인 분류 추가 ── */
window._openAddCat = () => {
  const form = document.getElementById('catInlineForm');
  form.dataset.mode = 'normal';
  document.getElementById('catInlineDate').style.display = 'none';
  document.getElementById('catInlineName').value = '';
  form.style.display = 'flex';
  document.getElementById('catInlineName').focus();
};

window._openAddEvent = () => {
  const form = document.getElementById('catInlineForm');
  form.dataset.mode = 'event';
  document.getElementById('catInlineDate').style.display = 'block';
  document.getElementById('catInlineName').value = '';
  document.getElementById('catInlineDate').value = '';
  form.style.display = 'flex';
  document.getElementById('catInlineName').focus();
};

/* ── 분류 수정 폼 열기 ── */
window._openEditCat = (id, name) => {
  const form = document.getElementById('catEditForm');
  form.dataset.id   = id;
  form.dataset.mode = 'normal';
  document.getElementById('catEditName').value        = name;
  document.getElementById('catEditDate').style.display = 'none';
  form.style.display = 'flex';
  document.getElementById('catEditName').focus();
};

window._openEditEvent = (id, name, date) => {
  const form = document.getElementById('catEditForm');
  form.dataset.id   = id;
  form.dataset.mode = 'event';
  document.getElementById('catEditName').value         = name;
  document.getElementById('catEditDate').value         = date || '';
  document.getElementById('catEditDate').style.display = 'block';
  form.style.display = 'flex';
  document.getElementById('catEditName').focus();
};

/* ── 분류 수정 제출 ── */
window._submitEditCat = async () => {
  const form = document.getElementById('catEditForm');
  const id   = form.dataset.id;
  const name = document.getElementById('catEditName').value.trim();
  const date = document.getElementById('catEditDate').value || null;
  if (!name) { showToast('이름을 입력해주세요'); return; }

  const res = await fetch('/api/categories', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', 'Content-Profile': 'corenull' },
    body: JSON.stringify({ category_id: id, house_id: state.houseId, name, event_date: date })
  });
  const data = await res.json();
  if (data.success) {
    const cat = state.categories.find(c => String(c.id) === String(id));
    if (cat) { cat.name = name; if (date !== undefined) cat.event_date = date; }
    form.style.display = 'none';
    _renderComposeCats([...document.querySelectorAll('#composeCatWrap .cat-sel.on')].map(el => el.dataset.id));
    showToast('수정됐어요 ✅');
  } else {
    showToast(data.error || '수정 실패');
  }
};

/* ── 분류 삭제 ── */
window._deleteCat = async (id, name) => {
  if (!confirm(`"${name}" 분류를 삭제할까요?`)) return;
  const res = await fetch('/api/categories', {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json', 'Content-Profile': 'corenull' },
    body: JSON.stringify({ category_id: id, house_id: state.houseId })
  });
  const data = await res.json();
  if (data.success) {
    state.categories = state.categories.filter(c => String(c.id) !== String(id));
    _renderComposeCats([...document.querySelectorAll('#composeCatWrap .cat-sel.on')].map(el => el.dataset.id).filter(x => x !== id));
    showToast('삭제됐어요 🗑️');
  } else {
    showToast(data.error || '삭제 실패');
  }
};

window._submitAddCat = async () => {
  const input      = document.getElementById('catInlineName');
  const name       = input.value.trim();
  const isEvent    = document.getElementById('catInlineForm').dataset.mode === 'event';
  const event_date = isEvent ? (document.getElementById('catInlineDate').value || null) : null;
  if (!name) { showToast('이름을 입력해주세요'); return; }
  if (isEvent && !event_date) { showToast('이벤트 날짜를 선택해주세요'); return; }

  const res = await fetch('/api/categories', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Content-Profile': 'corenull' },
    body: JSON.stringify({
      house_id:   state.houseId,
      name,
      color:      isEvent ? '#F7C59F' : '#A8D8A8',
      is_event:   isEvent,
      event_date,
      order_num:  (state.categories?.length || 0) + 1
    })
  });

  const data = await res.json();
  if (data.id || data.success) {
    if (!state.categories) state.categories = [];
    state.categories.push({
      id:         data.id || data.data?.id,
      name,
      color:      isEvent ? '#F7C59F' : '#A8D8A8',
      is_event:   isEvent,
      event_date: event_date || null,
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
  // 감정 칩 초기화
  const emotionWrap = document.getElementById('composeEmotionWrap');
  if (emotionWrap) emotionWrap.dataset.selected = '';
  _renderEmotionChips();
}

/* ── 새 글쓰기 모달 열기 ── */
export function openWriteModal(mode = 'write') {
  _editPostId = null;
  _resetModal();
  _renderComposeCats();

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

  document.getElementById('composeContent').value = post.content || '';
  _renderComposeCats(post.category_ids || []);
  // 수정 시 기존 감정 태그 복원
  if (post.emotion_tag) {
    const wrap = document.getElementById('composeEmotionWrap');
    if (wrap) wrap.dataset.selected = post.emotion_tag;
    _renderEmotionChips(post.emotion_tag);
  }

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

  const modal = document.getElementById('composeModal');
  const titleEl = modal?.querySelector('.modal-title');
  if (titleEl) titleEl.textContent = '수정하기 ✏️';
  const submitEl = modal?.querySelector('.modal-submit');
  if (submitEl) submitEl.textContent = '수정 완료';

  document.getElementById('composeModal').classList.add('open');
  setTimeout(() => document.getElementById('composeContent').focus(), 120);
}

window.openPostEditModal = openPostEditModal;

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

/* ── 감정 태그 결정 (사용자 선택 우선, 없으면 Gemini fallback) ── */
async function _resolveEmotionTag(content) {
  // 1순위: 사용자가 직접 선택
  const userSelected = _getSelectedEmotion();
  if (userSelected) return userSelected;

  // 2순위: Gemini 자동 분석 (content 있을 때만)
  if (!content) return null;
  try {
    const res = await fetch('/api/gemini', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'emotion', context: { content } })
    });
    const data = await res.json();
    return data.emotion ?? null;
  } catch(e) {
    console.warn('감정 분석 실패, null로 처리', e);
    return null;
  }
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
    const emotion_tag = await _resolveEmotionTag(content);
    const data = await apiFetch('/api/posts', {
      method: 'PUT',
      body: {
        post_id:      _editPostId,
        house_id:     state.houseId,
        owner_key:    state.ownerKey,
        content,
        media_urls:   mediaUrls,
        category_ids: catIds,
        emotion_tag,
      }
    });
    if (data) {
      const idx = state.allPosts.findIndex(p => p.id === _editPostId);
      if (idx !== -1) {
        state.allPosts[idx] = {
          ...state.allPosts[idx],
          content,
          media_urls:   mediaUrls,
          category_ids: catIds,
          emotion_tag,
        };
      }
      showToast('수정됐어요 ✅', 'success');
      document.getElementById('composeModal').classList.remove('open');
      if (typeof reload === 'function') await reload();
    }
    return;
  }

  // ── 새 글 모드 ──
  const emotion_tag = await _resolveEmotionTag(content);

  const data = await submitPost({ content, mediaUrls, categoryIds: catIds, roomId, emotion_tag });
  if (data?.id || data?.success) {
    showToast('등록됐어요 ✅', 'success');
    document.getElementById('composeModal').classList.remove('open');
    if (typeof reload === 'function') await reload();
  } else {
    showToast(data?.error || '등록 실패', 'error');
  }
}