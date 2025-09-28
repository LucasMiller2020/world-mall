# World Mall - World Mini App

## Overview

World Mall is a bot-proof global chat platform designed as a World Mini App that runs inside World App using MiniKit. The application provides verified human-only spaces for real-time communication, featuring a global square for general discussion and a work mode for professional collaboration. Built with human verification through World ID, the platform ensures authentic interactions while maintaining pseudonymous privacy.

### Phase 2 Enhancements (Completed)
- **Guest Mode**: Generous limits of 60 characters, 10 messages per day, 30-second cooldown
- **Dark Mode**: Comprehensive theme system with Light, Dark, System, and Auto (Sunrise→Sunset) modes
- **World ID Verification**: Server-side verification with SHA-256 nullifier hashing
- **Content Filtering**: Relaxed entropy-based spam detection allowing natural expressions
- **Diagnostic Tools**: Debug endpoints for World ID and session troubleshooting
- **DM Infrastructure**: Database tables for future direct messaging features

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
- **Guest Mode**: Accessible without verification with limited features (60 chars, 10/day, 30s cooldown)
- **Identity Management**: Hashed nullifiers from World ID as unique identifiers
- **Privacy Protection**: No personally identifiable information stored
- **Session Handling**: Express sessions with PostgreSQL store for persistent state
- **Diagnostic Endpoints**: /api/worldid/diag and /api/debug/session for troubleshooting

### Content Moderation System
- **Client-side Filtering**: Basic content filtering for immediate feedback
- **Server-side Validation**: Entropy-based spam detection allowing natural elongations and emojis
- **Smart Filtering**: Distinguishes between human expression (Howdyyyyy) and spam (aaaaaa)
- **Community Moderation**: Report and mute functionality
- **Rate Limiting**: Multiple tiers (per minute/hour/day) to prevent abuse

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