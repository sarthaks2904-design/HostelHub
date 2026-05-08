# HostelHub

HostelHub is a production-ready hostel management web application built with Express, Socket.IO, JWT authentication, bcrypt password hashing, and JSON file-based storage only.

## Features

- Secure authentication with JWT, bcrypt, protected routes, and role-based access control
- Roles: `ADMIN`, `WARDEN`, `STUDENT`
- Two scoped wardens:
  - Male warden for boys hostel
  - Female warden for girls hostel
- Student registration with mandatory hostel, academic, contact, and parent-contact details
- Student dashboards with profile, fees, payment receipts, attendance, QR code, movements, notifications, complaints, mess, and SOS
- Admin-only fee management with:
  - Receipt image upload by students
  - Fee verification and approval
  - Pending or cleared status tracking
  - Reminder notifications
  - Manual fine adjustments
  - Full timestamped payment timeline visible to student and warden
- Structured student directory with room, contacts, location, hostel, and fee status
- Separate anti-ragging complaint section with optional proof image upload
- Entry/exit requests, manual returns, QR-based scan simulation, overdue automation, curfew violations, and fee fines
- Real-time updates with Socket.IO for movement logs, status changes, fee changes, notifications, SOS alerts, and overdue alerts
- Complaint management, mess management, meal ratings, meal leave, notifications, and analytics dashboards

## Tech Stack

- Node.js
- Express
- Socket.IO
- JSON file storage
- JWT
- bcrypt

## Run

```bash
npm install
npm start
```

The app runs at [http://localhost:3000](http://localhost:3000).

## Test

```bash
npm test
```

## Default Accounts

- Admin: `admin` / `Admin@123`
- Male Warden: `warden` / `Warden@123`
- Female Warden: `warden-girls` / `Warden@123`
- Seed Student: `ENR2026001` / `Student@123`

## Environment

Copy `.env.example` to `.env` if you want to override defaults.

- `PORT`
- `JWT_SECRET`
- `NODE_ENV`

## Data Storage

All application state is persisted under [`data`](C:\Users\admin\OneDrive\Documents\HostelHub\data).
The JSON files are created and seeded automatically on first startup.
