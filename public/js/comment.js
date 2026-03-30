// public/js/comment.js
import { DEVICE_ID, state } from './common.js';

// ── Reaction 토글 ─────────────────────────────────────────────────────────────
export async function toggleReaction(postId, btn) {
  if (!state.houseId) return;

  btn.disabled = true;
  try {
    const res = await fetch('/api/comment?action=react', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-device-id': DEVICE_ID
      },
      body: JSON.stringify({
        house_id: state.houseId,
        target_id: postId,
        target_type: 'post',
        emoji: '❤️'
      })
    });
    const data = await res.json();

    // 버튼 상태 업데이트
    const count = btn.dataset.count ? parseInt(btn.dataset.count) : 0;
    if (data.reacted) {
      btn.dataset.count = count + 1;
      btn.innerHTML = `❤️ ${count + 1 > 0 ? count + 1 : ''}`;
      btn.style.background = 'rgba(255,100,100,.1)';
      btn.style.borderColor = 'rgba(255,100,100,.3)';
    } else {
      btn.dataset.count = Math.max(0, count - 1);
      const newCount = Math.max(0, count - 1);
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

// ── Reaction 수 로드 ──────────────────────────────────────────────────────────
export async function loadReactions(postIds) {
  if (!postIds.length) return;

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

// ── 포스트 댓글 모달 열기 ─────────────────────────────────────────────────────
export async function openPostComment(postId) {
  // 간단한 방명록 모달 재활용 또는 별도 모달
  // 현재는 토스트로 안내 (Phase 1에서 모달 구현)
  const { showToast } = await import('./common.js');
  showToast('댓글 기능은 곧 추가돼요 💬');
}

// ── window에 등록 (house.html에서 onclick으로 호출) ───────────────────────────
window.toggleReaction  = toggleReaction;
window.openPostComment = openPostComment;