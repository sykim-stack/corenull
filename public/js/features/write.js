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

/* ── 분류 렌더 (관리 버튼 없는 순수 선택 칩만) ── */
function _renderComposeCats(selectedIds = []) {
  const wrap = document.getElementById('composeCatWrap');
  if (!wrap) return;

  const normal = (state.categories || []).filter(c => !c.is_event);
  const events = (state.categories || []).filter(c =>  c.is_event);

  const makeChip = (c, isEvent) => {
    const sel = selectedIds.map(String).includes(String(c.id));
    const label = isEvent ? `🎉 ${c.name}` : c.name;
    const cls   = `cat-sel${sel ? ' on' : ''}${isEvent ? ' cat-event' : ''}`;
    return `<span class="${cls}" data-id="${c.id}"
      onclick="this.classList.toggle('on')"
      style="--cat-color:${c.color || (isEvent ? '#F7C59F' : 'var(--mint)')}">${label}</span>`;
  };

  // 관리 버튼은 ⚙️ 링크로만 노출
  const gearHint = state.isOwner
    ? `<button class="cat-gear-hint" onclick="import('/public/js/features/cat-mgr.js').then(m=>m.openCatMgr())">⚙️ 관리</button>`
    : '';

  wrap.innerHTML = `
    <div class="compose-cat-chips">
      ${normal.map(c => makeChip(c, false)).join('') || '<span style="font-size:12px;color:var(--muted);">분류 없음</span>'}
      ${events.length ? `<span class="cat-bar-sep" style="height:16px;width:1px;background:rgba(139,94,60,.2);display:inline-block;vertical-align:middle;margin:0 4px;"></span>${events.map(c => makeChip(c, true)).join('')}` : ''}
      ${gearHint}
    </div>`;

  _injectComposeCatStyles();
}

function _injectComposeCatStyles() {
  if (document.getElementById('__composeCatStyle')) return;
  const s = document.createElement('style');
  s.id = '__composeCatStyle';
  s.textContent = `
    .compose-cat-chips {
      display: flex;
      flex-wrap: wrap;
      gap: 7px;
      align-items: center;
    }
    .cat-sel {
      display: inline-flex;
      align-items: center;
      padding: 5px 13px;
      border-radius: 20px;
      font-size: 12px;
      font-weight: 500;
      cursor: pointer;
      border: 1.5px solid rgba(139,94,60,.2);
      background: var(--warm, #F7EEE3);
      color: var(--muted, #9B8B7E);
      transition: all .15s;
      min-height: 32px;
    }
    .cat-sel:hover:not(.on) { background: var(--peach, #F2C4A0); }
    .cat-sel.on {
      background: var(--cat-color, #A8D8A8);
      border-color: transparent;
      color: #3a2f28;
      font-weight: 600;
    }
    .cat-sel.cat-event {
      border-style: dashed;
      border-color: rgba(200,151,58,.35);
      color: #a07820;
    }
    .cat-sel.cat-event.on {
      background: var(--cat-color, #F7C59F);
      color: #5a3a10;
      border-style: solid;
      border-color: transparent;
    }
    .cat-gear-hint {
      background: none;
      border: 1px dashed rgba(139,94,60,.2);
      border-radius: 20px;
      padding: 4px 10px;
      font-size: 11px;
      color: var(--muted, #9B8B7E);
      cursor: pointer;
      font-family: 'Gowun Dodum', serif;
      transition: all .15s;
      min-height: 28px;
    }
    .cat-gear-hint:hover { background: var(--warm, #F7EEE3); color: var(--brown, #8B5E3C); }
  `;
  document.head.appendChild(s);
}

/* ── 모달 초기화 공통 ── */
function _resetModal() {
  state.writeFiles = [];
  document.getElementById('composeContent').value          = '';
  document.getElementById('composePrevWrap').style.display = 'none';
  document.getElementById('composePrevCells').innerHTML    = '';
  document.getElementById('composeProgWrap').style.display = 'none';
  const emotionWrap = document.getElementById('composeEmotionWrap');
  if (emotionWrap) emotionWrap.dataset.selected = '';
  _renderEmotionChips();
}

/* ── 새 글쓰기 모달 열기 ── */
export function openWriteModal(mode = 'write') {
  _editPostId = null;
  _resetModal();
  _renderComposeCats();

  const modal   = document.getElementById('composeModal');
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

  const modal   = document.getElementById('composeModal');
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

/* ── 감정 태그 결정 ── */
async function _resolveEmotionTag(content) {
  const userSelected = _getSelectedEmotion();
  if (userSelected) return userSelected;
  if (!content) return null;
  try {
    const res  = await fetch('/api/gemini', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'emotion', context: { content } })
    });
    const data = await res.json();
    return data.emotion ?? null;
  } catch(e) {
    return null;
  }
}

/* ── 제출 (새 글 / 수정 공통) ── */
export async function submitWrite(reloadData) {
  const reload  = typeof reloadData === 'function' ? reloadData : window._reloadData;
  const content = document.getElementById('composeContent').value.trim();
  const catIds  = [...document.querySelectorAll('#composeCatWrap .cat-sel.on')].map(el => el.dataset.id);
  const roomId  = state.currentRoomId || state.rooms?.find(r => r.room_type === 'room')?.id;

  if (!content && (!state.writeFiles || state.writeFiles.length === 0)) {
    showToast('내용이나 사진을 추가해주세요'); return;
  }

  const existingUrls = [...document.querySelectorAll('#composePrevCells .prev-cell[data-existing]')]
    .map(el => el.dataset.existing);

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
        state.allPosts[idx] = { ...state.allPosts[idx], content, media_urls: mediaUrls, category_ids: catIds, emotion_tag };
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