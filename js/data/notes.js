// === LanorTrad - Notes de traduction, chapitre par chapitre ===
//
// A quoi ca sert : expliquer un choix de traduction, un jeu de mots
// intraduisible, une reference culturelle, un nom qu'on a decide de garder en
// japonais. Bref, tout ce qu'un lecteur se demande en fin de chapitre.
//
// Deux raisons de s'en donner la peine :
//   1. c'est ce que les lecteurs reclament le plus a une team de scantrad ;
//   2. c'est le SEUL texte original du site. Un site de scan, c'est des images :
//      Google n'a presque rien a lire. Trois lignes ecrites par la team sur un
//      chapitre valent plus, pour le referencement, que n'importe quel reglage
//      technique.
//
// Ce fichier s'edite A LA MAIN. Aucun outil, aucune etape de build.
//
//   cle 1  : id de la serie, EXACTEMENT comme dans series.js
//   cle 2  : numero du chapitre, EXACTEMENT comme affiche ("247", "246.5")
//   intro  : (optionnel) une phrase de contexte, affichee en tete
//   notes  : la liste des notes. Chacune :
//              text : le texte de la note (obligatoire)
//              page : (optionnel) numero de page concerne, tel qu'affiche
//
// Une serie ou un chapitre absent d'ici n'affiche simplement rien : pas de
// bloc vide, pas de "aucune note". Rien.
//
// -- Exemple, a decommenter et adapter ------------------------------------
// window.NOTES = {
//   "Tougen Anki": {
//     "247": {
//       intro: "Un chapitre bavard, avec deux passages qui nous ont donne du fil a retordre.",
//       notes: [
//         { page: 6, text: "« Oni » est garde tel quel : « demon » renvoie a un imaginaire chretien qui n'a rien a voir." },
//         { text: "Le nom de la technique est un jeu de mots sur deux lectures du meme kanji. Impossible a rendre en francais sans le casser, on a choisi de garder le sens plutot que la forme." }
//       ]
//     }
//   }
// };
// -------------------------------------------------------------------------
window.NOTES = {};
