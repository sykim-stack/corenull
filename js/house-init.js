/**
 * house-init.js — Shell 초기화
 *
 * 규칙:
 * - Message.init() 호출
 * - View.render() 호출
 * - 모달 열고 닫기
 * - 유틸 (toast, confirm, lightbox)
 * - 비즈니스 로직 없음
 */

import { Message } from './Message.js';
import { View } from './View.js';
import { PostCard } from './PostCard.js';
// ─── 기본 설정 ────────────────────────────────────────────────────────────
const SLUG      = location.pathname.replace(/^\//, '') || 'hajun';
const OWNER_KEY = new URLSearchParams(location.search).get('owner');
let   _writeFiles  = [];
let   _uploadFiles = [];
let   _uploadRoomId = null;
let   _lbImages = [], _lbIndex = 0;

const CAT_META = {
  baby:    { badge: '👶 BABY HOUSE',  emoji: '👶', ph: '👶' },
  pet:     { badge: '🐾 PET HOUSE',   emoji: '🐾', ph: '🐾' },
  travel:  { badge: '✈️ TRAVEL',      emoji: '✈️', ph: '✈️' },
  fitness: { badge: '💪 FITNESS',     emoji: '💪', ph: '💪' },
  daily:   { badge: '🏠 DAILY',       emoji: '🏠', ph: '🏠' },
};

// ─── 초기화 ───────────────────────────────────────────────────────────────
async function init() {
  try {
    await Message.init(SLUG, OWNER_KEY);
    _applyHero();
    _initDday();
    _buildTabs();
    _bindEvents();
    _trackVisit();
    if (Message.state.isOwner) {
      document.getElementById('fab').style.display = 'flex';
    }
  } catch (e) {
    showToast('데이터를 불러오지 못했어요');
    console.error(e);
  }
}

// ─── Hero 적용 ────────────────────────────────────────────────────────────
function _applyHero() {
  const { house } = Message.state;
  const cat  = CAT_META[house.category] || CAT_META['daily'];
  const name = house.name || SLUG;

  document.title = `${name} · CoreNull`;
  document.getElementById('heroBadge').textContent    = cat.badge;
  document.getElementById('heroName').textContent     = name;
  document.getElementById('heroSub').textContent      = house.description || '';
  document.getElementById('footerName').textContent   = name;
  document.getElementById('footerEi').textContent     = cat.emoji;
  document.getElementById('heroPlaceholder').textContent = cat.ph;

  if (house.cover_url) {
    document.getElementById('heroFrame').innerHTML =
      `<img src="${house.cover_url}" alt="${name}"><div class="photo-upload-hint">사진 변경</div>`;
    document.getElementById('hero').classList.add('has-cover');
  }

  // 공유 버튼
  document.getElementById('shareWrap').innerHTML = `
    <button onclick="shareKakao()" class="share-btn kakao">
      <img src="https://developers.kakao.com/assets/img/about/logos/kakaolink/kakaolink_btn_medium.png" style="width:20px;height:20px;border-radius:50%;">
      카카오톡
    </button>
    <button onclick="copyLink()" class="share-btn link">🔗 링크 복사</button>`;
}

// ─── D-Day ────────────────────────────────────────────────────────────────
function _initDday() {
  const { house } = Message.state;
  if (!house.birth_date && !house.start_date) return;

  const start   = new Date(house.birth_date || house.start_date);
  const now     = new Date();
  const elapsed = Math.floor((now - start) / 86400000);
  let   items   = [{ num: elapsed + '일', label: '지난 날' }];

  if (house.category === 'baby' && house.hundred_date) {
    const diff = Math.ceil((new Date(house.hundred_date) - now) / 86400000);
    items = [
      { num: elapsed + '일',                                  label: '태어난 지' },
      { num: diff > 0 ? `D-${diff}` : diff === 0 ? 'D-DAY' : '완료 🎂', label: '백일까지' },
      { num: '100',                                            label: '기념일' },
    ];
  }

  document.getElementById('ddayWrap').innerHTML = items.map(i =>
    `<div class="dday-box">
       <div class="dday-num">${i.num}</div>
       <div class="dday-label">${i.label}</div>
     </div>`
  ).join('');
}

// ─── 탭 빌드 ──────────────────────────────────────────────────────────────
function _buildTabs() {
  const { rooms } = Message.state;
  const tabInner   = document.getElementById('tabInner');
  const tabContents = document.getElementById('tabContents');
  tabInner.innerHTML = '';
  tabContents.innerHTML = '';

  const ROOM_META = {
    living:  { icon: '🛋️', label: '거실' },
    room:    { icon: '🚪', label: '방' },
    library: { icon: '📚', label: '서재' },
    event:   { icon: '🎂', label: null },
  };

  const ordered = [
    ...rooms.filter(r => r.room_type === 'living'),
    ...rooms.filter(r => r.room_type === 'room'),
    ...rooms.filter(r => r.room_type === 'library'),
    ...rooms.filter(r => r.room_type === 'event'),
  ].filter(r => r.room_type !== 'storage');

  ordered.forEach((room, idx) => {
    const meta  = ROOM_META[room.room_type] || { icon: '🚪', label: room.room_name };
    const label = room.room_type === 'event' ? room.room_name : meta.label;
    const tabId = `tab-${room.id}`;

    // 탭 버튼
    const btn = document.createElement('button');
    btn.className    = 'tab-btn' + (idx === 0 ? ' active' : '');
    btn.innerHTML    = `<span class="ti">${meta.icon}</span>${label}`;
    btn.dataset.tab  = tabId;
    btn.onclick      = () => switchTab(tabId);
    tabInner.appendChild(btn);

    // 탭 콘텐츠
    const div = document.createElement('div');
    div.className = 'tab-content' + (idx === 0 ? ' active' : '');
    div.id        = tabId;
    tabContents.appendChild(div);

    // View 렌더 위임
    if (room.room_type === 'living')  View.renderLobby(div);
    if (room.room_type === 'room')    View.renderRoom(div, room.id);
    if (room.room_type === 'library') View.renderLibrary(div);
    if (room.room_type === 'event')   View.renderEvent(div, room.id);
  });

  // 탭 내 이벤트 위임 (data-switch-tab, data-cat, data-lightbox)
  tabContents.addEventListener('click', _onTabClick);
}

// ─── 탭 내 클릭 위임 ──────────────────────────────────────────────────────
function _onTabClick(e) {
  const { rooms } = Message.state;

  // 방 카드 클릭
  const switchTab_el = e.target.closest('[data-switch-tab]');
  if (switchTab_el) {
    switchTab(`tab-${switchTab_el.dataset.switchTab}`);
    return;
  }

  // "더 보기" 버튼 (type으로 방 찾기)
  const switchType_el = e.target.closest('[data-switch-type]');
  if (switchType_el) {
    const r = rooms.find(r => r.room_type === switchType_el.dataset.switchType);
    if (r) switchTab(`tab-${r.id}`);
    return;
  }

  // 카테고리 필터
  const cat_el = e.target.closest('[data-cat]');
  if (cat_el) {
    document.querySelectorAll('.cat-chip').forEach(c => c.classList.remove('active'));
    cat_el.classList.add('active');
    const roomEl = cat_el.closest('.tab-content');
    const roomId = roomEl?.id.replace('tab-', '');
    View.filterByCategory(cat_el.dataset.cat, roomId);
    return;
  }

  // Lightbox
  const lb_el = e.target.closest('[data-lightbox]');
  if (lb_el) {
    const urls  = JSON.parse(lb_el.dataset.urls || '[]');
    const index = parseInt(lb_el.dataset.index || '0');
    openLightbox(urls, index);
    return;
  }

  // 포스트 삭제
  const del_el = e.target.closest('[data-delete-post]');
  if (del_el && Message.state.isOwner) {
    openConfirm('글을 삭제할까요?', '삭제하면 되돌릴 수 없어요.', async () => {
      await Message.delete({ type: 'post', id: del_el.dataset.deletePost });
      _rebuildCurrentTab();
      showToast('삭제됐어요');
    });
    return;
  }

  // 댓글 삭제
  const delC_el = e.target.closest('[data-delete-comment]');
  if (delC_el && Message.state.isOwner) {
    openConfirm('메시지를 삭제할까요?', '삭제하면 되돌릴 수 없어요.', async () => {
      await Message.delete({ type: 'comment', id: delC_el.dataset.deleteComment });
      _rebuildCurrentTab();
      showToast('삭제됐어요');
    });
    return;
  }
}

// ─── 탭 전환 ──────────────────────────────────────────────────────────────
function switchTab(tabId) {
  document.querySelectorAll('.tab-content').forEach(el => el.classList.remove('active'));
  document.querySelectorAll('.tab-btn').forEach(el => el.classList.remove('active'));
  document.getElementById(tabId)?.classList.add('active');
  document.querySelector(`[data-tab="${tabId}"]`)?.classList.add('active');
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

// 현재 활성 탭 재렌더
function _rebuildCurrentTab() {
  const active = document.querySelector('.tab-content.active');
  if (!active) return;
  const roomId = active.id.replace('tab-', '');
  const room   = Message.state.rooms.find(r => r.id === roomId);
  if (!room) return;
  if (room.room_type === 'living')  View.renderLobby(active);
  if (room.room_type === 'room')    View.renderRoom(active, room.id);
  if (room.room_type === 'library') View.renderLibrary(active);
  if (room.room_type === 'event')   View.renderEvent(active, room.id);
}

// ─── 이벤트 바인딩 ────────────────────────────────────────────────────────
function _bindEvents() {
  // FAB → 글쓰기 모달
  document.getElementById('fab').onclick = () => openWriteModal();

  // 글쓰기 사진 선택
  document.getElementById('writePhotoBtn').onclick = () =>
    document.getElementById('writePhotoInput').click();
  document.getElementById('writePhotoInput').onchange = (e) =>
    _handleWritePhoto(e.target.files);

  // 글쓰기 등록
  document.getElementById('writeSubmitBtn').onclick = submitWrite;

  // 사진 업로드
  document.getElementById('dropZone').onclick = () =>
    document.getElementById('uploadInput').click();
  document.getElementById('uploadInput').onchange = (e) =>
    _handleUploadSelect(e.target.files);
  document.getElementById('uploadSubmitBtn').onclick = submitUpload;

  // 모달 오버레이 클릭 닫기
  ['writeModal', 'uploadModal', 'postModal'].forEach(id => {
    document.getElementById(id).onclick = (e) => {
      if (e.target === document.getElementById(id)) closeModal(id);
    };
  });

  // 포스트 모달 닫기
  document.getElementById('postModalClose').onclick = () => closeModal('postModal');

  // Lightbox
  document.getElementById('lbClose').onclick = closeLightbox;
  document.getElementById('lbPrev').onclick  = () => _lbMove(-1);
  document.getElementById('lbNext').onclick  = () => _lbMove(1);

  // confirm
  document.getElementById('confirmCancel').onclick = closeConfirm;

  // 커버 사진 변경 (오너만)
  if (Message.state.isOwner) {
    document.getElementById('heroFrame').classList.add('is-owner');
    document.getElementById('heroFrame').onclick = () =>
      document.getElementById('coverInput').click();
    document.getElementById('coverInput').onchange = (e) => uploadCover(e.target.files[0]);
  }
}

// ─── 글쓰기 모달 ──────────────────────────────────────────────────────────
function openWriteModal(roomId = null) {
  _writeFiles = [];
  _currentWriteRoomId = roomId;
  document.getElementById('writeContent').value = '';
  document.getElementById('writePrevWrap').style.display = 'none';
  document.getElementById('writePrevCells').innerHTML = '';
  document.getElementById('writeProgWrap').style.display = 'none';

  // 카테고리 칩
  const wrap = document.getElementById('writeCatWrap');
  wrap.innerHTML = Message.state.categories.map(c =>
    `<span class="cat-sel" data-id="${c.id}" onclick="this.classList.toggle('on')">${c.name}</span>`
  ).join('');

  document.getElementById('writeModal').classList.add('open');
}
let _currentWriteRoomId = null;

async function _handleWritePhoto(files) {
  _writeFiles = [...files];
  const cells = document.getElementById('writePrevCells');
  cells.innerHTML = '';
  for (const f of _writeFiles) {
    const url  = URL.createObjectURL(f);
    const cell = document.createElement('div');
    cell.className = 'prev-cell';
    cell.innerHTML = `<img src="${url}"><button class="prev-rm" onclick="this.parentElement.remove()">✕</button>`;
    cells.appendChild(cell);
  }
  document.getElementById('writePrevWrap').style.display = 'block';
}

async function submitWrite() {
  const content = document.getElementById('writeContent').value.trim();
  const catIds  = [...document.querySelectorAll('.cat-sel.on')].map(el => el.dataset.id);
  if (!content && _writeFiles.length === 0) { showToast('내용을 입력해주세요'); return; }

  const btn = document.getElementById('writeSubmitBtn');
  btn.disabled = true;

  try {
    let mediaUrls = [];
    if (_writeFiles.length > 0) {
      document.getElementById('writeProgWrap').style.display = 'block';
      mediaUrls = await Message.upload(_writeFiles, pct => {
        document.getElementById('writeProgFill').style.width = pct + '%';
        document.getElementById('writeProgText').textContent = `업로드 중... ${pct}%`;
      });
    }

    await Message.create({
      type:    'post',
      content,
      meta:    { mediaUrls, categoryIds: catIds, roomId: _currentWriteRoomId },
    });

    closeModal('writeModal');
    _rebuildCurrentTab();
    showToast('등록됐어요 ✅');
  } catch (e) {
    showToast(e.message || '오류가 발생했어요');
  } finally {
    btn.disabled = false;
    document.getElementById('writeProgWrap').style.display = 'none';
  }
}

// ─── 사진 업로드 모달 ─────────────────────────────────────────────────────
function openUploadModal(roomId = null) {
  _uploadFiles  = [];
  _uploadRoomId = roomId;
  document.getElementById('uploadPrevWrap').style.display = 'none';
  document.getElementById('uploadPrevCells').innerHTML = '';
  document.getElementById('uploadContent').value = '';
  document.getElementById('uploadModal').classList.add('open');
}

function _handleUploadSelect(files) {
  _uploadFiles = [...files];
  const cells  = document.getElementById('uploadPrevCells');
  cells.innerHTML = '';
  _uploadFiles.forEach(f => {
    const url  = URL.createObjectURL(f);
    const cell = document.createElement('div');
    cell.className = 'prev-cell';
    cell.innerHTML = `<img src="${url}">`;
    cells.appendChild(cell);
  });
  document.getElementById('uploadPrevWrap').style.display = 'block';
}

async function submitUpload() {
  if (_uploadFiles.length === 0) { showToast('사진을 선택해주세요'); return; }
  const btn = document.getElementById('uploadSubmitBtn');
  btn.disabled = true;

  try {
    document.getElementById('uploadProgWrap').style.display = 'block';
    const urls = await Message.upload(_uploadFiles, pct => {
      document.getElementById('uploadProgFill').style.width = pct + '%';
      document.getElementById('uploadProgText').textContent = `업로드 중... ${pct}%`;
    });

    // 미디어 저장 API
    await fetch('/api/media', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        house_id:   Message.state.houseId,
        room_id:    _uploadRoomId,
        owner_key:  OWNER_KEY,
        file_urls:  urls,
        content:    document.getElementById('uploadContent').value.trim(),
        media_type: 'photo',
      }),
    });

    closeModal('uploadModal');
    _rebuildCurrentTab();
    showToast('올라갔어요 📷');
  } catch (e) {
    showToast(e.message || '오류가 발생했어요');
  } finally {
    btn.disabled = false;
    document.getElementById('uploadProgWrap').style.display = 'none';
  }
}

