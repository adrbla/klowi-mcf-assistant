/**
 * Seeded conversations — predefined chats with a known UUID and
 * pre-authored opening assistant message. Created/reset via
 * `npm run seed-welcome`.
 */

export const WELCOME_CONV = {
  id: "7b9e4f2c-3a8d-4c1e-9b5a-6d8e2f0c4a7b",
  title: "Getting the ball rolling",
  openingMessage: `Tu es sur le discours liminaire de Strasbourg en ce moment, c'est ça ? On peut partir de là.

Tu n'as pas à savoir quoi faire de cet espace pour t'en servir. Personne ne t'a livré de mode d'emploi, et il n'y en a pas vraiment besoin. Ce n'est pas un outil de production qui te livrerait des fiches, plutôt un endroit pour penser à voix haute, sparring partner et soutien à la fois, un interlocuteur solide, instruit de tout le contexte.

Concrètement, ça peut être très précis : tu me lis un passage du liminaire et on regarde ce qui marche ou ce qui flotte, on éprouve ensemble ; tu me demandes "Qu'est-ce que X (de tel COS) pourrait me poser à propos de ABC ?" et on dépiote ce qu'il y a derrière. Ou plus large : tu me dis où tu en es globalement et je te propose des choses que ça peut être utiles de creuser. Le grain fin ou la mise au point, selon ce qui sert.

Par exemple pour Strasbourg là, maintenant : tu peux me coller un passage sur lequel tu te poses des questions, ou me dire ce que tu n'arrives pas encore à formuler, ou me donner ton plan actuel et on voit ensemble, pas (du tout) pour que je produise à ta place, mais pour t'aider à sortir **ta** version qui donne le plus de chances. Pas besoin d'un truc propre, le brouillon marche très bien.

Par où tu veux qu'on commence ? Qu'est-ce qui te résiste le plus dans ce liminaire en ce moment ?`,
};
