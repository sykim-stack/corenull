// popup.js v5.0.1 - with TODAY loop & multiline support

const PROJECTS = [
  { id: 'aaaaaaaa-0000-0000-0000-000000000001', name: 'BRAINPOOL', color: '#FFFFFF' },
  { id: '82423554-fa71-42cc-a297-90a65747113b', name: 'HajunAI',   color: '#79C0FF' },
  { id: 'c38f5b9a-14ab-4a36-85e2-b58289a4e4e6', name: 'CoreRing',  color: '#58A6FF' },
  { id: '13196994-00d5-4d7f-9436-619f07f5bd45', name: 'CoreChat',  color: '#D2A8FF' },
  { id: '66666666-0000-0000-0000-000000000006', name: 'CoreNull',  color: '#F0B429' },
  { id: '0a385ad1-4735-4967-978c-3a9aa7588613', name: 'CoreRoad',  color: '#F78166' },
  { id: '8f7e37b0-a19b-448f-a568-5bd8fd6bb3ff', name: 'CoreHub',   color: '#3FB950' },
  { id: '2a9aa9b2-6eaa-4386-a8af-8345e9c4a4d2', name: 'MindWorld', color: '#FFA657' },
];

const TYPE_LABEL = {
  work_log: '✅ 완료', issue: '🔴 이슈', decision: '💡 결정',
  memo: '📌 메모', design: '🏗️ 설계', report: '📊 보고서', sql: '🗃️ SQL'
};

const PROJECT_KEYWORDS = {
  'BRAINPOOL': 'aaaaaaaa-0000-0000-0000-000000000001',
  'CoreNull':  '66666666-0000-0000-0000-000000000006',
  'CoreRing':  'c38f5b9a-14ab-4a36-85e2-b58289a4e4e6',
  'CoreChat':  '13196994-00d5-4d7f-9436-619f07f5bd45',
  'CoreRoad':  '0a385ad1-4735-4967-978c-3a9aa7588613',
  'CoreHub':   '8f7e37b0-a19b-448f-a568-5bd8fd6bb3ff',
  'MindWorld': '2a9aa9b2-6eaa-4386-a8af-8345e9c4a4d2',
  'HajunAI':   '82423554-fa71-42cc-a297-90a65747113b',
};

let SUPABASE_URL = '';
let SUPABASE_KEY = '';
let selectedLogType = 'work_log';
let selectedDocType = 'work_log';

// XSS 방지
function escapeHtml(str) {
  if (!str) return '';
  return str.replace(/[&<>]/g, function(m) {
    if (m === '&') return '&amp;';
    if (m === '<') return '&lt;';
    if (m === '>') return '&gt;';
    return m;
  }).replace(/[\uD800-\uDBFF][\uDC00-\uDFFF]/g, function(c) {
    return c;
  });
}

// 줄바꿈 유지 (XSS 방지 후 \n → <br>)
function formatMultiline(text) {
  if (!text) return '';
  return escapeHtml(text).replace(/\n/g, '<br>');
}

