// api/comment.js
import { supabase } from '../lib/supabase.js';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  // GET
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

  // POST
  if (req.method === 'POST') {
    const { house_id, author_name, content, media_url } = req.body;

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
        content_original: content,
        lang,
        media_url: media_url || null
      })
      .select()
      .single();

    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json({ success: true, comment: data });
  }

  // DELETE
  if (req.method === 'DELETE') {
    const { comment_id, house_id } = req.body;
    if (!comment_id || !house_id) {
      return res.status(400).json({ error: 'comment_id, house_id required' });
    }

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