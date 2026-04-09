// api/comment.js
// ✅ fetch 직접 방식 통일 (supabase import 제거)
// ✅ action=react GET/POST 통합
// ✅ post_id 기반 GET 지원
// ✅ response 구조 통일 { success, data / error }

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-device-id');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const BASE = process.env.SUPABASE_URL;
  const KEY  = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const H = {
    'apikey': KEY,
    'Authorization': `Bearer ${KEY}`,
    'Content-Type': 'application/json',
    'Accept-Profile': 'corenull',
    'Content-Profile': 'corenull',
    'Prefer': 'return=representation',
  };

  // ────────────────────────────────────────────────────────────
  // GET
  // ────────────────────────────────────────────────────────────
  if (req.method === 'GET') {
    const { action, house_id, post_id, target_id, target_type } = req.query;
    const deviceId = req.headers['x-device-id'] || '';

    // ── GET reaction 상태 ──
    if (action === 'react') {
      if (!target_id || !target_type) return res.status(400).json({ error: 'target_id, target_type required' });

      // 전체 카운트
      const countRes = await fetch(
        `${BASE}/rest/v1/reactions?target_id=eq.${target_id}&target_type=eq.${target_type}&select=id`,
        { headers: H }
      );
      const countData = await countRes.json();
      const count = Array.isArray(countData) ? countData.length : 0;

      // 내 reaction 여부
      let reacted = false;
      if (deviceId) {
        const myRes = await fetch(
          `${BASE}/rest/v1/reactions?target_id=eq.${target_id}&target_type=eq.${target_type}&device_id=eq.${deviceId}&select=id&limit=1`,
          { headers: H }
        );
        const myData = await myRes.json();
        reacted = Array.isArray(myData) && myData.length > 0;
      }

      return res.status(200).json({ success: true, count, reacted });
    }

    // ── GET 댓글 ──
    if (!house_id) return res.status(400).json({ error: 'house_id required' });

    let url = `${BASE}/rest/v1/comments?house_id=eq.${house_id}&order=created_at.asc`;
    if (post_id) {
      url += `&post_id=eq.${post_id}`;
    } else {
      // house 방명록: post_id가 null인 것만
      url += `&post_id=is.null`;
    }

    const r = await fetch(url, { headers: H });
    const data = await r.json();
    if (!Array.isArray(data)) return res.status(500).json({ error: 'fetch failed', raw: data });
    return res.status(200).json({ success: true, comments: data });
  }

  // ────────────────────────────────────────────────────────────
  // POST
  // ────────────────────────────────────────────────────────────
  if (req.method === 'POST') {
    const { action } = req.body;
    const deviceId = req.headers['x-device-id'] || '';

    // ── POST reaction 토글 ──
    if (action === 'react') {
      const { house_id, target_id, target_type, emoji } = req.body;
      if (!target_id || !target_type) return res.status(400).json({ error: 'target_id, target_type required' });
      if (!deviceId) return res.status(400).json({ error: 'x-device-id header required' });

      // 기존 reaction 확인
      const checkRes = await fetch(
        `${BASE}/rest/v1/reactions?target_id=eq.${target_id}&target_type=eq.${target_type}&device_id=eq.${deviceId}&select=id&limit=1`,
        { headers: H }
      );
      const existing = await checkRes.json();

      if (Array.isArray(existing) && existing.length > 0) {
        // 이미 있으면 → 취소 (DELETE)
        await fetch(
          `${BASE}/rest/v1/reactions?target_id=eq.${target_id}&target_type=eq.${target_type}&device_id=eq.${deviceId}`,
          { method: 'DELETE', headers: H }
        );
        const countRes = await fetch(
          `${BASE}/rest/v1/reactions?target_id=eq.${target_id}&target_type=eq.${target_type}&select=id`,
          { headers: H }
        );
        const countData = await countRes.json();
        return res.status(200).json({ success: true, reacted: false, count: Array.isArray(countData) ? countData.length : 0 });
      } else {
        // 없으면 → 추가
        await fetch(`${BASE}/rest/v1/reactions`, {
          method: 'POST',
          headers: H,
          body: JSON.stringify({
            target_id,
            target_type,
            device_id: deviceId,
            house_id: house_id || null,
            emoji: emoji || '❤️',
            action_type: 'react',
          })
        });
        const countRes = await fetch(
          `${BASE}/rest/v1/reactions?target_id=eq.${target_id}&target_type=eq.${target_type}&select=id`,
          { headers: H }
        );
        const countData = await countRes.json();
        return res.status(200).json({ success: true, reacted: true, count: Array.isArray(countData) ? countData.length : 0 });
      }
    }

    // ── POST 댓글 ──
    let { house_id, slug, author_name, content, media_url, post_id } = req.body;

    // slug로 house_id 조회
    if (!house_id && slug) {
      const hRes = await fetch(`${BASE}/rest/v1/houses?slug=eq.${slug}&select=id&limit=1`, { headers: H });
      const hData = await hRes.json();
      house_id = hData[0]?.id;
      if (!house_id) return res.status(404).json({ error: '집을 찾을 수 없어요' });
    }

    if (!house_id || !author_name || !content)
      return res.status(400).json({ error: 'house_id(또는 slug), author_name, content required' });
    if (content.length > 500)
      return res.status(400).json({ error: '댓글은 500자 이내로 작성해주세요' });

    const isKorean    = /[ㄱ-ㅎ가-힣]/.test(content);
    const isVietnamese = /[àáảãạăắặằẳẵâấầẩẫậđèéẻẽẹêếềểễệìíỉĩịòóỏõọôốồổỗộơớờởỡợùúủũụưứừửữựỳýỷỹỵ]/i.test(content);
    const lang = isKorean ? 'ko' : isVietnamese ? 'vi' : 'other';

    const body = {
      house_id,
      author_name,
      content_original: content,
      lang,
      media_url: media_url || null,
      post_id: post_id || null,
    };

    const r = await fetch(`${BASE}/rest/v1/comments`, {
      method: 'POST', headers: H, body: JSON.stringify(body)
    });
    const text = await r.text();
    let data;
    try { data = JSON.parse(text); } catch (e) { return res.status(500).json({ error: 'parse error', raw: text }); }
    const comment = Array.isArray(data) ? data[0] : data;
    if (!comment?.id) return res.status(500).json({ error: '댓글 등록 실패', raw: data });

    return res.status(200).json({ success: true, comment });
  }

  // ────────────────────────────────────────────────────────────
  // DELETE
  // ────────────────────────────────────────────────────────────
  if (req.method === 'DELETE') {
    const { comment_id, house_id } = req.body;
    if (!comment_id || !house_id) return res.status(400).json({ error: 'comment_id, house_id required' });

    const r = await fetch(
      `${BASE}/rest/v1/comments?id=eq.${comment_id}&house_id=eq.${house_id}`,
      { method: 'DELETE', headers: H }
    );
    if (!r.ok) return res.status(500).json({ error: '삭제 실패' });
    return res.status(200).json({ success: true });
  }

  return res.status(405).json({ error: 'Method not allowed' });
}