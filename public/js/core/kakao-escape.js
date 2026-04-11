// ============================================================
// Kakao Escape & Save Flow v1.0
// Shared UX Protocol — CoreNull / CoreRing / CoreChat 공통
//
// 사용법:
//   import { initKakaoEscape } from './kakao-escape.js';
//   initKakaoEscape({ tone: 'content' }); // 'content' | 'chat'
//
// 또는 스크립트 태그:
//   <script src="/public/js/core/kakao-escape.js"></script>
//   <script>KakaoEscape.init({ tone: 'content' })</script>
// ============================================================

(function (global) {

  // ── 환경 감지 ──────────────────────────────────────────────
  function detectEnv() {
    const ua = navigator.userAgent || '';
    const isKakao   = /KAKAOTALK/i.test(ua);
    const isMobile  = /Android|iPhone|iPad|iPod/i.test(ua);
    const isPC      = !isMobile;
    return { isKakao, isMobile, isPC };
  }

  // ── 문구 세트 ──────────────────────────────────────────────
  const COPY = {
    content: {
      saveLabel : '이 글을 다시 보려면 저장하세요',
      toastMsg  : '복사 완료 👍\n카카오톡에 붙여넣으면 저장됩니다',
    },
    chat: {
      saveLabel : '이 대화를 계속하려면 저장하세요',
      toastMsg  : '복사 완료 👍\n카카오톡에 붙여넣으면 저장됩니다',
    },
  };

  // ── 스타일 주입 ────────────────────────────────────────────
  function injectStyles() {
    if (document.getElementById('__ke_style')) return;
    const s = document.createElement('style');
    s.id = '__ke_style';
    s.textContent = `
      /* ── Kakao Escape: 상단 배너 ── */
      #__ke_top {
        position: fixed; top: 0; left: 0; right: 0; z-index: 9000;
        background: #1a1a1a;
        border-bottom: 1px solid rgba(255,255,255,.08);
        padding: 10px 16px;
        display: flex; align-items: center; justify-content: space-between;
        gap: 12px;
        animation: __ke_slideDown .3s ease both;
      }
      #__ke_top .ke-label {
        font-size: 12px; color: rgba(255,255,255,.6);
        font-family: 'Gowun Dodum', sans-serif; white-space: nowrap;
        flex-shrink: 0;
      }
      #__ke_top .ke-chrome-btn {
        background: linear-gradient(135deg, #4285F4, #34A853);
        color: white; border: none; border-radius: 20px;
        padding: 9px 18px; font-size: 13px; font-weight: 700;
        cursor: pointer; white-space: nowrap; flex-shrink: 0;
        font-family: 'Gowun Dodum', sans-serif;
        box-shadow: 0 2px 10px rgba(66,133,244,.4);
        transition: opacity .2s;
      }
      #__ke_top .ke-chrome-btn:active { opacity: .8; }
      #__ke_top .ke-close {
        background: none; border: none; color: rgba(255,255,255,.4);
        font-size: 18px; cursor: pointer; padding: 0 4px; flex-shrink: 0;
      }

      /* ── 실패 가이드 ── */
      #__ke_fail {
        display: none;
        position: fixed; top: 52px; left: 12px; right: 12px; z-index: 8999;
        background: #2a2a2a; border: 1px solid rgba(255,255,255,.1);
        border-radius: 12px; padding: 12px 16px;
        font-size: 12px; color: rgba(255,255,255,.7); line-height: 1.7;
        font-family: 'Gowun Dodum', sans-serif;
        animation: __ke_fadeIn .2s ease both;
      }
      #__ke_fail.show { display: block; }

      /* ── 하단 저장 영역 ── */
      #__ke_bottom {
        position: fixed; bottom: 0; left: 0; right: 0; z-index: 9000;
        background: #1a1a1a;
        border-top: 1px solid rgba(255,255,255,.08);
        padding: 12px 16px 20px;
        animation: __ke_slideUp .35s ease both;
      }
      #__ke_bottom .ke-save-label {
        font-size: 11px; color: rgba(255,255,255,.4);
        text-align: center; margin-bottom: 10px; letter-spacing: 1px;
        font-family: 'Gowun Dodum', sans-serif;
      }
      #__ke_bottom .ke-btns {
        display: flex; gap: 8px;
      }
      #__ke_bottom .ke-btn {
        flex: 1; padding: 13px 10px;
        border: none; border-radius: 12px;
        font-size: 14px; font-weight: 700; cursor: pointer;
        font-family: 'Gowun Dodum', sans-serif;
        transition: opacity .2s; white-space: nowrap;
        display: flex; align-items: center; justify-content: center; gap: 6px;
      }
      #__ke_bottom .ke-btn:active { opacity: .75; }
      #__ke_bottom .ke-btn.kakao {
        background: #FEE500; color: #3C1E1E;
      }
      #__ke_bottom .ke-btn.copy {
        background: rgba(255,255,255,.1); color: rgba(255,255,255,.85);
        border: 1px solid rgba(255,255,255,.12);
      }

      /* ── PC 최소 UI (하단만, 작게) ── */
      #__ke_bottom.pc-mode {
        padding: 8px 16px 10px;
      }
      #__ke_bottom.pc-mode .ke-save-label { display: none; }
      #__ke_bottom.pc-mode .ke-btn {
        padding: 9px 10px; font-size: 12px;
      }

      /* ── 토스트 ── */
      #__ke_toast {
        position: fixed; bottom: 90px; left: 50%;
        transform: translateX(-50%) translateY(10px);
        background: #333; color: white;
        padding: 10px 20px; border-radius: 20px;
        font-size: 13px; opacity: 0; pointer-events: none;
        transition: all .3s; z-index: 9999; white-space: pre-line;
        text-align: center; line-height: 1.5;
        font-family: 'Gowun Dodum', sans-serif;
      }
      #__ke_toast.show {
        opacity: 1; transform: translateX(-50%) translateY(0);
      }

      /* ── 바디 패딩 보정 ── */
      body.__ke_has_top    { padding-top: 52px !important; }
      body.__ke_has_bottom { padding-bottom: 76px !important; }

      /* ── 애니메이션 ── */
      @keyframes __ke_slideDown {
        from { transform: translateY(-100%); opacity: 0; }
        to   { transform: translateY(0);     opacity: 1; }
      }
      @keyframes __ke_slideUp {
        from { transform: translateY(100%); opacity: 0; }
        to   { transform: translateY(0);    opacity: 1; }
      }
      @keyframes __ke_fadeIn {
        from { opacity: 0; transform: translateY(-4px); }
        to   { opacity: 1; transform: translateY(0); }
      }
    `;
    document.head.appendChild(s);
  }

  // ── 토스트 ────────────────────────────────────────────────
  let _toastTimer = null;
  function showToast(msg) {
    let el = document.getElementById('__ke_toast');
    if (!el) {
      el = document.createElement('div');
      el.id = '__ke_toast';
      document.body.appendChild(el);
    }
    el.textContent = msg;
    el.classList.add('show');
    clearTimeout(_toastTimer);
    _toastTimer = setTimeout(() => el.classList.remove('show'), 2800);
  }

  // ── 링크 복사 ──────────────────────────────────────────────
  function copyLink(toastMsg) {
    const url = location.href;
    navigator.clipboard.writeText(url)
      .then(() => showToast(toastMsg))
      .catch(() => {
        // fallback
        const ta = document.createElement('textarea');
        ta.value = url;
        ta.style.position = 'fixed';
        ta.style.opacity = '0';
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        document.body.removeChild(ta);
        showToast(toastMsg);
      });
  }

  // ── 나에게 보내기 (카카오 me API) ─────────────────────────
  function sendToMe(toastMsg) {
    if (window.Kakao?.isInitialized?.()) {
      try {
        Kakao.Share.sendScrap({
          requestUrl: location.href,
          templateId: undefined, // 기본 스크랩
        });
        return;
      } catch (e) { /* fallback */ }
    }
    // Kakao API 없으면 링크 복사로 대체
    copyLink(toastMsg);
  }

  // ── 크롬 열기 시도 ─────────────────────────────────────────
  let _failTimer = null;
  function tryChromeOpen() {
    const url = location.href;

    // intent scheme (Android)
    const intentUrl = `intent://${url.replace(/^https?:\/\//, '')}#Intent;scheme=https;package=com.android.chrome;end`;
    location.href = intentUrl;

    // 2초 후에도 여기 있으면 실패 → 가이드 표시
    clearTimeout(_failTimer);
    _failTimer = setTimeout(() => {
      const fail = document.getElementById('__ke_fail');
      if (fail) fail.classList.add('show');
    }, 2000);
  }

  // ── 상단 배너 렌더 (카카오 전용) ──────────────────────────
  function renderTopBanner() {
    if (document.getElementById('__ke_top')) return;

    const el = document.createElement('div');
    el.id = '__ke_top';
    el.innerHTML = `
      <span class="ke-label">카카오 브라우저 감지됨</span>
      <button class="ke-chrome-btn" id="__ke_chrome_btn">🚀 크롬에서 열기</button>
      <button class="ke-close" id="__ke_top_close">✕</button>
    `;
    document.body.prepend(el);
    document.body.classList.add('__ke_has_top');

    // 실패 가이드
    const fail = document.createElement('div');
    fail.id = '__ke_fail';
    fail.innerHTML = `열리지 않으면<br>오른쪽 상단 메뉴에서<br><strong>외부 브라우저로 열기</strong>를 선택하세요`;
    document.body.appendChild(fail);

    document.getElementById('__ke_chrome_btn').addEventListener('click', tryChromeOpen);
    document.getElementById('__ke_top_close').addEventListener('click', () => {
      el.remove();
      fail.remove();
      document.body.classList.remove('__ke_has_top');
    });
  }

  // ── 하단 저장 영역 렌더 ────────────────────────────────────
  function renderBottomSave(opts) {
    if (document.getElementById('__ke_bottom')) return;

    const { tone, isPC } = opts;
    const copy = COPY[tone] || COPY.content;

    const el = document.createElement('div');
    el.id = '__ke_bottom';
    if (isPC) el.classList.add('pc-mode');

    el.innerHTML = `
      <div class="ke-save-label">${copy.saveLabel}</div>
      <div class="ke-btns">
        <button class="ke-btn kakao" id="__ke_send_me">💬 나에게 보내기</button>
        <button class="ke-btn copy"  id="__ke_copy_link">🔗 링크 복사</button>
      </div>
    `;
    document.body.appendChild(el);
    document.body.classList.add('__ke_has_bottom');

    document.getElementById('__ke_send_me').addEventListener('click',  () => sendToMe(copy.toastMsg));
    document.getElementById('__ke_copy_link').addEventListener('click', () => copyLink(copy.toastMsg));
  }

  // ── 메인 init ──────────────────────────────────────────────
  /**
   * @param {object} opts
   * @param {'content'|'chat'} opts.tone  - 문구 톤 (기본: 'content')
   */
  function init(opts) {
    opts = opts || {};
    const tone = opts.tone || 'content';
    const env  = detectEnv();

    injectStyles();

    if (env.isKakao) {
      // 카카오 인앱: 상단 배너 + 하단 저장
      renderTopBanner();
      renderBottomSave({ tone, isPC: false });

    } else if (env.isMobile) {
      // 모바일 브라우저: 하단 저장만
      renderBottomSave({ tone, isPC: false });

    } else {
      // PC: 최소 UI (하단만, 작게)
      renderBottomSave({ tone, isPC: true });
    }
  }

  // ── 노출 ───────────────────────────────────────────────────
  // ES module
  if (typeof exports !== 'undefined') {
    exports.init             = init;
    exports.initKakaoEscape  = init;
  }
  // 글로벌 (스크립트 태그)
  global.KakaoEscape = { init };

})(typeof globalThis !== 'undefined' ? globalThis : window);