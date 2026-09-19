// === LanorTrad - Fiches personnages, sans spoil ===
//
// A quoi ca sert : un « qui est qui » par serie. Sur la fiche serie (onglet
// Personnages) et dans le lecteur (bouton « Qui est qui ? »).
//
// SANS SPOIL : chaque personnage n'apparait qu'a partir du chapitre ou il
// entre en scene (`depuis`). Un lecteur au chapitre 30 ne voit que les
// personnages deja rencontres, et seulement ce qu'on sait d'eux a ce stade.
// Ce qu'on apprend plus tard va dans `suite`, avec son propre chapitre.
// Dans le lecteur, un personnage qui arrive DANS le chapitre en cours ne
// s'affiche qu'une fois le chapitre termine.
//
// Une serie sans entree n'affiche RIEN : pas d'onglet vide, pas de bouton.
//
// Ce fichier s'edite A LA MAIN. Aucun outil, aucune etape de build.
// Verifie apres chaque modification : node scripts/check.js
//
// ---------------------------------------------------------------------------
// MODE D'EMPLOI
//
//   cle      : id de la serie, EXACTEMENT comme dans series.js ("Tougen Anki")
//   nom      : le nom tel qu'on l'ecrit dans nos traductions
//   depuis   : numero du chapitre ou il apparait, EXACTEMENT comme affiche
//              ("1", "12", "246.5")
//   role     : (facultatif) une etiquette courte : "Heros", "Mentor"…
//   texte    : ce qu'on sait de lui A CE CHAPITRE-LA, pas plus
//   image    : (facultatif) chemin d'un portrait carre, par exemple
//              "images/personnages/tougen-anki/shiki.webp". Sans image, une
//              pastille avec ses initiales prend la place.
//   suite    : (facultatif) ce qu'on apprend plus tard, par chapitre :
//              [ { depuis: "40", texte: "..." }, ... ]
//
// Pour demarrer : enleve les // du bloc d'exemple, puis remplace par tes
// vraies fiches. Garde les virgules entre deux personnages et deux series.
// ---------------------------------------------------------------------------

window.PERSONNAGES = {

//    ↓↓↓ ENLEVE LES // DE CE BLOC POUR L'ACTIVER, puis adapte ↓↓↓

//    "Tougen Anki": [
//      {
//        nom: "Shiki Ichinose",
//        depuis: "1",
//        role: "Heros",
//        texte: "Ado au sang chaud qui decouvre qu'il descend des Oni.",
//        suite: [
//          { depuis: "40", texte: "Ce que le lecteur apprend au chapitre 40, et pas avant." }
//        ]
//      },
//      {
//        nom: "Un autre personnage",
//        depuis: "12",
//        texte: "Invisible pour qui n'a pas encore lu le chapitre 12."
//      }
//    ],

//   ↑↑↑ FIN DU BLOC D'EXEMPLE ↑↑↑

};
