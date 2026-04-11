// ============================================================
// Kakao Escape & Save Flow v1.0
// Shared UX Protocol — CoreNull / CoreRing / CoreChat 공통
//
// 사용법 (ES module):
//   import { initKakaoEscape } from './kakao-escape.js';
//   initKakaoEscape({ tone: 'content', service: 'corenull' });
//
// 사용법 (스크립트 태그):
//   <script src="/public/js/core/kakao-escape.js"></script>
//   <script>KakaoEscape.init({ tone: 'chat', service: 'corering' })</script>
//
// ── CoreNull 전용: house_id 주입 ───────────────────────────
//   house.html init() 완료 후:
//   window.__ke_house_id = state.houseId;
//
// ── 전환 추적 localStorage 키 ──────────────────────────────
//   ke_device_id   : 기기 식별자 (자동 생성)
//   ke_first_visit : 최초 카카오 유입 ISO timestamp
//   ke_saved_at    : 저장 액션 시각 ISO timestamp
//   ke_service     : 마지막 유입 서비스명
//
// ── visit_log ref 값 ───────────────────────────────────────
//   kakao-first    : 카카오 최초 유입
//   kakao-return   : 저장 후 재방문
//   kakao-chrome   : 크롬 열기 클릭
//   kakao-copy     : 링크 복사
//   kakao-sendme   : 나에게 보내기
// ============================================================

