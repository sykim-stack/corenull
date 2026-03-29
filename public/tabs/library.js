// public/tabs/library.js
import { state } from '../js/common.js';

export function renderLibrary(container) {
  const photos = state.allMedia.filter(m => m.media_type === 'photo');
  const videos = state.allMedia.filter(m => m.media_type === 'video');
  const lbUrls = photos.map(m => m.file_url);

  const photoGrid = photos.length
    ? `<div class="lib-grid">${photos.map((m,i) => `
        <div class="lib-item" onclick='openLightbox(${JSON.stringify(lbUrls)},${i})'>
          <img src="${m.file_url}" loading="lazy">
          ${state.isOwner ? `
            <button class="lib-edit" onclick="event.stopPropagation();openEditModal('${m.id}','${(m.content||'').replace(/'/g,"\\'")}')">✏️</button>
            <button class="lib-del" onclick="event.stopPropagation();confirmDelMedia('${m.id}')">🗑️</button>` : ''}
        </div>`).join('')}</div>`
    : `<div class="empty"><div class="ei">📷</div><p>아직 사진이 없어요</p></div>`;

  const videoList = videos.length
    ? videos.map(v => {
        const p = parseVideoUrl(v.file_url);
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
    <div class="sec-head" style="margin-bottom:16px;">
      <div><div class="sec-label">GALLERY</div><div class="sec-title">사진첩 📷</div></div>
      ${state.isOwner ? `<button class="more-btn" onclick="openUploadModal(null)">+ 사진 추가</button>` : ''}
    </div>
    ${photoGrid}
    <div class="sec-head" style="margin-top:40px;margin-bottom:16px;">
      <div><div class="sec-label">VIDEO</div><div class="sec-title">영상 🎬</div></div>
      ${state.isOwner ? `<button class="more-btn" onclick="document.getElementById('videoModal').classList.add('open')">+ 영상 추가</button>` : ''}
    </div>
    <div class="video-list">${videoList}</div>
  </div>`;
}