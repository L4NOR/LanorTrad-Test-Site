// === LanorTrad - L'atelier : ou en est le prochain chapitre ? ===
// Une entree par serie EN COURS dont le prochain chapitre est en fabrication.
// C'est ce fichier (et lui seul) qui fait avancer la jauge sur le site.
// Editez-le a la main OU via l'outil local :
//   node tools/atelier-server.js   (ou tools/Modifier-Atelier.bat)
//
//   cle      : id de la serie, EXACTEMENT comme dans series.js
//   chapter  : numero(s) du chapitre en cours de fabrication, ex "250" ou "45-46"
//   step     : etape actuelle -- id ou numero (1 a 6) :
//                1 "pages"   Pages trouvees   (raws recuperees / telechargees)
//                2 "clean"   Clean            (textes effaces, redraw)
//                3 "trad"    Traduction       (japonais -> francais)
//                4 "edit"    Edit             (textes places dans les bulles)
//                5 "qcheck"  Q-check          (relecture finale)
//                6 "sortie"  Sortie           (en ligne)
//   updated  : "AAAA-MM-JJ" -- date du dernier changement d'etape
//   eta      : (optionnel) "AAAA-MM-JJ" date de sortie visee
//   note     : (optionnel) une phrase pour expliquer un retard, une galere...
//
// Une entree calee sur "sortie" disparait toute seule 3 jours apres `updated`
// (le temps que tout le monde voie que c'est publie), inutile de la supprimer
// a la main. Une serie sans entree ici n'affiche simplement rien.
window.ATELIER = {
  "Tougen Anki":      { chapter: "254-255-256", step: "edit",   updated: "2026-10-09", eta: "2026-10-18" },
  "Ao No Exorcist":   { chapter: "170",         step: "sortie", updated: "2026-09-06", eta: "2026-10-09" },
  "Catenaccio":       { chapter: "57-93",       step: "edit",   updated: "2026-09-04",
                        note: "Pas de date, nous travaillons sur tous les chapitres. Nous essayerons de les sortir au plus vite !" },
  "Tokyo Underworld": { chapter: "47-48-49-50", step: "edit",   updated: "2026-10-09" },
  "Satsudou":         { chapter: "19-39",       step: "trad",   updated: "2026-08-03",
                        note: "Pas de date, nous travaillons sur tous les chapitres. Nous essayerons de les sortir au plus vite !" }
};
