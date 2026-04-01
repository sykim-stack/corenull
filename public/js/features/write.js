// ── features/write.js ──────────────────────────────────────────────────────
// CoreNull · 글쓰기 모달

import { state, showToast, resizeImg, b64Blob } from '/public/js/common.js';
import { submitPost } from '/public/js/api.js';
import { uploadMany } from '/public/js/core/upload.js';

export function openWriteModal() {
  state.writeFiles = [];
  document.getElementById('writeContent').value = '';
  document.getElementById('writePrevWrap').style.display = 'none';
  document.getElementById('writeProgWrap').style.display = 'none';
  renderComposeCats('write');
  renderComposeRooms('write');
  document.getElementById('writeCatInline').style.display    = 'none';
  document.getElementById('writeEventInline').style.display  = 'none';
  document.getElementById('writeModal').classList.add('open');
  window.renderComposeCats('write');
  window.renderComposeRooms('write');
}

export async function handleWritePhoto(input) {
  state.writeFiles = [...input.files];
  const wrap  = document.getElementById('writePrevWrap');
  const cells = document.getElementById('writePrevCells');
  cells.innerHTML = '';
  for (const f of state.writeFiles) {
    const b64 = await resizeImg(f);
    const cell = document.createElement('div'); cell.className = 'prev-cell';
    cell.innerHTML = `<img src="${b64}"><button class="prev-rm" onclick="this.parentElement.remove()">✕</button>`;
    cells.appendChild(cell);
  }
  wrap.style.display = 'block';
}

export async function submitWrite(reloadData) {
  const content = document.getElementById('writeContent').value.trim();
  const catIds  = [...document.querySelectorAll('.cat-sel.on')].map(el => el.dataset.id);
  const roomId = document.querySelector('#writeRoomWrap .room-sel.on')?.dataset.id
  || state.currentRoomId
  || state.rooms.find(r => r.room_type === 'room')?.id;
  if (!content && state.writeFiles.length === 0) { showToast('내용을 입력해주세요'); return; }

  let mediaUrls = [];
  if (state.writeFiles.length) {
    document.getElementById('writeProgWrap').style.display = 'block';
    mediaUrls = await uploadMany(state.writeFiles, ({ current, total, percent }) => {
      document.getElementById('writeProgFill').style.width = `${percent}%`;
      document.getElementById('writeProgText').textContent = `${current}/${total} 업로드 중...`;
    });
    document.getElementById('writeProgText').textContent = '완료!';
  }

  const data = await submitPost({ content, mediaUrls, categoryIds: catIds, roomId });
  if (data.success) {
    showToast('등록됐어요 ✅');
    document.getElementById('writeModal').classList.remove('open');
    await reloadData();
  } else { showToast(data.error || '등록 실패'); }
}