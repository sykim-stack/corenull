// public/tabs/room.js
import { state, DEVICE_ID, showToast, apiFetch, renderPost, renderPostList, timeAgo, escHtml } from '/public/js/common.js';
import { openCatMgr } from '/public/js/features/cat-mgr.js';

// ── 카테고리 필터 ─────────────────────────────────────────────────────────
export function filterCat(catId, btn) {
  document.querySelectorAll('.cat-chip').forEach(el => el.classList.remove('active'));
  btn?.classList.add('active');
  state.activeCat = catId === 'all' ? null : catId;

  const opts = state._currentRoomOpts;
  if (!opts) return;

  const posts = _getFilteredPosts(opts, catId === 'all' ? null : catId);
  renderPostList(posts, `roomPostList-${opts.meta.roomId}`);
  const postIds = posts.map(p => p.id).filter(Boolean);
  if (postIds.length) loadReactions(postIds);
  if (postIds.length) loadCommentCounts(postIds);
}

// ── 포스트 필터링 ─────────────────────────────────────────────────────────
function _getFilteredPosts(opts, overrideCatId) {
  const catId = overrideCatId !== undefined ? overrideCatId : opts.filter?.categoryId;
  const posts = (state.allPosts || []).filter(p => p.room_id === opts.meta.roomId);
  if (!catId) return posts;
  return posts.filter(p => (p.category_ids || []).map(String).includes(String(catId)));
}

// ── 이벤트 날짜 기준 정렬 (진행 중 앞, 완료 뒤) ──────────────────────────
function _sortedCats(cats) {
  const now = new Date();
  return [...cats].sort((a, b) => {
    if (!a.event_date && !b.event_date) return 0;
    if (!a.event_date) return -1;  // 날짜 없는 일반 분류 앞
    if (!b.event_date) return 1;
    const aFuture = new Date(a.event_date) >= now;
    const bFuture = new Date(b.event_date) >= now;
    if (aFuture && !bFuture) return -1;  // 진행 중 앞
    if (!aFuture && bFuture) return 1;   // 완료 뒤
    return new Date(a.event_date) - new Date(b.event_date);
  });
}

// ── 메인 렌더 ─────────────────────────────────────────────────────────────
export function renderRoom(container, room, opts = {}) {
  state._currentRoomOpts = opts;

  const cats   = state.categories || [];
  const filter = opts.filter || {};

  const normal = cats.filter(c => !c.is_event);
  const events = _sortedCats(cats.filter(c => c.is_event));
  const now    = new Date();

  // ── 칩 HTML (날짜 제거, 깔끔하게) ────────────────────────────────────────
  const makeChip = (c, isEvent) => {
    const isActive  = filter.categoryId === c.id;
    const isDone    = isEvent && c.event_date && new Date(c.event_date) < now;
    const isToday   = isEvent && c.event_date && Math.abs(new Date(c.event_date) - now) < 86400000;

    let cls = 'cat-chip';
    if (isEvent) cls += ' cat-chip-event';
    if (isDone)  cls += ' cat-chip-done';
    if (isActive) cls += ' active';

    const label = isEvent ? `🎉 ${c.name}` : c.name;
    const badge = isToday ? '<span class="cat-chip-badge">D-DAY</span>' : '';

    return `<button class="${cls}" data-cat="${c.id}" onclick="filterCat('${c.id}',this)">${label}${badge}</button>`;
  };

  const allChip = `<button class="cat-chip${!filter.categoryId ? ' active' : ''}" data-cat="all" onclick="filterCat('all',this)">전체</button>`;
  const gearBtn = state.isOwner
    ? `<button class="cat-gear-btn" onclick="openCatMgr()" title="분류 관리">⚙️</button>`
    : '';

  const catHtml = `
    <div class="cat-bar-wrap">
      <div class="cat-bar" id="catBar">
        ${allChip}
        ${normal.map(c => makeChip(c, false)).join('')}
        ${events.length ? `<span class="cat-bar-sep"></span>${events.map(c => makeChip(c, true)).join('')}` : ''}
      </div>
      ${gearBtn}
    </div>`;

  container.innerHTML = `
    <div class="section">
      <div class="sec-head" style="margin-bottom:16px;">
        <div>
          <div class="sec-label">ROOM</div>
          <div class="sec-title">${room.room_name}</div>
        </div>
        <div style="display:flex;gap:8px;">
          ${state.isOwner ? `
            <button class="more-btn" onclick="openShareModal('${room.id}')">🔗 공유</button>
            <button class="more-btn" onclick="state.currentRoomId='${room.id}';openWriteModal()">+ 글쓰기</button>
          ` : ''}
        </div>
      </div>
      ${catHtml}
      <div id="roomPostList-${opts.meta?.roomId}"></div>
    </div>`;

  _injectCatBarStyles();

  const posts = _getFilteredPosts(opts);
  renderPostList(posts, `roomPostList-${opts.meta?.roomId}`);

  const postIds = posts.map(p => p.id).filter(Boolean);
  if (postIds.length) loadReactions(postIds);
  if (postIds.length) loadCommentCounts(postIds);
}

