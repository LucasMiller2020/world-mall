# World Mall — Global Square for Verified Humans

**Talk. Learn. Build. Connect.**

World Mall is a World App mini-app that brings verified humans into a real-time global square. It offers a guest-first entry path with privacy-preserving identity and a smooth upgrade to a full-fledged experience via World ID verification.

## Features

- World ID verification (Cloud v2) – unlock longer posts, starring, reporting and Work Mode
- Global Square – real-time feed via WebSocket with Server-Sent Events (SSE) and polling fallback
- Guest mode – post up to 60 characters, 10 messages/day, with a 30-second cooldown
- Interact – star posts, report bad behaviour and access Work Mode after verification
- Light/Dark theme – choose light or dark theme, match system preference or auto-cycle based on sunrise and sunset
- Privacy-first – nullifier-hash identity (no personally identifiable information), rate limits and moderation

## Badges

[![License](https://img.shields.io/github/license/LucasMiller2020/world-mall)](LICENSE)
[![Repository Size](https://img.shields.io/github/repo-size/LucasMiller2020/world-mall)](https://github.com/LucasMiller2020/world-mall)
[![Open Issues](https://img.shields.io/github/issues/LucasMiller2020/world-mall)](https://github.com/LucasMiller2020/world-mall/issues)
[![Last Commit](https://img.shields.io/github/last-commit/LucasMiller2020/world-mall)](https://github.com/LucasMiller2020/world-mall/commits/main)

## Quick start

Clone the repository and install dependencies:


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
cp .env.example .env   # fill WORLD_ID_* and DATABASE_URL
npm install
npm run db:push
npm run build
npm start```
### Environment
```
WORLD_ID_APP_ID=your_app_id
WORLD_ID_ACTION=world-mall/verify
WORLD_ID_CLOUD_SECRET=your_secret
DATABASE_URL=postgres://...
# Future
ENABLE_PERMIT2=false



### How verification works

1. The mini-app collects a proof using the World ID Verify command.
2. The client posts the proof to `/api/verify/worldid` on the server.
3. The server verifies the proof via Cloud v2, hashes the nullifier (SHA-256), upgrades the user’s role to verified and sets a `wm_uid` cookie.


### Known good paths (judge checklist)

| User type | Action | Result |
|---|---|---|
| Guest (web) | Post ≤60 characters | 30 second cooldown, up to 10 messages/day |
| Verify | Tap Verify with World ID, complete the sheet | Proof → success → role = verified |
| Verified | Post 200-char message | Stars, reporting and Work Mode available |
| Landing preview | Visit home page | Shows latest 10 posts from last 7 days |

### Known issues (demo)

- Some WebViews block third-party cookies. The app falls back to an `X-Session` header, but very old devices may require a refresh.
- Direct messages (World Chat) are not yet integrated.

## Release notes

This repository contains a demo release for hackathon submission. Tag `v0.1.0` includes:

- All features listed above.
- Setup instructions and environment variables.
- Basic testing steps (see Known good paths).
- Known demo limitations (see Known issues).

Future releases will focus on improving verification reliability, integrating World Chat for direct messages, introducing Mall Coins reactions and custom emoji packs, and refining on-boarding flows.

---

© 2025 Lucas Miller. Distributed under the MIT License.
