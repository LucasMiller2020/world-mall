# Mall Space - World Mini App

## Overview

Mall Space is a bot-proof global chat platform designed as a World Mini App that runs inside World App using MiniKit. The application provides verified human-only spaces for real-time communication, featuring a global square for general discussion and a work mode for professional collaboration. Built with human verification through World ID, the platform ensures authentic interactions while maintaining pseudonymous privacy.

### Phase 2 Community Moderation (Completed - October 18, 2025)
- **Community Guidelines Modal**: Educational modal displaying 5 rules of conduct and 3-strike system explanation
- **Keyword Filtering**: ROT13-encoded blocklist with advanced evasion detection (l33t speak, character repetition, spacing)
- **3-Strike Warning System**: Progressive penalties (warning → 1-hour timeout → permanent ban) with 30-day lookback
- **Auto-Hide Reported Messages**: Messages with 3+ unique reports automatically hidden from everyone except author
- **Mute Prompt After Reporting**: Dialog suggesting to mute user after successful report submission
- **Structured Logging**: Comprehensive audit trail for all moderation actions and violations

### Phase 4 Restoration (Completed - October 18, 2025)
- **Guest Mode Restored**: Removed all World ID verification requirements for basic access
- **No Rate Limits**: Disabled all rate limiting - no cooldowns, no daily caps for anyone
- **Simple Access**: Users can immediately click "Enter Global Square" and start chatting
- **Guest Configuration**: 240 char limit, 0 cooldown, unlimited daily messages
- **Optional Features**: World ID and premium features remain in code but are optional/unused
- **Landing Page Simplified**: Removed verification prompts, error banners, and promotional cards

### Phase 5 UX Enhancements (Completed - October 18, 2025)
- **Inline Edit Keyboard Shortcut**: Press Enter to save edits, Shift+Enter for new lines (30-second edit window)
- **Message Deletion**: Users can delete their own messages within 60 seconds with confirmation dialog
- **Real-Time Sync**: Fixed WebSocket query key invalidation using hierarchical pattern `['/api/messages', room]`
- **Optimistic Updates**: Instant UI feedback for edit and delete operations with automatic rollback on errors
- **Confirmation Protection**: Mandatory "Are you sure?" dialog prevents accidental deletions
- **Countdown Timers**: Visual feedback showing remaining time for edit (30s) and delete (60s) actions

### CORS Configuration (Completed - October 18, 2025)
- **Cross-Origin Support**: Added CORS middleware to enable World Mini App communication from World App iframe
- **Origin Whitelisting**: Production allows *.worldcoin.org, *.world.org, *.replit.app, *.replit.dev domains
- **Credential Support**: Enabled CORS credentials for session cookie functionality across origins
- **Security**: Dynamic origin validation with logging, no wildcard origins in production
- **Session Compatibility**: Works with SameSite=None, Secure cookies for cross-origin authenticated requests

### Phase 6 UI Improvements (Completed - October 19, 2025)
- **Single-Column Centered Layout**: Restored global square to clean centered layout (max-w-3xl) removing 2-column desktop grid
- **Hidden Default Sidebar**: OnlineUsersSidebar removed from default view for cleaner mobile-first experience
- **Collapsible Sidebar Toggle**: Added ChevronRight button next to online count to optionally show sidebar in slide-in Sheet
- **Emoji Reaction Updates**: Replaced star icon with grey Smile icon as emoji reaction trigger
- **6 Free Emojis**: Emoji picker shows ❤️ 👍 👎 😂 ❗ 🎉 followed by premium Smile icon button
- **Responsive Desktop Layout**: Desktop (≥768px) uses full width for chat and live feed, mobile (<768px) stays centered and narrow
- **Full-Width Chat Experience**: Message logs, composer, and live feed expand to utilize full screen width on tablets and desktops

