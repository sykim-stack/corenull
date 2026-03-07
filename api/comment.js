// api/comment.js
// 댓글(방명록) 작성 + 언어 감지

import { supabase } from '../lib/supabase.js';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).end();

  const { house_id, author_name, content } = req.body;

  if (!house_id || !author_name || !content) {
    return res.status(400).json({ error: 'house_id, author_name, content required' });
  }

  if (content.length > 500) {
    return res.status(400).json({ error: '댓글은 500자 이내로 작성해주세요' });
  }

  // 언어 자동 감지 (한국어 / 베트남어 / 기타)
  const isKorean    = /[ㄱ-ㅎ가-힣]/.test(content);
  const isVietnamese = /[àáảãạăắặằẳẵâấầẩẫậđèéẻẽẹêếềểễệìíỉĩịòóỏõọôốồổỗộơớờởỡợùúủũụưứừửữựỳýỷỹỵ]/i.test(content);
  const lang = isKorean ? 'ko' : isVietnamese ? 'vi' : 'other';

  const { data, error } = await supabase
    .schema('corenull')
    .from('comments')
    .insert({ house_id, author_name, content, lang })
    .select()
    .single();

  if (error) {
    console.error('comment error:', error);
    return res.status(500).json({ error: error.message });
  }

  return res.status(200).json({ success: true, comment: data });
}