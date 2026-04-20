// HajunAI Content Script v3.1 — 압축 snapshot + 실제 요약

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    if (msg.type === 'GET_CLAUDE_CONTEXT') {
      sendResponse(extractClaudeContext());
    }
    return true;
  });
  
  function extractClaudeContext() {
    try {
      // DOM 순서 기반으로 user/assistant 메시지 정렬
      const allEls = [
        ...Array.from(document.querySelectorAll('p.whitespace-pre-wrap.break-words'))
          .map(el => ({ el, role: 'user' })),
        ...Array.from(document.querySelectorAll('p.font-claude-response-body'))
          .map(el => ({ el, role: 'assistant' }))
      ].sort((a, b) => {
        const pos = a.el.compareDocumentPosition(b.el);
        return pos & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1;
      });
  
      const sorted = allEls
        .map(({ el, role }) => ({ role, text: el.innerText?.trim() }))
        .filter(t => t.text && t.text.length > 5)
        .slice(-20); // 최근 20턴
  
      if (sorted.length === 0) {
        return { ok: false, error: '대화 내용 없음' };
      }
  
      // ── snapshot: 역할별 압축 ──
      // user는 핵심 질문만 (200자), assistant는 첫 문장만 (120자)
      const snapshot = sorted.map(t => {
        if (t.role === 'user') {
          // 코드블록/시스템 프롬프트 제거 후 핵심만
          const clean = t.text
            .replace(/```[\s\S]*?```/g, '[코드블록]')
            .replace(/={3,}[\s\S]*?={3,}/g, '[컨텍스트]')
            .trim()
            .slice(0, 200);
          return `👤 ${clean}`;
        } else {
          // Claude 응답: 첫 의미있는 문장만
          const firstLine = t.text
            .split('\n')
            .map(l => l.trim())
            .filter(l => l.length > 10)
            .slice(0, 2)
            .join(' ')
            .slice(0, 120);
          return `🤖 ${firstLine}`;
        }
      }).join('\n');
  
      // ── summary: 마지막 user 질문 기반 실제 요약 ──
      const lastUser = [...sorted].reverse().find(t => t.role === 'user');
      const lastAssistant = [...sorted].reverse().find(t => t.role === 'assistant');
  
      // 마지막 user 메시지에서 핵심 동사+목적어 추출 (80자)
      const summaryBase = lastUser
        ? lastUser.text
            .replace(/```[\s\S]*?```/g, '')
            .replace(/={3,}[\s\S]*?={3,}/g, '')
            .trim()
            .slice(0, 80)
        : `${sorted.length}턴 캡처`;
  
      // 완료된 작업 힌트: assistant 마지막 응답 첫줄
      const assistantHint = lastAssistant
        ? lastAssistant.text.split('\n').find(l => l.trim().length > 10)?.slice(0, 60) || ''
        : '';
  
      const summary = assistantHint
        ? `${summaryBase} → ${assistantHint}`
        : summaryBase;
  
      return {
        ok: true,
        turnCount: sorted.length,
        summary: summary.slice(0, 120), // last_task 필드에 들어갈 값
        snapshot,                        // logContent에 들어갈 값 (압축됨)
        url: location.href
      };
  
    } catch (e) {
      return { ok: false, error: e.message };
    }
  }