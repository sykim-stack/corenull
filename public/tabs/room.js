// common.js 의 renderPost 함수만 교체하세요
// (나머지 코드는 그대로 유지)

export function renderPost(p, opts = {}) {
  const showDel      = opts.showDel  !== undefined ? opts.showDel  : state.isOwner;
  const showTags     = opts.showTags !== undefined ? opts.showTags : true;
  const showActions  = opts.showActions !== undefined ? opts.showActions : true;
  const delay        = opts.delay    || 0;

  const tags = showTags
    ? (p.category_ids || []).map(cid => {
        const c = state.categories.find(x => x.id === cid);
        return c ? `<span class="post-tag" style="background:${c.color || 'var(--mint)'};">${c.name}</span>` : '';
      }).join('')
    : '';

  const imgs    = p.media_urls || [];
  const media   = imgs.length ? renderStoryImgs(imgs, p) : '';
  const postData = encodeURIComponent(JSON.stringify({
    urls: imgs, content: p.content, date: p.created_at, category_ids: p.category_ids
  }));

  // 댓글/관심 버튼 (post.id 있을 때만)
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
      <span class="post-time" style="margin-left:auto;">${timeAgo(p.created_at)}</span>
      ${showDel ? `<button class="post-del" onclick="event.stopPropagation();deletePost('${p.id}')">🗑️</button>` : ''}
    </div>` : `
    <div class="post-foot" style="padding:10px 16px 14px;">
      <span class="post-time">${timeAgo(p.created_at)}</span>
      ${showDel ? `<button class="post-del" onclick="event.stopPropagation();deletePost('${p.id}')">🗑️</button>` : ''}
    </div>`;

  return `<div class="post-item" style="animation-delay:${delay * .05}s;border-radius:18px;overflow:hidden;cursor:pointer;"
      onclick="openPostModal(JSON.parse(decodeURIComponent('${postData}')))">
    ${tags ? `<div class="post-tags" style="padding:12px 16px 0;">${tags}</div>` : ''}
    ${p.content ? `<div class="post-body" style="padding:${tags ? '8px' : '14px'} 16px 0;">${p.content.replace(/\n/g, '<br>')}</div>` : ''}
    ${media}
    ${actionBar}
  </div>`;
}