// ── cat-bar 스타일 주입 ───────────────────────────────────────────────────
function _injectCatBarStyles() {
  if (document.getElementById('__catBarStyle')) return;
  const s = document.createElement('style');
  s.id = '__catBarStyle';
  s.textContent = `
    /* ── cat-bar 래퍼 ── */
    .cat-bar-wrap {
      display: flex;
      align-items: center;
      gap: 8px;
      margin-bottom: 20px;
    }

    /* ── 가로 스크롤 바 ── */
    .cat-bar {
      display: flex;
      align-items: center;
      gap: 7px;
      overflow-x: auto;
      -webkit-overflow-scrolling: touch;
      scrollbar-width: none;
      flex: 1;
      /* 오른쪽 페이드 힌트 (더 있음 암시) */
      -webkit-mask-image: linear-gradient(to right, black 80%, transparent 100%);
      mask-image: linear-gradient(to right, black 80%, transparent 100%);
      padding-bottom: 4px;
      padding-right: 24px; /* 마지막 칩 살짝 잘리게 */
    }
    .cat-bar::-webkit-scrollbar { display: none; }

    /* ── 기본 칩 ── */
    .cat-chip {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      background: var(--warm, #F7EEE3);
      border: 1.5px solid rgba(139,94,60,.15);
      border-radius: 20px;
      padding: 7px 14px;
      font-size: 13px;
      color: var(--muted, #9B8B7E);
      cursor: pointer;
      white-space: nowrap;
      font-family: 'Gowun Dodum', serif;
      transition: all .15s;
      flex-shrink: 0;
      position: relative;
      /* 터치 타겟 최소 44px */
      min-height: 36px;
    }
    .cat-chip:hover:not(.active) {
      background: var(--peach, #F2C4A0);
      color: var(--brown, #8B5E3C);
    }
    .cat-chip.active {
      background: var(--cb-bg, #1a1a1a);
      color: var(--cb-accent, #C9A84C);
      border-color: transparent;
    }

    /* ── 이벤트 칩 ── */
    .cat-chip-event {
      border-style: dashed;
      border-color: rgba(196,120,75,.35);
      color: var(--room-event, #C4784B);
    }
    .cat-chip-event.active {
      background: var(--room-event, #C4784B);
      color: white;
      border-style: solid;
      border-color: transparent;
    }
    /* 완료된 이벤트 칩 — 흐리게 */
    .cat-chip-event.cat-chip-done {
      opacity: .45;
      filter: grayscale(.4);
    }
    .cat-chip-event.cat-chip-done.active {
      opacity: 1;
      filter: none;
    }

    /* D-DAY 뱃지 */
    .cat-chip-badge {
      display: inline-block;
      background: var(--gold, #C9A84C);
      color: white;
      font-size: 9px;
      font-weight: 700;
      letter-spacing: .5px;
      border-radius: 8px;
      padding: 1px 5px;
      margin-left: 2px;
      vertical-align: middle;
    }

    /* ── 구분선 ── */
    .cat-bar-sep {
      width: 1px;
      height: 16px;
      background: rgba(139,94,60,.2);
      flex-shrink: 0;
      margin: 0 2px;
    }

    /* ── ⚙️ 관리 버튼 (오너 전용) ── */
    .cat-gear-btn {
      background: var(--warm, #F7EEE3);
      border: 1.5px solid rgba(139,94,60,.15);
      border-radius: 10px;
      width: 36px;
      height: 36px;
      font-size: 16px;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
      transition: background .15s;
    }
    .cat-gear-btn:hover {
      background: var(--peach, #F2C4A0);
    }
  `;
  document.head.appendChild(s);
}