document.addEventListener('DOMContentLoaded', async () => {
  await loadSettings();
  initTabs();
  initProjects();
  initTypeBtns();
  initButtons();
  checkConnection();
  tryAutoFillFromClaude();
  loadToday(); // 🆕 TODAY 로드
  document.getElementById('logContent').addEventListener('blur', generateAISuggestions);
   // 🔥 추가: AI 추천 트리거
   const logInput = document.getElementById('logContent');
   if (logInput) {
     logInput.addEventListener('blur', generateAISuggestions);
   }
 });
 
 // ─────────────────────────────────────────
 // 🔥 AI 추천 기능 (추가 영역)
 // ─────────────────────────────────────────
 async function generateAISuggestions() {
   const content = document.getElementById('logContent')?.value.trim();
   const el = document.getElementById('aiSuggestions');
   if (!content || !el) return;
 
   el.innerHTML = '⟳ 추천 생성중...';
 
   try {
     const res = await fetch(`${SUPABASE_URL}/functions/v1/ai-next-action`, {
       method: 'POST',
       headers: {
         'Content-Type': 'application/json',
         'apikey': SUPABASE_KEY
       },
       body: JSON.stringify({ text: content })
     });
 
     const data = await res.json();
     if (!data?.suggestions) throw new Error();
 
     el.innerHTML = data.suggestions.map(s =>
       `<button class="btn-sm" data-action="pick-ai" data-text="${encodeURIComponent(s)}">${escapeHtml(s)}</button>`
     ).join('');
 
   } catch {
     el.innerHTML = '<span style="color:#F78166">추천 실패</span>';
   }
 }
 
 // ─────────────────────────────────────────
 // 기존 코드 유지 (이벤트 위임에만 추가)
 // ─────────────────────────────────────────
 document.addEventListener('click', (e) => {
   const btn = e.target.closest('button');
   if (!btn) return;
 
   if (btn.dataset.action === 'pick-ai') {
     const text = decodeURIComponent(btn.dataset.text);
     document.getElementById('logNextAction').value = text;
   }
 });

async function tryAutoFillFromClaude() {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab?.url?.includes('claude.ai')) return;
    showClaudeBanner(true);
    const response = await Promise.race([
      chrome.tabs.sendMessage(tab.id, { type: 'GET_CLAUDE_CONTEXT' }),
      new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 3000))
    ]);
    if (!response?.ok || !response.snapshot) {
      showClaudeBanner(false, '대화 감지 실패');
      return;
    }
    const detectedProjectId = detectProjectFromText(response.snapshot);
    if (detectedProjectId) {
      document.getElementById('logProject').value = detectedProjectId;
    }
    document.getElementById('logLastTask').value = response.summary || '';
    showClaudeBanner(false, `✅ ${response.turnCount}턴 감지됨 — 자동 채워졌어요`);
  } catch (e) {
    if (e.message === 'timeout') {
      showClaudeBanner(false, '⚠️ 감지 실패 — 확장 다시 로드 후 시도');
    }
  }
}

function detectProjectFromText(text) {
  for (const [keyword, id] of Object.entries(PROJECT_KEYWORDS)) {
    if (text.includes(keyword)) return id;
  }
  return null;
}

function showClaudeBanner(loading, msg) {
  let banner = document.getElementById('claudeBanner');
  if (!banner) {
    banner = document.createElement('div');
    banner.id = 'claudeBanner';
    banner.style.cssText = `
      background:#1a2332; border:1px solid #58A6FF; border-radius:6px;
      padding:6px 10px; margin-bottom:10px; font-size:11px;
      color:#58A6FF; font-family:'JetBrains Mono',monospace;
      display:flex; align-items:center; gap:6px;
    `;
    const logTab = document.getElementById('tab-log');
    logTab.insertBefore(banner, logTab.firstChild);
  }
  banner.innerHTML = loading
    ? `<span style="animation:spin 0.6s linear infinite;display:inline-block">⟳</span> Claude 대화 감지 중...`
    : `🤖 ${msg || ''}`;
}

async function loadSettings() {
  return new Promise(resolve => {
    chrome.storage.local.get(['supabaseUrl', 'supabaseKey'], result => {
      SUPABASE_URL = result.supabaseUrl || '';
      SUPABASE_KEY = result.supabaseKey || '';
      if (document.getElementById('settingUrl')) {
        document.getElementById('settingUrl').value = SUPABASE_URL;
        document.getElementById('settingKey').value = SUPABASE_KEY;
      }
      resolve();
    });
  });
}

function initTabs() {
  document.querySelectorAll('.tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
      document.querySelectorAll('.content').forEach(c => c.classList.remove('active'));
      tab.classList.add('active');
      document.getElementById('tab-' + tab.dataset.tab).classList.add('active');
      if (tab.dataset.tab === 'health') loadHealth();
      if (tab.dataset.tab === 'today') loadToday();
    });
  });
}

