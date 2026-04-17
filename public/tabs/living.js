// public/tabs/living.js
import { state } from '../js/common.js';
import { loadLobbyComments } from '../js/api.js';

export async function renderLobby(container, house, milestones, comments, rooms) {
  // 백일 배너
  let bannerHtml = '';
  if (house.hundred_date) {
    const diff = Math.ceil((new Date(house.hundred_date) - new Date()) / 86400000);
    if (diff >= 0) {
      const badge = diff === 0 ? 'D-DAY 🎉' : `D-${diff}`;
      const title = diff === 0 ? '오늘이 백일이에요! 🎉' : `${house.name}의 백일이 다가오고 있어요 🎂`;
      const sub = diff === 0 ? '축하해요!' : `백일까지 ${diff}일 남았어요`;
      bannerHtml = `<div class="lobby-banner"><div class="lobby-banner-inner">
        <div class="lobby-badge">${badge}</div>
        <div><div style="font-size:14px;font-weight:600;">${title}</div>
        <div style="font-size:12px;color:var(--muted)">${sub}</div></div>
      </div></div>`;
    }
  }

  // 방 카드
  const ROOM_ICONS = { room:'🚪', library:'📚', event:'🎂', yard:'🌿' };
  const navRooms = rooms.filter(r => r.room_type !== 'living' && !r.is_hidden);
  const roomCardsHtml = navRooms.length ? `
    <div class="sec-head" style="margin-bottom:14px;">
      <div><div class="sec-label">ROOMS</div><div class="sec-title">방 둘러보기</div></div>
      <button class="more-btn" onclick="goRandomHouse()" style="background:var(--warm);padding:6px 12px;border-radius:20px;border:1px solid rgba(139,94,60,.15);font-size:12px;">🎲 다른 집 가기</button>
    </div>
    <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(110px,1fr));gap:10px;margin-bottom:36px;">
      ${navRooms.map(r => {
        const icon = ROOM_ICONS[r.room_type] || '🚪';
        const postCount = state.allPosts.filter(p => p.room_id === r.id).length;
        const photoCount = state.allMedia.filter(m => m.room_id === r.id && m.media_type === 'photo').length;
        const sub = r.room_type === 'library' ? `사진 ${photoCount}장` : `글 ${postCount}개`;
        let badge = '';
        if (r.room_type === 'event' && r.event_date) {
          const diff = Math.ceil((new Date(r.event_date) - new Date()) / 86400000);
          if (diff >= 0) badge = `<div style="font-size:10px;color:var(--gold);margin-top:5px;font-weight:600;">D-${diff}</div>`;
        }
        return `<div onclick="switchTab('tab-${r.id}')"
          style="background:white;border:1px solid rgba(139,94,60,.12);border-radius:14px;padding:14px 12px;cursor:pointer;transition:all .2s;text-align:left;"
          onmouseover="this.style.borderColor='var(--brown)';this.style.background='var(--warm)'"
          onmouseout="this.style.borderColor='rgba(139,94,60,.12)';this.style.background='white'">
          <div style="font-size:24px;margin-bottom:7px;">${icon}</div>
          <div style="font-size:12px;font-weight:600;color:var(--dark);">${r.room_name}</div>
          <div style="font-size:11px;color:var(--muted);margin-top:2px;">${sub}</div>
          ${badge}
        </div>`;
      }).join('')}
    </div>` : '';

  // 최근 사진
  const photos = state.allMedia.filter(m => m.media_type === 'photo').slice(0, 3);
  const lbUrls = photos.map(m => m.file_url);
  const photoHtml = photos.length
    ? photos.map((m, i) => `<div class="ps-cell" onclick='openLightbox(${JSON.stringify(lbUrls)},${i})'><img src="${m.file_url}" loading="lazy"></div>`).join('')
    : `<div style="grid-column:span 3;text-align:center;padding:24px;color:var(--muted);font-size:13px;">아직 사진이 없어요 📷</div>`;

  // 다음 마일스톤
  const now = new Date();
  const nextM = (milestones || [])
    .filter(m => m.milestone_date && new Date(m.milestone_date) >= now)
    .sort((a, b) => new Date(a.milestone_date) - new Date(b.milestone_date))[0];
  let msHtml = '';
  if (nextM) {
    const diff = Math.ceil((new Date(nextM.milestone_date) - now) / 86400000);
    msHtml = `<div class="sec-label" style="margin-bottom:10px;">NEXT MILESTONE</div>
      <div class="ms-card">
        <div class="ms-icon">${nextM.memo || '⭐'}</div>
        <div class="ms-info">
          <div class="ms-name">${nextM.title}</div>
          <div class="ms-date">${fmtDate(nextM.milestone_date)}</div>
        </div>
        <div class="ms-badge">${diff === 0 ? 'D-DAY' : `D-${diff}`}</div>
      </div>`;
  }

  // 최근 포스트
  const recentPosts = [...state.allPosts]
    .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
    .slice(0, 2);
  const recentPostsHtml = recentPosts.length ? `
    <div class="sec-head" style="margin-bottom:14px;margin-top:36px;">
      <div><div class="sec-label">RECENT POSTS</div><div class="sec-title">최근 기록</div></div>
      <button class="more-btn" onclick="switchToRoomType('room')">더 보기 →</button>
    </div>
    <div style="display:flex;flex-direction:column;gap:10px;margin-bottom:36px;">
      ${recentPosts.map(p => {
        const tags = (p.category_ids || []).map(cid => {
          const c = state.categories.find(x => x.id === cid);
          return c ? `<span style="font-size:10px;padding:2px 8px;border-radius:10px;background:${c.color||'var(--mint)'};color:white;">${c.name}</span>` : '';
        }).join('');
        const thumb = (p.media_urls && p.media_urls[0])
          ? `<img src="${p.media_urls[0]}" style="width:52px;height:52px;border-radius:8px;object-fit:cover;flex-shrink:0;">`
          : `<div style="width:52px;height:52px;border-radius:8px;background:var(--warm);display:flex;align-items:center;justify-content:center;font-size:20px;flex-shrink:0;">📝</div>`;
        const pd = encodeURIComponent(JSON.stringify({urls:p.media_urls||[],content:p.content,date:p.created_at,category_ids:p.category_ids}));
        return `<div onclick="openPostModal(JSON.parse(decodeURIComponent('${pd}')))"
          style="display:flex;gap:12px;background:white;border:1px solid rgba(139,94,60,.1);border-radius:14px;padding:12px;cursor:pointer;"
          onmouseover="this.style.borderColor='var(--brown)'" onmouseout="this.style.borderColor='rgba(139,94,60,.1)'">
          ${thumb}
          <div style="flex:1;min-width:0;">
            ${tags ? `<div style="display:flex;gap:4px;flex-wrap:wrap;margin-bottom:5px;">${tags}</div>` : ''}
            <div style="font-size:13px;color:var(--text);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${p.content || '(사진)'}</div>
            <div style="font-size:11px;color:var(--muted);margin-top:3px;">${timeAgo(p.created_at)}</div>
          </div>
        </div>`;
      }).join('')}
    </div>` : '';

  // 방명록 피드
  const feedHtml = comments.length ? comments.map((c, i) => {
    const txt = (c.content || '').replace(/'/g,"&#39;").replace(/`/g,"&#96;");
    return `<div class="feed-item" style="animation-delay:${i*.06}s">
      <div class="feed-head">
        <div class="feed-av">${(c.author_name||'?')[0]}</div>
        <div class="feed-name">${c.author_name||'익명'}</div>
        <div class="feed-flag">${c.lang==='vi'?'🇻🇳':'🇰🇷'}</div>
        ${state.isOwner ? `<button class="feed-del" onclick="deleteComment('${c.id}')">🗑️</button>` : ''}
        <button onclick="translateComment('${c.id}','${txt}',this)"
          style="background:none;border:1px solid rgba(139,94,60,.2);border-radius:20px;padding:3px 10px;font-size:11px;color:var(--muted);cursor:pointer;font-family:'Gowun Dodum',serif;margin-left:4px;">🌐 번역</button>
      </div>
      ${c.media_url ? `<div class="feed-img"><img src="${c.media_url}"></div>` : ''}
      <div class="feed-body">${(c.content||'').replace(/\n/g,'<br>')}</div>
      <div class="feed-time">${timeAgo(c.created_at)}</div>
    </div>`;
  }).join('')
  : `<div class="empty"><div class="ei">💌</div><p>아직 메시지가 없어요<br>첫 번째 메시지를 남겨주세요!</p></div>`;

  container.innerHTML = `${bannerHtml}<div class="section">
    ${roomCardsHtml}
    <div class="sec-head"><div><div class="sec-label">RECENT PHOTOS</div><div class="sec-title">최근 사진</div></div>
      <button class="more-btn" onclick="switchToRoomType('library')">더 보기 →</button></div>
    <div class="photo-strip">${photoHtml}</div>
    ${msHtml}
    ${recentPostsHtml}
    <div class="sec-head" style="margin-bottom:16px;">
      <div><div class="sec-label">GUESTBOOK</div><div class="sec-title">방명록 💌</div></div>
      <div style="font-size:12px;color:var(--muted);">${comments.length ? comments.length+'개' : ''}</div>
    </div>
    <div class="feed-list">${feedHtml}</div>
    <div class="gb-form">
      <div class="gb-title">${house.category==='baby' ? house.name+'에게 메시지를 남겨주세요 🎂' : '메시지를 남겨주세요'}</div>
      <input type="text" class="gb-input" id="gbAuthor" placeholder="이름 (예: 할머니, Bà ngoại, 큰아빠)">
      <div class="ai-row">
        <button class="ai-btn" id="aiKo" onclick="getAiMsg('ko')">✨ 한국어 추천</button>
        <button class="ai-btn" id="aiVi" onclick="getAiMsg('vi')">✨ Gợi ý tiếng Việt</button>
      </div>
      <div class="ai-sugg" id="aiSugg" style="display:none;"></div>
      <textarea class="gb-input gb-textarea" id="gbContent" placeholder="메시지를 남겨주세요&#10;한국어, 베트남어 모두 괜찮아요 💕"></textarea>
      <div class="gb-actions">
        <button class="gb-photo-btn" onclick="document.getElementById('gbPhotoInput').click()">📷</button>
        <input type="file" id="gbPhotoInput" accept="image/*" style="display:none" onchange="previewGbPhoto(this)">
        <button class="gb-submit" onclick="submitGuestbook()">남기기</button>
      </div>
      <div id="gbPrevWrap" style="display:none;margin-top:8px;">
        <img id="gbPrevImg" style="width:100%;border-radius:12px;max-height:180px;object-fit:cover;">
      </div>
    </div>
  </div>`;

  // 이름 자동완성
  setTimeout(() => {
    const el = document.getElementById('gbAuthor');
    if (el) el.value = localStorage.getItem('cn_author_name') || '';
  }, 50);
}

function fmtDate(str) {
  if (!str) return '';
  const d = new Date(str);
  return `${d.getFullYear()}년 ${d.getMonth()+1}월 ${d.getDate()}일`;
}

function timeAgo(str) {
  const diff = Date.now() - new Date(str).getTime();
  const m = Math.floor(diff/60000), h = Math.floor(m/60), d = Math.floor(h/24);
  if (d > 0) return `${d}일 전`;
  if (h > 0) return `${h}시간 전`;
  if (m > 0) return `${m}분 전`;
  return '방금';
}