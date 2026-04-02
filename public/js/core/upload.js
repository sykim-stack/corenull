// ── core/upload.js ─────────────────────────────────────────────────────────
// BRAINPOOL 공통 · Cloudinary 업로드
// 재사용: CoreNull / CoreHub / MindWorld / ...

const CLOUD_NAME   = 'dqzazs9hb';
const UPLOAD_PRESET = 'corenull';
const UPLOAD_URL   = `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/upload`;

/**
 * 단일 파일 업로드
 * @param {Blob} blob
 * @param {function} onProgress (0~100)
 * @returns {Promise<string>} secure_url
 */
export async function uploadOne(blob, onProgress) {
  const fd = new FormData();
  fd.append('file', blob, 'photo.jpg');
  fd.append('upload_preset', UPLOAD_PRESET);
  const res = await fetch(UPLOAD_URL, { method: 'POST', body: fd });
  const data = await res.json();
  if (!data.secure_url) throw new Error(data.error?.message || '업로드 실패');
  onProgress?.(100);
  return data.secure_url;
}

/**
 * 다중 파일 업로드
 * @param {File[]} files
 * @param {function} onProgress ({ current, total, percent })
 * @returns {Promise<string[]>} secure_url 배열
 */
export async function uploadMany(files, onProgress) {
  const urls = [];
  for (let i = 0; i < files.length; i++) {
    const { resizeImg, b64Blob } = await import('/public/js/common.js');
    const b64  = await resizeImg(files[i]);
    const blob = await b64Blob(b64);
    const url  = await uploadOne(blob);
    urls.push(url);
    onProgress?.({ current: i + 1, total: files.length, percent: Math.round(((i + 1) / files.length) * 100) });
  }
  return urls;
}

/**
 * 커버 이미지 업로드 (1600px 리사이즈)
 * @param {File} file
 * @returns {Promise<string>} secure_url
 */
export async function uploadCoverImage(file) {
  const { resizeImg, b64Blob } = await import('/public/js/common.js');
  const b64  = await resizeImg(file, 1600);
  const blob = await b64Blob(b64);
  return uploadOne(blob);
}
/**
 * house.html onclick용 커버 업로드 래퍼
 * @param {HTMLInputElement} input
 * @param {{ houseId, ownerKey, isOwner }} state
 * @param {function} showToast
 * @param {function} reloadData
 */
export async function uploadCover(input, state, showToast, reloadData) {
  if (!state.isOwner) return;
  const file = input.files[0]; if (!file) return;
  showToast('커버 업로드 중... ⏳');
  try {
    const cover_url = await uploadCoverImage(file);
    const res = await fetch('/api/upload', {                          // ← /api/cover → /api/upload
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        action: 'cover',                                               // ← action 추가
        house_id: state.houseId, 
        owner_key: state.ownerKey, 
        file_url: cover_url                                            // ← cover_url → file_url
      })
    });
    const data = await res.json();
    if (data.success) { showToast('커버가 변경됐어요 ✅'); await reloadData(); }
    else showToast(data.error || '커버 변경 실패');
  } catch { showToast('업로드 실패'); }
}