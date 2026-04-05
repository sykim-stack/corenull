// public/tabs/library.js
import { state } from '../js/common.js';

// ── 스토리 목록 로드 ──────────────────────────────────────────────────────
async function loadStories() {
  if (!state.houseId) return [];
  try {
    const res  = await fetch(`/api/house?action=stories&house_id=${state.houseId}`);
    const data = await res.json();
    return data.stories || [];
  } catch(e) { return []; }
}

// ── 스토리 생성 (Gemini) ──────────────────────────────────────────────────
export async function generateStory(cat) {
  const posts = (state.allPosts || []).filter(p =>
    (p.category_ids || []).map(String).includes(String(cat.id))
  );

  if (!posts.length) { window.showToast('이 카테고리에 기록이 없어요'); return; }

  window.showToast('스토리 생성 중... ✨');

  try {
    const posts_summary = posts.map((p, i) =>
      `[${i+1}] ${p.created_at?.slice(0,10) || ''} - ${p.content || '(사진)'} ${(p.media_urls||[]).length > 0 ? `(사진 ${p.media_urls.length}장)` : ''}`
    ).join('\n');

    const res  = await fetch('/api/gemini', {
      method : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body   : JSON.stringify({
        type   : 'story',
        context: {
          category_name: cat.name,
          house_name   : state.houseData?.name || state.slug,
          posts_summary,
        }
      })
    });
    const data = await res.json();
    if (!data.story?.title) { window.showToast('생성 실패 😢'); return; }

    openStoryPreview({ cat, title: data.story.title, content: data.story.content });
  } catch(e) {
    window.showToast('생성 실패 😢');
    console.error(e);
  }
}

// ── 스토리 미리보기 모달 ──────────────────────────────────────────────────
function openStoryPreview({ cat, title, content, storyId = null }) {
  document.getElementById('__storyModal')?.remove();

  const modal = document.createElement('div');
  modal.id = '__storyModal';
  modal.innerHTML = `
    <div class="sm-backdrop" id="smBackdrop"></div>
    <div class="sm-box">
      <div class="sm-handle"></div>
      <div class="sm-label">${cat?.name || ''} · 스토리</div>
      <input class="sm-title" id="smTitleInput" value="${escH(title)}" placeholder="스토리 제목">
      <textarea class="sm-content" id="smContentInput" rows="8">${escH(content)}</textarea>
      <div class="sm-toggle">
        <label>
          <input type="checkbox" id="smPublic"> 공개 (방문자에게 보임)
        </label>
      </div>
      <div class="sm-btns">
        <button class="sm-btn cancel" id="smCancel">취소</button>
        <button class="sm-btn save"   id="smSave">✅ 서재에 저장</button>
      </div>
    </div>`;

  injectStoryStyles();
  document.body.appendChild(modal);
  requestAnimationFrame(() => modal.querySelector('.sm-box').classList.add('open'));

  document.getElementById('smBackdrop').onclick = closeStoryModal;
  document.getElementById('smCancel').onclick   = closeStoryModal;
  document.getElementById('smSave').onclick     = () => saveStory({ cat, storyId });
}

function closeStoryModal() {
  const box = document.querySelector('#__storyModal .sm-box');
  if (!box) return;
  box.classList.remove('open');
  setTimeout(() => document.getElementById('__storyModal')?.remove(), 300);
}

// ── 스토리 저장 ───────────────────────────────────────────────────────────
async function saveStory({ cat, storyId }) {
  const title     = document.getElementById('smTitleInput')?.value.trim();
  const content   = document.getElementById('smContentInput')?.value.trim();
  const is_public = document.getElementById('smPublic')?.checked || false;

  if (!title || !content) { window.showToast('제목과 내용을 입력해주세요'); return; }

  const btn = document.getElementById('smSave');
  btn.disabled = true; btn.textContent = '저장 중...';

  try {
    const res  = await fetch('/api/house', {
      method : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body   : JSON.stringify({
        action     : storyId ? 'update_story' : 'create_story',
        house_id   : state.houseId,
        owner_key  : state.ownerKey,
        category_id: cat?.id || null,
        title, content, is_public,
      })
    });
    const data = await res.json();
    if (data.success) {
      window.showToast('서재에 저장됐어요 📚');
      closeStoryModal();
      const libTab = document.getElementById(`tab-${(state.rooms||[]).find(r=>r.room_type==='library')?.id}`);
      if (libTab) renderLibrary(libTab);
    } else {
      window.showToast(data.error || '저장 실패');
    }
  } catch(e) { window.showToast('저장 실패'); }
  finally { btn.disabled = false; btn.textContent = '✅ 서재에 저장'; }
}