### Phase 7 Chat Ave Design Overhaul (Completed - October 19, 2025)
- **Clean Color System**: Replaced beige/tan backgrounds with pure white (hsl 0,0%,100%) and light gray (hsl 0,0%,98%)
- **Modern Blue Accents**: Updated primary color from teal to accessible blue (hsl 210,100%,45%) meeting WCAG AA standards (5.3:1 contrast)
- **Chat Ave Message Layout**: Transformed from card-based bubbles to clean full-width rows with hover effects
- **Flat Message Design**: Removed Card/CardContent wrappers, using simple `flex items-start gap-3 px-4 py-3` layout
- **Avatar Upgrade**: Increased from 32px to 40px with colorful background variants based on username hash
- **Row Structure**: Profile pic (left) → Username/message (center, flex-1) → Timestamp/actions (right)
- **No Bubble Alignment**: All messages use same layout instead of alternating left/right based on ownership
- **Landing Page Polish**: Improved hero spacing (pt-16 md:pt-24), larger headings (text-4xl md:text-5xl), responsive button sizing
- **Mobile-First Responsive**: Centered max-w-md on mobile, full-width on desktop with appropriate padding

### Content Filter Adjustments (Completed - October 20, 2025)
- **Caps Filter Removed**: Eliminated excessive capitalization filter (>70% caps threshold) from both client and server
- **Allow All-Caps Messages**: Users can now freely use capital letters for emphasis and excitement (e.g., "WHATTTT THIS IS SO FUNNNN")
- **Casual Language Support**: Previously removed "hell" from blocklist to allow casual expressions like "hell yeah"
- **Focus on Harmful Content**: Content moderation now focuses solely on genuinely harmful content (slurs, hate speech, explicit material)
- **Expressive Formatting**: Users can express excitement and emotion through capitalization without being blocked

### Mobile UX Improvements (Completed - October 20, 2025)
- **WebSocket Reliability**: Enhanced connection monitoring with heartbeat detection (15s stale timeout)
- **Aggressive Polling Fallback**: 1.5s polling interval activates when WebSocket fails for responsive mobile sync
- **Automatic Recovery**: WebSocket reconnection attempts every 30s to restore real-time sync after network issues
- **Mobile Header Dropdown**: Consolidated settings and theme toggle into single ⋮ menu button on mobile (<768px)
- **Responsive Design**: Desktop (≥768px) keeps individual theme/settings buttons, mobile shows dropdown menu
- **Cleaner Mobile Header**: Reduced header clutter by combining two buttons into vertical dropdown menu

### WebSocket Polling Fix (Completed - October 20, 2025)
- **Mini App Polling Activation**: Fixed critical bug where World App (Mini App) clients never started polling loop
- **Connection Status Badge**: Added visible indicator showing "Live" (green) for WebSocket or "Polling" (yellow) for polling mode
- **Platform-Specific Logic**: Desktop browsers use WebSocket, World App uses continuous 2.5s polling
- **No Reconnection Attempts**: World App stays in polling mode permanently without trying WebSocket
- **Bidirectional Sync**: Mac ↔ iPhone message synchronization now works in both directions
- **Comprehensive Debugging**: Added platform detection logging and connection state monitoring

### Platform Detection Fix (Completed - October 20, 2025)
- **window.WorldApp Detection**: Updated platform.ts to detect World App using window.WorldApp object instead of window.minikit
- **Immediate Availability**: window.WorldApp is set by World App on load, works without waiting for MiniKit.install()
- **Race Condition Resolved**: Previous MiniKit.isInstalled() approach failed due to timing - required install() to complete first
- **Debug Panel Enhancement**: Settings sheet now shows both window.WorldApp and window.minikit status for troubleshooting
- **Reliable Detection**: Platform detection now works consistently on initial page load without async dependencies

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture
- **Framework**: React with TypeScript using Vite as the build tool
- **Routing**: Wouter for lightweight client-side routing
- **UI Framework**: Tailwind CSS with shadcn/ui component library for consistent design
- **State Management**: TanStack Query for server state management and caching
- **Real-time Updates**: WebSocket integration with polling fallback for live messaging

### Backend Architecture
- **Runtime**: Node.js with Express.js server
- **Database ORM**: Drizzle ORM for type-safe database operations
- **Real-time Communication**: WebSocket server using 'ws' library for live updates
- **Session Management**: Express sessions with PostgreSQL session store
- **Rate Limiting**: Custom implementation with rolling window counters

