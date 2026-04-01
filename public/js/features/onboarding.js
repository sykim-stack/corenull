// ── features/onboarding.js ────────────────────────────────────────────────
// CoreNull · 온보딩

import { state, showToast } from '/public/js/common.js';

const DEVICE_ID = localStorage.getItem('cn_device_id') || (() => {
  const id = crypto.randomUUID();
  localStorage.setItem('cn_device_id', id);
  return id;
})();

let selectedInterests = [];

export async function showInterestModal() {
  try {
    const res = await fetch('/api/interests', { headers: { 'x-device-id': DEVICE_ID } });
    const interests = await res.json();
    document.getElementById('interestGrid').innerHTML = interests.map(i =>
      `<div class="interest-chip" data-id="${i.id}" onclick="toggleInterest(this)">
        <div class="interest-emoji">${i.emoji}</div>
        <div class="interest-name">${i.name}</div>
      </div>`
    ).join('');
    document.getElementById('onboardOverlay').classList.add('open');
  } catch (e) { console.error('[interest modal]', e); }
}

export function toggleInterest(el) {
  el.classList.toggle('on');
  selectedInterests = [...document.querySelectorAll('.interest-chip.on')].map(e => e.dataset.id);
  document.getElementById('onboardBtn').disabled = selectedInterests.length < 3;
}

export async function goStepHouse() {
  if (selectedInterests.length < 3) return;
  try {
    await fetch('/api/interests', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-device-id': DEVICE_ID },
      body: JSON.stringify({ interest_ids: selectedInterests })
    });
  } catch {}
  document.getElementById('stepInterest').style.display = 'none';
  document.getElementById('stepHouse').style.display    = 'block';
  if (state.houseData) {
    const catEmoji = { baby:'👶', pet:'🐾', travel:'✈️', fitness:'💪', daily:'🏠' };
    document.getElementById('houseStepEmoji').textContent = catEmoji[state.houseData.category] || '🏠';
    document.getElementById('houseStepName').textContent  = state.houseData.name || state.slug;
    document.getElementById('houseStepSub').textContent   = `${state.houseData.name || state.slug}에 멤버로 등록됩니다`;
  }
}

export async function joinCurrentHouse() {
  if (!state.houseId) { skipOnboarding(); return; }
  try {
    await fetch('/api/onboarding?action=join-house', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-device-id': DEVICE_ID },
      body: JSON.stringify({ house_id: state.houseId, role: 'member' })
    });
    showToast('환영해요! 🏠');
  } catch {}
  document.getElementById('onboardOverlay').classList.remove('open');
}

export function skipOnboarding() {
  document.getElementById('onboardOverlay').classList.remove('open');
}