// public/tabs/room.js
import { state, DEVICE_ID, showToast, renderPost, renderPostList, timeAgo, escHtml } from '/public/js/common.js';

// ── 방 렌더 ───────────────────────────────────────────────────────────────
export function renderRoom(container, room) {
  const posts = state.allPosts.filter(p => p.room_id === room.id);
  const cats = state.categories || [];
  
  const catHtml = cats.length ? `
    <div class="cat-filter" style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:16px;">
      <button class="cat-chip active" data-cat="all" onclick="filterCat('all',this)">전체</button>
      ${cats.map(c => `<button class="cat-chip" data-cat="${c.id}" onclick="filterCat('${c.id}',this)"
        style="--cat-color:${c.color||'var(--mint)'};">${c.name}</button>`).join('')}
    </div>` : '';

  container.innerHTML = `
    <div class="section">
      <div class="sec-head" style="margin-bottom:16px;">
        <div><div class="sec-label">ROOM</div><div class="sec-title">${room.room_name}</div></div>
        ${state.isOwner ? `<button class="more-btn" onclick="state.currentRoomId='${room.id}';openWriteModal()">+ 글쓰기</button>` : ''}
      </div>
      ${catHtml}
      <div id="roomPostList-${room.id}"></div>
    </div>`;

  renderPostList(posts, `roomPostList-${room.id}`);
  const postIds = posts.map(p => p.id).filter(Boolean);
  if (postIds.length) loadReactions(postIds);
  if (postIds.length) loadCommentCounts(postIds);  // 추가
}
// ── 댓글 카운트 로드 (집주인만) ───────────────────────────────────────────
export async function loadCommentCounts(postIds) {
  if (!postIds?.length || !state.isOwner) return;
  await Promise.all(postIds.map(async (id) => {
    try {
      const res = await fetch(`/api/comment?house_id=${state.houseId}&post_id=${id}`);
      const data = await res.json();
      const count = (data.comments || []).length;
      const btn = document.querySelector(`[data-comment-id="${id}"]`);
      if (!btn || count === 0) return;
      btn.dataset.count = count;
      btn.innerHTML = `💬 ${count}`;
    } catch (e) {}
  }));
}

// ── 카테고리 필터 ─────────────────────────────────────────────────────────
export function filterCat(catId, btn) {
  document.querySelectorAll('.cat-chip').forEach(el => el.classList.remove('active'));
  btn?.classList.add('active');
  state.activeCat = catId === 'all' ? null : catId;

  const room = state.rooms.find(r => r.room_type === 'room');
  if (!room) return;
  const posts = catId === 'all'
    ? state.allPosts.filter(p => p.room_id === room.id)
    : state.allPosts.filter(p => p.room_id === room.id && (p.category_ids || []).includes(catId));

  renderPostList(posts, `roomPostList-${room.id}`);
  const postIds = posts.map(p => p.id).filter(Boolean);
  if (postIds.length) loadReactions(postIds);
  if (postIds.length) loadCommentCounts(postIds);  // 추가
}

// ── Reaction 토글 ─────────────────────────────────────────────────────────
export async function toggleReaction(postId, btn) {
  if (!state.houseId) return;
  btn.disabled = true;
  try {
    const res = await fetch('/api/comment?action=react', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-device-id': DEVICE_ID },
      body: JSON.stringify({ house_id: state.houseId, target_id: postId, target_type: 'post', emoji: '❤️' })
    });
    const data = await res.json();
    const count = parseInt(btn.dataset.count || '0');
    if (data.reacted) {
      btn.dataset.count = count + 1;
      btn.innerHTML = `❤️ ${count + 1}`;
      btn.style.background = 'rgba(255,100,100,.1)';
      btn.style.borderColor = 'rgba(255,100,100,.3)';
    } else {
      const newCount = Math.max(0, count - 1);
      btn.dataset.count = newCount;
      btn.innerHTML = newCount > 0 ? `🤍 ${newCount}` : '🤍';
      btn.style.background = 'none';
      btn.style.borderColor = 'rgba(139,94,60,.15)';
    }
  } catch (e) { console.error('reaction 실패', e); }
  finally { btn.disabled = false; }
}

// ── Reaction 수 로드 ──────────────────────────────────────────────────────
export async function loadReactions(postIds) {
  if (!postIds?.length) return;
  await Promise.all(postIds.map(async (id) => {
    try {
      const res = await fetch(`/api/comment?action=react&target_id=${id}&target_type=post`,
        { headers: { 'x-device-id': DEVICE_ID } });
      const data = await res.json();
      const btn = document.querySelector(`[data-reaction-id="${id}"]`);
      if (!btn) return;
      btn.dataset.count = data.count || 0;
      if (data.reacted) {
        btn.innerHTML = `❤️ ${data.count > 0 ? data.count : ''}`;
        btn.style.background = 'rgba(255,100,100,.1)';
        btn.style.borderColor = 'rgba(255,100,100,.3)';
      } else {
        btn.innerHTML = data.count > 0 ? `🤍 ${data.count}` : '🤍';
      }
    } catch (e) {}
  }));
}

