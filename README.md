# World Mall - World Mini App

A bot-proof global square for verified humans to talk, learn, and build. Built with World ID verification and real-time messaging.

## Features

- **Human-Only Space**: World ID verification ensures only real humans can participate
- **Real-Time Messaging**: Live chat with WebSocket/SSE and polling fallback
- **Global Square**: Main chat room with daily topics and star upvoting
- **Work Mode**: Separate feed for job offers, help requests, and collaboration
- **Rate Limiting**: Prevents spam with friendly cooldown messages
- **Content Moderation**: Report and mute functionality to keep the space healthy
- **Points System**: "Room Rain" demonstration for future token distribution

## Local Development

### Prerequisites

- Node.js 18+ 
- npm or yarn

### Setup

1. Clone the repository
2. Install dependencies:
   ```bash
   npm install
   ```

3. Copy environment variables:
   ```bash
   cp .env.example .env
   ```

4. Configure your World ID App:
   - Get your MiniKit App ID from the World App Developer Portal
   - Update `NEXT_PUBLIC_MINIKIT_APP_ID` in your `.env` file
   - Set `NEXT_PUBLIC_APP_URL` to your deployment URL

5. Start the development server:
   ```bash
   npm run dev
   ```

6. Open http://localhost:5000 in your browser

### Opening in World App

To test the full MiniKit integration:

1. Deploy your app to a public URL (Replit automatically provides this)
2. Register your mini-app in the World App Developer Portal
3. Configure the app URL in your World App settings
4. Open the app through World App to enable `MiniKit.isInstalled() === true`

**Important**: The app detects if it's running inside World App. When accessed via regular browser, it will show instructions to open in World App.

## Environment Variables

- `NEXT_PUBLIC_MINIKIT_APP_ID`: Your World ID app identifier (required)
- `NEXT_PUBLIC_APP_URL`: Your app's public URL for deep links
- `REALTIME_URL`: WebSocket endpoint URL
- Rate limiting constants (optional, have sensible defaults)

## Architecture

### Frontend
- Next.js 15 with App Router and TypeScript
- Real-time updates via WebSocket with polling fallback
- MiniKit integration for World ID verification
- Tailwind CSS following World Design Guidelines

### Backend
- Express server with WebSocket support
- In-memory storage with thin data access layer
- Rate limiting per verified human
- Content filtering and moderation

### Data Model
- **Human**: Stores only hashed nullifier from World ID (no PII)
- **Message**: Text content with room, author, timestamps, and engagement
- **Star**: Upvote tracking (1 per human per message)
- **RateLimit**: Rolling counters to enforce limits
- **Theme**: Daily topic configuration

## Security & Privacy

- **No PII Storage**: Only hashed World ID nullifiers are stored
- **Human Verification**: All posting requires World ID verification
- **Rate Limiting**: Prevents spam and abuse
- **Content Moderation**: Report and mute systems
- **Safe Defaults**: World Design Guidelines for accessibility

## Points System (Demo Only)

The current "Room Rain" implementation is points-only for demonstration:

- Points awarded to active, upvoted humans
- Transparent ledger showing distribution history
- **Note**: Real ERC-20 transfers would use Permit2 and sponsored gas (not included in MVP)

## Demo Flow

1. **Open** → Landing page with read-only preview
2. **Verify** → World ID verification via MiniKit
3. **Post** → Send message to Global Square
4. **Star** → Upvote messages (1 per human)
5. **Report** → Flag inappropriate content
6. **Work Mode** → Post categorized job/help requests
7. **Cooldown** → Rate limit demonstration

## API Endpoints

- `GET /api/health` - Health check
- `GET /api/messages` - Fetch messages
- `POST /api/messages` - Send message (requires verification)
- `POST /api/stars` - Star a message
- `POST /api/reports` - Report content
- `GET /api/theme` - Get today's topic
- `GET /api/ledger` - Points distribution history
- `WS /ws` - Real-time message updates

## Definition of Done

✅ Opens inside World App; MiniKit.isInstalled() returns true  
✅ Landing shows read-only preview (no verify needed)  
✅ Verify → post → live update works E2E  
✅ ⭐ upvote works; can't double-star same message  
✅ Rate limits & link limits enforced with friendly cooldowns  
✅ Report & Mute work  
✅ Work Mode shows categorized posts  
✅ Handles poor network (skeletons + retry)  
✅ Stores only hashed nullifier; no PII  
✅ UI spacing/states consistent with World guidelines  

## Technology Stack

- **Frontend**: Next.js 15, TypeScript, Tailwind CSS, @worldcoin/minikit-react
- **Backend**: Express, WebSocket, in-memory storage
- **Real-time**: WebSocket with polling fallback
- **Identity**: World ID via MiniKit
- **Styling**: World Design Guidelines (24px grid, safe-area padding)

## License

MIT
