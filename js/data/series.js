// === LanorTrad - Source unique des metadonnees de series ===
// Editez ce fichier a la main OU via l'outil local :
//   node tools/series-server.js   (ou tools/Modifier-Series.bat)
// Le manifeste des pages (nombre de pages par chapitre) est genere a part
// par tools/build-data.py.
//
// id        : doit correspondre EXACTEMENT au dossier dans /Manga (pour le lecteur)
// accent    : couleur d'accent utilisee pour le glow / theme 3D de la fiche
// demo      : true => chapitres reellement copies et lisibles dans cette version
window.SERIES = [
  {
    id: "Tougen Anki",
    title: "Tougen Anki",
    type: "manga",
    genres: ["Action", "Drame", "Fantasy", "LanorTrad"],
    status: "En cours",
    chapters: 249,
    lastUpdate: "2026-07-12",
    rating: 4.8,
    author: "Yura Urushibara",
    artist: "Yura Urushibara",
    year: 2020,
    accent: "#e0245e",
    description:
      "Shiki Ichinose est aux premiers abords un simple ado rebelle mais il se trouve qu'il est l'héritier du sang d'Oni. Ce dernier a vécu toute son enfance en ignorant ce qu'il était vraiment. C'est lorsqu'un inconnu tente de l'assassiner chez lui qu'il se voit révéler la vérité par son beau-père. L'homme qui tenta de s'en prendre à Shiki est un Momotarou, les Oni et les Momotarou n'ont jamais pu coexister et ont toujours mené une guerre sans fin. Que fera Shiki après toutes ces révélations ? Pourra-t-il réconcilier les Oni et Momotarou ?",
    cover: "images/Cover/TougenAnki.jpg",
    url: "manga.html?id=Tougen%20Anki",
    demo: true,
    featured: true
  },
  {
    id: "Ao No Exorcist",
    title: "Ao No Exorcist",
    type: "manga",
    genres: ["Action", "Aventure", "Fantasy", "LanorTrad"],
    status: "En cours",
    chapters: 171,
    lastUpdate: "2026-07-11",
    rating: 4.6,
    author: "Kazue Katou",
    artist: "Kazue Katou",
    year: 2009,
    accent: "#1b75bc",
    description:
      "Adopté dès son plus jeune âge par un exorciste de renom, Rin apprend un jour qu'il est le fils du mal incarné, quand son véritable père, Satan lui-même, apparaît pour l'emmener dans son monde. Mais impossible pour le jeune homme d'oublier tout ce qui lui a été enseigné jusqu'ici... Confronté à un adversaire invincible qui a consumé le seul homme à l'avoir jamais aimé, Rin fait alors le choix de combattre aux côtés des exorcistes, quitte à libérer, en dégainant l'épée de son père, la puissance démoniaque qui sommeille en lui !",
    cover: "images/Cover/AoNoExorcist.jpg",
    url: "manga.html?id=Ao%20No%20Exorcist",
    demo: false,
    featured: true
  },
  {
    id: "Catenaccio",
    title: "Catenaccio",
    type: "manga",
    genres: ["Sports", "Vie Scolaire", "Collaboration"],
    status: "En cours",
    chapters: 56,
    lastUpdate: "2026-03-28",
    rating: 4.5,
    author: "Morimoto Daisuke",
    artist: "Morimoto Daisuke",
    year: 2022,
    accent: "#16a34a",
    // Équipes partenaires (hors LanorTrad) qui collaborent sur cette série
    partners: [
      { name: "KaminaTrad", url: "https://x.com/KaminaTrad", color: "#1d9bf0" },
      { name: "Flexxon", url: "https://x.com/flexonthefluxxx", color: "#f59e0b" }
    ],
    description:
      "Yatarou Araki, membre du club de football du lycée Toujou, rêve d'atteindre le sommet de l'Europe, la scène la plus prestigieuse du monde. Lors du dernier match de sa dernière année au lycée, il s'efforce d'attirer l'attention des recruteurs afin de faire le premier pas vers son rêve et d'entrer dans les rangs des professionnels.",
    cover: "images/Cover/Catenaccio.png",
    url: "manga.html?id=Catenaccio",
    demo: false,
    featured: true
  },
  {
    id: "Tokyo Underworld",
    title: "Tokyo Underworld",
    type: "manga",
    genres: ["Horreur", "Mystère", "LanorTrad"],
    status: "En cours",
    chapters: 44,
    lastUpdate: "2026-07-11",
    rating: 4.4,
    author: "Sakaki Kenji",
    artist: "Sakaki Kenji",
    year: 2022,
    accent: "#9333ea",
    description:
      "Une certaine légende urbaine parle de l'existence de Shin Tokyo, un Tokyo alternatif dans lequel les personnes ayant causé la mort d'autrui sont envoyées pour se repentir de leur crime. Le seul moyen d'en réchapper : survivre au jugement sans merci qui les y attend ! Yomi et Yami sont deux frères jumeaux ayant la particularité de partager leurs sensations. Mais un jour, leur professeur qui se faisait harceler par certains de leurs camarades se suicide devant eux, entraînant leur classe entière dans le monde de Shin Tokyo. Désormais, les jumeaux ne pensent plus qu'à une chose : échapper ensemble de l'enfer dans lequel ils ont été transportés !",
    cover: "images/Cover/TokyoUnderworld.jpg",
    url: "manga.html?id=Tokyo%20Underworld",
    demo: false,
    featured: true
  },
  {
    id: "Satsudou",
    title: "Satsudou",
    type: "manga",
    genres: ["Aventure", "Comédie", "Arts Martiaux", "LanorTrad"],
    status: "En cours",
    chapters: 18,
    lastUpdate: "2026-02-23",
    rating: 4.3,
    author: "Titti Yukinaga",
    artist: "Nishi Nadai",
    year: 2023,
    accent: "#f59e0b",
    description:
      "Akamori Mitsuo voudrait être un employé ordinaire, mais... Il est un meurtrier de génie né dans une famille qui pratique l'art ancien de tuer depuis des siècles. Akamori se heurte à des obstacles tels que les Yakuza, les combattants et les gangs sur le chemin qui le mène à ses fins.",
    cover: "images/Cover/Satsudou.jpg",
    url: "manga.html?id=Satsudou",
    demo: false,
    featured: true
  },
  // === ONESHOTS ===
  {
    id: "Countdown",
    title: "Countdown",
    type: "oneshot",
    genres: ["Spectres", "Surnaturel", "Oneshot"],
    status: "Terminé",
    chapters: 1,
    lastUpdate: "2025-12-25",
    rating: 4.2,
    author: "Saito Ryoga",
    artist: "Saito Ryoga",
    year: 2024,
    accent: "#64748b",
    description:
      "Vêtements noirs, yeux noirs, cheveux noirs. Si tu croises cette silhouette, le compte à rebours a peut-être déjà commencé. Dix minutes de lecture, et un frisson qui reste.",
    cover: "images/Cover/Countdown.jpg",
    url: "manga.html?id=Countdown",
    demo: false,
    featured: false
  },
  {
    id: "Gestation of Kalavinka",
    title: "Gestation of Kalavinka",
    type: "oneshot",
    genres: ["Réincarnation", "Surnaturel", "Oneshot"],
    status: "Terminé",
    chapters: 1,
    lastUpdate: "2025-12-25",
    rating: 4.4,
    author: "Shinjuubako",
    artist: "Shinjuubako",
    year: 2018,
    accent: "#0ea5e9",
    description:
      "Après avoir perdu sa femme, Dawei accomplit le rituel de l'enterrement céleste sur son corps afin de faire son deuil.",
    cover: "images/Cover/Gestation of Kalavinka.jpg",
    url: "manga.html?id=Gestation%20of%20Kalavinka",
    demo: false,
    featured: false
  },
  {
    id: "In the White",
    title: "In the White",
    type: "oneshot",
    genres: ["Psychologie", "Romance", "Oneshot"],
    status: "Terminé",
    chapters: 1,
    lastUpdate: "2025-12-25",
    rating: 4.1,
    author: "Takami Nao",
    artist: "Takami Nao",
    year: 2017,
    accent: "#e2e8f0",
    description:
      "Une petite araignée vient perturber la vie d'un auteur désespéré.",
    cover: "images/Cover/In the White.jpg",
    url: "manga.html?id=In%20the%20White",
    demo: false,
    featured: false
  },
  {
    id: "Sake to Sakana",
    title: "Sake to Sakana",
    type: "oneshot",
    genres: ["Drame", "Fantaisie", "Horreur", "Mystère", "Oneshot"],
    status: "Terminé",
    chapters: 1,
    lastUpdate: "2025-12-25",
    rating: 4.5,
    author: "Matsutanaka Daichi",
    artist: "Matsutanaka Daichi",
    year: 2015,
    accent: "#06b6d4",
    description:
      "Fumi et Haru sont deux amies d'université qui partagent une passion pour la natation, jusqu'à ce que l'héritage \"unique\" de Fumi vienne compliquer les choses.",
    cover: "images/Cover/Sake to Sakana.jpg",
    url: "manga.html?id=Sake%20to%20Sakana",
    demo: false,
    featured: false
  },
  {
    id: "Second Coming",
    title: "Second Coming",
    type: "oneshot",
    genres: ["Drame", "Horreur", "Mystère", "Tragédie", "Oneshot"],
    status: "Terminé",
    chapters: 1,
    rating: 4.6,
    author: "Kadono Tamio",
    artist: "Kadono Tamio",
    year: 2014,
    accent: "#dc2626",
    description:
      "Un forgeron perd sa fille lors d'un sacrifice et attend 40 ans pour se venger.",
    cover: "images/Cover/Second Coming.jpg",
    url: "manga.html?id=Second%20Coming",
    demo: false,
    featured: false
  }
];
