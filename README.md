# 300 Par Arena (private beta)

Copy of the srh site's 300 Par solo game, 1v1 Duel, leaderboard and dashboard, on its own Firebase
project, plus an invite-only beta and round-robin tournaments. Game internals: `app/300par/README.md`.
Tournament design, rules and edge cases: **`TOURNAMENT.md`**.

## Setup (new Firebase project)

1. Create a Firebase project. Enable **Authentication** -> Google and Email/Password, and add your
   domain (e.g. `*.vercel.app`) under Authentication -> Settings -> Authorized domains.
2. Create a **Firestore** database.
3. Copy `.env.local.example` to `.env.local` and fill in the web config, the **service account**
   (Admin SDK - required, the waitlist/admin/tournament APIs run server side), `APP_URL` and SMTP.
   (`.env.local` currently holds placeholders only so the app builds.)
4. Publish the rules: `npx firebase-tools deploy --only firestore:rules --project <id>` (or paste
   `firestore.rules` into the console).
5. Optional TTL policies (Firestore -> TTL): collection group `duelRooms` field `deleteAt`, and
   collection group `picks` field `deleteAt` - cleans abandoned duel rooms.
6. `npm install && npm run dev`, sign in with an admin email, open `/admin`, invite friends.

The dashboard's duel history query needs one composite index; the first error in the browser console
has a link that creates it.

## Scripts

- `npm run dev` / `npm run build`
- `npm test` - tournament format unit tests
- `npm run test:emulator` - end-to-end tournament + rules test on the Firestore emulator
  (needs Java and `npx firebase-tools`; use `npx -y firebase-tools@14 emulators:exec ...` if the CLI isn't installed)