// ── 스토리 삭제 ───────────────────────────────────────────────────────────
async function deleteStory(storyId) {
  window.openConfirm('스토리를 삭제할까요?', '삭제하면 되돌릴 수 없어요.', async () => {
    const res  = await fetch('/api/house', {
      method : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body   : JSON.stringify({
        action   : 'delete_story',
        story_id : storyId,
        house_id : state.houseId,
        owner_key: state.ownerKey
      })
    });
    const data = await res.json();
    if (data.success) {
      window.showToast('삭제됐어요');
      const libTab = document.getElementById(`tab-${(state.rooms||[]).find(r=>r.room_type==='library')?.id}`);
      if (libTab) renderLibrary(libTab);
    } else window.showToast(data.error || '삭제 실패');
  });
}

// ── 스토리 수정 ───────────────────────────────────────────────────────────
async function editStory(storyId) {
  try {
    const res  = await fetch(`/api/house?action=stories&house_id=${state.houseId}`);
    const data = await res.json();
    const story = (data.stories || []).find(s => s.id === storyId);
    if (!story) return;
    // content에서 title/body 분리 (## 제목\n\n본문 포맷)
    const lines   = (story.content || '').split('\n\n');
    const title   = lines[0]?.replace(/^## /, '') || '';
    const content = lines.slice(1).join('\n\n');
    const cat = (state.categories || []).find(c => String(c.id) === String(story.category_ids?.[0]));
    openStoryPreview({ cat, title, content, storyId });
  } catch(e) { window.showToast('불러오기 실패'); }
}

// ── 메인 렌더 ─────────────────────────────────────────────────────────────
export async function renderLibrary(container) {
  const photos    = state.allMedia.filter(m => m.media_type === 'photo');
  const videos    = state.allMedia.filter(m => m.media_type === 'video');
  const lbUrls    = photos.map(m => m.file_url);
  const eventCats = (state.categories || []).filter(c => c.is_event);
  const stories   = await loadStories();

  // ── 스토리 섹션 ──
  const storiesHtml = stories.length
    ? stories.map(s => {
        const lines   = (s.content || '').split('\n\n');
        const title   = lines[0]?.replace(/^## /, '') || s.id;
        const body    = lines.slice(1).join('\n\n');
        return `
        <div class="story-card">
          <div class="story-card-head">
            <div>
              <div class="story-card-title">${escH(title)}</div>
              <div class="story-card-meta">
                ${s.is_public ? '<span class="story-badge public">공개</span>' : '<span class="story-badge private">비공개</span>'}
                · ${fmtDate(s.created_at)}
              </div>
            </div>
            ${state.isOwner ? `
              <div style="display:flex;gap:6px;">
                <button class="story-action-btn" onclick="editStory('${s.id}')">✏️</button>
                <button class="story-action-btn" onclick="deleteStory('${s.id}')">🗑️</button>
              </div>` : ''}
          </div>
          <div class="story-card-content">${escH(body).replace(/\n/g,'<br>')}</div>
        </div>`}).join('')
    : `<div class="empty"><div class="ei">📖</div><p>아직 스토리가 없어요${state.isOwner ? '<br>아래 버튼으로 AI 스토리를 만들어보세요!' : ''}</p></div>`;

  // 이벤트 → 스토리 생성 버튼
  const genBtns = state.isOwner && eventCats.length
    ? `<div class="story-gen-wrap">
        ${eventCats.map(c => `
          <button class="story-gen-btn" onclick="generateStory('${c.id}')">
            ✨ ${escH(c.name)} 스토리 생성
          </button>`).join('')}
       </div>`
    : '';

  // ── 사진첩 ──
  const photoGrid = photos.length
    ? `<div class="lib-grid">${photos.map((m,i) => `
        <div class="lib-item" onclick='openLightbox(${JSON.stringify(lbUrls)},${i})'>
          <img src="${m.file_url}" loading="lazy">
          ${state.isOwner ? `
            <button class="lib-edit" onclick="event.stopPropagation();openEditModal('${m.id}','${(m.content||'').replace(/'/g,"\\'")}')">✏️</button>
            <button class="lib-del"  onclick="event.stopPropagation();confirmDelMedia('${m.id}')">🗑️</button>` : ''}
        </div>`).join('')}</div>`
    : `<div class="empty"><div class="ei">📷</div><p>아직 사진이 없어요</p></div>`;

  // ── 영상 ──
  const videoList = videos.length
    ? videos.map(v => {
        const p = window.parseVideoUrl?.(v.file_url);
        if (!p) return '';
        return `<div class="video-item">
          <iframe class="video-embed ${p.platform==='TikTok'?'vert':''}" src="${p.embedUrl}" allowfullscreen></iframe>
          <div class="video-info">
            <span class="video-plat">${p.platform}</span>
            ${state.isOwner ? `<button class="video-del" onclick="confirmDelMedia('${v.id}')">🗑️</button>` : ''}
          </div>
        </div>`;
      }).join('')
    : `<div class="empty"><div class="ei">🎬</div><p>아직 영상이 없어요</p></div>`;

  container.innerHTML = `<div class="section">

    <!-- 스토리 -->
    <div class="sec-head" style="margin-bottom:12px;">
      <div><div class="sec-label">STORY</div><div class="sec-title">스토리 📖</div></div>
    </div>
    ${genBtns}
    <div id="storiesList">${storiesHtml}</div>

    <!-- 사진첩 -->
    <div class="sec-head" style="margin-top:40px;margin-bottom:16px;">
      <div><div class="sec-label">GALLERY</div><div class="sec-title">사진첩 📷</div></div>
      ${state.isOwner ? `<button class="more-btn" onclick="openUploadModal(null)">+ 사진 추가</button>` : ''}
    </div>
    ${photoGrid}

    <!-- 영상 -->
    <div class="sec-head" style="margin-top:40px;margin-bottom:16px;">
      <div><div class="sec-label">VIDEO</div><div class="sec-title">영상 🎬</div></div>
      ${state.isOwner ? `<button class="more-btn" onclick="document.getElementById('videoModal').classList.add('open')">+ 영상 추가</button>` : ''}
    </div>
    <div class="video-list">${videoList}</div>

  </div>`;
}

// ── window 노출 ───────────────────────────────────────────────────────────
window.generateStory = (catId) => {
  const cat = (state.categories || []).find(c => String(c.id) === String(catId));
  if (cat) generateStory(cat);
  else window.showToast('카테고리를 찾을 수 없어요');
};
window.deleteStory = deleteStory;
window.editStory   = editStory;

// ── 유틸 ─────────────────────────────────────────────────────────────────
function escH(str) {
  return (str||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
}
function fmtDate(str) {
  if (!str) return '';
  const d = new Date(str);
  return `${d.getFullYear()}. ${d.getMonth()+1}. ${d.getDate()}`;
}

// ── 스토리 모달 스타일 ────────────────────────────────────────────────────
function injectStoryStyles() {
  if (document.getElementById('__storyStyle')) return;
  const s = document.createElement('style');
  s.id = '__storyStyle';
  s.textContent = `
    #__storyModal { position:fixed;inset:0;z-index:9999; }
    .sm-backdrop  { position:absolute;inset:0;background:rgba(0,0,0,.4);backdrop-filter:blur(2px); }
    .sm-box {
      position:absolute;bottom:0;left:0;right:0;max-height:90vh;overflow-y:auto;
      background:white;border-radius:20px 20px 0 0;padding:20px 20px 40px;
      transform:translateY(100%);transition:transform .3s cubic-bezier(.4,0,.2,1);
    }
    .sm-box.open   { transform:translateY(0); }
    .sm-handle     { width:40px;height:4px;background:#e0d0c0;border-radius:2px;margin:0 auto 16px; }
    .sm-label      { font-size:12px;color:#a08060;margin-bottom:8px; }
    .sm-title      { width:100%;border:1px solid #e0d0c0;border-radius:10px;padding:10px 12px;
                     font-size:16px;font-weight:600;font-family:inherit;margin-bottom:10px;outline:none; }
    .sm-content    { width:100%;border:1px solid #e0d0c0;border-radius:10px;padding:10px 12px;
                     font-size:14px;line-height:1.7;font-family:inherit;resize:vertical;outline:none; }
    .sm-toggle     { margin:12px 0;font-size:13px;color:#6b3f1f; }
    .sm-btns       { display:flex;gap:8px;margin-top:16px; }
    .sm-btn        { flex:1;padding:14px;border:none;border-radius:12px;font-size:14px;
                     font-weight:600;cursor:pointer;font-family:inherit; }
    .sm-btn.cancel { background:#f7ede3;color:#6b3f1f; }
    .sm-btn.save   { background:linear-gradient(135deg,#6b3f1f,#c8973a);color:white; }
    .story-gen-wrap { display:flex;flex-wrap:wrap;gap:8px;margin-bottom:16px; }
    .story-gen-btn  { background:#f7ede3;border:1px solid #e0c090;border-radius:20px;
                      padding:8px 16px;font-size:13px;color:#6b3f1f;cursor:pointer;
                      font-family:inherit;transition:all .2s; }
    .story-gen-btn:hover { background:#c8973a;color:white;border-color:#c8973a; }
    .story-card     { background:white;border:1px solid rgba(139,94,60,.12);border-radius:16px;
                      padding:18px;margin-bottom:12px;box-shadow:0 2px 8px rgba(107,63,31,.06); }
    .story-card-head { display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:10px; }
    .story-card-title { font-size:16px;font-weight:700;color:#3a2a1a; }
    .story-card-meta  { font-size:11px;color:#a08060;margin-top:4px; }
    .story-badge      { display:inline-block;border-radius:8px;padding:2px 8px;font-size:10px;font-weight:600; }
    .story-badge.public  { background:#e8f5e9;color:#2e7d32; }
    .story-badge.private { background:#f7ede3;color:#a08060; }
    .story-card-content { font-size:14px;line-height:1.8;color:#5a4a3a; }
    .story-action-btn   { background:none;border:1px solid #e0d0c0;border-radius:8px;
                          padding:4px 8px;cursor:pointer;font-size:13px; }
  `;
  document.head.appendChild(s);
}