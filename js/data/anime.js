// === LanorTrad - Adaptations animées des séries ===
// Source unique pour l'onglet « Anime » de la fiche série.
// La clé DOIT correspondre exactement à l'`id` dans js/data/series.js.
//
// `seasons` est une FRISE : saisons, films, OAV et bonus dans le même tableau,
// classés par date de sortie (le site les retrie de lui-même sur `date`).
//
// entrée.n        : numéro de saison (pastille « S1 », « S2 »…)
// entrée.kind     : "film" | "oav" | "bonus" pour ce qui n'est pas une saison
//                   (pas de numéro : la pastille affiche FILM / OAV / BONUS)
// entrée.date     : date de sortie AAAA-MM-JJ — sert au classement de la frise
// entrée.episodes : nombre total d'épisodes (génère la liste ; 1 pour un film)
// entrée.platforms: badges « Disponible sur » (indicatif, non cliquable)
// note            : mention affichée en bas de l'onglet
//
// === Lecture via Aniverse (aniverse.fr) ===
// entrée.avSlug   : identifiant de L'ENTRÉE sur aniverse.fr.
//                   Attention : contrairement à l'ancien catalogueur, chaque
//                   saison a son propre slug (pas de /saison2/), et chaque
//                   épisode a son lien direct :
//                     https://aniverse.fr/watch/<avSlug>?ep=<n>
//
// === Saison en cours de diffusion ===
// entrée.airing   : { start, jour, heure } — date du 1er épisode (AAAA-MM-JJ),
//                   jour et heure de sortie hebdomadaire (heure de Paris).
//                   Le site en déduit TOUT SEUL, à chaque visite, les épisodes
//                   déjà sortis et la date du prochain : aucun fichier à
//                   modifier le vendredi soir. Les titres et les miniatures,
//                   eux, arrivent avec tools/build-anime.js (voir ci-dessous).
//
// Titres, dates et miniatures des épisodes : js/data/anime-episodes.js,
// généré par `node tools/build-anime.js` (ou tools/Mettre-A-Jour-Anime.bat).
// Ce fichier-ci reste la source : c'est lui qui dit quelles entrées existent.
//
// entrée.eps      : épisodes écrits À LA MAIN, quand Aniverse n'a pas encore
//                   publié le titre ni l'image. Ils passent DEVANT le fichier
//                   généré, que relancer l'outil n'écrasera donc jamais.
window.ANIME = {
  "Ao No Exorcist": {
    studio: "A-1 Pictures / Studio VOLN",
    note: "LanorTrad ne diffuse pas d'animé : les liens t'envoient sur aniverse.fr, un site tiers.",
    seasons: [
      {
        n: 1,
        title: "Blue Exorcist",
        year: 2011,
        date: "2011-04-16",
        episodes: 25,
        status: "Terminée",
        studio: "A-1 Pictures",
        avSlug: "blue-exorcist",
        platforms: ["Crunchyroll", "ADN"],
        synopsis:
          "Rin Okumura découvre qu'il est le fils de Satan et entre à l'Académie de la Croix-Vraie pour devenir exorciste et maîtriser ses flammes bleues."
      },
      {
        kind: "bonus",
        title: "Ura Ex",
        year: 2011,
        date: "2011-06-22",
        episodes: 10,
        status: "Terminé",
        studio: "A-1 Pictures",
        avSlug: "blue-exorcist-specials",
        synopsis:
          "Dix courts bonus parus en 2011, en marge de la saison 1."
      },
      {
        kind: "oav",
        title: "Runaway Kuro",
        year: 2011,
        date: "2011-10-26",
        episodes: 1,
        status: "Terminé",
        studio: "A-1 Pictures",
        avSlug: "blue-exorcist-runaway-kuro",
        synopsis:
          "L'OAV consacré à Kuro, le cat-sith de Rin."
      },
      {
        kind: "film",
        title: "Blue Exorcist — Le Film",
        year: 2012,
        date: "2012-12-28",
        episodes: 1,
        status: "Terminé",
        studio: "A-1 Pictures",
        avSlug: "blue-exorcist-the-movie",
        synopsis:
          "Le long métrage sorti en salles fin 2012, entre la saison 1 et Kyôto Saga."
      },
      {
        n: 2,
        title: "Kyôto Saga",
        year: 2017,
        date: "2017-01-06",
        episodes: 12,
        status: "Terminée",
        studio: "A-1 Pictures",
        avSlug: "blue-exorcist-kyoto-saga",
        platforms: ["Crunchyroll", "ADN"],
        synopsis:
          "Le vol de l'Œil Impur de l'Empereur entraîne Rin et ses camarades à Kyôto, sur les terres de la famille Suguro."
      },
      {
        n: 3,
        title: "Shimane Illuminati Saga",
        year: 2024,
        date: "2024-01-06",
        episodes: 12,
        status: "Terminée",
        studio: "Studio VOLN",
        avSlug: "blue-exorcist-shimane-illuminati-saga",
        platforms: ["Crunchyroll", "ADN"],
        synopsis:
          "L'Illuminati refait surface à Shimane et menace de réveiller une force capable de rouvrir la porte de Gehenna."
      },
      {
        n: 4,
        title: "Beyond the Snow Saga",
        year: 2024,
        date: "2024-10-05",
        episodes: 12,
        status: "Terminée",
        studio: "Studio VOLN",
        avSlug: "blue-exorcist-beyond-the-snow-saga",
        platforms: ["Crunchyroll", "ADN"],
        synopsis:
          "Les secrets du passé des frères Okumura et de leur mère se dévoilent dans cet arc enneigé et plus intime."
      },
      {
        n: 5,
        title: "The Blue Night Saga",
        year: 2025,
        date: "2025-01-04",
        episodes: 12,
        status: "Terminée",
        studio: "Studio VOLN",
        avSlug: "blue-exorcist-the-blue-night-saga",
        platforms: ["Crunchyroll", "ADN"],
        synopsis:
          "L'adaptation de l'arc Yosuga : la Nuit Bleue, l'événement qui a tout déclenché seize ans plus tôt, revient au premier plan."
      }
    ]
  },

  "Tougen Anki": {
    studio: "Studio Hibari",
    // Où en est l'anime par rapport au manga.
    mangaSync: { label: "Saison 1 · épisode 24", chapter: 77 },
    note: "LanorTrad ne diffuse pas d'animé : les liens t'envoient sur aniverse.fr, un site tiers.",
    seasons: [
      {
        n: 1,
        title: "Tougen Anki",
        year: 2025,
        date: "2025-07-11",
        episodes: 24,
        status: "Terminée",
        studio: "Studio Hibari",
        avSlug: "tougen-anki",
        platforms: ["Crunchyroll", "Disney+"],
        synopsis:
          "Ichinose Shiki réveille son sang d'Oni le jour de la mort de son père adoptif et se retrouve plongé dans la guerre millénaire opposant les descendants de Momotarô aux Oni."
      },
      {
        n: 2,
        title: "Nikkô Kegon Falls Arc",
        year: 2026,
        date: "2026-10-02",
        episodes: 12,
        status: "En cours",
        studio: "Studio Hibari",
        avSlug: "tougen-anki-nikko-kegon-falls-arc",
        platforms: ["Crunchyroll"],
        // Premier épisode le vendredi 2 octobre 2026, puis un par semaine.
        airing: { start: "2026-10-02", jour: "vendredi", heure: "18:00" },
        // Aniverse n'a encore publié ni titre ni image pour cette saison : les
        // trois premiers épisodes sont donc renseignés à la main, d'après la
        // fiche Crunchyroll de la série. À effacer le jour où Aniverse les
        // publie — tools/build-anime.js prendra le relais tout seul.
        eps: {
          "1": {
            t: "Début d'entraînement",
            d: "2026-10-02",
            img: "https://imgsrv.crunchyroll.com/cdn-cgi/image/fit=contain,format=auto,quality=80,width=640,height=360/catalog/crunchyroll/3975c8a8110eb8e033c84717b0ee0568.png"
          },
          "2": {
            t: "Comment devenir fort",
            d: "2026-10-09",
            img: "https://imgsrv.crunchyroll.com/cdn-cgi/image/fit=contain,format=auto,quality=80,width=640,height=360/catalog/crunchyroll/300f3aa41a69b65d7be249d36a71349a.png"
          },
          "3": {
            t: "But",
            d: "2026-10-16",
            img: "https://imgsrv.crunchyroll.com/cdn-cgi/image/fit=contain,format=auto,quality=80,width=640,height=360/catalog/crunchyroll/743cca26eed971ff833a29b621b48acb.png"
          }
        },
        synopsis:
          "Deuxième saison, annoncée sous le nom de l'arc des chutes de Kegon, à Nikkô."
      }
    ]
  }
};
