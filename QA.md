# QA Checklist for Judges

Follow this script to test the World Mall demo and ensure you encounter the happy path.

1. **Open World Mall** in the World App.
2. **Guest path**:
   - Post “Hello from judge!” (≤60 characters).
   - Observe the 30‑second cooldown indicator and the limit of 10 messages per day.
3. **Verify with World ID**:
   - Tap **Verify with World ID**.
   - Complete the verification sheet.
   - Upon success, ensure that your role is upgraded to **verified**.
4. **Verified path**:
   - Post a 200‑character message.
   - Star an existing message.
   - Open the **Work Mode** tab.
5. **Theme toggle**:
   - Toggle between **light**, **dark**, **system** and **auto** themes.
   - Refresh the page and confirm that your preference persists.
6. **Home page history**:
   - Navigate to the landing page and confirm that “Live from Global Square” shows the latest history (up to the last ten posts from the last seven days).

## Known issues & workarounds

- **Cookie fallback** – if the WebView blocks cookies, refresh once. An `X‑Session` header fallback is in place.
- **Verification failures** – ensure that World App is updated and the `WORLD_ID_ACTION` in your `.env` file matches `world‑mall/verify`.
