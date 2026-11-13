// Built by Manaswin Tripathi (@manaswintripathi)
// Expense Splitter — Node.js + Express + JSON file storage (no database).
// Run: npm install && npm start   (then open http://localhost:3000)

const express = require('express');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;
const DATA_FILE = path.join(__dirname, 'data.json');

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// ---------------------------------------------------------------- storage
function seedData() {
  return {
    people: [
      { id: 'p1', name: 'Manas' },
      { id: 'p2', name: 'Yash' },
      { id: 'p3', name: 'Vishal' },
      { id: 'p4', name: 'Priya' }
    ],
    expenses: [
      { id: 'e1', title: 'November house rent', payerId: 'p1', amount: 12000, category: 'Rent', date: '2026-11-01', splitType: 'equal', participants: ['p1', 'p2', 'p3', 'p4'], shares: {} },
      { id: 'e2', title: 'Weekly groceries — Big Bazaar', payerId: 'p2', amount: 2480, category: 'Groceries', date: '2026-11-03', splitType: 'equal', participants: ['p1', 'p2', 'p3', 'p4'], shares: {} },
      { id: 'e3', title: 'Dinner at Domino\'s', payerId: 'p3', amount: 960, category: 'Food', date: '2026-11-05', splitType: 'equal', participants: ['p1', 'p2', 'p3'], shares: {} },
      { id: 'e4', title: 'Wi-Fi bill', payerId: 'p1', amount: 799, category: 'Utilities', date: '2026-11-06', splitType: 'equal', participants: ['p1', 'p2', 'p3', 'p4'], shares: {} },
      { id: 'e5', title: 'Groceries — vegetables & milk', payerId: 'p4', amount: 1120, category: 'Groceries', date: '2026-11-08', splitType: 'equal', participants: ['p1', 'p2', 'p3', 'p4'], shares: {} },
      { id: 'e6', title: 'Movie night — tickets & popcorn', payerId: 'p2', amount: 1400, category: 'Entertainment', date: '2026-11-10', splitType: 'custom', participants: ['p1', 'p2', 'p3', 'p4'], shares: { p1: 500, p2: 300, p3: 300, p4: 300 } }
    ]
  };
}

function loadData() {
  try {
    if (fs.existsSync(DATA_FILE)) return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
  } catch (e) { console.error('Could not read data.json, re-seeding:', e.message); }
  const data = seedData();
  saveData(data);
  return data;
}

function saveData(data) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2), 'utf8');
}

let db = loadData();
const newId = (prefix) => prefix + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);

// ------------------------------------------------------------- calculations
// For one expense, return { personId: amountOwed }.
function sharesFor(exp) {
  const out = {};
  const participants = (exp.participants && exp.participants.length ? exp.participants : db.people.map(p => p.id));
  if (exp.splitType === 'custom' && exp.shares) {
    let total = 0;
    for (const pid of participants) {
      const v = Number(exp.shares[pid] || 0);
      if (v > 0) { out[pid] = v; total += v; }
    }
    // If custom shares do not add up, scale them proportionally to the amount.
    if (total > 0 && Math.abs(total - exp.amount) > 0.01) {
      for (const pid of Object.keys(out)) out[pid] = +(out[pid] * exp.amount / total).toFixed(2);
    }
    return out;
  }
  const each = +(exp.amount / participants.length).toFixed(2);
  for (const pid of participants) out[pid] = each;
  return out;
}

// Net balance per person: positive = others owe them, negative = they owe.
function computeBalances(expenses) {
  const paid = {}, owed = {};
  for (const p of db.people) { paid[p.id] = 0; owed[p.id] = 0; }
  for (const exp of expenses) {
    paid[exp.payerId] = (paid[exp.payerId] || 0) + Number(exp.amount);
    for (const [pid, share] of Object.entries(sharesFor(exp))) {
      owed[pid] = (owed[pid] || 0) + Number(share);
    }
  }
  const balances = {};
  for (const p of db.people) balances[p.id] = +((paid[p.id] || 0) - (owed[p.id] || 0)).toFixed(2);
  return { paid, owed, balances };
}

// Greedy minimum-transaction settlement: debtors pay creditors directly.
function computeSettlements(balances) {
  const creditors = [], debtors = [];
  for (const [id, bal] of Object.entries(balances)) {
    if (bal > 0.01) creditors.push({ id, amount: bal });
    else if (bal < -0.01) debtors.push({ id, amount: -bal });
  }
  creditors.sort((a, b) => b.amount - a.amount);
  debtors.sort((a, b) => b.amount - a.amount);
  const settlements = [];
  let i = 0, j = 0;
  while (i < debtors.length && j < creditors.length) {
    const pay = Math.min(debtors[i].amount, creditors[j].amount);
    settlements.push({ from: debtors[i].id, to: creditors[j].id, amount: +pay.toFixed(2) });
    debtors[i].amount = +(debtors[i].amount - pay).toFixed(2);
    creditors[j].amount = +(creditors[j].amount - pay).toFixed(2);
    if (debtors[i].amount < 0.01) i++;
    if (creditors[j].amount < 0.01) j++;
  }
  return settlements;
}

function filterExpenses(query) {
  let list = db.expenses.slice().sort((a, b) => b.date.localeCompare(a.date));
  if (query.month) list = list.filter(e => e.date.startsWith(query.month));
  if (query.category) list = list.filter(e => e.category === query.category);
  if (query.person) list = list.filter(e => e.payerId === query.person || (e.participants || []).includes(query.person));
  return list;
}