// ── 댓글 카운트 로드 ──────────────────────────────────────────────────────
export async function loadCommentCounts(postIds) {
  if (!postIds?.length) return;
  await Promise.all(postIds.map(async (id) => {
    const data = await apiFetch(`/api/comment?house_id=${state.houseId}&post_id=${id}`, { silent: true });
    const count = (data?.comments || []).length;
    const btn = document.querySelector(`[data-comment-id="${id}"]`);
    if (!btn || count === 0) return;
    btn.dataset.count = count;
    btn.innerHTML = `💬 ${count}`;
  }));
}

// ── Reaction 토글 ─────────────────────────────────────────────────────────
export async function toggleReaction(postId, btn) {
  if (!state.houseId) return;
  btn.disabled = true;
  try {
    const data = await apiFetch('/api/comment', {
      method: 'POST',
      headers: { 'x-device-id': DEVICE_ID },
      body: { action: 'react', house_id: state.houseId, target_id: postId, target_type: 'post', emoji: '❤️' }
    });
    if (!data) return;
    const count = data.count || 0;
    if (data.reacted) {
      btn.dataset.count = count;
      btn.innerHTML = `❤️ ${count > 0 ? count : ''}`;
      btn.style.background  = 'rgba(255,100,100,.1)';
      btn.style.borderColor = 'rgba(255,100,100,.3)';
    } else {
      btn.dataset.count = count;
      btn.innerHTML = count > 0 ? `🤍 ${count}` : '🤍';
      btn.style.background  = 'none';
      btn.style.borderColor = 'rgba(139,94,60,.15)';
    }
  } finally {
    btn.disabled = false;
  }
}

// ── Reaction 수 로드 ──────────────────────────────────────────────────────
export async function loadReactions(postIds) {
  if (!postIds?.length) return;
  await Promise.all(postIds.map(async (id) => {
    const data = await apiFetch(
      `/api/comment?action=react&target_id=${id}&target_type=post`,
      { headers: { 'x-device-id': DEVICE_ID }, silent: true }
    );
    const btn = document.querySelector(`[data-reaction-id="${id}"]`);
    if (!btn || !data) return;
    btn.dataset.count = data.count || 0;
    if (data.reacted) {
      btn.innerHTML = `❤️ ${data.count > 0 ? data.count : ''}`;
      btn.style.background  = 'rgba(255,100,100,.1)';
      btn.style.borderColor = 'rgba(255,100,100,.3)';
    } else {
      btn.innerHTML = data.count > 0 ? `🤍 ${data.count}` : '🤍';
    }
  }));
}

// ── 포스트 댓글 열기 ──────────────────────────────────────────────────────
export async function openPostComment(postId) {
  const existing = document.getElementById(`comments-${postId}`);
  if (existing) { existing.remove(); return; }

  const btn  = document.querySelector(`[data-comment-id="${postId}"]`);
  const card = btn?.closest('.post-item');
  if (!card) return;

  const wrap = document.createElement('div');
  wrap.id = `comments-${postId}`;
  wrap.style.cssText = 'border-top:1px solid rgba(139,94,60,.1);padding:12px 16px;background:rgba(247,238,227,.4);';
  wrap.innerHTML = `
    <div id="clist-${postId}" style="margin-bottom:10px;"></div>
    <div style="display:flex;gap:8px;align-items:center;">
      <input id="cinput-${postId}" placeholder="댓글 달기..."
        style="flex:1;border:1px solid rgba(139,94,60,.2);border-radius:20px;padding:8px 14px;
               font-size:13px;font-family:'Gowun Dodum',serif;background:white;outline:none;"
        onkeydown="if(event.key==='Enter')submitPostComment('${postId}')">
      <button onclick="submitPostComment('${postId}')"
        style="background:var(--brown);color:white;border:none;border-radius:20px;
               padding:8px 16px;font-size:12px;cursor:pointer;font-family:'Gowun Dodum',serif;">게시</button>
    </div>`;
  card.appendChild(wrap);
  await loadPostComments(postId);
}