function initProjects() {
  ['logProject', 'searchProject', 'ctxProject', 'docProject'].forEach(id => {
    const sel = document.getElementById(id);
    if (!sel) return;
    PROJECTS.forEach(p => {
      const opt = document.createElement('option');
      opt.value = p.id;
      opt.textContent = p.name;
      sel.appendChild(opt);
    });
  });
}

function initTypeBtns() {
  document.querySelectorAll('#logTypeBtns .type-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('#logTypeBtns .type-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      selectedLogType = btn.dataset.type;
    });
  });
  document.querySelectorAll('#docTypeBtns .type-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('#docTypeBtns .type-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      selectedDocType = btn.dataset.type;
    });
  });
}

function initButtons() {
  document.getElementById('btnSaveLog').addEventListener('click', saveLog);
  document.getElementById('btnSaveDoc').addEventListener('click', saveDoc);
  document.getElementById('btnSaveSettings').addEventListener('click', saveSettings);
  document.getElementById('btnSearch').addEventListener('click', searchRecords);
  document.getElementById('btnLoadCtx').addEventListener('click', loadContext);
}

async function checkConnection() {
  const dot = document.getElementById('statusDot');
  if (!SUPABASE_URL || !SUPABASE_KEY) {
    dot.style.background = '#F78166';
    dot.style.boxShadow = '0 0 6px #F78166';
    return;
  }
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/contexts?select=project_id&limit=1`, {
      headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` }
    });
    if (res.ok) {
      dot.style.background = '#3FB950';
      dot.style.boxShadow = '0 0 6px #3FB950';
    } else throw new Error();
  } catch {
    dot.style.background = '#F78166';
    dot.style.boxShadow = '0 0 6px #F78166';
  }
}

// ── 작업 기록 저장 (next_action 추가) ──
async function saveLog() {
  const projectId = document.getElementById('logProject').value;
  const content   = document.getElementById('logContent').value.trim();
  const lastTask  = document.getElementById('logLastTask').value.trim();
  const nextAction = document.getElementById('logNextAction')?.value.trim();

  if (!projectId) return showToast('프로젝트를 선택하세요', 'error');
  if (!content)   return showToast('작업 내용을 입력하세요', 'error');
  if (!SUPABASE_URL || !SUPABASE_KEY) return showToast('설정에서 Supabase 정보를 입력하세요', 'error');

  if (!nextAction) {
    if (!confirm('next_action 없이 저장하시겠습니까?')) return;
  }

  setLoading('log', true);
  try {
    const projectName = PROJECTS.find(p => p.id === projectId)?.name || '';
    const title = `[${projectName}] ${TYPE_LABEL[selectedLogType] || selectedLogType} ${formatDate()}`;
    const res = await sbInsert('documents', { project_id: projectId, title, content, doc_type: selectedLogType });
    if (!res.ok) throw new Error(await res.text());

    if (lastTask || nextAction) {
      const updateData = {};
      if (lastTask) updateData.last_task = lastTask;
      if (nextAction) updateData.next_action = nextAction;
      await sbUpdate('contexts', updateData, `project_id=eq.${projectId}`);
    }

    showToast('✅ 저장 완료!', 'success');
    document.getElementById('logContent').value = '';
    document.getElementById('logLastTask').value = '';
    if (document.getElementById('logNextAction')) document.getElementById('logNextAction').value = '';
    loadToday();
  } catch (e) {
    showToast('❌ 저장 실패: ' + e.message, 'error');
  } finally {
    setLoading('log', false);
  }
}

