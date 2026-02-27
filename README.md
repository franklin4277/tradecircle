# TradeCircle

Minimal full-stack demo: Node/Express backend with SQLite, and a simple static frontend served from `public/`.

Features
- Register / login (JWT)
- Create, edit, delete listings with optional image upload
- Simple admin and profile pages

Quick start (local)

1. Install dependencies

```bash
npm install
```

2. Start the server

```bash
npm start
```

3. Open http://localhost:3000

Notes
- SQLite stores data in `tradecircle.db` in the project root. Back up the DB for persistence.
- Do not commit secrets. Use environment variables for production credentials.
