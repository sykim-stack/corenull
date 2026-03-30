// api/comment.js
// 방명록 (post_id = null) + 포스트 댓글 (post_id = uuid) 통합

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  // ── GET ──────────────────────────────────────────────────────────────────
  if (req.method === 'GET') {
    const { house_id, post_id } = req.query;

    // 포스트 댓글 조회 (post_id 기준)
    if (post_id) {
      const { data, error } = await supabase
        .schema('corenull')
        .from('comments')
        .select('*')
        .eq('post_id', post_id)
        .order('created_at', { ascending: true });
      if (error) return res.status(500).json({ error: error.message });
      return res.status(200).json({ comments: data });
    }

    // 방명록 조회 (house_id 기준, post_id = null)
    if (!house_id) return res.status(400).json({ error: 'house_id or post_id required' });
    const { data, error } = await supabase
      .schema('corenull')
      .from('comments')
      .select('*')
      .eq('house_id', house_id)
      .is('post_id', null)
      .order('created_at', { ascending: false });
    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json({ comments: data });
  }

  // ── POST ─────────────────────────────────────────────────────────────────
  if (req.method === 'POST') {
    let { house_id, slug, author_name, content, media_url, post_id } = req.body;

    // slug → house_id 변환
    if (!house_id && slug) {
      const { data: house, error: hErr } = await supabase
        .schema('corenull')
        .from('houses')
        .select('id')
        .eq('slug', slug)
        .single();
      if (hErr || !house) return res.status(404).json({ error: '집을 찾을 수 없어요' });
      house_id = house.id;
    }

    // post_id → house_id 변환 (포스트 댓글, house_id 없을 때)
    if (!house_id && post_id) {
      const { data: post, error: pErr } = await supabase
        .schema('corenull')
        .from('posts')
        .select('house_id')
        .eq('id', post_id)
        .single();
      if (pErr || !post) return res.status(404).json({ error: '포스트를 찾을 수 없어요' });
      house_id = post.house_id;
    }

    if (!house_id || !author_name || !content)
      return res.status(400).json({ error: 'house_id(또는 slug/post_id), author_name, content required' });
    if (content.length > 500)
      return res.status(400).json({ error: '댓글은 500자 이내로 작성해주세요' });

    const isKorean     = /[ㄱ-ㅎ가-힣]/.test(content);
    const isVietnamese = /[àáảãạăắặằẳẵâấầẩẫậđèéẻẽẹêếềểễệìíỉĩịòóỏõọôốồổỗộơớờởỡợùúủũụưứừửữựỳýỷỹỵ]/i.test(content);
    const lang = isKorean ? 'ko' : isVietnamese ? 'vi' : 'other';

    const { data, error } = await supabase
      .schema('corenull')
      .from('comments')
      .insert({
        house_id,
        author_name,
        content,
        lang,
        media_url: media_url || null,
        post_id:   post_id   || null,   // null = 방명록, uuid = 포스트 댓글
      })
      .select()
      .single();
    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json({ success: true, comment: data });
  }

  // ── DELETE ───────────────────────────────────────────────────────────────
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

  res.status(405).json({ error: 'Method not allowed' });
}