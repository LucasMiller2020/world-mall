# World Mall — a World App Mini App

**World Mall** is a bot‑resistant global square for verified humans. Guests can say hi with limits; a one‑tap **World ID** unlocks full chat, stars, reports, Work Mode, and higher rate limits.

## Demo
- Mini App (World App): (QR / link if available)
- Web guest (limited): (Replit autoscale URL)
- Video (≤3 min): (YouTube unlisted link)

## Core Features
- Guest Mode (server‑enforced: char limit, per‑day cap, cooldown)
- **World ID Cloud verification** (hashed nullifier; no PII)
- Real‑time global chat (Express + WS + polling fallback)
- Rate limiting & moderation (report/mute/filter)
- Topics of the Day scheduler; **Room Rain** points (ledger)
- **Dark mode** (system match, manual toggle, sunrise→sunset)
- Basic admin/telemetry

## Stack
- Client: React + TypeScript + Vite
- Server: Node/Express + WebSocket
- DB: PostgreSQL + Drizzle ORM
- Identity: World ID (Cloud Verify)
- Optional: EIP‑712 / Permit2 scaffolding (feature‑flagged)

## Getting Started
```bash
git clone https://github.com/LucasMiller2020/world-mall.git
cd world-mall
cp .env.example .env
# Fill in environment variables, then:
npm i
npm run db:push
npm run build
npm start   # server listens on $PORT (default 5000), host 0.0.0.0
```

### Environment Variables
See `.env.example`. Never commit your real secrets.
- `WORLD_ID_APP_ID=app_xxx`
- `WORLD_ID_ACTION=world-mall/verify`
- `(Optional) WORLD_ID_APP_SECRET=your_secret_if_required`  # if Cloud Verify secret is used
- `DATABASE_URL=postgres://...`
- `(Optional) guest/verified policy overrides`

### Security & Privacy
- Stores only SHA‑256 hashed nullifiers, no PII.
- Server-side rate limits and content filtering.
- Do not commit `.env` or production data.

### License
MIT © 2025 Lucas Miller
