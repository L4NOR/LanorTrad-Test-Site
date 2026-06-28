// === LanorTrad - Adaptations animées des séries ===
// Source unique pour l'onglet « Anime » de la fiche série.
// La clé DOIT correspondre exactement à l'`id` dans js/data/series.js.
//
// season.n        : numéro de saison (affiché en pastille)
// season.episodes : nombre d'épisodes (génère la grille)
// season.platforms: badges « Disponible sur » (indicatif, non cliquable)
// note            : mention affichée en bas de l'onglet
//
// === Lecture via anime-sama ===
// asSlug          : identifiant de la série sur anime-sama.to (slug du catalogue)
// season.asSeason : numéro de saison côté anime-sama (par défaut = season.n)
// season.langs    : langues réellement disponibles ["vostfr", "vf"]
//                   → génère le sélecteur VOSTFR / VF et les liens des épisodes
//                   URL : https://anime-sama.to/catalogue/<asSlug>/saison<asSeason>/<lang>/
window.ANIME = {
  "Ao No Exorcist": {
    studio: "A-1 Pictures / Studio VOLN",
    asSlug: "blue-exorcist",
    note: "LanorTrad ne diffuse pas d'animé — les liens renvoient vers anime-sama.to (catalogueur tiers).",
    seasons: [
      {
        n: 1,
        title: "Blue Exorcist",
        year: 2011,
        episodes: 25,
        status: "Terminée",
        studio: "A-1 Pictures",
        langs: ["vostfr", "vf"],
        platforms: ["Crunchyroll", "ADN"],
        synopsis:
          "Rin Okumura découvre qu'il est le fils de Satan et entre à l'Académie de la Croix-Vraie pour devenir exorciste et maîtriser ses flammes bleues."
      },
      {
        n: 2,
        title: "Kyôto Saga",
        year: 2017,
        episodes: 12,
        status: "Terminée",
        studio: "A-1 Pictures",
        langs: ["vostfr", "vf"],
        platforms: ["Crunchyroll", "ADN"],
        synopsis:
          "Le vol de l'Œil Impur de l'Empereur entraîne Rin et ses camarades à Kyôto, sur les terres de la famille Suguro."
      },
      {
        n: 3,
        title: "Shimane Illuminati Saga",
        year: 2024,
        episodes: 12,
        status: "Terminée",
        studio: "Studio VOLN",
        langs: ["vostfr", "vf"],
        platforms: ["Crunchyroll", "ADN"],
        synopsis:
          "L'Illuminati refait surface à Shimane et menace de réveiller une force capable de rouvrir la porte de Gehenna."
      },
      {
        n: 4,
        title: "Beyond the Snow Saga",
        year: 2025,
        episodes: 12,
        status: "Terminée",
        studio: "Studio VOLN",
        langs: ["vostfr", "vf"],
        platforms: ["Crunchyroll", "ADN"],
        synopsis:
          "Les secrets du passé des frères Okumura et de leur mère se dévoilent dans cet arc enneigé et plus intime."
      }
    ],
    movies: [
      { title: "Blue Exorcist — Le Film", year: 2012, studio: "A-1 Pictures" }
    ]
  },

  "Tougen Anki": {
    studio: "Studio Hibari",
    asSlug: "tougen-anki",
    // Où en est l'anime par rapport au manga (source : anime-sama)
    mangaSync: { label: "Saison 1 · épisode 24", chapter: 77 },
    note: "LanorTrad ne diffuse pas d'animé — les liens renvoient vers anime-sama.to (catalogueur tiers).",
    seasons: [
      {
        n: 1,
        title: "Tougen Anki",
        year: 2025,
        episodes: 24,
        status: "Saison 1 terminée",
        studio: "Studio Hibari",
        langs: ["vostfr", "vf"],
        platforms: ["Crunchyroll", "Disney+"],
        synopsis:
          "Ichinose Shiki réveille son sang d'Oni le jour de la mort de son père adoptif et se retrouve plongé dans la guerre millénaire opposant les descendants de Momotarô aux Oni."
      },
      {
        // Annoncée sur anime-sama — pas encore d'épisodes : `upcoming` désactive les liens.
        n: 2,
        title: "Saison 2",
        year: 2026,
        episodes: null,
        status: "À venir",
        studio: "Studio Hibari",
        upcoming: true,
        releaseNote: "Diffusion prévue pour octobre 2026."
      }
    ]
  }
};