// ─── 방명록 등록 (View.js gbForm에서 호출) ────────────────────────────────
async function submitGuestbook() {
  const author  = document.getElementById('gbAuthor')?.value.trim();
  const content = document.getElementById('gbContent')?.value.trim();
  if (!author || !content) { showToast('이름과 메시지를 입력해주세요'); return; }

  try {
    await Message.create({
      type:    'comment',
      content,
      meta:    { authorName: author },
    });
    document.getElementById('gbAuthor').value  = '';
    document.getElementById('gbContent').value = '';
    _rebuildCurrentTab();
    showToast('메시지가 등록됐어요 💌');
  } catch (e) {
    showToast(e.message || '오류가 발생했어요');
  }
}

// ─── 커버 사진 업로드 ─────────────────────────────────────────────────────
async function uploadCover(file) {
  if (!file) return;
  showToast('업로드 중... ⏳');
  try {
    const urls = await Message.upload([file]);
    await fetch('/api/house', {
      method:  'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ house_id: Message.state.houseId, owner_key: OWNER_KEY, cover_url: urls[0] }),
    });
    location.reload();
  } catch (e) {
    showToast('업로드 실패');
  }
}

// ─── 공유 ─────────────────────────────────────────────────────────────────
function shareKakao() {
  const { house } = Message.state;
  Kakao.Share.sendDefault({
    objectType: 'feed',
    content: {
      title:       house.name || SLUG,
      description: house.description || '',
      imageUrl:    house.cover_url || '',
      link:        { mobileWebUrl: location.href, webUrl: location.href },
    },
  });
}

