// public/js/common.js

// ── 전역 State ────────────────────────────────────────────────────────────────
export const state = {
  slug:       location.pathname.replace(/^\//, '') || 'hajun',
  ownerKey:   new URLSearchParams(location.search).get('owner'),
  isOwner:    false,
  houseId:    null,
  houseData:  null,
  rooms:      [],
  categories: [],
  allMedia:   [],
  allPosts:   [],
  // write modal
  writeFiles:   [],
  uploadFiles:  [],
  // lightbox
  lbImages:  [],
  lbIndex:   0,
  // guestbook
  gbPhotoB64:    null,
  uploadRoomId:  null,
  currentRoomId: null,
  activeCat:     null,
  selectedInterests: [],
};

// ── Device ID ─────────────────────────────────────────────────────────────────
export function getDeviceId() {
  let id = localStorage.getItem('cn_device_id');
  if (!id) {
    id = 'dev_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    localStorage.setItem('cn_device_id', id);
  }
  return id;
}
export const DEVICE_ID = getDeviceId();

// ── 날짜/시간 유틸 ─────────────────────────────────────────────────────────────
export function fmtDate(str) {
  if (!str) return '';
  const d = new Date(str);
  return `${d.getFullYear()}년 ${d.getMonth() + 1}월 ${d.getDate()}일`;
}

export function timeAgo(str) {
  const diff = Date.now() - new Date(str).getTime();
  const m = Math.floor(diff / 60000);
  const h = Math.floor(m / 60);
  const d = Math.floor(h / 24);
  if (d > 0) return `${d}일 전`;
  if (h > 0) return `${h}시간 전`;
  if (m > 0) return `${m}분 전`;
  return '방금';
}

// ── 문자열 유틸 ───────────────────────────────────────────────────────────────
export function escHtml(str) {
  return (str || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
}

// ── 이미지 유틸 ───────────────────────────────────────────────────────────────
export async function resizeImg(file, maxW = 1200) {
  return new Promise(resolve => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      const s = Math.min(1, maxW / img.width);
      const c = document.createElement('canvas');
      c.width  = img.width  * s;
      c.height = img.height * s;
      c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
      URL.revokeObjectURL(url);
      resolve(c.toDataURL('image/jpeg', .85));
    };
    img.src = url;
  });
}

export async function b64Blob(b64) {
  return await (await fetch(b64)).blob();
}

// ── Toast ─────────────────────────────────────────────────────────────────────
export function showToast(msg) {
  const t = document.getElementById('toast');
  if (!t) return;
  t.textContent = msg;
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 2500);
}

// ── Confirm Dialog ────────────────────────────────────────────────────────────
export function openConfirm(title, sub, onOk) {
  document.getElementById('confirmTitle').textContent = title;
  document.getElementById('confirmSub').textContent   = sub;
  document.getElementById('confirmOk').onclick = () => { closeConfirm(); onOk(); };
  document.getElementById('confirmOverlay').classList.add('open');
}

export function closeConfirm() {
  document.getElementById('confirmOverlay').classList.remove('open');
}

// ── Modal ─────────────────────────────────────────────────────────────────────
export function closeModal(id, e) {
  if (!e || e.target === document.getElementById(id)) {
    document.getElementById(id)?.classList.remove('open');
  }
}

// ── Post 렌더러 (공통) ────────────────────────────────────────────────────────
export function renderStoryImgs(urls, post) {
  const count = urls.length;
  const img = u => `<img src="${u}" loading="lazy">`;
  if (count === 1) return `<div class="story-imgs one">${img(urls[0])}</div>`;
  if (count === 2) return `<div class="story-imgs two">${img(urls[0])}${img(urls[1])}</div>`;
  if (count === 3) return `<div class="story-imgs three">${img(urls[0])}${img(urls[1])}${img(urls[2])}</div>`;
  if (count === 4) return `<div class="story-imgs four">${urls.map(img).join('')}</div>`;
  const show = urls.slice(0, 5);
  const rest = count - 5;
  const topImgs = show.slice(0, 2).map(img).join('');
  const botMid  = show.slice(2, 4).map(img).join('');
  let lastCell;
  if (rest > 0) {
    const cardStr = encodeURIComponent(JSON.stringify({ urls, content: post.content, date: post.created_at, category_ids: post.category_ids }));
    lastCell = `<div class="more-cell">${img(show[4])}<div class="more-badge" onclick="event.stopPropagation();openPostModal(JSON.parse(decodeURIComponent('${cardStr}')))">+${rest + 1}</div></div>`;
  } else {
    lastCell = img(show[4]);
  }
  return `<div class="story-imgs many"><div class="row-top">${topImgs}</div><div class="row-bot">${botMid}${lastCell}</div></div>`;
}

// common.js 의 renderPost 함수만 교체하세요
// (나머지 코드는 그대로 유지)
 
