const IS_DEBUG = new URLSearchParams(location.search).has('debug');
if (!IS_DEBUG) { window.Debug = { log: () => {}, api: () => {}, state: () => {} }; }
else {
  const logs = [];
  const fmt = () => new Date().toTimeString().slice(0,8);

  function push(type, msg) {
    logs.push({ time: fmt(), type, msg });
    render();
  }

  function render() {
    const el = document.getElementById('__debug_log');
    if (!el) return;
    el.innerHTML = logs.slice(-20).reverse().map(l =>
      `<div style="display:flex;gap:8px;padding:5px 12px;border-bottom:0.5px solid var(--color-border-tertiary)">
        <span style="font-size:10px;color:var(--color-text-tertiary);min-width:50px">${l.time}</span>
        <span style="font-size:10px;min-width:60px;color:${typeColor(l.type)}">${l.type}</span>
        <span style="font-size:11px;color:var(--color-text-secondary)">${l.msg}</span>
      </div>`
    ).join('');
  }

  function typeColor(t) {
    return { API:'#185FA5', EVENT:'#533AB7', ERROR:'#A32D2D', STATE:'#3B6D11' }[t] || '#888';
  }

  function setState(obj) {
    document.getElementById('__debug_house_id') && (document.getElementById('__debug_house_id').textContent = obj.house_id?.slice(0,8)+'...' || '-');
    document.getElementById('__debug_slug') && (document.getElementById('__debug_slug').textContent = obj.slug || '-');
    document.getElementById('__debug_tab') && (document.getElementById('__debug_tab').textContent = obj.tab || '-');
    document.getElementById('__debug_posts') && (document.getElementById('__debug_posts').textContent = obj.posts ?? '-');
    document.getElementById('__debug_owner') && (document.getElementById('__debug_owner').textContent = obj.owner ? 'true' : 'false');
    push('STATE', `slug:${obj.slug} tab:${obj.tab} posts:${obj.posts}`);
  }

  function inject() {
    const div = document.createElement('div');
    div.id = '__debug_panel';
    div.style.cssText = 'position:fixed;bottom:16px;right:16px;width:320px;z-index:9999;font-family:monospace;font-size:12px;border:0.5px solid var(--color-border-secondary);border-radius:12px;overflow:hidden;background:var(--color-background-primary);box-shadow:0 4px 16px rgba(0,0,0,0.12)';
    div.innerHTML = `
      <div style="display:flex;align-items:center;justify-content:space-between;padding:8px 12px;background:var(--color-background-secondary);border-bottom:0.5px solid var(--color-border-tertiary)">
        <span style="font-size:11px;font-weight:500;color:var(--color-text-secondary)">CORENULL DEBUG</span>
        <span style="font-size:10px;padding:2px 8px;border-radius:99px;background:#EAF3DE;color:#3B6D11">ON</span>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:1px;background:var(--color-border-tertiary)">
        ${['house_id','slug','tab','posts','owner','last_api'].map(k => `
          <div style="background:var(--color-background-primary);padding:8px 12px">
            <div style="font-size:10px;color:var(--color-text-tertiary);margin-bottom:3px">${k}</div>
            <div id="__debug_${k}" style="font-size:12px;font-weight:500;color:var(--color-text-primary)">-</div>
          </div>`).join('')}
      </div>
      <div style="border-top:0.5px solid var(--color-border-tertiary)">
        <div style="padding:6px 12px;font-size:10px;color:var(--color-text-tertiary)">event log</div>
        <div id="__debug_log" style="max-height:120px;overflow-y:auto"></div>
      </div>`;
    document.body.appendChild(div);
  }

  document.addEventListener('DOMContentLoaded', inject);

  window.Debug = {
    log: (msg) => push('EVENT', msg),
    api: (url, status, ms) => {
      push('API', `${url} → ${status} (${ms}ms)`);
      const el = document.getElementById('__debug_last_api');
      if (el) el.textContent = `${status} ${ms}ms`;
      if (el) el.style.color = status < 300 ? '#3B6D11' : '#A32D2D';
    },
    state: setState,
    error: (msg) => push('ERROR', msg),
  };
}