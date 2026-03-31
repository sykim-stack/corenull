// ── core/share.js ──────────────────────────────────────────────────────────
// BRAINPOOL 공통 · 공유 버튼 (카카오 / Zalo / 링크복사)

/**
 * @param {{ name, description, cover_url, url }} opts
 */
export function shareKakao(opts) {
  if (!window.Kakao?.isInitialized()) return;
  Kakao.Share.sendDefault({
    objectType: 'feed',
    content: {
      title      : opts.name,
      description: opts.description || 'CoreNull에서 소중한 순간을 기록하고 있어요',
      imageUrl   : opts.cover_url   || 'https://corenull.vercel.app/icon-hajun-512.png',
      link       : { mobileWebUrl: opts.url, webUrl: opts.url }
    },
    buttons: [{ title: '집 방문하기', link: { mobileWebUrl: opts.url, webUrl: opts.url } }]
  });
}

/**
 * @param {string} url
 */
export function shareZalo(url) {
  window.open(`https://zalo.me/share?url=${encodeURIComponent(url)}`, '_blank');
}

/**
 * @param {string} url
 * @param {function} onSuccess toast 콜백
 */
export function copyLink(url, onSuccess) {
  navigator.clipboard.writeText(url).then(() => onSuccess?.('링크가 복사됐어요 🔗'));
}