// ── TODAY 기능 (멀티라인 지원) ──
async function loadToday() {
  const el = document.getElementById('todayList');
  if (!el || !SUPABASE_URL || !SUPABASE_KEY) return;
  el.innerHTML = '<div class="empty">⟳ 불러오는 중...</div>';
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/contexts?select=*`, {
      headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` }
    });
    const data = await res.json();
    const list = data.filter(d => d.next_action);
    if (!list.length) {
      el.innerHTML = '<div class="empty">🎉 할 일이 없습니다</div>';
      return;
    }
    el.innerHTML = list.map(row => {
      const project = PROJECTS.find(p => p.id === row.project_id);
      return `
        <div class="record-card">
          <div class="record-top">
            <span class="record-project" style="color:${project?.color || '#8B949E'}">${escapeHtml(project?.name || '?')}</span>
          </div>
          <div class="record-body">${formatMultiline(row.next_action)}</div>
          <div class="record-actions">
            <button class="btn-sm" data-action="done" data-id="${row.project_id}">✅ 완료</button>
            <button class="btn-sm" data-action="fail" data-id="${row.project_id}">❌ 실패</button>
          </div>
        </div>
      `;
    }).join('');
  } catch {
    el.innerHTML = '<div class="empty">불러오기 실패</div>';
  }
}

async function handleDone(projectId) {
  await sbInsert('documents', {
    project_id: projectId,
    title: '[완료]',
    content: '작업 완료',
    doc_type: 'report'
  });
  await sbUpdate('contexts', { next_action: null }, `project_id=eq.${projectId}`);
  showToast('✅ 완료 처리되었습니다', 'success');
  loadToday();
}

async function handleFail(projectId) {
  const reason = prompt('실패 이유를 입력하세요 (선택)');
  await sbInsert('documents', {
    project_id: projectId,
    title: '[실패]',
    content: reason || '이유 없음',
    doc_type: 'issue'
  });
  await sbUpdate('contexts', { next_action: null }, `project_id=eq.${projectId}`);
  showToast('❌ 실패 기록됨', 'error');
  loadToday();
}

