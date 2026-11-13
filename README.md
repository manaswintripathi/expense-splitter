# Expense Splitter

Built by Manaswin Tripathi (@manaswintripathi)

Split shared expenses between friends, flatmates and teammates — and instantly see who owes whom. No database, no sign-up, no cloud: everything is stored in a local `data.json` file.

## Features

- **People** — add flatmates / friends who share expenses.
- **Expenses** — add an expense with payer, amount, category and date; split it **equally** or with **custom shares** per person.
- **Who owes whom** — automatic net balances per person.
- **Simplified settlements** — the minimum number of payments needed to settle everyone up (greedy debtor → creditor matching).
- **Monthly summary** — total spent, per-person paid / owed / balance, per-category breakdown with CSS bar charts and a monthly totals chart (no external chart library, works offline).
- **Filter** — filter expenses by month, category or person.
- **Edit / delete** — edit any expense in place, or delete it.
- **Export CSV** — download the filtered summary as a CSV file.
- **Seed data** — ships with realistic sample data (rent, groceries, food, Wi-Fi, movie night) that you can clear in one click.

## Tech stack

- **Backend:** Node.js + Express (only dependency)
- **Storage:** JSON file (`data.json`, auto-created and seeded on first run)
- **Frontend:** Vanilla HTML / CSS / JavaScript — no framework, no CDN dependency

## Setup / run

```bash
npm install
npm start
```

Then open http://localhost:3000

To use a different port:

```bash
PORT=4000 npm start
```

## API

| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/data` | People + expenses (optional `?month=YYYY-MM&category=&person=`) |
| GET | `/api/summary` | Totals, per-person balances, per-category, settlements (same filters) |
| GET | `/api/categories` | List of categories in use |
| POST | `/api/people` | `{ "name": "Asha" }` |
| DELETE | `/api/people/:id` | Delete a person (only if unused in expenses) |
| POST | `/api/expenses` | Create an expense |
| PUT | `/api/expenses/:id` | Update an expense |
| DELETE | `/api/expenses/:id` | Delete an expense |
| GET | `/api/export.csv` | Download the filtered summary as CSV |
| POST | `/api/seed` | Restore the sample data |
| POST | `/api/clear` | Delete all expenses (keeps people) |
| GET | `/api/health` | Health check |

Expense body:

```json
{
  "title": "Weekly groceries",
  "payerId": "p1",
  "amount": 2480,
  "category": "Groceries",
  "date": "2026-11-03",
  "splitType": "equal",
  "participants": ["p1", "p2", "p3"],
  "shares": {}
}
```

For `splitType: "custom"`, `shares` must add up to `amount`, e.g. `{ "p1": 500, "p2": 300 }`.

## How settlements work

Each expense adds what the payer paid and what every participant owes. A person's net balance is `paid − owed` (positive = others owe them). Debtors are then matched to creditors, largest first, so the group settles in the fewest possible payments.

## Project structure

```
expense-splitter/
├── server.js          # Express API + balances / settlements logic
├── package.json
├── data.json          # Auto-created on first run (gitignored)
├── public/
│   ├── index.html     # UI
│   ├── style.css      # Styling + bar charts
│   └── app.js         # Frontend logic (fetch, render, filters)
└── README.md
```

## License

MIT — Built by Manaswin Tripathi (@manaswintripathi)
