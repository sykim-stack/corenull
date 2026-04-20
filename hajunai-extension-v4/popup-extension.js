// ─────────────────────────────────────────
// 🔥 BRAINPOOL EXTENSION LAYER v1.0
// 복불용 구조 (원본 절대 보호)
// ─────────────────────────────────────────

(function () {
    console.log('🚀 Extension Layer Loaded');
  
    // 원본 보호
    const ORIGINAL = {
      saveLog: window.saveLog,
      loadToday: window.loadToday,
      generateAISuggestions: window.generateAISuggestions
    };
  
    // 안전 Wrapper
    function wrapAsync(fn, after) {
      return async function (...args) {
        let result;
  
        try {
          result = await fn?.apply(this, args);
        } catch (e) {
          console.warn('⚠️ 원본 함수 오류', e);
        }
  
        try {
          await after?.apply(this, args);
        } catch (e) {
          console.warn('⚠️ 확장 오류', e);
        }
  
        return result;
      };
    }
  
    // ─────────────────────────────────────────
    // 🔥 saveLog 확장
    // ─────────────────────────────────────────
    async function afterSaveLog() {
      const content = document.getElementById('logContent')?.value;
      const next = document.getElementById('logNextAction')?.value;
  
      if (!content) return;
  
      console.log('🧠 [EXT] saveLog 분석');
  
      // 행동 기록
      localStorage.setItem('bp_last_log', content);
  
      // 품질 체크
      if (!next || next.length < 5) {
        console.log('⚠️ next_action 부족');
      }
  
      // 실패 감지
      if (content.includes('실패') || content.includes('안됨')) {
        console.log('🚨 실패 패턴 감지');
      }
    }
  
    // ─────────────────────────────────────────
    // 🔥 TODAY 확장
    // ─────────────────────────────────────────
    async function afterLoadToday() {
      console.log('📊 [EXT] TODAY 분석');
  
      const cards = document.querySelectorAll('.record-card');
  
      cards.forEach(card => {
        const text = card.innerText;
  
        if (text.includes('실패')) {
          card.style.border = '1px solid #F78166';
        }
  
        if (text.length > 100) {
          card.style.background = 'rgba(255,255,255,0.03)';
        }
      });
    }
  
    // ─────────────────────────────────────────
    // 🔥 AI 추천 확장
    // ─────────────────────────────────────────
    async function afterAISuggest() {
      console.log('🤖 [EXT] AI 추천 분석');
  
      const el = document.getElementById('aiSuggestions');
      if (!el) return;
  
      const buttons = el.querySelectorAll('button');
  
      buttons.forEach(btn => {
        const text = btn.innerText;
  
        if (text.includes('삭제') || text.includes('초기화')) {
          btn.style.border = '1px solid #F78166';
        }
  
        if (text.length < 5) {
          btn.style.opacity = 0.5;
        }
      });
    }
  
    // ─────────────────────────────────────────
    // 🔥 Hook 적용
    // ─────────────────────────────────────────
    if (ORIGINAL.saveLog) {
      window.saveLog = wrapAsync(ORIGINAL.saveLog, afterSaveLog);
    }
  
    if (ORIGINAL.loadToday) {
      window.loadToday = wrapAsync(ORIGINAL.loadToday, afterLoadToday);
    }
  
    if (ORIGINAL.generateAISuggestions) {
      window.generateAISuggestions = wrapAsync(
        ORIGINAL.generateAISuggestions,
        afterAISuggest
      );
    }
  
    // ─────────────────────────────────────────
    // 🔥 글로벌 행동 추적
    // ─────────────────────────────────────────
    document.addEventListener('click', (e) => {
      const btn = e.target.closest('button');
      if (!btn) return;
  
      console.log('👆 클릭:', btn.innerText);
  
      if (btn.innerText.includes('완료')) {
        localStorage.setItem('bp_last_action', 'done');
      }
    });
  
  })();