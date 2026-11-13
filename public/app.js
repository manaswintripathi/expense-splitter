// Built by Manaswin Tripathi (@manaswintripathi)
const $ = (s) => document.querySelector(s);
const inr = (n) => '₹' + Number(n || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 });
let people = [], expenses = [], categories = [];

function filters() {
  return {
    month: $('#filter-month').value,
    category: $('#filter-category').value,
    person: $('#filter-person').value
  };
}
function queryString(f) {
  const p = new URLSearchParams();
  if (f.month) p.set('month', f.month);
  if (f.category) p.set('category', f.category);
  if (f.person) p.set('person', f.person);
  return p.toString();
}

async function loadAll() {
  const f = filters();
  const qs = queryString(f);
  const [dataRes, sumRes, catRes] = await Promise.all([
    fetch('/api/data' + (qs ? '?' + qs : '')),
    fetch('/api/summary' + (qs ? '?' + qs : '')),
    fetch('/api/categories')
  ]);
  const data = await dataRes.json();
  const summary = await sumRes.json();
  categories = await catRes.json();
  people = data.people; expenses = data.expenses;
  renderPeople(); renderSummary(summary, f); renderExpenses(); renderCategoryFilter();
}

function renderPeople() {
  $('#people-list').innerHTML = people.map(p =>
    `<li>${escapeHtml(p.name)} <button data-del-person="${p.id}" title="Delete">✕</button></li>`).join('');
  $('#exp-payer').innerHTML = people.map(p => `<option value="${p.id}">${escapeHtml(p.name)}</option>`).join('');
  const personSel = $('#filter-person');
  const cur = personSel.value;
  personSel.innerHTML = '<option value="">Everyone</option>' + people.map(p => `<option value="${p.id}">${escapeHtml(p.name)}</option>`).join('');
  personSel.value = cur;
  $('#exp-participants').innerHTML = people.map(p =>
    `<label><input type="checkbox" class="participant" value="${p.id}" checked> ${escapeHtml(p.name)}</label>`).join('');
  renderCustomShares();
}

function renderSummary(s, f) {
  $('#total-spent').textContent = inr(s.total);
  $('#total-count').textContent = s.count;
  $('#total-people').textContent = people.length;
  $('#summary-scope').textContent = f.month ? `— ${f.month}` : '';
  $('#balances').innerHTML = s.perPerson.map(p => {
    const cls = p.balance > 0.01 ? 'positive' : p.balance < -0.01 ? 'negative' : '';
    const note = p.balance > 0.01 ? 'is owed' : p.balance < -0.01 ? 'owes' : 'settled';
    return `<div class="balance-row"><span>${escapeHtml(p.name)} — paid ${inr(p.paid)}, share ${inr(p.owed)}</span><span class="${cls}">${inr(Math.abs(p.balance))} ${note}</span></div>`;
  }).join('') || '<p class="muted">No data yet.</p>';
  const name = (id) => (people.find(p => p.id === id) || {}).name || id;
  $('#settlements').innerHTML = s.settlements.length
    ? s.settlements.map(x => `<li><strong>${escapeHtml(name(x.from))}</strong> pays <strong>${escapeHtml(name(x.to))}</strong> ${inr(x.amount)}</li>`).join('')
    : '<li>Everyone is settled up. 🎉</li>';
  renderBars('#category-chart', s.byCategory);
  renderBars('#month-chart', s.byMonth);
}

function renderBars(sel, obj) {
  const entries = Object.entries(obj).sort((a, b) => b[1] - a[1]);
  const max = entries.length ? Math.max(...entries.map(([, v]) => v)) : 1;
  document.querySelector(sel).innerHTML = entries.length
    ? entries.map(([k, v]) => `<div class="bar-row"><span>${escapeHtml(k)}</span><div class="bar-track"><div class="bar-fill" style="width:${(v / max * 100).toFixed(1)}%"></div></div><span>${inr(v)}</span></div>`).join('')
    : '<p class="muted">No data yet.</p>';
}

function renderCategoryFilter() {
  const sel = $('#filter-category');
  const cur = sel.value;
  sel.innerHTML = '<option value="">All categories</option>' + categories.map(c => `<option>${escapeHtml(c)}</option>`).join('');
  sel.value = cur;
}

function renderExpenses() {
  const name = (id) => (people.find(p => p.id === id) || {}).name || id;
  $('#expense-rows').innerHTML = expenses.map(e => `<tr>
    <td>${e.date}</td><td>${escapeHtml(e.title)}</td><td>${escapeHtml(e.category)}</td>
    <td>${escapeHtml(name(e.payerId))}</td><td>${inr(e.amount)}</td>
    <td>${e.splitType === 'custom' ? 'Custom' : 'Equal (' + (e.participants || []).length + ')'}</td>
    <td><button class="edit" data-edit="${e.id}">Edit</button> <button data-del="${e.id}">Delete</button></td>
  </tr>`).join('');
  $('#no-expenses').classList.toggle('hidden', expenses.length > 0);
}

