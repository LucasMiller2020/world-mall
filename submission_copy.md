## Project Title
World Mall — Global Square for Verified Humans

## One-liner (140 chars)
A World App Mini App where verified humans talk, learn, build, and connect—guest-friendly, with seamless World ID verification.

## Short description (150–200 words)
World Mall brings the internet’s town square into the World App. Guests can say hi instantly (60 chars, 10/day), while a one-tap World ID verification unlocks full conversation: 240-char posts, starring, reporting, and Work Mode for hiring, advice, and collaboration. Under the hood, the app uses a privacy-first identity model (hashed nullifiers) and server-side rate limiting to keep conversations human. Real-time updates use WebSockets with SSE/poll fallback to behave well inside mobile webviews. The UI follows the World Design Guidelines and includes a theme toggle (light/dark, system, and sunrise→sunset auto mode). Next: we’ll integrate World Chat when available to power DMs/friends without rebuilding messaging. We’ll also add "Mall Coins" reactions and custom emoji packs to reward great posts and fund community bounties. World Mall is designed to scale: a human-first entry path (guest), a strong verification moment, and lightweight moderation that grows with the network.

## Problem & solution (bullets)
- Problem: Global chat fills with bots/spam; guests feel shut out.
- Solution: Guest‑first hello, human‑only upgrades via World ID.
- Guardrails: Nullifier‑hash identity, rate limits, report/mute.
- Resilience: WS/SSE/poll, cookie + header session fallback.

## Tech stack
React + TypeScript, Vite, Express + WebSocket, PostgreSQL (Drizzle), World ID Cloud v2, Replit Autoscale.

## Demo link
- Live Mini App: *open via World App*.
- Web demo (guest preview): your Replit-hosted URL used in previous screenshots.

## Repo
https://github.com/LucasMiller2020/world-mall

## Growth plan (bullets judges like)
- Viral loop: invite links post‑verify; "say hi" streaks; "Topic of the Day".
- Work Mode → job outcomes → stars → **Mall Coins** micro‑rewards.
- Community packs: custom emojis/badges purchasable with coins.
- DM/friends: integrate **World Chat** for private threads (no new infra).
- Metrics to watch: guest→verified conversion, 7d retention, stars per post, report rate.

## Team & contact
- Solo builder: Lucas Miller — Personal.LucasMiller@gmail.com (primary), Business.LucasMiller@gmail.com