function copyLink() {
  navigator.clipboard.writeText(location.href);
  showToast('링크 복사됐어요 🔗');
}

// ─── 방문 기록 ────────────────────────────────────────────────────────────
function _trackVisit() {
  const ref        = new URLSearchParams(location.search).get('ref') || 'direct';
  const invited_by = ref.startsWith('dev_') ? ref : null;
  const deviceId   = (() => {
    let id = localStorage.getItem('cn_device_id');
    if (!id) { id = 'dev_' + Date.now() + '_' + Math.random().toString(36).substr(2,9); localStorage.setItem('cn_device_id', id); }
    return id;
  })();

  fetch('/api/visit', {
    method:  'POST',
    headers: { 'Content-Type': 'application/json', 'x-device-id': deviceId },
    body: JSON.stringify({ house_id: Message.state.houseId, ref, invited_by }),
  }).catch(() => {});
}

// ─── 유틸: Toast ──────────────────────────────────────────────────────────
function showToast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 2500);
}

// ─── 유틸: Confirm ────────────────────────────────────────────────────────
function openConfirm(title, sub, onOk) {
  document.getElementById('confirmTitle').textContent = title;
  document.getElementById('confirmSub').textContent   = sub;
  document.getElementById('confirmOk').onclick = () => { closeConfirm(); onOk(); };
  document.getElementById('confirmOverlay').classList.add('open');
}
function closeConfirm() {
  document.getElementById('confirmOverlay').classList.remove('open');
}

