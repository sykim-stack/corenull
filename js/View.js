/**
 * View.js — 필터링 + 정렬 + PostCard 조합
 *
 * 규칙:
 * - 데이터는 Message.state에서만 읽음
 * - 카드 렌더는 PostCard에 위임
 * - API 호출 없음
 * - 비즈니스 로직 없음
 */

const View = (() => {

  // ─── 거실 (Lobby) ─────────────────────────────────────────────────────────
  function renderLobby(container) {
    const { house, rooms, posts, comments, media, milestones } = Message.state;

    // 최근 사진 3장
    const photos    = media.filter(m => m.media_type === 'photo').slice(0, 3);
    const photoHtml = photos.length
      ? photos.map((m, i) =>
          `<div class="ps-cell" data-lightbox data-urls='${JSON.stringify(photos.map(x=>x.file_url))}' data-index="${i}">
             <img src="${m.file_url}" loading="lazy">
           </div>`).join('')
      : `<div class="empty"><div class="ei">📷</div><p>아직 사진이 없어요</p></div>`;

    // 최근 글 2개
    const recentPosts = [...posts]
      .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
      .slice(0, 2);
    const postsHtml = recentPosts.map(p => PostCard.post(p)).join('')
      || `<div class="empty"><div class="ei">📝</div><p>아직 글이 없어요</p></div>`;

    // 방명록 (post_id 없는 comment)
    const guestbook = [...comments]
      .filter(c => !c.post_id)
      .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
      .slice(0, 5);
    const gbHtml = guestbook.map(c => PostCard.comment(c)).join('')
      || `<div class="empty"><div class="ei">💌</div><p>첫 메시지를 남겨주세요</p></div>`;

    // 방 카드
    const navRooms  = rooms.filter(r => r.room_type !== 'living' && r.room_type !== 'storage');
    const roomsHtml = navRooms.map(r => {
      const count = posts.filter(p => p.room_id === r.id).length;
      return `<div data-switch-tab="${r.id}">${PostCard.room(r, count)}</div>`;
    }).join('');

    // 다음 마일스톤
    const now    = new Date();
    const nextM  = [...(milestones || [])]
      .filter(m => m.milestone_date && new Date(m.milestone_date) >= now)
      .sort((a, b) => new Date(a.milestone_date) - new Date(b.milestone_date))[0];
    const msHtml = nextM ? _milestone(nextM) : '';

    container.innerHTML = `
      <div class="section">
        <div class="sec-head">
          <div><div class="sec-label">ROOMS</div><div class="sec-title">방 둘러보기</div></div>
        </div>
        <div class="rooms-grid">${roomsHtml}</div>

        <div class="sec-head" style="margin-top:36px;">
          <div><div class="sec-label">RECENT PHOTOS</div><div class="sec-title">최근 사진</div></div>
          <button class="more-btn" data-switch-type="library">더 보기 →</button>
        </div>
        <div class="photo-strip">${photoHtml}</div>

        ${msHtml}

        <div class="sec-head" style="margin-top:36px;">
          <div><div class="sec-label">RECENT POSTS</div><div class="sec-title">최근 기록</div></div>
          <button class="more-btn" data-switch-type="room">더 보기 →</button>
        </div>
        <div class="post-list">${postsHtml}</div>

        <div class="sec-head" style="margin-top:36px;">
          <div><div class="sec-label">GUESTBOOK</div><div class="sec-title">방명록 💌</div></div>
        </div>
        <div class="feed-list" id="gbList">${gbHtml}</div>
        <div id="gbForm"></div>
      </div>`;
  }

  // ─── 방 (Room) ────────────────────────────────────────────────────────────
  function renderRoom(container, roomId) {
    const { posts, categories, rooms } = Message.state;
    const room     = rooms.find(r => r.id === roomId);
    const roomPosts = posts
      .filter(p => p.room_id === roomId)
      .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

    const chips = categories.map(c =>
      `<span class="cat-chip" data-cat="${c.id}">${c.name}</span>`
    ).join('');

    container.innerHTML = `
      <div class="section">
        <div class="sec-head">
          <div><div class="sec-label">ROOM</div><div class="sec-title">${room?.room_name || '방'} 📝</div></div>
        </div>
        <div class="cat-bar">
          <span class="cat-chip active" data-cat="all">전체</span>${chips}
        </div>
        <div class="post-list" id="postList">
          ${roomPosts.map(p => PostCard.post(p)).join('')
            || `<div class="empty"><div class="ei">📝</div><p>아직 글이 없어요</p></div>`}
        </div>
      </div>`;
  }

  // ─── 서재 (Library) ───────────────────────────────────────────────────────
  function renderLibrary(container) {
    const { media } = Message.state;
    const photos = media.filter(m => m.media_type === 'photo');
    const videos = media.filter(m => m.media_type === 'video');

    const photoHtml = photos.length
      ? `<div class="lib-grid">${photos.map((m, i) =>
          `<div class="lib-item"
               data-lightbox
               data-urls='${JSON.stringify(photos.map(x=>x.file_url))}'
               data-index="${i}">
             <img src="${m.file_url}" loading="lazy">
           </div>`).join('')}</div>`
      : `<div class="empty"><div class="ei">📷</div><p>아직 사진이 없어요</p></div>`;

    const videoHtml = videos.length
      ? videos.map(v => {
          const p = _parseVideo(v.file_url);
          if (!p) return '';
          return `<div class="video-item" data-id="${v.id}">
            <iframe class="video-embed ${p.vert ? 'vert' : ''}" src="${p.embedUrl}" allowfullscreen></iframe>
            <div class="video-info"><span class="video-plat">${p.platform}</span></div>
          </div>`;
        }).join('')
      : `<div class="empty"><div class="ei">🎬</div><p>아직 영상이 없어요</p></div>`;

    container.innerHTML = `
      <div class="section">
        <div class="sec-head">
          <div><div class="sec-label">GALLERY</div><div class="sec-title">사진첩 📷</div></div>
        </div>
        ${photoHtml}
        <div class="sec-head" style="margin-top:40px;">
          <div><div class="sec-label">VIDEO</div><div class="sec-title">영상 🎬</div></div>
        </div>
        <div class="video-list">${videoHtml}</div>
      </div>`;
  }

  // ─── 이벤트 (Event) ───────────────────────────────────────────────────────
  function renderEvent(container, roomId) {
    const { rooms, posts, media } = Message.state;
    const room = rooms.find(r => r.id === roomId);
    if (!room) return;

    const diff = room.event_date
      ? Math.ceil((new Date(room.event_date) - new Date()) / 86400000)
      : null;
    const dday = diff === null ? '' : diff > 0 ? `D-${diff}` : diff === 0 ? 'D-DAY 🎉' : '완료 🎂';

    const eventPosts  = posts.filter(p => p.room_id === roomId)
      .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    const eventPhotos = media.filter(m => m.room_id === roomId && m.media_type === 'photo');

    const postsHtml = eventPosts.map(p => PostCard.post(p)).join('')
      || `<div class="empty"><div class="ei">📝</div><p>아직 글이 없어요</p></div>`;

    const photoHtml = eventPhotos.length
      ? `<div class="lib-grid">${eventPhotos.map((m, i) =>
          `<div class="lib-item"
               data-lightbox
               data-urls='${JSON.stringify(eventPhotos.map(x=>x.file_url))}'
               data-index="${i}">
             <img src="${m.file_url}" loading="lazy">
           </div>`).join('')}</div>`
      : `<div class="empty"><div class="ei">📷</div><p>이벤트 사진을 올려주세요</p></div>`;

    container.innerHTML = `
      <div class="section">
        <div class="ev-header">
          <div class="ev-title">${room.room_name}</div>
          ${room.event_date ? `<div class="ev-date">${_fmtDate(room.event_date)}</div>` : ''}
          ${dday ? `<div class="ev-dday">${dday}</div>` : ''}
        </div>
        <div class="sec-head">
          <div><div class="sec-label">POSTS</div><div class="sec-title">글</div></div>
        </div>
        <div class="post-list">${postsHtml}</div>
        <div class="sec-head" style="margin-top:36px;">
          <div><div class="sec-label">PHOTOS</div><div class="sec-title">사진</div></div>
        </div>
        ${photoHtml}
      </div>`;
  }

  // ─── 카테고리 필터 ────────────────────────────────────────────────────────
  function filterByCategory(catId, roomId) {
    const { posts } = Message.state;
    const roomPosts = posts.filter(p => p.room_id === roomId);
    const filtered  = catId === 'all'
      ? roomPosts
      : roomPosts.filter(p => (p.category_ids || []).some(id => String(id) === String(catId)));

    const el = document.getElementById('postList');
    if (!el) return;
    el.innerHTML = filtered.map(p => PostCard.post(p)).join('')
      || `<div class="empty"><div class="ei">📝</div><p>글이 없어요</p></div>`;
  }

  // ─── PRIVATE 헬퍼 ─────────────────────────────────────────────────────────
  function _milestone(m) {
    const diff = Math.ceil((new Date(m.milestone_date) - new Date()) / 86400000);
    const badge = diff === 0 ? 'D-DAY' : `D-${diff}`;
    return `
      <div class="ms-card" style="margin-top:36px;">
        <div class="ms-icon">${m.memo || '⭐'}</div>
        <div class="ms-info">
          <div class="ms-name">${m.title}</div>
          <div class="ms-date">${_fmtDate(m.milestone_date)}</div>
        </div>
        <div class="ms-badge">${badge}</div>
      </div>`;
  }

  function _fmtDate(str) {
    if (!str) return '';
    const d = new Date(str);
    return `${d.getFullYear()}년 ${d.getMonth()+1}월 ${d.getDate()}일`;
  }

  function _parseVideo(url) {
    if (!url) return null;
    if (url.includes('youtube') || url.includes('youtu.be')) {
      const id = url.match(/(?:v=|youtu\.be\/)([^&?/]+)/)?.[1];
      return id ? { platform: 'YouTube', embedUrl: `https://www.youtube.com/embed/${id}`, vert: false } : null;
    }
    if (url.includes('tiktok')) {
      const id = url.match(/video\/(\d+)/)?.[1];
      return id ? { platform: 'TikTok', embedUrl: `https://www.tiktok.com/embed/${id}`, vert: true } : null;
    }
    return null;
  }

  return { renderLobby, renderRoom, renderLibrary, renderEvent, filterByCategory };

})();