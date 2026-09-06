/opt/homebrew/Library/Homebrew/cmd/shellenv.sh: line 18: /bin/ps: Operation not permitted
const API_URL = 'https://hlivs-teachers-shop-picks.lailaifamily.chatgpt.site/api/recommendations';
const categories = ['食', '衣', '住', '行', '育', '樂'];

const state = { category: '', recommendations: [], showAll: false };
const app = document.querySelector('#app');
const form = document.querySelector('#recommendation-form');
const categoryGrid = document.querySelector('#category-grid');
const shopName = document.querySelector('#shop-name');
const phone = document.querySelector('#phone');
const search = document.querySelector('#search');
const list = document.querySelector('#shop-list');
const count = document.querySelector('#count-badge');
const more = document.querySelector('#panel-more');
const submit = document.querySelector('#submit-button');
const error = document.querySelector('#form-error');
const duplicateMessage = document.querySelector('#duplicate-message');
const shopHelp = document.querySelector('#shop-help');

function normalize(value) {
  return value.normalize('NFKC').toLocaleLowerCase('zh-Hant-TW').replace(/[\s・·－—_()（）-]/g, '');
}

function escapeHtml(value) {
  return String(value).replace(/[&<>'"]/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' })[character]);
}

function duplicateFor(value) {
  const query = normalize(value);
  if (query.length < 2) return null;
  const exact = state.recommendations.find((item) => normalize(item.name) === query);
  if (exact) return { item: exact, exact: true };
  const similar = state.recommendations.find((item) => normalize(item.name).includes(query) || query.includes(normalize(item.name)));
  return similar ? { item: similar, exact: false } : null;
}

function refreshFormState() {
  const duplicate = duplicateFor(shopName.value);
  duplicateMessage.innerHTML = '';
  shopHelp.hidden = Boolean(duplicate);
  shopName.setAttribute('aria-invalid', duplicate?.exact ? 'true' : 'false');
  if (duplicate) {
    duplicateMessage.className = duplicate.exact ? 'duplicate-alert' : 'similar-alert';
    duplicateMessage.innerHTML = `<div><strong>${duplicate.exact ? '這間店已經有人推薦過了' : '這個名稱可能相似，請確認一下'}</strong><br>${escapeHtml(duplicate.item.name)}・${escapeHtml(duplicate.item.category)}類</div>`;
  } else {
    duplicateMessage.className = '';
  }
  submit.disabled = !state.category || !shopName.value.trim() || Boolean(duplicate?.exact);
}

function renderCategories() {
  categoryGrid.innerHTML = categories.map((category) => `<button type="button" role="radio" aria-checked="${state.category === category}" class="category-option${state.category === category ? ' selected' : ''}" data-category="${category}">${category}</button>`).join('');
}

function renderRecommendations() {
  const query = normalize(search.value);
  const filtered = query ? state.recommendations.filter((item) => normalize(item.name).includes(query) || item.category === search.value.trim()) : state.recommendations;
  const visible = state.showAll || query ? filtered : filtered.slice(0, 6);
  count.textContent = `${state.recommendations.length} 間`;
  if (!visible.length) {
    list.innerHTML = `<div class="empty-result">${state.recommendations.length ? '目前找不到相符店家，可以放心推薦。' : '還沒有人推薦，等你分享第一間好店！'}</div>`;
  } else {
    list.innerHTML = visible.map((item) => `<article class="shop-card"><span class="shop-category">${escapeHtml(item.category)}</span><div><h3>${escapeHtml(item.name)}</h3><p>${escapeHtml(item.phone || '尚未提供電話')}</p></div></article>`).join('');
  }
  more.hidden = Boolean(query) || state.recommendations.length <= 6;
  more.textContent = state.showAll ? '收起名單' : `查看全部 ${state.recommendations.length} 間`;
}

async function loadRecommendations() {
  try {
    const response = await fetch(API_URL);
    if (!response.ok) throw new Error();
    const data = await response.json();
    state.recommendations = Array.isArray(data.recommendations) ? data.recommendations : [];
    renderRecommendations();
    refreshFormState();
  } catch {
    list.innerHTML = '<div class="empty-result">目前無法讀取推薦名單，請稍後再試。</div>';
  }
}

categoryGrid.addEventListener('click', (event) => {
  const button = event.target.closest('[data-category]');
  if (!button) return;
  state.category = button.dataset.category;
  renderCategories();
  refreshFormState();
});
shopName.addEventListener('input', () => { error.textContent = ''; refreshFormState(); });
search.addEventListener('input', () => { state.showAll = true; renderRecommendations(); });
more.addEventListener('click', () => { state.showAll = !state.showAll; renderRecommendations(); });

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  if (submit.disabled) return;
  submit.disabled = true;
  submit.textContent = '正在送出…';
  error.textContent = '';
  try {
    const response = await fetch(API_URL, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ category: state.category, name: shopName.value, phone: phone.value, website: '' }) });
    const data = await response.json();
    if (response.status === 409 && data.duplicate) {
      if (!state.recommendations.some((item) => item.id === data.duplicate.id)) state.recommendations.unshift(data.duplicate);
      throw new Error('這間店已經在推薦名單中囉。');
    }
    if (!response.ok || !data.recommendation) throw new Error(data.error || '送出失敗。');
    const success = document.querySelector('#success-template').content.cloneNode(true);
    success.querySelector('#submitted-shop').innerHTML = `<span>${escapeHtml(data.recommendation.category)}</span><strong>${escapeHtml(data.recommendation.name)}</strong>`;
    app.replaceWith(success);
    document.querySelector('#recommend-another').addEventListener('click', () => window.location.reload());
  } catch (cause) {
    error.textContent = cause.message || '送出時發生問題，資料尚未送出，請再試一次。';
    submit.textContent = '送出推薦 →';
    refreshFormState();
  }
});

renderCategories();
loadRecommendations();