### Data Storage Solutions
- **Primary Database**: PostgreSQL with Neon serverless adapter
- **Schema Management**: Drizzle migrations for version control
- **Data Models**: 
  - Humans table storing hashed nullifiers (no PII)
  - Messages for both global and work rooms
  - Stars for upvoting system
  - Rate limits for spam prevention
  - Themes for daily topics

### Authentication and Authorization
- **Human Verification**: World ID Cloud v2 server-side verification with SHA-256 nullifier hashing
- **Access Control**: World ID verification required for all features (no guest mode)
- **Premium System**: 1 WLD payment unlocks premium features via MiniKit pay command
- **Identity Management**: Hashed nullifiers from World ID as unique identifiers
- **Privacy Protection**: No personally identifiable information stored
- **Session Handling**: Express sessions with PostgreSQL store for persistent state
- **Payment Processing**: MiniKit payment integration for premium upgrades

### Content Moderation System
- **Community Guidelines**: Educational modal with 5 rules and 3-strike system explanation
- **Keyword Filtering**: ROT13-encoded blocklist detecting slurs, hate speech, and explicit content
- **Advanced Evasion Detection**: Catches l33t speak, character repetition, and spacing tricks
- **3-Strike Warning System**: Progressive enforcement (warning → 1-hour timeout → permanent ban)
- **30-Day Lookback Window**: Strikes count for 30 days before expiring
- **Auto-Hide Mechanism**: Messages with 3+ unique reports hidden from all users except author
- **Community Reporting**: Users can report inappropriate content with reason selection
- **Mute & Block Features**: Personal filtering with mute prompt after reporting
- **Structured Logging**: Comprehensive audit trail for moderation actions and policy violations
- **Client-side Pre-validation**: Immediate feedback before server submission
- **Server-side Enforcement**: Final validation layer preventing harmful content

### Real-time Features
- **WebSocket Connection**: Live message updates and presence tracking
- **Fallback Mechanism**: Automatic polling when WebSocket connection fails
- **Presence System**: Online user counting with 30-second refresh intervals
- **Live Updates**: Instant message delivery and star count updates

### Work Mode Architecture
- **Separate Feed**: Dedicated channel for professional collaboration
- **Enhanced Metadata**: Category classification, optional links, geographic scope
- **Link Rate Limiting**: Stricter limits for promotional content prevention
- **Professional Context**: Help requests, advice sharing, and collaboration posts

### Theme System
- **4 Theme Modes**: Light, Dark, System, and Auto (Sunrise→Sunset)
- **CSS Variables**: Comprehensive theming with CSS custom properties
- **Geolocation Support**: Auto mode uses browser location for accurate sunrise/sunset
- **Persistence**: Theme preferences saved in localStorage
- **UI Controls**: Quick toggle and settings sheet with all mode options

### Direct Messaging Infrastructure (Future)
- **Database Tables**: connections, dm_threads, dm_members, dm_messages
- **Relationship System**: Friend connections with pending/accepted/blocked states
- **Thread Management**: Multi-user DM threads with read receipts
- **Message Storage**: Persistent DM messages with timestamps

## External Dependencies

### World ID Integration
- **@worldcoin/minikit-js**: Core MiniKit functionality for World App integration
- **@worldcoin/minikit-react**: React-specific World ID components and hooks
- **World App Detection**: Runtime detection of World App environment

### Database and ORM
- **@neondatabase/serverless**: Neon PostgreSQL serverless adapter
- **drizzle-orm**: Type-safe ORM for database operations
- **drizzle-kit**: Database migration and schema management tools
- **connect-pg-simple**: PostgreSQL session store for Express

### UI and Styling
- **@radix-ui/***: Comprehensive set of accessible UI primitives
- **tailwindcss**: Utility-first CSS framework
- **class-variance-authority**: Type-safe component variants
- **lucide-react**: Icon library for consistent iconography

### Development Tools
- **TypeScript**: Static type checking throughout the application
- **Vite**: Fast development server and build tool
- **@replit/vite-plugin-***: Replit-specific development enhancements
- **tsx**: TypeScript execution for server-side development