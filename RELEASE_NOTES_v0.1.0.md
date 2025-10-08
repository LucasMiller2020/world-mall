# Release v0.1.0 – World Mall (Hackathon Demo)

This is the initial demo release of World Mall for the hackathon submission. It is tagged
`v0.1.0` and includes the following:

## Features

- Guest posting (≤60 characters, 10 messages/day, 30-second cooldown).
- World ID verification via Cloud v2 to unlock full functionality (200-character posts, stars,
  reporting and Work Mode).
- Real-time feed using WebSockets, with SSE/polling fallback for environments that do not
  support WebSockets (e.g. some mobile WebViews).
- Privacy-preserving identity: hashed nullifier to avoid storing PII.
- Light, dark, system and auto (sunrise→sunset) themes.
- Basic rate limiting and moderation controls.

## Setup

1. Clone the repository and install dependencies with `npm install`.
2. Copy `.env.example` to `.env` and fill in `WORLD_ID_APP_ID`, `WORLD_ID_ACTION`,
   `WORLD_ID_CLOUD_SECRET` and `DATABASE_URL`.
3. Push database migrations with `npm run db:push`.
4. Build the project using `npm run build`.
5. Start the server with `npm start`.

## Testing

Use the steps in **QA.md** to test the guest, verification and verified flows, as well as theme
toggling and landing page history.

## Known issues

- Some WebViews block cookies. A header fallback is implemented but may require a refresh on
  very old devices.
- The direct messaging feature (World Chat) is not yet implemented.

## Acknowledgements

Thank you to the hackathon organisers and the World ID team for providing the APIs and support
necessary to build this project.
