/**
 * Seeds (or resets) the welcome conversation in Postgres.
 *
 * Idempotent: running this multiple times always lands on the same
 * fresh state — chat row exists with the predefined ID, and the only
 * message is the opening assistant message. Used both for initial
 * seeding and for "wiping" after PO test runs.
 *
 * Run: `npm run seed-welcome`
 *
 * Env vars required:
 *   POSTGRES_URL  auto-injected by Vercel Postgres
 *   DEFAULT_USER_ID  optional, defaults to "chloe"
 *   BASE_URL  optional, used to print absolute URL after seeding
 */

import { sql } from "@vercel/postgres";
import { WELCOME_CONV } from "../lib/seeded-convs.ts";

function fail(msg: string): never {
  console.error(`[seed-welcome] ${msg}`);
  process.exit(1);
}

async function main() {
  if (!process.env.POSTGRES_URL) {
    fail("POSTGRES_URL is not set (run `vercel env pull .env.local`)");
  }

  const userId = process.env.DEFAULT_USER_ID ?? "chloe";
  const { id, title, openingMessage } = WELCOME_CONV;

  // Upsert the chat row. If the row already exists, refresh title and
  // updated_at; otherwise insert it.
  await sql`
    INSERT INTO chats (id, user_id, title, updated_at)
    VALUES (${id}, ${userId}, ${title}, NOW())
    ON CONFLICT (id) DO UPDATE SET
      title = EXCLUDED.title,
      updated_at = NOW()
  `;

  // Wipe any messages that may have been added during testing.
  const wiped = await sql`DELETE FROM messages WHERE chat_id = ${id}`;

  // Insert the opening assistant message.
  await sql`
    INSERT INTO messages (chat_id, role, content)
    VALUES (${id}, 'assistant', ${openingMessage})
  `;

  console.log(`[seed-welcome] ✓ welcome conv seeded`);
  console.log(`[seed-welcome]   wiped ${wiped.rowCount ?? 0} prior message(s)`);
  console.log(`[seed-welcome]   → /conv/${id}`);
  if (process.env.BASE_URL) {
    console.log(`[seed-welcome]   → ${process.env.BASE_URL}/conv/${id}`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
