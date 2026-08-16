// === LanorTrad - Notes de traduction, chapitre par chapitre ===
//
// A quoi ca sert : expliquer un choix de traduction, un jeu de mots
// intraduisible, une reference culturelle, un nom qu'on a decide de garder en
// japonais. Bref, tout ce qu'un lecteur se demande en fin de chapitre.
//
// Ou ca s'affiche : en bas du chapitre, apres les credits de la team.
// Un chapitre sans notes n'affiche RIEN du tout.
//
// Deux raisons de s'en donner la peine :
//   1. c'est ce que les lecteurs reclament le plus a une team de scantrad ;
//   2. c'est le SEUL texte original du site. Un site de scan, c'est des images :
//      Google n'a presque rien a lire. Trois lignes ecrites par la team sur un
//      chapitre valent plus, pour le referencement, que n'importe quel reglage
//      technique.
//
// Ce fichier s'edite A LA MAIN. Aucun outil, aucune etape de build.
// Apres modification : le site l'affiche tout de suite ; pour que Google le
// voie, il faut redeployer.
//
// ---------------------------------------------------------------------------
// MODE D'EMPLOI
//
//   cle 1  : id de la serie, EXACTEMENT comme dans series.js  ("Tougen Anki")
//   cle 2  : numero du chapitre, EXACTEMENT comme affiche     ("249", "246.5")
//   intro  : (optionnel) une phrase de contexte, affichee en tete
//   notes  : la liste des notes. Chaque note s'ecrit au choix :
//              { page: 12, text: "..." }   avec le numero de page
//              "..."                        juste le texte
//
// Pour demarrer : enleve les // des lignes marquees ci-dessous, puis remplace
// le contenu par tes vraies notes. Attention a garder les virgules entre deux
// series et entre deux chapitres.
// ---------------------------------------------------------------------------

window.NOTES = {

   ↓↓↓ ENLEVE LES // DE CE BLOC POUR L'ACTIVER, puis adapte ↓↓↓
  
   "Tougen Anki": {
     "246": {
       intro: "Un chapitre bavard, avec deux passages qui nous ont donne du fil a retordre.",
       notes: [
         { page: 6, text: "« Oni » est garde tel quel : « demon » renvoie a un imaginaire chretien qui n'a rien a voir." },
         "Le nom de la technique joue sur deux lectures du meme kanji. Intraduisible sans casser le jeu de mots : on a garde le sens plutot que la forme."
       ]
     },
     "245": {
       notes: [
         "Une seule note suffit, et l'intro est facultative."
       ]
     }
  },
  
  ↑↑↑ FIN DU BLOC D'EXEMPLE ↑↑↑

};

// Verification rapide, dans la console du navigateur (touche F12) :
//   window.NOTES
// Si ca affiche {} alors que tu as ecrit des notes, c'est qu'elles sont encore
// dans les commentaires (lignes commencant par //).
