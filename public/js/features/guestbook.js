// ── features/guestbook.js ──────────────────────────────────────────────────
// CoreNull · 방명록

import { state, showToast, b64Blob } from '/public/js/common.js';

let gbPhotoB64 = null;

export function previewGbPhoto(input) {
  const file = input.files[0]; if (!file) return;
  const r = new FileReader();
  r.onload = e => {
    gbPhotoB64 = e.target.result;
    document.getElementById('gbPrevImg').src = e.target.result;
    document.getElementById('gbPrevWrap').style.display = 'block';
  };
  r.readAsDataURL(file);
}

export async function submitGuestbook(reloadData) {
  const author  = document.getElementById('gbAuthor')?.value.trim();
  const content = document.getElementById('gbContent')?.value.trim();
  if (!author || !content) { showToast('이름과 메시지를 입력해주세요'); return; }
  localStorage.setItem('cn_author_name', author);

  let media_url = null;
  if (gbPhotoB64) {
    try {
      showToast('사진 업로드 중... ⏳');
      const blob = await b64Blob(gbPhotoB64);
      const fd = new FormData();
      fd.append('file', blob, 'gb.jpg');
      fd.append('upload_preset', 'corenull');
      const cr = await fetch('https://api.cloudinary.com/v1_1/dqzazs9hb/image/upload', { method:'POST', body: fd });
      const cl = await cr.json();
      if (cl.secure_url) media_url = cl.secure_url;
    } catch { showToast('사진 업로드 실패'); return; }
  }

  const res = await fetch('/api/comment', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ house_id: state.houseId, author_name: author, content, media_url })
  });
  const data = await res.json();
  if (res.ok && data.success) {
    document.getElementById('gbAuthor').value = '';
    document.getElementById('gbContent').value = '';
    document.getElementById('gbPrevWrap').style.display = 'none';
    gbPhotoB64 = null;
    showToast('메시지가 등록됐어요 💌');
    await reloadData();
  } else showToast(data.error || '등록 실패');
}

export async function deleteComment(id, reloadData) {
  const { openConfirm } = await import('/public/js/common.js');
  openConfirm('메시지를 삭제할까요?', '삭제하면 되돌릴 수 없어요.', async () => {
    await fetch('/api/comment', {
      method: 'DELETE', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ comment_id: id, house_id: state.houseId })
    });
    showToast('삭제됐어요');
    await reloadData();
  });
}

export async function getAiMsg(lang) {
  const btn = document.getElementById(lang === 'vi' ? 'aiVi' : 'aiKo'); if (!btn) return;
  btn.disabled = true;
  try {
    const res = await fetch('/api/gemini', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'message', context: { lang } })
    });
    const data = await res.json();
    const el = document.getElementById('aiSugg'); if (!el) return;
    el.innerHTML = (data.suggestions || []).map(s =>
      `<button class="ai-chip" onclick="document.getElementById('gbContent').value=this.textContent;document.getElementById('aiSugg').style.display='none';">${s}</button>`
    ).join('');
    el.style.display = 'flex'; el.style.flexDirection = 'column';
  } catch { showToast('AI 문구 생성 실패'); }
  finally { btn.disabled = false; }
}

export async function translateComment(id, txt, btn) {
  btn.disabled = true; btn.textContent = '번역 중...';
  try {
    const res = await fetch('/api/gemini', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'translate', text: decodeURIComponent(txt) })
    });
    const data = await res.json();
    const feedItem = btn.closest('.feed-item');
    const body = feedItem?.querySelector('.feed-body');
    if (body && data.translated)
      body.innerHTML += `<div style="margin-top:8px;padding-top:8px;border-top:1px solid rgba(139,94,60,.1);font-size:13px;color:var(--muted);">${data.translated}</div>`;
    btn.style.display = 'none';
  } catch { showToast('번역 실패'); btn.disabled = false; btn.textContent = '🌐 번역'; }
}