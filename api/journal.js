// api/journal.js
// Gemini Vision → 성장일기 자동 생성 → Supabase 저장

import { supabase } from '../lib/supabase.js';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).end();

  const { media_id, image_url, baby_name, event_tag } = req.body;

  if (!media_id || !image_url) {
    return res.status(400).json({ error: 'media_id, image_url required' });
  }

  const name = baby_name || '하준이';
  const tag  = event_tag || 'daily';

  // 이벤트 태그별 프롬프트 조정
  const tagPrompts = {
    birth:       '출생 첫날',
    hundred_days:'백일',
    first_step:  '첫 걸음마',
    first_word:  '첫 말',
    daily:       '일상의 한 장면'
  };
  const scene = tagPrompts[tag] || '일상의 한 장면';

  const prompt = `
이 사진은 ${name}의 ${scene} 사진입니다.
따뜻하고 감동적인 성장일기를 한국어로 3~4문장으로 써주세요.
부모의 시선으로, 아이에게 말하는 편지 형식으로 작성해주세요.
이모지는 1~2개만 사용하고, 과하게 감상적이지 않게 써주세요.
  `.trim();

  try {
    // Gemini Vision API 호출
    const geminiRes = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${process.env.GEMINI_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{
            parts: [
              { text: prompt },
              { inline_data: null },  // URL 방식 사용
              {
                fileData: {
                  mimeType: 'image/jpeg',
                  fileUri: image_url
                }
              }
            ]
          }]
        })
      }
    );

    // Gemini는 URL 직접 지원 안 할 수 있으므로 fetch → base64 변환
    const imageRes    = await fetch(image_url);
    const imageBuffer = await imageRes.arrayBuffer();
    const base64      = Buffer.from(imageBuffer).toString('base64');
    const mimeType    = imageRes.headers.get('content-type') || 'image/jpeg';

    const geminiRes2 = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${process.env.GEMINI_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{
            parts: [
              { text: prompt },
              {
                inline_data: {
                  mime_type: mimeType,
                  data: base64
                }
              }
            ]
          }]
        })
      }
    );

    const geminiData = await geminiRes2.json();
    const journal    = geminiData?.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!journal) {
      return res.status(500).json({ error: 'Gemini 응답 없음' });
    }

    // Supabase media 업데이트
    const { error: updateError } = await supabase
      .schema('corenull')
      .from('media')
      .update({ ai_journal: journal })
      .eq('id', media_id);

    if (updateError) {
      console.error('update error:', updateError);
      return res.status(500).json({ error: updateError.message });
    }

    return res.status(200).json({ success: true, journal });

  } catch (e) {
    console.error('journal error:', e);
    return res.status(500).json({ error: e.message });
  }
}