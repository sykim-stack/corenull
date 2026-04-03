// api/comment.js
import { supabase } from '../lib/supabase.js';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-device-id');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const { action } = req.query;

  // ── REACTION ────────────────────────────────────────────────────────────
  if (action === 'react') {
    const deviceId = req.headers['x-device-id'];

    // GET: 특정 포스트의 reaction 수 + 내가 눌렀는지
    if (req.method === 'GET') {
      const { target_id, target_type = 'post' } = req.query;
      if (!target_id) return res.status(400).json({ error: 'target_id required' });

      const { data, error } = await supabase
        .schema('corenull')
        .from('reactions')
        .select('*')
        .eq('target_id', target_id)
        .eq('target_type', target_type);

      if (error) return res.status(500).json({ error: error.message });

      const count = data.length;
      const reacted = deviceId ? data.some(r => r.device_id === deviceId) : false;
      return res.status(200).json({ count, reacted });
    }

    // POST: 토글 (있으면 삭제, 없으면 추가)
    if (req.method === 'POST') {
      const { house_id, target_id, target_type = 'post', emoji = '❤️' } = req.body;
      if (!house_id || !target_id || !deviceId)
        return res.status(400).json({ error: 'house_id, target_id, x-device-id required' });

      const { data: existing } = await supabase
        .schema('corenull')
        .from('reactions')
        .select('id')
        .eq('target_id', target_id)
        .eq('target_type', target_type)
        .eq('device_id', deviceId)
        .single();

      if (existing) {
        await supabase.schema('corenull').from('reactions').delete().eq('id', existing.id);
        return res.status(200).json({ reacted: false });
      } else {
        await supabase.schema('corenull').from('reactions').insert({
          house_id, target_id, target_type, emoji, device_id: deviceId
        });
        return res.status(200).json({ reacted: true });
      }
    }
  }

  // ── COMMENT GET ─────────────────────────────────────────────────────────
  if (req.method === 'GET') {
    const { house_id, room_id, post_id } = req.query;
    if (!house_id) return res.status(400).json({ error: 'house_id required' });

    let query = supabase
      .schema('corenull')
      .from('comments')
      .select('*')
      .eq('house_id', house_id)
      .order('created_at', { ascending: true });

    if (post_id) query = query.eq('post_id', post_id);
    else if (room_id) query = query.eq('room_id', room_id).is('post_id', null);
    else query = query.is('room_id', null).is('post_id', null);

    const { data, error } = await query;
    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json({ comments: data });
  }

  // ── COMMENT POST ─────────────────────────────────────────────────────────
  if (req.method === 'POST') {
    let { house_id, slug, author_name, content, media_url, room_id, post_id } = req.body;

    if (!house_id && slug) {
      const { data: houses, error: hErr } = await supabase
        .schema('corenull')
        .from('houses')
        .select('id')
        .eq('slug', slug)
        .single();
      if (hErr || !houses) return res.status(404).json({ error: '집을 찾을 수 없어요' });
      house_id = houses.id;
    }

    if (!house_id || !author_name || !content)
      return res.status(400).json({ error: 'house_id(또는 slug), author_name, content required' });

    if (content.length > 500)
      return res.status(400).json({ error: '댓글은 500자 이내로 작성해주세요' });

    const isKorean = /[ㄱ-ㅎ가-힣]/.test(content);
    const isVietnamese = /[àáảãạăắặằẳẵâấầẩẫậđèéẻẽẹêếềểễệìíỉĩịòóỏõọôốồổỗộơớờởỡợùúủũụưứừửữựỳýỷỹỵ]/i.test(content);
    const lang = isKorean ? 'ko' : isVietnamese ? 'vi' : 'other';

    const { data, error } = await supabase
      .schema('corenull')
      .from('comments')
      .insert({
        house_id,
        author_name,
        content_original: content,
        lang,
        media_url: media_url || null,
        room_id: room_id || null,
        post_id: post_id || null,
      })
      .select()
      .single();

    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json({ success: true, comment: data });
  }

  // ── COMMENT DELETE ────────────────────────────────────────────────────────
  if (req.method === 'DELETE') {
    const { comment_id, house_id } = req.body;
    if (!comment_id || !house_id)
      return res.status(400).json({ error: 'comment_id, house_id required' });

    const { error } = await supabase
      .schema('corenull')
      .from('comments')
      .delete()
      .eq('id', comment_id)
      .eq('house_id', house_id);

    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json({ success: true });
  }

  return res.status(405).end();
}