// ── 조회 (멀티라인 지원) ──
async function searchRecords() {
  const projectId = document.getElementById('searchProject').value;
  const docType   = document.getElementById('searchType').value;
  const resultsEl = document.getElementById('searchResults');
  resultsEl.innerHTML = '<div class="empty">⟳ 조회중...</div>';
  if (!SUPABASE_URL || !SUPABASE_KEY) {
    resultsEl.innerHTML = '<div class="empty">설정에서 Supabase 정보를 입력하세요</div>';
    return;
  }
  try {
    let url = `${SUPABASE_URL}/rest/v1/documents?select=*&order=created_at.desc&limit=20`;
    if (projectId) url += `&project_id=eq.${projectId}`;
    if (docType)   url += `&doc_type=eq.${docType}`;
    const res = await fetch(url, {
      headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` }
    });
    const data = await res.json();
    if (!data.length) { resultsEl.innerHTML = '<div class="empty">기록 없음</div>'; return; }
    resultsEl.innerHTML = data.map((row, idx) => {
      const project = PROJECTS.find(p => p.id === row.project_id);
      const name  = project?.name || '?';
      const color = project?.color || '#8B949E';
      const time  = fmtTime(row.created_at);
      return `
        <div class="record-card">
          <div class="record-top">
            <span class="record-project" style="color:${color}">${escapeHtml(name)}</span>
            <span class="record-time">${time}</span>
          </div>
          <span class="record-type">${TYPE_LABEL[row.doc_type] || row.doc_type}</span>
          <div class="record-title">${escapeHtml(row.title)}</div>
          <div class="record-body" id="rb-${idx}">${formatMultiline(row.content)}</div>
          <div class="record-actions">
            <button class="btn-sm" data-action="toggle-body" data-target="rb-${idx}">펼치기</button>
            <button class="btn-sm btn-copy" data-action="copy" data-text="${encodeURIComponent(row.content)}">📋 복사</button>
          </div>
        </div>`;
    }).join('');
  } catch (e) {
    resultsEl.innerHTML = '<div class="empty">조회 실패</div>';
  }
}

// ── 맥락 조회 ──
async function loadContext() {
  const projectId = document.getElementById('ctxProject').value;
  const resultsEl = document.getElementById('ctxResults');
  resultsEl.innerHTML = '<div class="empty">⟳ 불러오는 중...</div>';
  if (!SUPABASE_URL || !SUPABASE_KEY) {
    resultsEl.innerHTML = '<div class="empty">설정에서 Supabase 정보를 입력하세요</div>';
    return;
  }
  try {
    let ctxUrl = `${SUPABASE_URL}/rest/v1/contexts?select=*&order=health_score.desc`;
    if (projectId) ctxUrl += `&project_id=eq.${projectId}`;
    let docsUrl = `${SUPABASE_URL}/rest/v1/documents?select=project_id,title,content,doc_type,created_at&order=created_at.desc&limit=30`;
    if (projectId) docsUrl += `&project_id=eq.${projectId}`;
    const headers = { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` };
    const [ctxRes, docsRes] = await Promise.all([fetch(ctxUrl, { headers }), fetch(docsUrl, { headers })]);
    const data = await ctxRes.json();
    const allDocs = await docsRes.json();
    if (!data.length) { resultsEl.innerHTML = '<div class="empty">맥락 없음</div>'; return; }
    resultsEl.innerHTML = data.map((row, idx) => {
      const project = PROJECTS.find(p => p.id === row.project_id);
      const name  = project?.name || '?';
      const color = project?.color || '#8B949E';
      const score = row.health_score || 0;
      const scoreColor = score >= 70 ? '#3FB950' : score >= 40 ? '#FFA657' : '#F78166';
      const summary  = row.summary  || '—';
      const lastTask = row.last_task || '—';
      const nextAction = row.next_action || '—';
      const recentDocs = (allDocs || []).filter(d => d.project_id === row.project_id).slice(0,3).map(d => {
        const clean = d.content.replace(/\[Claude 자동 캡처[^\]]*\]/g, '').replace(/👤[^\n]*/g, '').replace(/🤖 /g, '').split('\n').map(l=>l.trim()).filter(l=>l.length>10).slice(0,2).join(' ').slice(0,100);
        return `- ${d.title.replace(/\[.*?\]\s*/,'')} : ${clean}`;
      }).join('\n');
      const clipText = `=== HANDOFF ===\n프로젝트: ${name}\n마지막 작업: ${lastTask}\n다음 액션: ${nextAction}\n요약: ${summary}\n최근 작업:\n${recentDocs || '기록 없음'}\n==============`;
      return `
        <div class="ctx-card">
          <div class="ctx-top">
            <span class="ctx-name" style="color:${color}">${escapeHtml(name)}</span>
            <span class="ctx-health" style="color:${scoreColor}">${score}/100</span>
          </div>
          <div class="ctx-summary">${escapeHtml(summary)}</div>
          <div class="ctx-last">📌 ${escapeHtml(lastTask)}</div>
          <div class="ctx-last">🎯 ${escapeHtml(nextAction)}</div>
          <div class="ctx-actions">
            <button class="btn-sm btn-copy" data-action="copy" data-text="${encodeURIComponent(clipText)}">📋 Claude에 복사</button>
            <button class="btn-sm" data-action="toggle-ctx" data-target="ctx-detail-${idx}">상세보기</button>
          </div>
          <div id="ctx-detail-${idx}" style="display:none; margin-top:8px; font-size:11px; color:var(--text2); line-height:1.5;">
            ${recentDocs ? `<div style="margin-bottom:6px;"><b>최근 작업:</b><br><pre style="white-space:pre-wrap;">${escapeHtml(recentDocs)}</pre></div>` : ''}
            ${row.architecture ? `<div><b>구조:</b> ${escapeHtml(row.architecture)}</div>` : ''}
            ${row.dependencies ? `<div><b>의존성:</b> ${escapeHtml(row.dependencies)}</div>` : ''}
            ${row.decisions ? `<div><b>결정:</b> ${escapeHtml(row.decisions)}</div>` : ''}
            ${row.code_context ? `<div><b>코드:</b> ${escapeHtml(row.code_context)}</div>` : ''}
          </div>
        </div>`;
    }).join('');
  } catch (e) {
    resultsEl.innerHTML = '<div class="empty">불러오기 실패</div>';
  }
}

