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

## How Verification Works

World Mall uses **World ID Cloud v2** for bot-resistant human verification. Here's how it works:

### World ID Integration
- **Cloud Verification API**: We use World ID Cloud v2 (`/api/v2/verify`) to validate proofs without storing personal data
- **Privacy-First**: Only SHA-256 hashed nullifiers are stored—no PII or biometric data ever touches our servers
- **Mini App Integration**: Seamless one-tap verification for World App users via MiniKit SDK
- **Web Fallback**: Guest mode for web users with server-enforced limits until they verify

### Verification Flow
1. **Guest Mode** (Default for web):
   - Limited to 60 characters per message
   - 10 messages per day maximum
   - 30-second cooldown between messages
   - Access to global chat room only

2. **Verified Mode** (After World ID verification):
   - Full 240 character limit
   - Higher rate limits (5/min, 60/hr, 200/day)
   - Access to all features: stars, reports, Work Mode
   - Persistent identity across sessions

### Testing Notes
- **In World App**: Uses native MiniKit for seamless verification (simulator or real device)
- **On Web**: Test guest mode first, then verify via World ID widget
- **Development**: Set `NODE_ENV=development` to simulate successful verification without real proofs
- **Production**: Requires valid World ID App ID and proper Cloud API configuration

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
See `.env.example` for full configuration. Key variables:
- `WORLD_ID_APP_ID` - Your World ID app identifier
- `WORLD_ID_ACTION` - Action ID for verification (default: world-mall/verify)  
- `WORLD_ID_CLOUD_SECRET` - Optional cloud secret for enhanced security
- `DATABASE_URL` - PostgreSQL connection string
- `SESSION_SECRET` - Secure random string for session encryption
- `ENABLE_PERMIT2` - Feature flag for Permit2 integration (default: false)

### Security & Privacy
- Stores only SHA‑256 hashed nullifiers, no PII
- Server-side rate limits and content filtering
- Guest sessions use privacy-preserving hashed identifiers
- Do not commit `.env` or production data

### License
MIT © 2025 Lucas Miller
