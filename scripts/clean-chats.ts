/**
 * Wipes all chats and messages from the Postgres DB.
 * One-shot cleanup before sharing the app with a new user (orphan test
 * chats from earlier development pollute the sidebar).
 *
 * Run: `npm run clean-chats`
 *
 * Env vars required:
 *   POSTGRES_URL  auto-injected by Vercel Postgres marketplace integration
 */

import { sql } from "@vercel/postgres";

function fail(msg: string): never {
  console.error(`[clean-chats] ${msg}`);
  process.exit(1);
}

async function main() {
  if (!process.env.POSTGRES_URL) {
    fail("POSTGRES_URL is not set (run `vercel env pull .env.local`)");
  }

  const before = await sql`SELECT COUNT(*)::int AS n FROM chats`;
  const beforeCount = (before.rows[0] as { n: number }).n;
  console.log(`[clean-chats] before: ${beforeCount} chats`);

  const result = await sql`DELETE FROM chats`;
  console.log(
    `[clean-chats] deleted ${result.rowCount ?? 0} chats (messages cascade via FK).`,
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