// ── 헬스 ──
async function loadHealth() {
  const list = document.getElementById('healthList');
  if (!SUPABASE_URL || !SUPABASE_KEY) {
    list.innerHTML = '<div class="empty">설정에서 Supabase 정보를 입력하세요</div>';
    return;
  }
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/contexts?select=project_id,health_score,phase,last_task&order=health_score.desc`, {
      headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` }
    });
    const data = await res.json();
    if (!data.length) { list.innerHTML = '<div class="empty">데이터 없음</div>'; return; }
    list.innerHTML = data.map(row => {
      const project = PROJECTS.find(p => p.id === row.project_id);
      if (!project) return '';
      const score = row.health_score || 0;
      const color = score >= 70 ? '#3FB950' : score >= 40 ? '#FFA657' : '#F78166';
      const lastTask = (row.last_task || '—').substring(0, 45) + ((row.last_task || '').length > 45 ? '...' : '');
      return `
        <div class="project-card">
          <div class="project-card-top">
            <span class="project-name" style="color:${project.color}">${escapeHtml(project.name)}</span>
            <span class="project-score" style="color:${color}">${score}/100</span>
          </div>
          <div class="health-bar"><div class="health-fill" style="width:${score}%;background:${color};"></div></div>
          <div class="project-phase">${row.phase || 'phase0'} · ${escapeHtml(lastTask)}</div>
        </div>`;
    }).join('');
  } catch { list.innerHTML = '<div class="empty">로드 실패</div>'; }
}

// ── 문서 저장 ──
async function saveDoc() {
  const projectId = document.getElementById('docProject').value;
  const title     = document.getElementById('docTitle').value.trim();
  const content   = document.getElementById('docContent').value.trim();
  if (!projectId) return showToast('프로젝트를 선택하세요', 'error');
  if (!title)     return showToast('제목을 입력하세요', 'error');
  if (!content)   return showToast('내용을 입력하세요', 'error');
  if (!SUPABASE_URL || !SUPABASE_KEY) return showToast('설정에서 Supabase 정보를 입력하세요', 'error');
  setLoading('doc', true);
  try {
    const res = await sbInsert('documents', { project_id: projectId, title, content, doc_type: selectedDocType });
    if (!res.ok) throw new Error(await res.text());
    showToast('📄 문서 저장 완료!', 'success');
    document.getElementById('docTitle').value = '';
    document.getElementById('docContent').value = '';
  } catch (e) {
    showToast('❌ 저장 실패: ' + e.message, 'error');
  } finally {
    setLoading('doc', false);
  }
}

// ── 설정 저장 ──
async function saveSettings() {
  const url = document.getElementById('settingUrl').value.trim();
  const key = document.getElementById('settingKey').value.trim();
  chrome.storage.local.set({ supabaseUrl: url, supabaseKey: key }, () => {
    SUPABASE_URL = url;
    SUPABASE_KEY = key;
    showToast('✅ 설정 저장 완료', 'success');
    checkConnection();
  });
}

// ── Supabase 헬퍼 ──
async function sbInsert(table, data) {
  return fetch(`${SUPABASE_URL}/rest/v1/${table}`, {
    method: 'POST',
    headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}`, 'Content-Type': 'application/json', 'Prefer': 'return=minimal' },
    body: JSON.stringify(data)
  });
}
async function sbUpdate(table, data, filter) {
  return fetch(`${SUPABASE_URL}/rest/v1/${table}?${filter}`, {
    method: 'PATCH',
    headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}`, 'Content-Type': 'application/json', 'Prefer': 'return=minimal' },
    body: JSON.stringify(data)
  });
}

