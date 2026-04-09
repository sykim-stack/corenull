// /api/rooms.js v3.1 — category 자동생성/삭제 제거

export default async function handler(req, res) {
  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

  const db = (path, method, body) =>
    fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
      method,
      headers: {
        apikey: SUPABASE_KEY,
        Authorization: `Bearer ${SUPABASE_KEY}`,
        'Content-Type': 'application/json',
        'Accept-Profile': 'corenull',
        'Content-Profile': 'corenull',
        Prefer: 'return=representation',
      },
      body: body ? JSON.stringify(body) : undefined,
    });

  if (req.method === 'GET') {
    const { room_id } = req.query;
    if (!room_id) return res.status(400).json({ error: 'room_id 필요' });

    const rRes = await db(`rooms?id=eq.${room_id}&select=info_title,info_body,info_account`, 'GET');
    if (!rRes.ok) return res.status(500).json({ error: '조회 실패' });

    const rows = await rRes.json();
    const room = rows?.[0];
    if (!room) return res.status(404).json({ error: 'room 없음' });

    return res.status(200).json({
      info_title: room.info_title || '',
      info_body: room.info_body || '',
      info_account: room.info_account || '',
    });
  }

  if (req.method === 'POST') {
    const { house_id, owner_key, room_name, event_date } = req.body;
    if (!house_id || !owner_key || !room_name)
      return res.status(400).json({ error: '필수값 누락' });

    const hRes = await db(`houses?id=eq.${house_id}&select=owner_key`, 'GET');
    if (!hRes.ok) {
      const detail = await hRes.text();
      return res.status(500).json({ error: 'house 조회 실패', detail });
    }

    const houses = await hRes.json();
    const house = houses?.[0];
    if (!house || house.owner_key !== owner_key)
      return res.status(403).json({ error: '권한 없음' });

    const oRes = await db(`rooms?house_id=eq.${house_id}&select=order_num&order=order_num.desc&limit=1`, 'GET');
    const lastArr = await oRes.json();
    const order_num = (lastArr?.[0]?.order_num || 0) + 1;

    const rRes = await db('rooms', 'POST', {
      house_id,
      room_name,
      room_type: 'event',
      event_date: event_date || null,
      order_num,
      is_hidden: false,
    });

    if (!rRes.ok) {
      const detail = await rRes.json();
      return res.status(500).json({ error: '방 생성 실패', detail });
    }

    const [room] = await rRes.json();
    return res.status(200).json({ success: true, room });
  }

  if (req.method === 'PATCH') {
    const { room_id, house_id, owner_key, room_name, event_date, info_title, info_body, info_account } = req.body;
    if (!room_id || !house_id || !owner_key)
      return res.status(400).json({ error: '필수값 누락' });

    const hRes = await db(`houses?id=eq.${house_id}&select=owner_key`, 'GET');
    if (!hRes.ok) return res.status(500).json({ error: 'house 조회 실패' });

    const houses = await hRes.json();
    const house = houses?.[0];
    if (!house || house.owner_key !== owner_key)
      return res.status(403).json({ error: '권한 없음' });

    const update = {};
    if (room_name !== undefined) update.room_name = room_name;
    if (event_date !== undefined) update.event_date = event_date || null;
    if (info_title !== undefined) update.info_title = info_title;
    if (info_body !== undefined) update.info_body = info_body;
    if (info_account !== undefined) update.info_account = info_account;

    if (!Object.keys(update).length)
      return res.status(400).json({ error: '수정할 항목 없음' });

    const rCheck = await db(`rooms?id=eq.${room_id}&house_id=eq.${house_id}&select=id`, 'GET');
    const rCheckArr = await rCheck.json();
    if (!rCheckArr?.length)
      return res.status(404).json({ error: 'room 없음' });

    const rRes = await db(`rooms?id=eq.${room_id}&house_id=eq.${house_id}`, 'PATCH', update);
    if (!rRes.ok) {
      const err = await rRes.json();
      return res.status(500).json({ error: err.message || '수정 실패' });
    }

    return res.status(200).json({ success: true });
  }

  if (req.method === 'DELETE') {
    const { room_id, house_id, owner_key } = req.body;
    if (!room_id || !house_id || !owner_key)
      return res.status(400).json({ error: '필수값 누락' });

    const hRes = await db(`houses?id=eq.${house_id}&select=owner_key`, 'GET');
    if (!hRes.ok) return res.status(500).json({ error: 'house 조회 실패' });

    const houses = await hRes.json();
    const house = houses?.[0];
    if (!house || house.owner_key !== owner_key)
      return res.status(403).json({ error: '권한 없음' });

    await db(`media?room_id=eq.${room_id}`, 'PATCH', { room_id: null });

    const rRes = await db(`rooms?id=eq.${room_id}&house_id=eq.${house_id}`, 'DELETE');
    if (!rRes.ok) {
      const err = await rRes.json();
      return res.status(500).json({ error: err.message || '삭제 실패' });
    }

    return res.status(200).json({ success: true });
  }

  return res.status(405).json({ error: 'Method not allowed' });
}

