# PayPulse — Bi-Weekly Budget Planner

A full-stack budgeting application designed around a bi-weekly pay schedule. Built with Angular 19 and Node.js/Express with SQLite.

## Features

- **Bi-weekly pay schedule**: Enter your paycheck amount and a date — all future paydays are calculated automatically on a 14-day cycle
- **Recurring bills**: Track monthly and bi-weekly bills with due dates and categories
- **On-the-fly expenses**: Quick-add expenses with category tagging
- **Debt tracking**: Track debts with interest rates, minimum payments, and payment history
- **Auto-transfer**: Set a fixed amount to be transferred to savings each payday; surplus goes toward debts
- **Pay period balancing**: Bills are allocated to the correct pay period based on due dates, balancing obligations across paychecks
- **Custom categories**: Add, edit, and remove expense categories with custom icons and colors
- **Dashboard**: Visual overview with spending trends, category breakdowns, debt progress, and pay period allocations

## Quick Start with Docker

### Option 1: Docker Compose (Recommended)

```bash
docker-compose up -d
```

The app will be available at **http://localhost:3000**

### Option 2: Docker Build & Run

```bash
# Build the image
docker build -t paypulse .

# Run the container
docker run -d \
  --name paypulse \
  -p 3000:3000 \
  -v paypulse-data:/app/data \
  paypulse
```

### Persistent Data

SQLite data is stored in `/app/data` inside the container. The Docker setup uses a named volume (`paypulse-data`) so your data persists between container restarts.

## Development Setup

### Backend

```bash
cd backend
npm install
npm run dev
```

Runs on http://localhost:3000

### Frontend

```bash
cd frontend
npm install
npm start
```

Runs on http://localhost:4200 with proxy to backend

## Architecture

```
budget-app/
├── frontend/          # Angular 19 (standalone components)
│   └── src/app/
│       ├── components/  # Dashboard, Paychecks, Bills, Expenses, Debts, Categories
│       ├── models/      # TypeScript interfaces
│       └── services/    # API service
├── backend/           # Node.js + Express + SQLite
│   └── src/
│       ├── routes/      # REST API endpoints
│       ├── database.js  # SQLite setup + migrations
│       └── server.js    # Express server
├── Dockerfile         # Multi-stage build
├── docker-compose.yml # One-command deployment
└── README.md
```

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | /api/dashboard | Full financial summary |
| GET/POST | /api/paycheck | Paycheck configuration |
| PATCH | /api/paycheck/transfer | Update transfer amount |
| GET/POST | /api/categories | List/create categories |
| PUT/DELETE | /api/categories/:id | Update/delete category |
| GET/POST | /api/bills | List/create recurring bills |
| PUT/DELETE | /api/bills/:id | Update/delete bill |
| GET/POST | /api/expenses | List/create expenses |
| PUT/DELETE | /api/expenses/:id | Update/delete expense |
| GET/POST | /api/debts | List/create debts |
| PUT/DELETE | /api/debts/:id | Update/delete debt |
| POST | /api/debts/:id/payments | Record debt payment |

## How Pay Period Balancing Works

Monthly bills are assigned to the pay period that contains their due date. For example, if rent is due on the 1st and you get paid on the 28th and 11th, rent will be allocated to the pay period starting on the 28th (since the 1st falls within that 14-day window). This prevents situations where one paycheck is overloaded with bills while another has none.
