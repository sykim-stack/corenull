// api/comment.js
import { supabase } from '../lib/supabase.js';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const action = req.query.action || req.body?.action || null;

  // ── POST COMMENT (event_posts) ──────────────────
  if (action === 'post-comment') {
    if (req.method === 'GET') {
      const { post_id } = req.query;
      if (!post_id) return res.status(400).json({ error: 'post_id required' });
      const { data, error } = await supabase
        .schema('corenull')
        .from('event_posts')
        .select('*')
        .eq('room_id', post_id)
        .order('created_at', { ascending: true });
      if (error) return res.status(500).json({ error: error.message });
      return res.status(200).json({ comments: data });
    }
    if (req.method === 'POST') {
      const { post_id, house_id, author_name, content } = req.body;
      if (!post_id || !house_id || !author_name || !content)
        return res.status(400).json({ error: 'post_id, house_id, author_name, content required' });
      if (content.length > 300)
        return res.status(400).json({ error: '300자 이내로 작성해주세요' });
      const isKorean = /[ㄱ-ㅎ가-힣]/.test(content);
      const isVietnamese = /[àáảãạăắặằẳẵâấầẩẫậđèéẻẽẹêếềểễệìíỉĩịòóỏõọôốồổỗộơớờởỡợùúủũụưứừửữựỳýỷỹỵ]/i.test(content);
      const lang = isKorean ? 'ko' : isVietnamese ? 'vi' : 'other';
      const { data, error } = await supabase
        .schema('corenull')
        .from('event_posts')
        .insert({ house_id, room_id: post_id, author_name, content, lang })
        .select()
        .single();
      if (error) return res.status(500).json({ error: error.message });
      return res.status(200).json({ success: true, comment: data });
    }
  }

  // ── GUESTBOOK (comments) ────────────────────────
  if (req.method === 'GET') {
    const { house_id, room_id } = req.query;
    if (!house_id) return res.status(400).json({ error: 'house_id required' });
    let query = supabase
      .schema('corenull')
      .from('comments')
      .select('*')
      .eq('house_id', house_id)
      .order('created_at', { ascending: false });
    if (room_id) query = query.eq('room_id', room_id);
    else query = query.is('room_id', null);
    const { data, error } = await query;
    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json({ comments: data });
  }

  if (req.method === 'POST') {
    let { house_id, slug, author_name, content, media_url, room_id } = req.body;
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
      return res.status(400).json({ error: '500자 이내로 작성해주세요' });
    const isKorean = /[ㄱ-ㅎ가-힣]/.test(content);
    const isVietnamese = /[àáảãạăắặằẳẵâấầẩẫậđèéẻẽẹêếềểễệìíỉĩịòóỏõọôốồổỗộơớờởỡợùúủũụưứừửữựỳýỷỹỵ]/i.test(content);
    const lang = isKorean ? 'ko' : isVietnamese ? 'vi' : 'other';
    const { data, error } = await supabase
      .schema('corenull')
      .from('comments')
      .insert({ house_id, author_name, content_original: content, lang, media_url: media_url || null, room_id: room_id || null })
      .select()
      .single();
    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json({ success: true, comment: data });
  }

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