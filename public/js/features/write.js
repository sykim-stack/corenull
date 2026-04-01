// ── public/js/features/write.js ───────────────────────────────────────────
// CoreNull · 통합 작성 모달 (글쓰기 + 사진 올리기)

import { state, showToast, resizeImg } from '/public/js/common.js';
import { submitPost } from '/public/js/api.js';
import { uploadMany } from '/public/js/core/upload.js';

// 진입점: 'write' = textarea 포커스 | 'photo' = 파일선택 즉시 열기
export function openWriteModal(mode = 'write') {
  state.writeFiles = [];

  // 입력값 초기화
  document.getElementById('composeContent').value           = '';
  document.getElementById('composePrevWrap').style.display  = 'none';
  document.getElementById('composePrevCells').innerHTML     = '';
  document.getElementById('composeProgWrap').style.display  = 'none';
  document.getElementById('composeCatInline').style.display    = 'none';
  document.getElementById('composeEventInline').style.display  = 'none';

  // 분류 · 방 칩 렌더
  window.renderComposeCats('compose');
  window.renderComposeRooms('compose');

  document.getElementById('composeModal').classList.add('open');

  if (mode === 'write') {
    setTimeout(() => document.getElementById('composeContent').focus(), 120);
  } else {
    // 사진 모드: 모달 열자마자 파일선택
    setTimeout(() => document.getElementById('composePhotoInput').click(), 120);
  }
}

export function openUploadModal(roomId) {
  // roomId 있으면 해당 방 미리 지정
  if (roomId) state.currentRoomId = roomId;
  openWriteModal('photo');
}

export async function handleWritePhoto(input) {
  const newFiles = [...input.files];
  state.writeFiles = [...(state.writeFiles || []), ...newFiles].slice(0, 10);

  const cells = document.getElementById('composePrevCells');
  for (const f of newFiles) {
    const b64  = await resizeImg(f);
    const cell = document.createElement('div');
    cell.className   = 'prev-cell';
    cell.innerHTML   = `<img src="${b64}"><button class="prev-rm" onclick="this.parentElement.remove()">✕</button>`;
    cells.appendChild(cell);
  }
  document.getElementById('composePrevWrap').style.display = 'block';
  // 입력 초기화 (같은 파일 재선택 가능하도록)
  input.value = '';
}

export async function submitWrite(reloadData) {
  const content = document.getElementById('composeContent').value.trim();
  const catIds  = [...document.querySelectorAll('#composeCatWrap .cat-sel.on')].map(el => el.dataset.id);
  const roomId  =
    document.querySelector('#composeRoomWrap .room-sel.on')?.dataset.id ||
    state.currentRoomId ||
    state.rooms.find(r => r.room_type === 'room')?.id;

  if (!content && state.writeFiles.length === 0) {
    showToast('내용이나 사진을 추가해주세요'); return;
  }

  let mediaUrls = [];
  if (state.writeFiles.length) {
    document.getElementById('composeProgWrap').style.display = 'block';
    mediaUrls = await uploadMany(state.writeFiles, ({ current, total, percent }) => {
      document.getElementById('composeProgFill').style.width    = `${percent}%`;
      document.getElementById('composeProgText').textContent    = `${current}/${total} 업로드 중...`;
    });
    document.getElementById('composeProgText').textContent = '완료!';
  }

  const data = await submitPost({ content, mediaUrls, categoryIds: catIds, roomId });
  if (data.success) {
    showToast('등록됐어요 ✅');
    document.getElementById('composeModal').classList.remove('open');
    await reloadData();
  } else {
    showToast(data.error || '등록 실패');
  }
}