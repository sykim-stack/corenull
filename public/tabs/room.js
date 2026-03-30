// public/tabs/room.js
import { state, DEVICE_ID, showToast, renderPost, renderPostList, timeAgo, escHtml } from '/public/js/common.js';

// ── 방 렌더 ───────────────────────────────────────────────────────────────
export function renderRoom(container, room) {
  const posts = state.allPosts.filter(p => p.room_id === room.id);
  const cats  = state.categories;

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

  // reaction 로드
  const postIds = posts.map(p => p.id).filter(Boolean);
  if (postIds.length) loadReactions(postIds);
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
}

// ── Reaction 토글 ─────────────────────────────────────────────────────────
export async function toggleReaction(postId, btn) {
  if (!state.houseId) return;
  btn.disabled = true;
  try {
    const res = await fetch('/api/comment?action=react', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-device-id': DEVICE_ID },
      body: JSON.stringify({
        house_id: state.houseId,
        target_id: postId,
        target_type: 'post',
        emoji: '❤️'
      })
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
  } catch (e) {
    console.error('reaction 실패', e);
  } finally {
    btn.disabled = false;
  }
}

// ── Reaction 수 로드 ──────────────────────────────────────────────────────
export async function loadReactions(postIds) {
  if (!postIds?.length) return;
  await Promise.all(postIds.map(async (id) => {
    try {
      const res = await fetch(
        `/api/comment?action=react&target_id=${id}&target_type=post`,
        { headers: { 'x-device-id': DEVICE_ID } }
      );
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

// ── 포스트 댓글 열기 (Phase 1 예정) ──────────────────────────────────────
export function openPostComment(postId) {
  showToast('댓글 기능은 곧 추가돼요 💬');
}

export function submitPostComment() {}
export function deletePostComment() {}