// ── 댓글 로드 ─────────────────────────────────────────────────────────────
async function loadPostComments(postId) {
  const el = document.getElementById(`clist-${postId}`);
  if (!el) return;

  const data = await apiFetch(`/api/comment?house_id=${state.houseId}&post_id=${postId}`, { silent: true });
  const comments = data?.comments || [];

  if (!comments.length) {
    el.innerHTML = `<div style="font-size:12px;color:var(--muted);text-align:center;padding:8px 0;">첫 댓글을 남겨보세요 💬</div>`;
    return;
  }
  el.innerHTML = comments.map(c => `
    <div style="display:flex;gap:8px;margin-bottom:10px;align-items:flex-start;">
      <div style="width:30px;height:30px;border-radius:50%;background:linear-gradient(135deg,var(--pink),var(--peach));
                  display:flex;align-items:center;justify-content:center;font-size:13px;flex-shrink:0;">
        ${c.author_name?.charAt(0) || '?'}
      </div>
      <div style="flex:1;background:white;border-radius:14px;padding:8px 12px;">
        <div style="font-size:12px;font-weight:600;color:var(--dark);margin-bottom:2px;">${escHtml(c.author_name)}</div>
        <div style="font-size:13px;color:var(--text);">${escHtml(c.content ?? '')}</div>
        <div style="font-size:11px;color:var(--muted);margin-top:4px;">${timeAgo(c.created_at)}</div>
      </div>
      ${state.isOwner ? `
        <button onclick="deletePostComment('${c.id}','${postId}')"
          style="background:none;border:none;font-size:14px;cursor:pointer;color:var(--muted);padding:4px;">🗑️</button>` : ''}
    </div>`).join('');
}

// ── 댓글 작성 ─────────────────────────────────────────────────────────────
export async function submitPostComment(postId) {
  const input   = document.getElementById(`cinput-${postId}`);
  const content = input?.value.trim();
  if (!content) return;
  const author = localStorage.getItem('cn_author_name') || '익명';
  input.value    = '';
  input.disabled = true;

  const data = await apiFetch('/api/comment', {
    method: 'POST',
    body: { house_id: state.houseId, author_name: author, content, post_id: postId }
  });

  if (data) {
    await loadPostComments(postId);
    const countBtn = document.querySelector(`[data-comment-id="${postId}"]`);
    if (countBtn) {
      const cur = parseInt(countBtn.dataset.count || '0') + 1;
      countBtn.dataset.count = cur;
      countBtn.innerHTML = `💬 ${cur}`;
    }
  }
  input.disabled = false;
  input.focus();
}

// ── 댓글 삭제 ─────────────────────────────────────────────────────────────
export async function deletePostComment(commentId, postId) {
  const data = await apiFetch('/api/comment', {
    method: 'DELETE',
    body: { comment_id: commentId, house_id: state.houseId }
  });
  if (data) await loadPostComments(postId);
}

// ── 공유 ─────────────────────────────────────────────────────────────────
export function openShareModal(roomId) {
  const url = `${location.origin}${location.pathname}?room=${roomId}`;
  if (navigator.share) {
    navigator.share({ title: document.title, url }).catch(() => {});
  } else {
    navigator.clipboard.writeText(url).then(() => showToast('링크 복사됨 🔗', 'success'));
  }
}

// ── window 노출 ───────────────────────────────────────────────────────────
window.state             = state;
window.filterCat         = filterCat;
window.toggleReaction    = toggleReaction;
window.openPostComment   = openPostComment;
window.submitPostComment = submitPostComment;
window.deletePostComment = deletePostComment;
window.openShareModal    = openShareModal;
window.openCatMgr        = openCatMgr;