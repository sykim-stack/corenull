// api/comment.js
// 댓글(방명록) 작성 + 언어 감지

import { supabase } from '../lib/supabase.js';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  // GET — 댓글 목록 조회
  if (req.method === 'GET') {
    const { house_id } = req.query;
    if (!house_id) return res.status(400).json({ error: 'house_id required' });

    const { data, error } = await supabase
      .schema('corenull')
      .from('comments')
      .select('*')
      .eq('house_id', house_id)
      .order('created_at', { ascending: false });

    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json({ comments: data });
  }

  // POST — 댓글 저장
  if (req.method === 'POST') {
    const { house_id, author_name, content } = req.body;

    if (!house_id || !author_name || !content) {
      return res.status(400).json({ error: 'house_id, author_name, content required' });
    }
    if (content.length > 500) {
      return res.status(400).json({ error: '댓글은 500자 이내로 작성해주세요' });
    }

    const isKorean = /[ㄱ-ㅎ가-힣]/.test(content);
    const isVietnamese = /[àáảãạăắặằẳẵâấầẩẫậđèéẻẽẹêếềểễệìíỉĩịòóỏõọôốồổỗộơớờởỡợùúủũụưứừửữựỳýỷỹỵ]/i.test(content);
    const lang = isKorean ? 'ko' : isVietnamese ? 'vi' : 'other';

    const { data, error } = await supabase
      .schema('corenull')
      .from('comments')
      .insert({
        house_id,
        author_name,
        content_original: content,   // ← 여기 수정
        lang
      })
      .select()
      .single();

    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json({ success: true, comment: data });
  }

  return res.status(405).end();
}