// ── 포스트 댓글 열기 (인스타 방식 인라인) ────────────────────────────────
export async function openPostComment(postId) {
  const existing = document.getElementById(`comments-${postId}`);

  // 이미 열려있으면 닫기
  if (existing) { existing.remove(); return; }

  // 포스트 카드 찾기
  const btn = document.querySelector(`[data-comment-id="${postId}"]`);
  const card = btn?.closest('.post-item');
  if (!card) return;

  // 댓글 영역 생성
  const wrap = document.createElement('div');
  wrap.id = `comments-${postId}`;
  wrap.style.cssText = 'border-top:1px solid rgba(139,94,60,.1);padding:12px 16px;background:rgba(247,238,227,.4);';
  wrap.innerHTML = `<div id="clist-${postId}" style="margin-bottom:10px;"></div>
    <div style="display:flex;gap:8px;align-items:center;">
      <input id="cinput-${postId}" placeholder="댓글 달기..."
        style="flex:1;border:1px solid rgba(139,94,60,.2);border-radius:20px;padding:8px 14px;font-size:13px;font-family:'Gowun Dodum',serif;background:white;outline:none;"
        onkeydown="if(event.key==='Enter')submitPostComment('${postId}')">
      <button onclick="submitPostComment('${postId}')"
        style="background:var(--brown);color:white;border:none;border-radius:20px;padding:8px 16px;font-size:12px;cursor:pointer;font-family:'Gowun Dodum',serif;">게시</button>
    </div>`;
  card.appendChild(wrap);

  // 댓글 로드
  await loadPostComments(postId);
}

// ── 댓글 로드 ─────────────────────────────────────────────────────────────
async function loadPostComments(postId) {
  const el = document.getElementById(`clist-${postId}`);
  if (!el) return;

  try {
    const res = await fetch(`/api/comment?house_id=${state.houseId}&post_id=${postId}`);
    const data = await res.json();
    const comments = data.comments || [];

    if (!comments.length) {
      el.innerHTML = `<div style="font-size:12px;color:var(--muted);text-align:center;padding:8px 0;">첫 댓글을 남겨보세요 💬</div>`;
      return;
    }

    el.innerHTML = comments.map(c => `
      <div style="display:flex;gap:8px;margin-bottom:10px;align-items:flex-start;">
        <div style="width:30px;height:30px;border-radius:50%;background:linear-gradient(135deg,var(--pink),var(--peach));display:flex;align-items:center;justify-content:center;font-size:13px;flex-shrink:0;">
          ${c.author_name?.charAt(0) || '?'}
        </div>
        <div style="flex:1;background:white;border-radius:14px;padding:8px 12px;">
          <div style="font-size:12px;font-weight:600;color:var(--dark);margin-bottom:2px;">${escHtml(c.author_name)}</div>
          <div style="font-size:13px;color:var(--text);">${escHtml(c.content)}</div>
          <div style="font-size:11px;color:var(--muted);margin-top:4px;">${timeAgo(c.created_at)}</div>
        </div>
        ${state.isOwner ? `<button onclick="deletePostComment('${c.id}','${postId}')"
          style="background:none;border:none;font-size:14px;cursor:pointer;color:var(--muted);padding:4px;">🗑️</button>` : ''}
      </div>`).join('');
  } catch (e) { console.error('댓글 로드 실패', e); }
}

// ── 댓글 작성 ─────────────────────────────────────────────────────────────
export async function submitPostComment(postId) {
  const input = document.getElementById(`cinput-${postId}`);
  const content = input?.value.trim();
  if (!content) return;

  const author = localStorage.getItem('cn_author_name') || '익명';
  input.value = '';
  input.disabled = true;

  try {
    const res = await fetch('/api/comment', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ house_id: state.houseId, author_name: author, content, post_id: postId })
    });
    const data = await res.json();
    if (data.success) {
      await loadPostComments(postId);
      // 댓글 카운트 업데이트
      const countBtn = document.querySelector(`[data-comment-id="${postId}"]`);
      if (countBtn) {
        const cur = parseInt(countBtn.dataset.count || '0') + 1;
        countBtn.dataset.count = cur;
        countBtn.innerHTML = `💬 ${cur}`;
      }
    } else showToast(data.error || '댓글 등록 실패');
  } catch (e) { showToast('댓글 등록 실패'); }
  finally { input.disabled = false; input.focus(); }
}

// ── 댓글 삭제 ─────────────────────────────────────────────────────────────
export async function deletePostComment(commentId, postId) {
  try {
    const res = await fetch('/api/comment', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ comment_id: commentId, house_id: state.houseId })
    });
    const data = await res.json();
    if (data.success) await loadPostComments(postId);
    else showToast(data.error || '삭제 실패');
  } catch (e) { showToast('삭제 실패'); }
}