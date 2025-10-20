# Mall Space - World Mini App

## Overview
Mall Space is a bot-proof global chat platform designed as a World Mini App, running inside World App using MiniKit. It provides verified human-only spaces for real-time communication with a global square for general discussion. The platform ensures authentic interactions through World ID human verification while maintaining pseudonymous privacy. The project prioritizes community moderation, a streamlined user experience, and robust technical performance across all platforms.

## User Preferences
Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture
The frontend uses React with TypeScript and Vite. It employs Wouter for routing, Tailwind CSS with shadcn/ui for UI, and TanStack Query for server state management. Real-time updates use universal HTTP polling with a 2.5-second interval for consistent, reliable message sync across all platforms (desktop, mobile, World App). 

The UI features a clean, single-column centered layout, a collapsible sidebar for online users, and redesigned message layouts for improved readability and interaction.

**Key Pages**:
- `/` - Landing page with chat preview and "Enter the Global Square" button
- `/join` - Join page offering "Join as Guest" (primary) or "Login with World ID" (secondary) options
- `/room/global` - Main chat interface with messaging, voting, and reactions
- `/settings` - User preferences including theme, voting display toggle, and username color

### Backend Architecture
The backend is built with Node.js and Express.js. Drizzle ORM handles type-safe database operations. Real-time communication uses HTTP polling exclusively - the WebSocket server has been deprecated in favor of universal polling for maximum reliability across all platforms. Session management uses Express sessions with a PostgreSQL store. Content moderation includes a ROT13-encoded blocklist with advanced evasion detection and a 3-strike warning system.

### Data Storage Solutions
The primary database is PostgreSQL, utilizing a Neon serverless adapter. Drizzle migrations manage schema changes. 

Key data models include:
- **Humans**: Stores user profiles with handle (username), online status (isOnline, lastOnline), reserved username flags (handleReserved for World ID users), and re-verification tracking (lastVerification, verificationInterval, nextVerificationDue)
- **Messages**: Chat messages with voting and reaction support
- **Message Votes**: Reddit-style upvotes/downvotes per message
- **Message Reactions**: Discord/Slack-style emoji reactions (👍 😂 ❗ ❤️ 🔥 👀)
- **Guest Sessions**: Tracks anonymous guest sessions via IP/user-agent hashing
- **Rate Limits**: Prevents spam and abuse

### Authentication and Authorization
The platform supports two authentication methods: guest access and World ID verification. 

**Guest Login System**: Users can join immediately by choosing a username (2-25 characters, alphanumeric with underscores/hyphens). Guest usernames are only reserved while the user is online - when they leave, the username becomes available for others. This provides a Chat Ave-style frictionless onboarding experience.

**Online Tracking**: The system uses a heartbeat mechanism to track online status. Clients send heartbeats every 30 seconds. The server runs a cleanup job every 30 seconds that marks users offline if they haven't sent a heartbeat in 150 seconds (tolerating 3-5 missed heartbeats). This threshold accounts for browser throttling when tabs are backgrounded, preventing false offline detections.

**World ID Verification**: Users can verify with World ID to permanently reserve their username. Human verification is performed via World ID Cloud v2 server-side verification using SHA-256 nullifier hashing. The system relies on hashed nullifiers from World ID for unique identification, ensuring no personally identifiable information is stored.

Session handling is managed by Express sessions with a PostgreSQL store. Guest sessions are tracked via cookies and online status is monitored to determine username availability.

**Re-verification System**: World ID verified users must re-verify periodically: 1 year initially, then 2 years, then 3 years recurring thereafter. This ensures continued human verification while minimizing friction for long-term users.

### Content Moderation System
The platform implements community guidelines with a 3-strike system. A keyword filtering system (ROT13-encoded blocklist) detects harmful content, including advanced evasion techniques. Messages with multiple reports are automatically hidden, and users can report, mute, and block others. All moderation actions are logged for auditing. The system allows all-caps messages and generally focuses moderation on genuinely harmful content.

### Real-time Features
All platforms (desktop, mobile, World App) now exclusively use HTTP polling with a 2.5-second interval for consistent, near-real-time message synchronization. This approach simplifies architecture by eliminating WebSocket connection failures and platform-specific bugs. A visible "Polling" status indicator is displayed for transparency.

### Design and UX
The UI features a clean color system with pure white and light gray backgrounds, accented by an accessible blue for primary elements. Message layouts are flat, full-width rows with hover effects, 40px avatars, and a clear three-row structure (profile pic, message content, timestamp/actions). Mobile UX has been enhanced with a consolidated header dropdown and improved polling reliability.

## External Dependencies

### World ID Integration
- `@worldcoin/minikit-js`: Core MiniKit functionalities for World App.
- `@worldcoin/minikit-react`: React-specific World ID components.
- `window.WorldApp`: Used for runtime detection of the World App environment.

### Database and ORM
- `@neondatabase/serverless`: For connecting to Neon PostgreSQL.
- `drizzle-orm`: For type-safe database interactions.
- `drizzle-kit`: For database migrations.
- `connect-pg-simple`: For PostgreSQL session storage.

### UI and Styling
- `@radix-ui/*`: Accessible UI primitives.
- `tailwindcss`: Utility-first CSS framework.
- `class-variance-authority`: For type-safe component variants.
- `lucide-react`: Icon library.

### Development Tools
- `TypeScript`: For static type checking.
- `Vite`: Fast build tool and development server.
- `tsx`: For server-side TypeScript execution.