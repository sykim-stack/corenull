// public/tabs/room.js
import { state } from '../js/common.js';
import { renderPostList } from '../js/api.js';  // ← 추가

export function renderRoom(container, room) {
  const eventRooms = state.rooms.filter(r => r.room_type === 'event');

  const chips = state.categories.map(c => {
    const matchedEvent = eventRooms.find(r => r.room_name === c.name);
    const eventAttr = matchedEvent
      ? `data-event-room="${matchedEvent.id}" data-event-name="${matchedEvent.room_name}"`
      : '';
    return `<span class="cat-chip" data-id="${c.id}" ${eventAttr} onclick="filterCat('${c.id}',this)">${c.name}</span>`;
  }).join('');

  container.innerHTML = `<div class="section">
    <div class="sec-head">
      <div><div class="sec-label">ROOM</div><div class="sec-title">방 📝</div></div>
      <div style="display:flex;gap:8px;">
        ${state.isOwner ? `<button class="more-btn" onclick="openEventMgr()">🎂 이벤트</button>` : ''}
        ${state.isOwner ? `<button class="more-btn" onclick="openWriteModal()">+ 글쓰기</button>` : ''}
      </div>
    </div>
    <div class="cat-bar">
      <span class="cat-chip active" data-id="all" onclick="filterCat('all',this)">전체</span>${chips}
    </div>
    <div id="eventGoBanner" style="display:none;margin-bottom:16px;background:linear-gradient(135deg,#FEF3DC,#FDE8D8);border:1px solid rgba(201,168,76,.3);border-radius:16px;padding:14px 16px;align-items:center;gap:12px;">
      <span style="font-size:20px;">🎂</span>
      <div style="flex:1;">
        <div style="font-size:13px;font-weight:600;color:var(--dark);" id="eventGoBannerName"></div>
        <div style="font-size:11px;color:var(--muted);">이벤트 전용 페이지에서 더 자세히 볼 수 있어요</div>
      </div>
      <a id="eventGoBtn" href="#" target="_blank"
        style="background:var(--gold);color:white;border-radius:20px;padding:7px 16px;font-size:12px;text-decoration:none;white-space:nowrap;flex-shrink:0;">페이지 가기 →</a>
    </div>
    <div class="post-list" id="postList"></div>
  </div>

  <div class="modal-overlay" id="eventMgrModal" onclick="closeModal('eventMgrModal',event)" style="align-items:center;padding:24px;">
    <div class="modal-box">
      <div class="modal-handle"></div>
      <div class="modal-title">🎂 이벤트 관리</div>
      <div id="eventRoomList" style="margin-bottom:16px;"></div>
      <div style="background:var(--warm);border-radius:14px;padding:16px;">
        <div style="font-size:12px;color:var(--brown);font-weight:600;margin-bottom:10px;">+ 새 이벤트 추가</div>
        <input class="modal-input" id="newEventName" placeholder="이벤트 이름 (예: 돌잔치)">
        <input class="modal-input" id="newEventDate" type="date">
        <button class="modal-submit" style="margin-top:0;" onclick="createEventRoom()">생성</button>
      </div>
    </div>
  </div>`;

  renderPostList(state.allPosts.filter(p => p.room_id === room.id));
  if (state.isOwner) renderEventRoomList();
}

export function filterCat(catId, el) {
  document.querySelectorAll('.cat-chip').forEach(c => c.classList.remove('active'));
  el.classList.add('active');

  const roomObj = state.rooms.find(r => r.room_type === 'room');
  const roomPosts = roomObj ? state.allPosts.filter(p => p.room_id === roomObj.id) : state.allPosts;
  const filtered = catId === 'all'
    ? roomPosts
    : roomPosts.filter(p => Array.isArray(p.category_ids) && p.category_ids.some(id => String(id) === String(catId)));

  renderPostList(filtered);

  // 이벤트 배너
  const banner = document.getElementById('eventGoBanner');
  if (!banner) return;
  const eventRoomId = el.dataset.eventRoom;
  if (eventRoomId) {
    document.getElementById('eventGoBannerName').textContent = el.dataset.eventName || '';
    document.getElementById('eventGoBtn').href = `/event?slug=${state.slug}&room=${eventRoomId}`;
    banner.style.display = 'flex';
  } else {
    banner.style.display = 'none';
  }
}