function renderCustomShares() {
  const custom = document.querySelector('input[name="splitType"]:checked').value === 'custom';
  const box = $('#custom-shares');
  box.classList.toggle('hidden', !custom);
  if (!custom) return;
  const checked = [...document.querySelectorAll('.participant:checked')].map(c => c.value);
  box.innerHTML = checked.map(id => {
    const p = people.find(x => x.id === id);
    return `<label>${escapeHtml(p ? p.name : id)} share (₹) <input type="number" min="0" step="0.01" class="share-input" data-share="${id}" value="0"></label>`;
  }).join('');
}

function escapeHtml(s) {
  return String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

// ------------------------------------------------------------------ events
document.querySelectorAll('input[name="splitType"]').forEach(r => r.addEventListener('change', renderCustomShares));
document.addEventListener('change', (e) => { if (e.target.classList.contains('participant')) renderCustomShares(); });

['filter-month', 'filter-category', 'filter-person'].forEach(id =>
  document.getElementById(id).addEventListener('change', loadAll));
$('#clear-filters').addEventListener('click', () => {
  $('#filter-month').value = ''; $('#filter-category').value = ''; $('#filter-person').value = ''; loadAll();
});
$('#export-csv').addEventListener('click', () => {
  const qs = queryString(filters());
  window.location = '/api/export.csv' + (qs ? '?' + qs : '');
});

$('#person-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const name = $('#person-name').value.trim();
  if (!name) return;
  const res = await fetch('/api/people', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name }) });
  if (!res.ok) return alert((await res.json()).error || 'Could not add person.');
  $('#person-name').value = ''; loadAll();
});

$('#expense-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  $('#form-error').textContent = '';
  const participants = [...document.querySelectorAll('.participant:checked')].map(c => c.value);
  const splitType = document.querySelector('input[name="splitType"]:checked').value;
  const shares = {};
  if (splitType === 'custom') {
    document.querySelectorAll('.share-input').forEach(inp => { shares[inp.dataset.share] = Number(inp.value || 0); });
  }
  const body = {
    title: $('#exp-title').value.trim(),
    payerId: $('#exp-payer').value,
    amount: Number($('#exp-amount').value),
    category: $('#exp-category').value,
    date: $('#exp-date').value,
    splitType, participants, shares
  };
  const id = $('#expense-id').value;
  const res = await fetch(id ? '/api/expenses/' + id : '/api/expenses', {
    method: id ? 'PUT' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body)
  });
  if (!res.ok) { $('#form-error').textContent = (await res.json()).error || 'Could not save expense.'; return; }
  e.target.reset();
  $('#expense-id').value = '';
  $('#expense-submit').textContent = 'Add expense';
  $('#expense-cancel').classList.add('hidden');
  document.querySelector('input[name="splitType"][value="equal"]').checked = true;
  $('#exp-date').value = new Date().toISOString().slice(0, 10);
  loadAll();
});

$('#expense-cancel').addEventListener('click', () => {
  $('#expense-form').reset(); $('#expense-id').value = '';
  $('#expense-submit').textContent = 'Add expense';
  $('#expense-cancel').classList.add('hidden');
  $('#exp-date').value = new Date().toISOString().slice(0, 10);
  renderCustomShares();
});

document.addEventListener('click', async (e) => {
  const del = e.target.closest('[data-del]');
  const edit = e.target.closest('[data-edit]');
  const delPerson = e.target.closest('[data-del-person]');
  if (del) {
    if (!confirm('Delete this expense?')) return;
    await fetch('/api/expenses/' + del.dataset.del, { method: 'DELETE' }); loadAll();
  } else if (delPerson) {
    const res = await fetch('/api/people/' + delPerson.dataset.delPerson, { method: 'DELETE' });
    if (!res.ok) alert((await res.json()).error || 'Could not delete person.');
    loadAll();
  } else if (edit) {
    const exp = expenses.find(x => x.id === edit.dataset.edit);
    if (!exp) return;
    $('#expense-id').value = exp.id;
    $('#exp-title').value = exp.title;
    $('#exp-payer').value = exp.payerId;
    $('#exp-amount').value = exp.amount;
    $('#exp-category').value = exp.category;
    $('#exp-date').value = exp.date;
    document.querySelector(`input[name="splitType"][value="${exp.splitType}"]`).checked = true;
    document.querySelectorAll('.participant').forEach(c => { c.checked = (exp.participants || []).includes(c.value); });
    renderCustomShares();
    if (exp.splitType === 'custom') {
      document.querySelectorAll('.share-input').forEach(inp => { inp.value = exp.shares[inp.dataset.share] || 0; });
    }
    $('#expense-submit').textContent = 'Save changes';
    $('#expense-cancel').classList.remove('hidden');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
});

$('#seed-btn').addEventListener('click', async () => {
  if (!confirm('Restore sample data? Current expenses will be replaced.')) return;
  await fetch('/api/seed', { method: 'POST' }); loadAll();
});
$('#clear-btn').addEventListener('click', async () => {
  if (!confirm('Delete ALL expenses? People will be kept.')) return;
  await fetch('/api/clear', { method: 'POST' }); loadAll();
});

// ---------------------------------------------------------------------- init
$('#exp-date').value = new Date().toISOString().slice(0, 10);
loadAll();