// ── 이벤트 위임 ──
document.addEventListener('click', (e) => {
  const btn = e.target.closest('button');
  if (!btn) return;
  if (btn.dataset.action === 'toggle-body') {
    const el = document.getElementById(btn.dataset.target);
    const expanded = el.classList.toggle('expanded');
    btn.textContent = expanded ? '접기' : '펼치기';
  }
  if (btn.dataset.action === 'copy') {
    const text = decodeURIComponent(btn.dataset.text);
    navigator.clipboard.writeText(text).then(() => showToast('📋 복사됐어요!', 'success'));
  }
  if (btn.dataset.action === 'toggle-ctx') {
    const el = document.getElementById(btn.dataset.target);
    const visible = el.style.display === 'none';
    el.style.display = visible ? 'block' : 'none';
    btn.textContent = visible ? '접기' : '상세보기';
  }
  if (btn.dataset.action === 'done') handleDone(btn.dataset.id);
  if (btn.dataset.action === 'fail') handleFail(btn.dataset.id);
  if (btn.dataset.action === 'pick-ai') {
    const text = decodeURIComponent(btn.dataset.text);
    document.getElementById('logNextAction').value = text;
  }
});

// ── UI 헬퍼 ──
function formatDate() {
  const d = new Date();
  return `${d.getFullYear()}.${String(d.getMonth()+1).padStart(2,'0')}.${String(d.getDate()).padStart(2,'0')}`;
}
function fmtTime(iso) {
  const d = new Date(iso);
  return `${d.getMonth()+1}/${d.getDate()} ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
}
function setLoading(type, loading) {
  const cap = type.charAt(0).toUpperCase() + type.slice(1);
  const spinner = document.getElementById(`${type}Spinner`);
  const btnText = document.getElementById(`${type}BtnText`);
  const btn = document.getElementById(`btnSave${cap}`);
  if (spinner) spinner.style.display = loading ? 'block' : 'none';
  if (btnText) btnText.textContent = loading ? '저장 중...' : (type === 'log' ? '💾 DB에 저장' : '📄 문서 DB 저장');
  if (btn) btn.disabled = loading;
}
function showToast(msg, type = '') {
  // ── AI 추천 액션 생성 ──
async function generateAISuggestions() {
  const content = document.getElementById('logContent').value.trim();
  if (!content) return;

  const el = document.getElementById('aiSuggestions');
  if (!el) return;

  el.innerHTML = '⟳ 추천 생성중...';

  try {
    const res = await fetch(`${SUPABASE_URL}/functions/v1/ai-next-action`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': SUPABASE_KEY
      },
      body: JSON.stringify({ text: content })
    });

    const data = await res.json();

    if (!data.suggestions) throw new Error();

    el.innerHTML = data.suggestions.map(s =>
      `<button class="btn-sm" data-action="pick-ai" data-text="${encodeURIComponent(s)}">${escapeHtml(s)}</button>`
    ).join('');

  } catch {
    el.innerHTML = '<span style="color:#F78166">추천 실패</span>';
  }
}
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.className = 'toast show ' + type;
  setTimeout(() => t.className = 'toast', 2500);
}
// ── Manus Bridge: 자동 동기화 엔진 ──
async function syncWithManus() {
  const MANUS_URL = 'https://8080-ixitdeovip2i3v0zncojy-43352031.sg1.manus.computer/handoff.json'; // 마누스가 제공할 임시 URL
  const saveBtn = document.getElementById('saveBtn' );
  const taskInput = document.getElementById('taskContent'); // 실제 input ID에 맞게 수정 필요

  try {
    const res = await fetch(MANUS_URL);
    if (!res.ok) return;

    const data = await res.json();
    if (data && data.report) {
      // 1. 작업 내용 자동 채우기
      taskInput.value = data.report;
      
      // 2. "마누스의 기억 도착" 알림 (선택사항)
      const statusLine = document.querySelector('.status-line'); // 상태 표시줄이 있다면
      if (statusLine) statusLine.textContent = "🤖 마누스의 작업 리포트가 로드되었습니다!";

      // 3. 저장 버튼 반짝임 효과 (CSS 애니메이션 추가 필요)
      saveBtn.classList.add('manus-blink');
      console.log("Manus Bridge: Sync Complete!");
    }
  } catch (e) {
    console.log("Manus Bridge: Waiting for Manus...");
  }
}

// 팝업 열릴 때 실행
document.addEventListener('DOMContentLoaded', () => {
  syncWithManus();
  // ... 기존 초기화 코드 ...
});