// ─────────────────────────────────────────────────────────────
// 📦 apiFetch — 공통 API 래퍼 (common.js에 통합)
// ─────────────────────────────────────────────────────────────
// 사용법:
//   const data = await apiFetch('/api/comment', { method:'POST', body:{...} })
//   → 실패 시 자동 토스트 + 콘솔 debug 출력
//   → 성공 시 data 반환
// ─────────────────────────────────────────────────────────────

// ── 토스트 ───────────────────────────────────────────────────
let _toastTimer = null;

export function showToast(msg, type = 'info', duration = 3500) {
  let el = document.getElementById('_bp_toast');
  if (!el) {
    el = document.createElement('div');
    el.id = '_bp_toast';
    el.style.cssText = `
      position:fixed; bottom:24px; left:50%; transform:translateX(-50%) translateY(20px);
      min-width:220px; max-width:360px; padding:12px 20px;
      border-radius:14px; font-size:13px; font-family:'Gowun Dodum',serif;
      text-align:center; z-index:99999; pointer-events:none;
      opacity:0; transition:opacity .25s, transform .25s;
      box-shadow:0 4px 20px rgba(0,0,0,.18);
    `;
    document.body.appendChild(el);
  }

  const themes = {
    info:    { bg: 'var(--brown,#8b5e3c)',  color: '#fff' },
    success: { bg: '#4caf82',               color: '#fff' },
    error:   { bg: '#e05c5c',               color: '#fff' },
    warn:    { bg: '#e0a84a',               color: '#fff' },
  };
  const t = themes[type] || themes.info;
  el.style.background = t.bg;
  el.style.color       = t.color;
  el.textContent       = msg;

  // 표시
  requestAnimationFrame(() => {
    el.style.opacity   = '1';
    el.style.transform = 'translateX(-50%) translateY(0)';
  });

  clearTimeout(_toastTimer);
  _toastTimer = setTimeout(() => {
    el.style.opacity   = '0';
    el.style.transform = 'translateX(-50%) translateY(20px)';
  }, duration);
}

// ── apiFetch ─────────────────────────────────────────────────
const IS_DEV = location.hostname === 'localhost' || location.hostname === '127.0.0.1';

export async function apiFetch(url, options = {}) {
  const { body, headers = {}, silent = false, ...rest } = options;

  const fetchOpts = {
    ...rest,
    headers: {
      'Content-Type': 'application/json',
      ...headers,
    },
  };
  if (body) fetchOpts.body = typeof body === 'string' ? body : JSON.stringify(body);

  let res, raw;
  try {
    res = await fetch(url, fetchOpts);
    raw = await res.text();
  } catch (networkErr) {
    const msg = '네트워크 오류가 발생했어요';
    if (!silent) showToast(msg, 'error');
    console.error(`[apiFetch] 네트워크 실패 → ${url}`, networkErr);
    return null;
  }

  // JSON 파싱
  let data;
  try {
    data = JSON.parse(raw);
  } catch {
    console.error(`[apiFetch] JSON 파싱 실패 → ${url}`, raw);
    if (!silent) showToast('서버 응답 오류', 'error');
    return null;
  }

  // 실패 처리
  if (!res.ok || data?.success === false || data?.error) {
    const userMsg  = data?.error  || `오류가 발생했어요 (${res.status})`;
    const debugMsg = data?.debug  || data?.raw || raw;

    if (!silent) showToast(userMsg, 'error');

    // 개발 환경 or debug 필드 있을 때 상세 출력
    if (IS_DEV || data?.debug) {
      console.group(`[apiFetch] ❌ ${res.status} → ${url}`);
      console.error('user msg :', userMsg);
      console.error('debug    :', debugMsg);
      console.error('full body:', data);
      console.groupEnd();
    } else {
      console.error(`[apiFetch] ❌ ${res.status} → ${url} |`, userMsg);
    }
    return null;
  }

  return data;
}

// ── window 노출 (house.html 인라인 onclick용) ─────────────────
window.showToast  = showToast;
window.apiFetch   = apiFetch;