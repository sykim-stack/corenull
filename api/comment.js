// api/comment.js
// ✅ fetch 직접 방식 통일
// ✅ action=react GET/POST 통합
// ✅ post_id 기반 GET 지원
// ✅ { success, data/comments, error, debug } 응답 통일

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

  // 공통 에러 응답
  const fail = (status, error, debug = null) =>
    res.status(status).json({ success: false, error, ...(debug ? { debug } : {}) });

  const ok = (data) =>
    res.status(200).json({ success: true, ...data });

  // ────────────────────────────────────────────────────────────
  // GET
  // ────────────────────────────────────────────────────────────
  if (req.method === 'GET') {
    const { action, house_id, post_id, target_id, target_type } = req.query;
    const deviceId = req.headers['x-device-id'] || '';

    // ── GET reaction 상태 ──
    if (action === 'react') {
      if (!target_id || !target_type)
        return fail(400, 'target_id, target_type required');

      try {
        // 전체 카운트
        const countRes = await fetch(
          `${BASE}/rest/v1/reactions?target_id=eq.${target_id}&target_type=eq.${target_type}&select=id`,
          { headers: H }
        );
        const countRaw = await countRes.text();
        const countData = JSON.parse(countRaw);
        if (!Array.isArray(countData))
          return fail(500, 'reaction 조회 실패', countRaw);

        const count = countData.length;

        // 내 reaction 여부
        let reacted = false;
        if (deviceId) {
          const myRes = await fetch(
            `${BASE}/rest/v1/reactions?target_id=eq.${target_id}&target_type=eq.${target_type}&device_id=eq.${deviceId}&select=id&limit=1`,
            { headers: H }
          );
          const myData = JSON.parse(await myRes.text());
          reacted = Array.isArray(myData) && myData.length > 0;
        }

        return ok({ count, reacted });
      } catch (e) {
        return fail(500, 'reaction 조회 실패', e.message);
      }
    }

    // ── GET 댓글 ──
    if (!house_id) return fail(400, 'house_id required');

    try {
      let url = `${BASE}/rest/v1/comments?house_id=eq.${house_id}&order=created_at.asc`;
      if (post_id) {
        url += `&post_id=eq.${post_id}`;
      } else {
        url += `&post_id=is.null`;
      }

      const r = await fetch(url, { headers: H });
      const raw = await r.text();
      const data = JSON.parse(raw);
      if (!Array.isArray(data)) return fail(500, '댓글 조회 실패', raw);
      return ok({ comments: data });
    } catch (e) {
      return fail(500, '댓글 조회 실패', e.message);
    }
  }

  // ────────────────────────────────────────────────────────────
  // POST
  // ────────────────────────────────────────────────────────────
  if (req.method === 'POST') {
    const body = req.body;
    const { action } = body;
    const deviceId = req.headers['x-device-id'] || '';

    // ── POST reaction 토글 ──
    if (action === 'react') {
      const { house_id, target_id, target_type, emoji } = body;
      if (!target_id || !target_type)
        return fail(400, 'target_id, target_type required');
      if (!deviceId)
        return fail(400, 'x-device-id 헤더가 필요해요');

      try {
        // 기존 reaction 확인
        const checkRes = await fetch(
          `${BASE}/rest/v1/reactions?target_id=eq.${target_id}&target_type=eq.${target_type}&device_id=eq.${deviceId}&select=id&limit=1`,
          { headers: H }
        );
        const existing = JSON.parse(await checkRes.text());

        if (Array.isArray(existing) && existing.length > 0) {
          // 취소
          await fetch(
            `${BASE}/rest/v1/reactions?target_id=eq.${target_id}&target_type=eq.${target_type}&device_id=eq.${deviceId}`,
            { method: 'DELETE', headers: H }
          );
        } else {
          // 추가
          const insertRes = await fetch(`${BASE}/rest/v1/reactions`, {
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
          if (!insertRes.ok) {
            const raw = await insertRes.text();
            return fail(500, 'reaction 저장 실패', raw);
          }
        }

        // 최신 카운트
        const countRes = await fetch(
          `${BASE}/rest/v1/reactions?target_id=eq.${target_id}&target_type=eq.${target_type}&select=id`,
          { headers: H }
        );
        const countData = JSON.parse(await countRes.text());
        const reacted = !(Array.isArray(existing) && existing.length > 0);
        return ok({ reacted, count: Array.isArray(countData) ? countData.length : 0 });
      } catch (e) {
        return fail(500, 'reaction 처리 실패', e.message);
      }
    }

    // ── POST 댓글 ──
    let { house_id, slug, author_name, content, media_url, post_id } = body;

    if (!house_id && slug) {
      try {
        const hRes = await fetch(`${BASE}/rest/v1/houses?slug=eq.${slug}&select=id&limit=1`, { headers: H });
        const hData = JSON.parse(await hRes.text());
        house_id = hData[0]?.id;
        if (!house_id) return fail(404, '집을 찾을 수 없어요');
      } catch (e) {
        return fail(500, '집 조회 실패', e.message);
      }
    }

    if (!house_id || !author_name || !content)
      return fail(400, 'house_id(또는 slug), author_name, content required');
    if (content.length > 500)
      return fail(400, '댓글은 500자 이내로 작성해주세요');

    const isKo = /[ㄱ-ㅎ가-힣]/.test(content);
    const isVi = /[àáảãạăắặằẳẵâấầẩẫậđèéẻẽẹêếềểễệìíỉĩịòóỏõọôốồổỗộơớờởỡợùúủũụưứừửữựỳýỷỹỵ]/i.test(content);
    const lang = isKo ? 'ko' : isVi ? 'vi' : 'other';

    try {
      const r = await fetch(`${BASE}/rest/v1/comments`, {
        method: 'POST',
        headers: H,
        body: JSON.stringify({
          house_id,
          author_name,
          content_original: content,
          lang,
          media_url: media_url || null,
          post_id: post_id || null,
        })
      });
      const raw = await r.text();
      let data;
      try { data = JSON.parse(raw); } catch { return fail(500, 'parse error', raw); }
      const comment = Array.isArray(data) ? data[0] : data;
      if (!comment?.id) return fail(500, '댓글 등록 실패', raw);
      return ok({ comment });
    } catch (e) {
      return fail(500, '댓글 등록 실패', e.message);
    }
  }

  // ────────────────────────────────────────────────────────────
  // DELETE
  // ────────────────────────────────────────────────────────────
  if (req.method === 'DELETE') {
    const { comment_id, house_id } = req.body;
    if (!comment_id || !house_id)
      return fail(400, 'comment_id, house_id required');

    try {
      const r = await fetch(
        `${BASE}/rest/v1/comments?id=eq.${comment_id}&house_id=eq.${house_id}`,
        { method: 'DELETE', headers: H }
      );
      if (!r.ok) return fail(500, '삭제 실패', await r.text());
      return ok({});
    } catch (e) {
      return fail(500, '삭제 실패', e.message);
    }
  }

  return fail(405, 'Method not allowed');
}