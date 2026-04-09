// public/tabs/room.js
import { state, DEVICE_ID, showToast, apiFetch, renderPost, renderPostList, timeAgo, escHtml } from '/public/js/common.js';

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

// ── 메인 렌더 ─────────────────────────────────────────────────────────────
export function renderRoom(container, room, opts = {}) {
  state._currentRoomOpts = opts;

  const cats   = (state.categories || []).filter(c => !c.is_event);
  const filter = opts.filter || {};

  const makeChip = c =>
    `<button class="cat-chip${filter.categoryId === c.id ? ' active' : ''}"
      data-cat="${c.id}" onclick="filterCat('${c.id}',this)"
      style="--cat-color:${c.color || 'var(--mint)'};">${c.name}</button>`;

  const catHtml = cats.length ? `
    <div class="cat-filter" style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:16px;">
      <button class="cat-chip${!filter.categoryId ? ' active' : ''}" data-cat="all" onclick="filterCat('all',this)">전체</button>
      ${cats.map(makeChip).join('')}
    </div>` : '';

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

  const posts = _getFilteredPosts(opts);
  renderPostList(posts, `roomPostList-${opts.meta?.roomId}`);

  const postIds = posts.map(p => p.id).filter(Boolean);
  if (postIds.length) loadReactions(postIds);
  if (postIds.length) loadCommentCounts(postIds);
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
    if (!data) return; // apiFetch가 이미 토스트 띄움
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

// ── 공유 모달 (stub — house.html의 openShareModal 연결) ──────────────────
export function openShareModal(roomId) {
  const url = `${location.origin}${location.pathname}?room=${roomId}`;
  if (navigator.share) {
    navigator.share({ title: document.title, url }).catch(() => {});
  } else {
    navigator.clipboard.writeText(url).then(() => showToast('링크 복사됨 🔗', 'success'));
  }
}

// ── 유틸 ─────────────────────────────────────────────────────────────────
function fmtDate(str) {
  if (!str) return '';
  const d = new Date(str);
  return `${d.getFullYear()}년 ${d.getMonth() + 1}월 ${d.getDate()}일`;
}

// ── window 노출 (인라인 onclick용) ────────────────────────────────────────
window.filterCat        = filterCat;
window.toggleReaction   = toggleReaction;
window.openPostComment  = openPostComment;
window.submitPostComment = submitPostComment;
window.deletePostComment = deletePostComment;
window.openShareModal   = openShareModal;