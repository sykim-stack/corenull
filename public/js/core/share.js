// public/js/core/share.js
// BRAINPOOL · CoreNull 공통 공유 엔진
// 집 공유 + 포스트 공유 통합

// ── 집 전체 공유 ──────────────────────────────────────────────────────────

export function shareHouseKakao({ name, description, cover_url, url }) {
  if (!window.Kakao?.isInitialized()) return;
  Kakao.Share.sendDefault({
    objectType: 'feed',
    content: {
      title      : name,
      description: description || 'CoreNull에서 소중한 순간을 기록하고 있어요',
      imageUrl   : cover_url   || 'https://corenull.vercel.app/icon-hajun-512.png',
      link       : { mobileWebUrl: url, webUrl: url }
    },
    buttons: [{ title: '집 방문하기', link: { mobileWebUrl: url, webUrl: url } }]
  });
}

export function shareHouseZalo(url) {
  window.open(`https://zalo.me/share?url=${encodeURIComponent(url)}`, '_blank');
}

export function copyLink(url, onSuccess) {
  navigator.clipboard.writeText(url).then(() => onSuccess?.('링크가 복사됐어요 🔗'));
}

// ── 포스트 공유 (거실/방/서재/이벤트 공통) ──────────────────────────────

/**
 * 포스트 공유 메인 함수
 * @param {object} opts
 * @param {string} opts.postId
 * @param {string} opts.houseId
 * @param {string} opts.ownerKey   - 오너만 invite_code 생성 가능, 비오너는 집 URL 공유
 * @param {string} opts.houseName
 * @param {string} opts.content    - 포스트 내용 (미리보기용)
 * @param {string} opts.coverUrl   - 포스트 첫 이미지
 * @param {string} opts.slug
 * @param {function} opts.onToast
 * @param {HTMLElement} opts.btn   - 로딩 표시용
 */
export async function sharePost(opts) {
  const { postId, houseId, ownerKey, houseName, content, coverUrl, slug, onToast, btn } = opts;

  if (btn) { btn.disabled = true; btn.textContent = '⏳'; }

  try {
    let shareUrl;

    if (ownerKey) {
      // 오너: invite_code 발급 → share.html 랜딩
      const res  = await fetch('/api/share', {
        method : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body   : JSON.stringify({ post_id: postId, house_id: houseId, owner_key: ownerKey })
      });
      const data = await res.json();
      if (!data.invite_code) { onToast?.(data.error || '공유 실패'); return; }
      shareUrl = `${location.origin}/share.html?code=${data.invite_code}`;
    } else {
      // 방문자: 집 URL 공유 (포스트 직접 앵커)
      shareUrl = `${location.origin}/${slug}`;
    }

    // PC는 바텀시트, 모바일만 Web Share
const isMobile = /iPhone|iPad|Android/i.test(navigator.userAgent);
if (navigator.share && isMobile) {
  await navigator.share({
    title: `${houseName}의 기록`,
    text : content?.slice(0, 80) || '',
    url  : shareUrl
  });
  return;
}
openShareSheet({ shareUrl, houseName, content, coverUrl, onToast });

  } catch(e) {
    if (e.name !== 'AbortError') onToast?.('공유 실패');
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = '🔗'; }
  }
}

// ── 공유 바텀시트 (Web Share API 미지원 환경) ────────────────────────────

