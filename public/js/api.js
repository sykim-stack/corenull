// public/js/api.js
import { state } from './common.js';

export async function loadHouseData() {
  const ownerParam = state.ownerKey ? `&owner=${encodeURIComponent(state.ownerKey)}` : '';
  const res = await fetch(`/api/house?slug=${state.slug}${ownerParam}`);
  const data = await res.json();
  if (!data.house) throw new Error('집을 찾을 수 없어요');

  state.houseData  = data.house;
  state.houseId    = data.house.id;
  state.isOwner    = !!data.house.is_owner;
  state.rooms      = data.rooms || [];
  state.categories = data.categories || [];
  state.allMedia   = data.media || [];
  state.allPosts   = data.posts || [];

  return data;
}

export async function loadLobbyComments() {
  const res = await fetch(`/api/comment?house_id=${state.houseId}`);
  const data = await res.json();
  return data.comments || [];
}

export async function submitComment({ content, mediaUrl = null }) {
  let author = localStorage.getItem('cn_author_name');
  if (!author) {
    author = prompt('이름을 입력해주세요') || '익명';
    if (author !== '익명') localStorage.setItem('cn_author_name', author);
  }
  const res = await fetch('/api/comment', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ house_id: state.houseId, author_name: author, content, media_url: mediaUrl })
  });
  return await res.json();
}

export async function submitPost({ content, mediaUrls, categoryIds, roomId, emotion_tag }) {
  return apiFetch('/api/posts', {
    method: 'POST',
    body: {
      house_id:     state.houseId,
      owner_key:    state.ownerKey,
      room_id:      roomId,
      content,
      media_urls:   mediaUrls,
      category_ids: categoryIds,
      emotion_tag,
    }
  });
}

export async function deletePost(postId) {
  const res = await fetch('/api/posts', {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ post_id: postId, house_id: state.houseId, owner_key: state.ownerKey })
  });
  return await res.json();
}