export function renderPost(p, opts = {}) {
  const showDel     = opts.showDel  !== undefined ? opts.showDel  : state.isOwner;
  const showTags    = opts.showTags !== undefined ? opts.showTags : true;
  const showActions = opts.showActions !== undefined ? opts.showActions : true;
  const delay       = opts.delay || 0;

  const tags = showTags
    ? (p.category_ids || []).map(cid => {
        const c = state.categories.find(x => x.id === cid);
        return c ? `<span class="post-tag" style="background:${c.color||'var(--mint)'};">${c.name}</span>` : '';
      }).join('')
    : '';

  const imgs   = p.media_urls || [];
  const media  = imgs.length ? renderStoryImgs(imgs, p) : '';
  const postData = encodeURIComponent(JSON.stringify({
    postId: p.id,   // ← 이거 추가
    urls: imgs, content: p.content, date: p.created_at, category_ids: p.category_ids
  }));

  // 미디어/텍스트 클릭 → 모달 (액션바는 클릭 안됨)
  const clickable = imgs.length > 0;

  const actionBar = (showActions && p.id) ? `
    <div class="post-actions" style="display:flex;align-items:center;gap:8px;padding:0 16px 14px;">
      <button class="reaction-btn" data-reaction-id="${p.id}"
        onclick="event.stopPropagation();toggleReaction('${p.id}',this)"
        style="display:flex;align-items:center;gap:4px;background:none;border:1px solid rgba(139,94,60,.15);border-radius:20px;padding:6px 12px;font-size:12px;cursor:pointer;color:var(--brown);transition:all .2s;">
        🤍
      </button>
      <button class="comment-btn" data-comment-id="${p.id}" data-count="0"
        onclick="event.stopPropagation();openPostComment('${p.id}')"
        style="display:flex;align-items:center;gap:4px;background:none;border:1px solid rgba(139,94,60,.15);border-radius:20px;padding:6px 12px;font-size:12px;cursor:pointer;color:var(--brown);transition:all .2s;">
        💬
      </button>
      <button class="share-post-btn" data-post-id="${p.id}"
        onclick="event.stopPropagation();sharePost('${p.id}',this)"
        style="display:flex;align-items:center;gap:4px;background:none;border:1px solid rgba(139,94,60,.15);border-radius:20px;padding:6px 12px;font-size:12px;cursor:pointer;color:var(--brown);transition:all .2s;">
        🔗
      </button>
      <span class="post-time" style="margin-left:auto;">${timeAgo(p.created_at)}</span>
      ${showDel ? `<button class="post-del" onclick="event.stopPropagation();deletePost('${p.id}')">🗑️</button>` : ''}
    </div>` : `

  // 미디어만 클릭 가능하게 — 텍스트+액션은 클릭 전파 없음
  const mediaHtml = imgs.length
    ? `<div onclick="openPostModal(JSON.parse(decodeURIComponent('${postData}')))" style="cursor:zoom-in;">${media}</div>`
    : '';

  return `<div class="post-item" style="animation-delay:${delay * .05}s;">
    ${tags ? `<div class="post-tags">${tags}</div>` : ''}
    ${p.content ? `<div class="post-body">${p.content.replace(/\n/g,'<br>')}</div>` : ''}
    ${mediaHtml}
    ${actionBar}
  </div>`;
}

export function renderPostList(posts, containerId = 'postList') {
  const el = document.getElementById(containerId);
  if (!el) return;
  if (!posts.length) {
    el.innerHTML = `<div class="empty"><div class="ei">📝</div><p>아직 글이 없어요${state.isOwner ? '<br>첫 번째 글을 써보세요!' : ''}</p></div>`;
    return;
  }
  el.innerHTML = posts.map((p, i) => renderPost(p, { delay: i })).join('');
}

// ── 상수 ──────────────────────────────────────────────────────────────────────
export const ROOM_META = {
  living:  { icon: '🛋️', label: '거실' },
  room:    { icon: '🚪', label: '방' },
  library: { icon: '📚', label: '서재' },
  event:   { icon: '🎂', label: null },
  storage: { icon: '📦', label: '창고' },
};

export const MILESTONE_DEFAULTS = {
  baby: [
    { title: '태어난 날',      memo: '⭐', milestone_date: '2025-12-22' },
    { title: '첫 미소',        memo: '😊', milestone_date: null },
    { title: '백일',           memo: '🎂', milestone_date: '2026-03-31' },
    { title: '첫 뒤집기',      memo: '🔄', milestone_date: null },
    { title: '예방접종',       memo: '💉', milestone_date: null },
    { title: '첫 걸음마',      memo: '👣', milestone_date: null },
    { title: '첫 단어',        memo: '💬', milestone_date: null },
    { title: '첫 번째 생일',   memo: '🎁', milestone_date: '2026-12-22' },
  ],
  pet:     [{ title: '입양일', memo: '🐾', milestone_date: null }],
  travel:  [{ title: '첫 여행', memo: '✈️', milestone_date: null }],
  fitness: [{ title: '시작일', memo: '💪', milestone_date: null }],
  daily:   [],
};

export const CAT_META = {
  baby:    { badge: '👶 BABY HOUSE', emoji: '👶', ph: '👶' },
  pet:     { badge: '🐾 PET HOUSE',  emoji: '🐾', ph: '🐾' },
  travel:  { badge: '✈️ TRAVEL',     emoji: '✈️', ph: '✈️' },
  fitness: { badge: '💪 FITNESS',    emoji: '💪', ph: '💪' },
  daily:   { badge: '🏠 DAILY',      emoji: '🏠', ph: '🏠' },
};