function openShareSheet({ shareUrl, houseName, content, coverUrl, onToast }) {
  // 기존 시트 제거
  document.getElementById('__shareSheet')?.remove();

  const sheet = document.createElement('div');
  sheet.id = '__shareSheet';
  sheet.innerHTML = `
    <div class="ss-backdrop" id="ssBackdrop"></div>
    <div class="ss-box" id="ssBox">
      <div class="ss-handle"></div>
      <div class="ss-title">공유하기</div>
      ${content ? `<div class="ss-preview">${esc(content.slice(0,60))}${content.length>60?'…':''}</div>` : ''}
      <div class="ss-btns">
        <button class="ss-btn kakao"  id="ssBtnKakao">
          <img src="https://developers.kakao.com/assets/img/about/logos/kakaolink/kakaolink_btn_medium.png">카카오톡
        </button>
        <button class="ss-btn zalo"   id="ssBtnZalo">💬 Zalo</button>
        <button class="ss-btn copy"   id="ssBtnCopy">🔗 링크 복사</button>
      </div>
    </div>`;

  injectSheetStyles();
  document.body.appendChild(sheet);

  // 카카오
  document.getElementById('ssBtnKakao').onclick = () => {
    if (!window.Kakao?.isInitialized()) { onToast?.('카카오 초기화 필요'); return; }
    Kakao.Share.sendDefault({
      objectType: 'feed',
      content: {
        title      : `${houseName}의 기록`,
        description: content?.slice(0, 80) || '',
        imageUrl   : coverUrl || 'https://corenull.vercel.app/icon-hajun-512.png',
        link       : { mobileWebUrl: shareUrl, webUrl: shareUrl }
      },
      buttons: [{ title: '보러 가기', link: { mobileWebUrl: shareUrl, webUrl: shareUrl } }]
    });
    closeSheet();
  };

  // Zalo
  document.getElementById('ssBtnZalo').onclick = () => {
    window.open(`https://zalo.me/share?url=${encodeURIComponent(shareUrl)}`, '_blank');
    closeSheet();
  };

  // 링크 복사
  document.getElementById('ssBtnCopy').onclick = () => {
    navigator.clipboard.writeText(shareUrl).then(() => {
      onToast?.('링크가 복사됐어요 🔗');
      closeSheet();
    });
  };

  // 백드롭 닫기
  document.getElementById('ssBackdrop').onclick = closeSheet;

  // 슬라이드인
  requestAnimationFrame(() => document.getElementById('ssBox')?.classList.add('open'));
}

function closeSheet() {
  const box = document.getElementById('ssBox');
  if (!box) return;
  box.classList.remove('open');
  setTimeout(() => document.getElementById('__shareSheet')?.remove(), 300);
}

function esc(str) {
  return String(str||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

function injectSheetStyles() {
  if (document.getElementById('__shareSheetStyle')) return;
  const s = document.createElement('style');
  s.id = '__shareSheetStyle';
  s.textContent = `
    #__shareSheet { position:fixed;inset:0;z-index:9999; }
    .ss-backdrop  { position:absolute;inset:0;background:rgba(0,0,0,.4);backdrop-filter:blur(2px); }
    .ss-box {
      position:absolute;bottom:0;left:0;right:0;
      background:white;border-radius:20px 20px 0 0;
      padding:20px 20px 32px;
      transform:translateY(100%);transition:transform .3s cubic-bezier(.4,0,.2,1);
    }
    .ss-box.open  { transform:translateY(0); }
    .ss-handle    { width:40px;height:4px;background:#e0d0c0;border-radius:2px;margin:0 auto 16px; }
    .ss-title     { font-size:16px;font-weight:700;color:#3a2a1a;margin-bottom:8px; }
    .ss-preview   { font-size:13px;color:#a08060;margin-bottom:16px;
                    white-space:nowrap;overflow:hidden;text-overflow:ellipsis; }
    // injectSheetStyles() 안에서 .ss-btns, .ss-btn 부분 교체
.ss-btns      { display:grid;grid-template-columns:repeat(3,1fr);gap:10px; }
.ss-btn {
  padding:16px 8px;border:none;border-radius:14px;
  font-size:13px;font-weight:600;cursor:pointer;
  font-family:inherit;display:flex;flex-direction:column;
  align-items:center;justify-content:center;gap:6px;
  transition:opacity .15s;width:100%;aspect-ratio:1.8;
}
    .ss-btn:hover { opacity:.85; }
    .ss-btn img   { width:28px;height:28px;border-radius:50%; }
    .ss-btn.kakao { background:#FEE500;color:#3A1D1D; }
    .ss-btn.zalo  { background:#0068FF;color:white; }
    .ss-btn.copy  { background:#f7ede3;color:#6b3f1f; }
  `;
  document.head.appendChild(s);
}