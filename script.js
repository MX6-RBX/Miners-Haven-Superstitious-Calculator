const ELEMENTS = ["Earth", "Aether", "Order", "Fire", "Entropy", "Water"];
const recipe = new Map();

// Supports the current MH_DATA format: { "1": { Id, Name, Image, Elements }, ... }
const items = Object.values(MH_DATA).filter(x => x && x.Name && x.Elements);
const byId = new Map(items.map(x => [String(x.Id), x]));

const search = document.getElementById('search');
const results = document.getElementById('results');
const recipeEl = document.getElementById('recipe');
const elementsEl = document.getElementById('elements');
const itemCount = document.getElementById('itemCount');

function addItem(item, amount = 1) {
  const id = String(item.Id);
  const current = recipe.get(id) || 0;
  recipe.set(id, current + amount);
  render();
}

function removeItem(id) {
  recipe.delete(String(id));
  render();
}

function changeQty(id, amount) {
  id = String(id);
  const next = (recipe.get(id) || 0) + amount;
  if (next <= 0) recipe.delete(id);
  else recipe.set(id, next);
  render();
}

function calculateTotals() {
  const totals = Object.fromEntries(ELEMENTS.map(e => [e, 0]));
  for (const [id, qty] of recipe) {
    const item = byId.get(id);
    if (!item) continue;
    for (const element of ELEMENTS) totals[element] += (Number(item.Elements[element]) || 0) * qty;
  }
  return totals;
}

function renderResults(query = '') {
  const q = query.trim().toLowerCase();
  if (!q) { results.classList.add('hidden'); results.innerHTML = ''; return; }

  const matches = items.filter(item => item.Name.toLowerCase().includes(q)).slice(0, 25);
  results.innerHTML = matches.length ? matches.map(item => `
    <div class="result" data-id="${escapeHtml(item.Id)}">
      <img class="icon" src="${escapeAttr(item.Image)}" alt="">
      <div class="result-info">
        <div class="result-name">${escapeHtml(item.Name)}</div>
        <div class="result-type">ID ${escapeHtml(item.Id)}</div>
      </div>
    </div>`).join('') : '<div class="result">No items found.</div>';
  results.classList.remove('hidden');
}

function render() {
  const totalCount = [...recipe.values()].reduce((a,b) => a+b, 0);
  itemCount.textContent = `${totalCount} item${totalCount === 1 ? '' : 's'}`;

  if (!recipe.size) {
    recipeEl.className = 'recipe empty';
    recipeEl.innerHTML = '<div class="empty-state">Search for an item above to add it to your recipe.</div>';
  } else {
    recipeEl.className = 'recipe';
    recipeEl.innerHTML = [...recipe.entries()].map(([id, qty]) => {
      const item = byId.get(id);
      return `<div class="recipe-item">
        <img src="${escapeAttr(item.Image)}" alt="">
        <div><div class="name">${escapeHtml(item.Name)}</div><div class="meta">ID ${escapeHtml(item.Id)}</div></div>
        <div class="qty"><button data-action="minus" data-id="${escapeHtml(id)}">−</button><span>${qty}</span><button data-action="plus" data-id="${escapeHtml(id)}">+</button></div>
        <button class="remove" data-action="remove" data-id="${escapeHtml(id)}">×</button>
      </div>`;
    }).join('');
  }

  const totals = calculateTotals();
  const max = Math.max(1, ...Object.values(totals).map(Math.abs));
  elementsEl.innerHTML = ELEMENTS.map(element => {
    const value = totals[element];
    const negative = value < 0;
    const width = Math.min(100, Math.abs(value) / max * 100);
    return `<div class="element ${negative ? 'negative' : 'positive'}">
      <div class="element-head"><span class="element-name">${element}</span><span class="value">${formatNumber(value)}</span></div>
      <div class="bar"><div class="fill" style="width:${width}%"></div></div>
    </div>`;
  }).join('');
}

function formatNumber(n) { return Number.isInteger(n) ? n.toLocaleString() : n.toLocaleString(undefined,{maximumFractionDigits:2}); }
function escapeHtml(v) { return String(v).replace(/[&<>'"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c])); }
function escapeAttr(v) { return escapeHtml(v); }

search.addEventListener('input', e => renderResults(e.target.value));
results.addEventListener('click', e => {
  const row = e.target.closest('.result[data-id]');
  if (!row) return;
  const item = byId.get(String(row.dataset.id));
  if (item) addItem(item);
  search.value = '';
  results.classList.add('hidden');
  search.focus();
});
recipeEl.addEventListener('click', e => {
  const btn = e.target.closest('[data-action]');
  if (!btn) return;
  const id = btn.dataset.id;
  if (btn.dataset.action === 'plus') changeQty(id, 1);
  if (btn.dataset.action === 'minus') changeQty(id, -1);
  if (btn.dataset.action === 'remove') removeItem(id);
});
document.getElementById('clearBtn').addEventListener('click', () => { recipe.clear(); render(); });
document.addEventListener('click', e => { if (!e.target.closest('.search-wrap')) results.classList.add('hidden'); });
render();
