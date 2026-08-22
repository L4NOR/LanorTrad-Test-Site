// === LanorTrad - Qui a fait quoi, chapitre par chapitre ===
// Ce fichier decide des noms affiches sur l'ecran de fin d'un chapitre.
// Editez-le a la main OU via l'outil local :
//   node tools/credits-server.js   (ou tools/Modifier-Credits.bat)
//
// TROIS NIVEAUX, du plus general au plus precis. Chaque niveau ne remplace
// que les champs qu'il cite : inutile de recopier les autres.
//
//   1. defaut                     l'equipe habituelle
//   2. series[<id>].defaut        toute une serie (une reprise, un renfort)
//   3. series[<id>].chapitres[N]  un chapitre precis
//
//   trad   Traduction (japonais -> francais)
//   clean  Clean (textes effaces, redraw)
//   edit   Edit (textes places dans les bulles)
//   qc     Q-check (relecture finale)
//
// L'id de serie s'ecrit EXACTEMENT comme dans series.js ("Tougen Anki").
// Le numero de chapitre s'ecrit comme dans chapters.js ("250", "45.5").
// Un champ ABSENT herite du niveau au-dessus. Un champ mis a "" a la main
// masque la ligne -- un chapitre sorti sans Q-check, par exemple. L'outil,
// lui, n'ecrit jamais de champ vide : il le retire.
// Un nom identique en clean et en edit s'affiche sur une seule ligne
// "Clean & Edit", comme avant.
window.CREDITS = {
  defaut: { trad: "Taichoskii", clean: "Lanor", edit: "Lanor", qc: "Zerox" },
  series: {}
};
