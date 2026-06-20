// === LanorTrad - Source unique des metadonnees de series ===
// Editez ce fichier pour ajouter/modifier une serie. Le manifeste des pages
// (nombre de pages par chapitre) est genere a part par tools/build-data.py.
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
    chapters: 241,
    lastUpdate: "2026-04-19",
    rating: 4.8,
    author: "Yura Urushibara",
    accent: "#e0245e",
    description:
      "Ichinose Shiki, héritier du sang d'Oni, a passé toute son enfance sans se rendre compte de ce fait. Lorsqu'un inconnu se présente le jour de la mort de son père adoptif, sa véritable nature se réveille et il est entraîné dans la guerre millénaire opposant les descendants de Momotarô aux Oni.",
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
    lastUpdate: "2025-02-23",
    rating: 4.6,
    author: "Kazue Katô",
    accent: "#1B75BC",
    description:
      "Rin Okumura est un adolescent qui découvre un jour qu'il est le fils de Satan. Déterminé à devenir un exorciste pour vaincre son père démoniaque, il entre à la prestigieuse Académie de la Croix-Vraie pour maîtriser ses flammes bleues.",
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
    author: "Hironori Yamatani",
    accent: "#16a34a",
    // Équipes partenaires (hors LanorTrad) qui collaborent sur cette série
    partners: [
      { name: "KaminaTrad", url: "https://x.com/KaminaTrad", color: "#1d9bf0" },
      { name: "Flexxon", url: "https://x.com/flexonthefluxxx", color: "#f59e0b" }
    ],
    description:
      "Yataro Araki, membre de l'équipe de football du lycée Tôjô, nourrit de grandes ambitions : dans dix ans, il se voit déjà au sommet du football européen. Un récit de sport intense porté par la rage de vaincre et l'esprit d'équipe.",
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
    lastUpdate: "2025-02-23",
    rating: 4.4,
    author: "Uru Okabe",
    accent: "#9333ea",
    description:
      "Selon la légende urbaine, les coupables sont condamnés à tomber dans les Enfers de Tokyo. Là, ils ne bénéficient d'aucune pitié et doivent affronter des épreuves mortelles pour espérer revenir à la surface.",
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
    lastUpdate: "2025-02-23",
    rating: 4.3,
    author: "Kanata Yanagawa",
    accent: "#f59e0b",
    description:
      "Akamori Mitsuo veut être un salarié ordinaire mais... c'est un meurtrier de génie né dans une famille qui pratique l'art ancien de tuer. Une comédie d'action décalée où l'on tente d'échapper à son destin.",
    cover: "images/Cover/Satsudou.jpg",
    url: "manga.html?id=Satsudou",
    demo: false,
    featured: false
  },
  // === ONESHOTS ===
  {
    id: "Countdown",
    title: "Countdown",
    type: "oneshot",
    genres: ["Spectres", "Surnaturel", "Oneshot"],
    status: "Terminé",
    chapters: 1,
    rating: 4.2,
    author: "—",
    accent: "#64748b",
    description:
      "Vêtements noirs, yeux noirs, cheveux noirs... et si vous rencontriez cela...?!",
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
    rating: 4.4,
    author: "—",
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
    rating: 4.1,
    author: "—",
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
    rating: 4.5,
    author: "—",
    accent: "#06b6d4",
    description:
      "Fumi et Haru sont deux amies d'université qui partagent une passion pour la natation, jusqu'à ce que l'héritage « unique » de Fumi vienne tout compliquer.",
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
    author: "—",
    accent: "#dc2626",
    description:
      "Un forgeron perd sa fille lors d'un sacrifice et attend 40 ans pour se venger.",
    cover: "images/Cover/Second Coming.jpg",
    url: "manga.html?id=Second%20Coming",
    demo: false,
    featured: false
  }
];
