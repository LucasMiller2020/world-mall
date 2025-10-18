# Mall Space Design Guidelines

## Design Approach
**Reference-Based Approach**: Drawing inspiration from Discord (community chat mastery) and Linear (professional polish with excellent dark mode). This combination delivers a chat platform that feels both approachable and sophisticated, with clear information hierarchy critical for moderation features.

**Key Principles**:
- Dark-first design with seamless light mode transition
- Moderation elements should feel authoritative without being aggressive
- Visual hierarchy that immediately communicates warning levels
- Maintain conversation flow while clearly displaying moderation UI

---

## Color Palette

### Dark Mode (Default)
**Background Layers**:
- Primary BG: 220 15% 11%
- Secondary BG (sidebars/panels): 220 15% 14%
- Elevated surfaces (modals, cards): 220 15% 17%
- Input fields: 220 15% 8%

**Text Colors**:
- Primary text: 220 10% 95%
- Secondary text: 220 8% 70%
- Muted text (timestamps): 220 8% 50%

**Brand & Interactive**:
- Primary brand: 262 80% 60% (vibrant purple for CTAs, active states)
- Link/clickable: 215 90% 65% (bright blue)
- Success/online: 142 70% 50%

**Moderation Palette**:
- Critical warning: 0 85% 60% (red for bans, severe violations)
- Standard warning: 38 95% 55% (amber for cautions)
- Info/guideline: 215 80% 55% (blue for educational)
- Blocked content overlay: 220 15% 20% with 85% opacity

### Light Mode
**Background Layers**:
- Primary BG: 220 20% 98%
- Secondary BG: 220 20% 94%
- Elevated surfaces: 0 0% 100%
- Input fields: 220 15% 96%

**Text Colors**:
- Primary: 220 20% 15%
- Secondary: 220 15% 35%
- Muted: 220 10% 55%

**Brand & Interactive**: Same hues as dark mode, adjusted lightness for contrast

---

## Typography
**Font Stack**: Inter (primary), System UI fallback

**Scale**:
- Headings (modals, sections): text-lg/font-semibold (18px)
- Body (messages): text-base/font-normal (16px)
- Small (timestamps, metadata): text-sm (14px)
- Tiny (badges, labels): text-xs/font-medium (12px)

**Hierarchy**:
- Username in chat: font-semibold with 500 weight
- Warning text: font-semibold
- Timestamps and metadata: font-normal with muted color

---

## Layout System
**Spacing Primitives**: Use Tailwind units of 2, 4, 6, 8, 12, 16 for consistency

**Grid Structure**:
- Three-column layout: Sidebar (280px) | Main Chat (flex-1) | User Info Panel (320px, collapsible)
- Mobile: Single column with slide-out sidebar
- Spacing: gap-4 between major sections, gap-2 for tight groupings

**Content Density**:
- Message padding: p-3 for comfortable reading
- Modal padding: p-6 for guidelines, p-4 for quick actions
- Badge spacing: m-1 for inline warnings

---

## Component Library

### Core Chat Elements
**Message Bubbles**: Alternate sender highlighting, no bubble UI—flat design with subtle hover states (bg opacity change). Avatar (40px rounded-full) + username + timestamp + message content in horizontal flow.

**Input Field**: Rounded-lg with p-3, elevated surface color, focus ring in brand purple (ring-2 ring-primary).

### Navigation
**Sidebar**: Server/channel list with icon-first design, active state uses primary brand color with subtle bg highlight. Nested channels indent with pl-6.

**Top Bar**: Server name, search (w-64 input), user controls aligned right.

### Moderation Components

**Warning Badges**: Inline with messages, rounded-md px-2 py-1 with icon + text
- Critical: Red bg at 15% opacity, red border-l-2, text in red at full saturation
- Standard: Amber implementation
- Info: Blue implementation
- Sizes: h-6 for inline, h-8 for standalone warnings

**Community Guidelines Modal**:
- Overlay: Full-screen with bg-black/60 backdrop blur
- Modal: max-w-2xl centered, elevated surface color, rounded-xl
- Header: Sticky with title + close button
- Content sections: Numbered list with icons, each section has pt-6 separation
- Footer: Primary CTA button (I Understand) + secondary dismiss link

**Blocked Content Placeholder**: Replaces message with blurred overlay, centered text "Message Hidden - Violates Guidelines" with "Show Details" link that expands moderation reason.

**Moderation Action Bar**: Fixed bottom banner (when moderating), h-16 with action buttons (Warn, Timeout, Ban) using appropriate warning colors, flex justify-between layout.

### Status Indicators
**User Status Dots**: 8px circle, positioned absolute bottom-0 right-0 on avatar with white ring-2
- Online: Green (142 70% 50%)
- Away: Amber (38 95% 55%)
- DND: Red (0 85% 60%)
- Offline: Gray (220 10% 40%)

### Buttons
**Primary**: bg-primary rounded-md px-4 py-2, white text, subtle shadow
**Secondary**: variant="outline" with border in secondary text color
**Danger**: Red background for destructive actions
**Blur Background**: When on images/overlays, add backdrop-blur-md bg-black/30

---

## Images

**No large hero images** - This is an application interface, not a marketing page.

**Avatar Images**:
- User avatars: 40px circles throughout chat, 64px in profile cards
- Server icons: 48px rounded-lg in sidebar
- Default fallbacks: Colored backgrounds with initials

**Empty States**:
- No messages illustration: Simple line drawing (max 240px) centered with text below
- No search results: Magnifying glass icon with "No results found"

**Moderation Icons**: 
- Warning triangle (amber)
- Shield-x (red for bans)
- Info circle (blue)
- Eye-off (for hidden content)
Use icon library (Heroicons recommended) at 20px for inline, 24px for prominent displays

---

## Interaction Patterns
- Message hover reveals timestamp + quick actions (reply, react, more)
- Smooth transitions (150ms ease) for all state changes
- Warning badges pulse subtly on first appearance (animate-pulse-once)
- Modal enter/exit with fade + scale animation (duration-200)
- No distracting animations during active chatting