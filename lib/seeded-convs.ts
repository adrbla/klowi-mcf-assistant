/**
 * Seeded conversations — predefined chats with a known UUID and a
 * pre-authored opening assistant message. Created/reset via
 * `npm run seed-welcome`.
 *
 * The opening message is rendered as a regular DB-stored assistant
 * message; the client-side typewriter animation is gated by the
 * conversation having exactly one assistant message and zero user
 * replies, not by the chat ID.
 */

export const WELCOME_CONV = {
  id: "7b9e4f2c-3a8d-4c1e-9b5a-6d8e2f0c4a7b",
  title: "Getting the ball rolling",
  // Phase 1 placeholder — final wording is co-authored in phase 2.
  openingMessage: `**[Placeholder phase 1 — message d'accueil à rédiger]**

Bienvenue. Cet espace est nouveau pour toi. Je n'ai pas encore décidé exactement quoi te dire à l'arrivée — on y travaille avec Adrien.

En attendant, parle-moi de ce qui te préoccupe en ce moment dans ta préparation, et on regarde ensemble.`,
};