(function (global) {

  // ── 환경 감지 ──────────────────────────────────────────────
  function detectEnv() {
    const ua     = navigator.userAgent || '';
    const isKakao  = /KAKAOTALK/i.test(ua);
    const isMobile = /Android|iPhone|iPad|iPod/i.test(ua);
    return { isKakao, isMobile, isPC: !isMobile };
  }

  // ── 전환 추적 ──────────────────────────────────────────────
  var TRACK = {

    deviceId: function () {
      var id = localStorage.getItem('ke_device_id');
      if (!id) {
        id = 'ke_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8);
        localStorage.setItem('ke_device_id', id);
      }
      return id;
    },

    markFirstVisit: function (service) {
      if (!localStorage.getItem('ke_first_visit')) {
        localStorage.setItem('ke_first_visit', new Date().toISOString());
        localStorage.setItem('ke_service', service || '');
      }
    },

    markSaved: function () {
      localStorage.setItem('ke_saved_at', new Date().toISOString());
    },

    isReturn: function () {
      return !!localStorage.getItem('ke_saved_at');
    },

    minutesSinceFirst: function () {
      var t = localStorage.getItem('ke_first_visit');
      if (!t) return null;
      return Math.floor((Date.now() - new Date(t).getTime()) / 60000);
    },

    log: function (ref, service) {
      var endpoint = TRACK._endpoint(service);
      if (!endpoint) return;
      var deviceId = TRACK.deviceId();
      try {
        fetch(endpoint, {
          method : 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-device-id' : deviceId,
          },
          body: JSON.stringify({
            house_id   : window.__ke_house_id || null,
            ref        : ref,
            invited_by : null,
            meta: {
              service      : service,
              first_visit  : localStorage.getItem('ke_first_visit') || null,
              saved_at     : localStorage.getItem('ke_saved_at')     || null,
              minutes_since: TRACK.minutesSinceFirst(),
              is_return    : TRACK.isReturn(),
            },
          }),
        });
      } catch (e) { /* silent */ }
    },

    // CoreRing / CoreChat 은 Phase 1 에서 /api/track 추가 예정
    _endpoint: function (service) {
      if (service === 'corenull') return '/api/house';
      return null;
    },
  };

  // ── 문구 세트 ──────────────────────────────────────────────
  var COPY = {
    content: {
      saveLabel: '이 글을 다시 보려면 저장하세요',
      toastMsg : '복사 완료 👍\n카카오톡에 붙여넣으면 저장됩니다',
    },
    chat: {
      saveLabel: '이 대화를 계속하려면 저장하세요',
      toastMsg : '복사 완료 👍\n카카오톡에 붙여넣으면 저장됩니다',
    },
  };

  // ── 스타일 주입 ────────────────────────────────────────────
  function injectStyles() {
    if (document.getElementById('__ke_style')) return;
    var s = document.createElement('style');
    s.id = '__ke_style';
    s.textContent = [
      '#__ke_top{position:fixed;top:0;left:0;right:0;z-index:9000;background:#1a1a1a;border-bottom:1px solid rgba(255,255,255,.08);padding:10px 16px;display:flex;align-items:center;justify-content:space-between;gap:12px;animation:__ke_slideDown .3s ease both;}',
      '#__ke_top .ke-label{font-size:12px;color:rgba(255,255,255,.6);font-family:"Gowun Dodum",sans-serif;white-space:nowrap;flex-shrink:0;}',
      '#__ke_top .ke-chrome-btn{background:linear-gradient(135deg,#4285F4,#34A853);color:white;border:none;border-radius:20px;padding:9px 18px;font-size:13px;font-weight:700;cursor:pointer;white-space:nowrap;flex-shrink:0;font-family:"Gowun Dodum",sans-serif;box-shadow:0 2px 10px rgba(66,133,244,.4);transition:opacity .2s;}',
      '#__ke_top .ke-chrome-btn:active{opacity:.8;}',
      '#__ke_top .ke-close{background:none;border:none;color:rgba(255,255,255,.4);font-size:18px;cursor:pointer;padding:0 4px;flex-shrink:0;}',
      '#__ke_fail{display:none;position:fixed;top:52px;left:12px;right:12px;z-index:8999;background:#2a2a2a;border:1px solid rgba(255,255,255,.1);border-radius:12px;padding:12px 16px;font-size:12px;color:rgba(255,255,255,.7);line-height:1.7;font-family:"Gowun Dodum",sans-serif;animation:__ke_fadeIn .2s ease both;}',
      '#__ke_fail.show{display:block;}',
      '#__ke_bottom{position:fixed;bottom:0;left:0;right:0;z-index:9000;background:#1a1a1a;border-top:1px solid rgba(255,255,255,.08);padding:12px 16px 20px;animation:__ke_slideUp .35s ease both;}',
      '#__ke_bottom .ke-save-label{font-size:11px;color:rgba(255,255,255,.4);text-align:center;margin-bottom:10px;letter-spacing:1px;font-family:"Gowun Dodum",sans-serif;}',
      '#__ke_bottom .ke-btns{display:flex;gap:8px;}',
      '#__ke_bottom .ke-btn{flex:1;padding:13px 10px;border:none;border-radius:12px;font-size:14px;font-weight:700;cursor:pointer;font-family:"Gowun Dodum",sans-serif;transition:opacity .2s;white-space:nowrap;display:flex;align-items:center;justify-content:center;gap:6px;}',
      '#__ke_bottom .ke-btn:active{opacity:.75;}',
      '#__ke_bottom .ke-btn.kakao{background:#FEE500;color:#3C1E1E;}',
      '#__ke_bottom .ke-btn.copy{background:rgba(255,255,255,.1);color:rgba(255,255,255,.85);border:1px solid rgba(255,255,255,.12);}',
      '#__ke_bottom.pc-mode{padding:8px 16px 10px;}',
      '#__ke_bottom.pc-mode .ke-save-label{display:none;}',
      '#__ke_bottom.pc-mode .ke-btn{padding:9px 10px;font-size:12px;}',
      // 디버그 뱃지 (localhost 전용)
      '#__ke_debug{position:fixed;top:56px;right:8px;z-index:9001;background:rgba(0,200,80,.12);border:1px solid rgba(0,200,80,.3);border-radius:8px;padding:4px 10px;font-size:10px;color:rgba(0,200,80,.9);letter-spacing:1px;font-family:monospace;pointer-events:none;}',
      '#__ke_toast{position:fixed;bottom:90px;left:50%;transform:translateX(-50%) translateY(10px);background:#333;color:white;padding:10px 20px;border-radius:20px;font-size:13px;opacity:0;pointer-events:none;transition:all .3s;z-index:9999;white-space:pre-line;text-align:center;line-height:1.5;font-family:"Gowun Dodum",sans-serif;}',
      '#__ke_toast.show{opacity:1;transform:translateX(-50%) translateY(0);}',
      'body.__ke_has_top{padding-top:52px!important;}',
      'body.__ke_has_bottom{padding-bottom:76px!important;}',
      '@keyframes __ke_slideDown{from{transform:translateY(-100%);opacity:0;}to{transform:translateY(0);opacity:1;}}',
      '@keyframes __ke_slideUp{from{transform:translateY(100%);opacity:0;}to{transform:translateY(0);opacity:1;}}',
      '@keyframes __ke_fadeIn{from{opacity:0;transform:translateY(-4px);}to{opacity:1;transform:translateY(0);}}',
    ].join('');
    document.head.appendChild(s);
  }

  // ── 토스트 ────────────────────────────────────────────────
  var _toastTimer = null;
  function showToast(msg) {
    var el = document.getElementById('__ke_toast');
    if (!el) { el = document.createElement('div'); el.id = '__ke_toast'; document.body.appendChild(el); }
    el.textContent = msg;
    el.classList.add('show');
    clearTimeout(_toastTimer);
    _toastTimer = setTimeout(function () { el.classList.remove('show'); }, 2800);
  }

  // ── 링크 복사 ──────────────────────────────────────────────
  function copyLink(toastMsg, service) {
    var url = location.href;
    function done() { TRACK.markSaved(); TRACK.log('kakao-copy', service); showToast(toastMsg); }
    if (navigator.clipboard) {
      navigator.clipboard.writeText(url).then(done).catch(function () { fallbackCopy(url, done); });
    } else {
      fallbackCopy(url, done);
    }
  }
  function fallbackCopy(url, cb) {
    var ta = document.createElement('textarea');
    ta.value = url; ta.style.cssText = 'position:fixed;opacity:0;';
    document.body.appendChild(ta); ta.select(); document.execCommand('copy');
    document.body.removeChild(ta); cb();
  }

  // ── 나에게 보내기 ──────────────────────────────────────────
  function sendToMe(toastMsg, service) {
  TRACK.markSaved();
  TRACK.log('kakao-sendme', service);
  
  // sendScrap 대신 sendDefault로 교체
  if (window.Kakao && window.Kakao.isInitialized && window.Kakao.isInitialized()) {
    try {
      window.Kakao.Share.sendDefault({
        objectType: 'feed',
        content: {
          title      : document.title || 'CoreNull',
          description: '소중한 순간을 함께 기록해요',
          imageUrl   : document.querySelector('meta[property="og:image"]')?.content || '',
          link       : { mobileWebUrl: location.href, webUrl: location.href }
        },
        buttons: [{ title: '보러 가기', link: { mobileWebUrl: location.href, webUrl: location.href } }]
      });
      return;
    } catch (e) { /* fallback */ }
  }
  copyLink(toastMsg, service);
}

  // ── 크롬 열기 ──────────────────────────────────────────────
  var _failTimer = null;
  function tryChromeOpen(service) {
    TRACK.log('kakao-chrome', service);
    var url = location.href;
    var intentUrl = 'intent://' + url.replace(/^https?:\/\//, '') + '#Intent;scheme=https;package=com.android.chrome;end';
    location.href = intentUrl;
    clearTimeout(_failTimer);
    _failTimer = setTimeout(function () {
      var el = document.getElementById('__ke_fail');
      if (el) el.classList.add('show');
    }, 2000);
  }

  // ── 디버그 뱃지 (localhost 전용) ───────────────────────────
  function renderDebugBadge() {
    var isLocal = location.hostname === 'localhost' || location.hostname === '127.0.0.1';
    if (!isLocal) return;
    var el = document.createElement('div');
    el.id = '__ke_debug';
    var min = TRACK.minutesSinceFirst();
    el.textContent = 'KE: ' + (TRACK.isReturn() ? '재방문' : '최초') + ' · ' + (min !== null ? min + 'm' : '-');
    document.body.appendChild(el);
  }

  // ── 상단 배너 ──────────────────────────────────────────────
  function renderTopBanner(service) {
    if (document.getElementById('__ke_top')) return;
    var el = document.createElement('div');
    el.id = '__ke_top';
    el.innerHTML = '<span class="ke-label">카카오 브라우저 감지됨</span>'
      + '<button class="ke-chrome-btn" id="__ke_chrome_btn">🚀 크롬에서 열기</button>'
      + '<button class="ke-close" id="__ke_top_close">✕</button>';
    document.body.prepend(el);
    document.body.classList.add('__ke_has_top');

    var fail = document.createElement('div');
    fail.id = '__ke_fail';
    fail.innerHTML = '열리지 않으면<br>오른쪽 상단 메뉴에서<br><strong>외부 브라우저로 열기</strong>를 선택하세요';
    document.body.appendChild(fail);

    document.getElementById('__ke_chrome_btn').addEventListener('click', function () { tryChromeOpen(service); });
    document.getElementById('__ke_top_close').addEventListener('click', function () {
      el.remove(); fail.remove();
      document.body.classList.remove('__ke_has_top');
    });
  }

  // ── 하단 저장 영역 ─────────────────────────────────────────
  function renderBottomSave(opts) {
    if (document.getElementById('__ke_bottom')) return;
    var tone = opts.tone, isPC = opts.isPC, service = opts.service;
    var copy = COPY[tone] || COPY.content;
    var el = document.createElement('div');
    el.id = '__ke_bottom';
    if (isPC) el.classList.add('pc-mode');
    el.innerHTML = '<div class="ke-save-label">' + copy.saveLabel + '</div>'
      + '<div class="ke-btns">'
      + '<button class="ke-btn kakao" id="__ke_send_me">💬 나에게 보내기</button>'
      + '<button class="ke-btn copy"  id="__ke_copy_link">🔗 링크 복사</button>'
      + '</div>';
    document.body.appendChild(el);
    document.body.classList.add('__ke_has_bottom');
    document.getElementById('__ke_send_me').addEventListener('click',  function () { sendToMe(copy.toastMsg, service); });
    document.getElementById('__ke_copy_link').addEventListener('click', function () { copyLink(copy.toastMsg, service); });
  }

  // ── init ───────────────────────────────────────────────────
  /**
   * @param {object}           opts
   * @param {'content'|'chat'} opts.tone     문구 톤 (기본: 'content')
   * @param {string}           opts.service  'corenull' | 'corering' | 'corechat'
   */
  function init(opts) {
    opts    = opts    || {};
    var tone    = opts.tone    || 'content';
    var service = opts.service || 'corenull';
    var env     = detectEnv();

    injectStyles();
    renderDebugBadge();

    if (env.isKakao) {
      TRACK.markFirstVisit(service);
      var ref = TRACK.isReturn() ? 'kakao-return' : 'kakao-first';
      TRACK.log(ref, service);
      renderTopBanner(service);
      renderBottomSave({ tone: tone, isPC: false, service: service });

    } else if (env.isMobile) {
      if (TRACK.isReturn()) TRACK.log('kakao-return', service);
      renderBottomSave({ tone: tone, isPC: false, service: service });

    } else {
      renderBottomSave({ tone: tone, isPC: true, service: service });
    }
  }

  // ── 노출 ───────────────────────────────────────────────────
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = { init: init, initKakaoEscape: init };
  }
  global.KakaoEscape = { init: init, initKakaoEscape: init };

})(typeof globalThis !== 'undefined' ? globalThis : window);