function buildSummary(query) {
  const expenses = filterExpenses(query);
  const { paid, owed, balances } = computeBalances(expenses);
  const byCategory = {};
  const byMonth = {};
  for (const e of expenses) {
    byCategory[e.category] = +(byCategory[e.category] || 0) + Number(e.amount);
    const m = e.date.slice(0, 7);
    byMonth[m] = +(byMonth[m] || 0) + Number(e.amount);
  }
  const total = +expenses.reduce((s, e) => s + Number(e.amount), 0).toFixed(2);
  return {
    total, count: expenses.length,
    perPerson: db.people.map(p => ({ id: p.id, name: p.name, paid: +(paid[p.id] || 0).toFixed(2), owed: +(owed[p.id] || 0).toFixed(2), balance: balances[p.id] })),
    byCategory, byMonth,
    settlements: computeSettlements(balances)
  };
}

// ------------------------------------------------------------------- routes
app.get('/api/data', (req, res) => res.json({ people: db.people, expenses: filterExpenses(req.query) }));
app.get('/api/summary', (req, res) => res.json(buildSummary(req.query)));
app.get('/api/categories', (req, res) => res.json([...new Set(db.expenses.map(e => e.category))].sort()));

app.post('/api/people', (req, res) => {
  const name = String(req.body.name || '').trim();
  if (!name) return res.status(400).json({ error: 'Name is required.' });
  const person = { id: newId('p'), name };
  db.people.push(person); saveData(db);
  res.status(201).json(person);
});

app.delete('/api/people/:id', (req, res) => {
  if (db.expenses.some(e => e.payerId === req.params.id || (e.participants || []).includes(req.params.id))) {
    return res.status(400).json({ error: 'Person is part of expenses — delete those expenses first.' });
  }
  db.people = db.people.filter(p => p.id !== req.params.id); saveData(db);
  res.json({ ok: true });
});

function validateExpense(body) {
  const amount = Number(body.amount);
  if (!body.title || !body.title.trim()) return 'Title is required.';
  if (!db.people.some(p => p.id === body.payerId)) return 'Choose a valid payer.';
  if (!amount || amount <= 0) return 'Amount must be greater than 0.';
  if (!body.date) return 'Date is required.';
  const participants = Array.isArray(body.participants) && body.participants.length ? body.participants : db.people.map(p => p.id);
  if (body.splitType === 'custom') {
    const total = participants.reduce((s, pid) => s + Number((body.shares || {})[pid] || 0), 0);
    if (Math.abs(total - amount) > 0.01) return `Custom shares must add up to ₹${amount} (got ₹${total}).`;
  }
  return null;
}

app.post('/api/expenses', (req, res) => {
  const err = validateExpense(req.body);
  if (err) return res.status(400).json({ error: err });
  const exp = {
    id: newId('e'),
    title: req.body.title.trim(),
    payerId: req.body.payerId,
    amount: Number(req.body.amount),
    category: req.body.category || 'Other',
    date: req.body.date,
    splitType: req.body.splitType === 'custom' ? 'custom' : 'equal',
    participants: req.body.participants && req.body.participants.length ? req.body.participants : db.people.map(p => p.id),
    shares: req.body.shares || {}
  };
  db.expenses.push(exp); saveData(db);
  res.status(201).json(exp);
});

app.put('/api/expenses/:id', (req, res) => {
  const err = validateExpense(req.body);
  if (err) return res.status(400).json({ error: err });
  const idx = db.expenses.findIndex(e => e.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Expense not found.' });
  db.expenses[idx] = {
    id: req.params.id,
    title: req.body.title.trim(),
    payerId: req.body.payerId,
    amount: Number(req.body.amount),
    category: req.body.category || 'Other',
    date: req.body.date,
    splitType: req.body.splitType === 'custom' ? 'custom' : 'equal',
    participants: req.body.participants && req.body.participants.length ? req.body.participants : db.people.map(p => p.id),
    shares: req.body.shares || {}
  };
  saveData(db);
  res.json(db.expenses[idx]);
});

app.delete('/api/expenses/:id', (req, res) => {
  db.expenses = db.expenses.filter(e => e.id !== req.params.id); saveData(db);
  res.json({ ok: true });
});

app.get('/api/export.csv', (req, res) => {
  const expenses = filterExpenses(req.query);
  const name = (id) => (db.people.find(p => p.id === id) || {}).name || id;
  const esc = (v) => `"${String(v).replace(/"/g, '""')}"`;
  const rows = [['Date', 'Title', 'Category', 'Payer', 'Amount (INR)', 'Split', 'Participants'].join(',')];
  for (const e of expenses) {
    rows.push([e.date, esc(e.title), esc(e.category), esc(name(e.payerId)), e.amount, e.splitType, esc((e.participants || []).map(name).join('; '))].join(','));
  }
  const summary = buildSummary(req.query);
  rows.push('', 'Summary', '', '', '', '', '');
  for (const p of summary.perPerson) rows.push([esc(`Balance — ${p.name}`), '', '', '', p.balance, '', ''].join(','));
  for (const s of summary.settlements) rows.push([esc(`Settlement — ${name(s.from)} pays ${name(s.to)}`), '', '', '', s.amount, '', ''].join(','));
  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', 'attachment; filename="expense-splitter-summary.csv"');
  res.send(rows.join('\n'));
});

app.post('/api/seed', (req, res) => { db = seedData(); saveData(db); res.json(db); });
app.post('/api/clear', (req, res) => { db = { people: db.people, expenses: [] }; saveData(db); res.json(db); });

app.get('/api/health', (req, res) => res.json({ ok: true, app: 'expense-splitter' }));

app.listen(PORT, () => console.log(`Expense Splitter running at http://localhost:${PORT} — Built by Manaswin Tripathi (@manaswintripathi)`));