// ─── 유틸: Modal ──────────────────────────────────────────────────────────
function closeModal(id) {
  document.getElementById(id)?.classList.remove('open');
}

// ─── 유틸: Lightbox ───────────────────────────────────────────────────────
function openLightbox(urls, index = 0) {
  _lbImages = urls;
  _lbIndex  = index;
  const track  = document.getElementById('lbTrack');
  const thumbs = document.getElementById('lbThumbs');

  track.innerHTML = urls.map(u =>
    `<div class="lb-slide"><img src="${u}" draggable="false"></div>`
  ).join('');
  thumbs.innerHTML = urls.map((u, i) =>
    `<div class="lb-thumb ${i === index ? 'active' : ''}" onclick="lbGoTo(${i})">
       <img src="${u}">
     </div>`
  ).join('');

  _lbUpdate();
  document.getElementById('lightbox').classList.add('open');
}

function _lbUpdate() {
  document.getElementById('lbTrack').style.transform = `translateX(-${_lbIndex * 100}vw)`;
  document.getElementById('lbCounter').textContent   = `${_lbIndex + 1} / ${_lbImages.length}`;
  document.querySelectorAll('.lb-thumb').forEach((t, i) =>
    t.classList.toggle('active', i === _lbIndex)
  );
}

function lbGoTo(i) { _lbIndex = i; _lbUpdate(); }

function _lbMove(dir) {
  _lbIndex = (_lbIndex + dir + _lbImages.length) % _lbImages.length;
  _lbUpdate();
}

function closeLightbox() {
  document.getElementById('lightbox').classList.remove('open');
}

// ─── 실행 ─────────────────────────────────────────────────────────────────
init();