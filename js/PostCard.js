/**
 * PostCard.js — 렌더링만
 *
 * 규칙:
 * - 순수 함수 (data in → HTML string out)
 * - 상태 변경 없음
 * - API 호출 없음
 * - 레이아웃은 View.js / house.html이 입힘
 */

const PostCard = (() => {

  // ─── post 카드 ────────────────────────────────────────────────────────────
  function post(p) {
    const imgs    = p.media_urls || [];
    const cats    = p.category_ids || [];
    const tags    = cats.map(cid => {
      const c = (Message.state.categories || []).find(x => x.id === cid);
      return c ? `<span class="post-tag" style="background:${c.color||'var(--mint)'};">${c.name}</span>` : '';
    }).join('');

    return `
      <div class="post-item" data-id="${p.id}">
        ${tags ? `<div class="post-tags">${tags}</div>` : ''}
        ${p.content ? `<div class="post-body">${p.content.replace(/\n/g,'<br>')}</div>` : ''}
        ${imgs.length ? _imgs(imgs) : ''}
        <div class="post-foot">
          <span class="post-time">${_ago(p.created_at)}</span>
        </div>
      </div>`;
  }

  // ─── comment 카드 (방명록 / 댓글 동일 구조) ───────────────────────────────
  function comment(c) {
    const flag = c.lang === 'vi' ? '🇻🇳' : '🇰🇷';
    return `
      <div class="feed-item" data-id="${c.id}">
        <div class="feed-head">
          <div class="feed-av">${(c.author_name||'?')[0]}</div>
          <div class="feed-name">${c.author_name||'익명'}</div>
          <div class="feed-flag">${flag}</div>
          <span class="feed-time" style="margin-left:auto;">${_ago(c.created_at)}</span>
        </div>
        ${c.media_url ? `<div class="feed-img"><img src="${c.media_url}"></div>` : ''}
        <div class="feed-body">${(c.content||'').replace(/\n/g,'<br>')}</div>
      </div>`;
  }

  // ─── 방 카드 ──────────────────────────────────────────────────────────────
  function room(r, postCount = 0) {
    const ICONS = { room:'🚪', library:'📚', event:'🎂', living:'🛋️', storage:'📦' };
    const icon  = ICONS[r.room_type] || '🚪';
    const sub   = r.room_type === 'library' ? '사진 보관함' : `글 ${postCount}개`;
    return `
      <div class="room-card" data-id="${r.id}">
        <span class="room-icon">${icon}</span>
        <div class="room-name">${r.room_name}</div>
        <div class="room-sub">${sub}</div>
      </div>`;
  }

  // ─── 이미지 그리드 ────────────────────────────────────────────────────────
  function _imgs(urls) {
    const n   = urls.length;
    const img = u => `<img src="${u}" loading="lazy">`;

    if (n === 1) return `<div class="story-imgs one">${img(urls[0])}</div>`;
    if (n === 2) return `<div class="story-imgs two">${urls.map(img).join('')}</div>`;
    if (n === 3) return `<div class="story-imgs three">${urls.map(img).join('')}</div>`;
    if (n === 4) return `<div class="story-imgs four">${urls.map(img).join('')}</div>`;

    // 5장 이상
    const rest = n - 5;
    const last = rest > 0
      ? `<div class="more-cell">${img(urls[4])}<div class="more-badge">+${rest + 1}</div></div>`
      : img(urls[4]);
    return `
      <div class="story-imgs many">
        <div class="row-top">${urls.slice(0,2).map(img).join('')}</div>
        <div class="row-bot">${urls.slice(2,4).map(img).join('')}${last}</div>
      </div>`;
  }

  // ─── 시간 포맷 ────────────────────────────────────────────────────────────
  function _ago(str) {
    if (!str) return '';
    const diff = Date.now() - new Date(str).getTime();
    const m = Math.floor(diff / 60000);
    if (m < 2)  return '방금';
    if (m < 60) return `${m}분 전`;
    const h = Math.floor(m / 60);
    if (h < 24) return `${h}시간 전`;
    const d = Math.floor(h / 24);
    if (d < 7)  return `${d}일 전`;
    return new Date(str).toLocaleDateString('ko-KR', { month:'short', day:'numeric' });
  }

  return { post, comment, room };

})();