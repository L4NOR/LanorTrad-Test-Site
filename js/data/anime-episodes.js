// === LanorTrad - Episodes des animes (titres, dates, images) ===
// FICHIER GENERE par tools/build-anime.js - ne pas editer a la main.
// Source : les pages d'Aniverse (aniverse.fr).
// Cle : le slug Aniverse de l'entree (champ avSlug dans js/data/anime.js).
//   t   : titre francais de l'episode       d : date de diffusion (AAAA-MM-JJ)
//   img : image de l'episode                maj : date de la derniere recolte
//   affiche : image de l'entree, servie aux cartes sans visuel propre
//   langs   : nombre d'episodes dispos en VOSTFR / VF
//   suivant : prochain episode annonce {n, le} - indicatif, il vieillit vite
//
// Rien ici n'est indispensable : sans ce fichier, l'onglet Anime affiche des
// cases numerotees et tous les liens marchent quand meme.
window.ANIME_EPISODES = {
  "blue-exorcist": {
    maj: "2026-10-18",
    affiche: "https://cdn.onefy.me/t/w_500,c_limit/artwork/anime/658b21e4-99ef-4f2a-9722-9260482bdc37/poster-43c3244d.jpg",
    langs: {"vostfr":25,"vf":25},
    eps: {
      "1": {"t":"Le mal est tapi tout au fond de nous","d":"2011-04-16","img":"https://cdn.onefy.me/t/artwork/anime/658b21e4-99ef-4f2a-9722-9260482bdc37/episodes/episode-a9387a02.jpg"},
      "2": {"t":"La porte de la Géhenne","d":"2011-04-23","img":"https://cdn.onefy.me/t/artwork/anime/658b21e4-99ef-4f2a-9722-9260482bdc37/episodes/episode-9c069879.jpg"},
      "3": {"t":"Aîné et cadet","d":"2011-04-30","img":"https://cdn.onefy.me/t/artwork/anime/658b21e4-99ef-4f2a-9722-9260482bdc37/episodes/episode-2b786028.jpg"},
      "4": {"t":"Le jardin d'Amahara","d":"2011-05-07","img":"https://cdn.onefy.me/t/artwork/anime/658b21e4-99ef-4f2a-9722-9260482bdc37/episodes/episode-f2d3788c.jpg"},
      "5": {"t":"L'enfant du temple maudit","d":"2011-05-14","img":"https://cdn.onefy.me/t/artwork/anime/658b21e4-99ef-4f2a-9722-9260482bdc37/episodes/episode-7c3e3a23.jpg"},
      "6": {"t":"Le cuisinier fantôme","d":"2011-05-21","img":"https://cdn.onefy.me/t/artwork/anime/658b21e4-99ef-4f2a-9722-9260482bdc37/episodes/episode-6c3ab2e5.jpg"},
      "7": {"t":"Entre amis","d":"2011-05-28","img":"https://cdn.onefy.me/t/artwork/anime/658b21e4-99ef-4f2a-9722-9260482bdc37/episodes/episode-65c9411b.jpg"},
      "8": {"t":"Il y avait un malade","d":"2011-06-04","img":"https://cdn.onefy.me/t/artwork/anime/658b21e4-99ef-4f2a-9722-9260482bdc37/episodes/episode-8988dacb.jpg"},
      "9": {"t":"Trauma","d":"2011-06-11","img":"https://cdn.onefy.me/t/artwork/anime/658b21e4-99ef-4f2a-9722-9260482bdc37/episodes/episode-2e24fc46.jpg"},
      "10": {"t":"Cat Sith","d":"2011-06-18","img":"https://cdn.onefy.me/t/artwork/anime/658b21e4-99ef-4f2a-9722-9260482bdc37/episodes/episode-c8131ddc.jpg"},
      "11": {"t":"Le démon des profondeurs","d":"2011-06-25","img":"https://cdn.onefy.me/t/artwork/anime/658b21e4-99ef-4f2a-9722-9260482bdc37/episodes/episode-5b54d5f4.jpg"},
      "12": {"t":"Démons en action","d":"2011-07-02","img":"https://cdn.onefy.me/t/artwork/anime/658b21e4-99ef-4f2a-9722-9260482bdc37/episodes/episode-a117fe6b.jpg"},
      "13": {"t":"La preuve","d":"2011-07-09","img":"https://cdn.onefy.me/t/artwork/anime/658b21e4-99ef-4f2a-9722-9260482bdc37/episodes/episode-16aa6173.jpg"},
      "14": {"t":"Une joyeuse excursion","d":"2011-07-16","img":"https://cdn.onefy.me/t/artwork/anime/658b21e4-99ef-4f2a-9722-9260482bdc37/episodes/episode-9ec1756c.jpg"},
      "15": {"t":"Sympathie","d":"2011-07-23","img":"https://cdn.onefy.me/t/artwork/anime/658b21e4-99ef-4f2a-9722-9260482bdc37/episodes/episode-7c0f46e3.jpg"},
      "16": {"t":"Un pari","d":"2011-07-30","img":"https://cdn.onefy.me/t/artwork/anime/658b21e4-99ef-4f2a-9722-9260482bdc37/episodes/episode-ba52768b.jpg"},
      "17": {"t":"Tentation","d":"2011-08-06","img":"https://cdn.onefy.me/t/artwork/anime/658b21e4-99ef-4f2a-9722-9260482bdc37/episodes/episode-87cbf805.jpg"},
      "18": {"t":"Cyclone","d":"2011-08-13","img":"https://cdn.onefy.me/t/artwork/anime/658b21e4-99ef-4f2a-9722-9260482bdc37/episodes/episode-d0a69005.jpg"},
      "19": {"t":"Un jour comme un autre","d":"2011-08-20","img":"https://cdn.onefy.me/t/artwork/anime/658b21e4-99ef-4f2a-9722-9260482bdc37/episodes/episode-e6b6d98e.jpg"},
      "20": {"t":"Le masque","d":"2011-08-27","img":"https://cdn.onefy.me/t/artwork/anime/658b21e4-99ef-4f2a-9722-9260482bdc37/episodes/episode-c1773b65.jpg"},
      "21": {"t":"Le jardin des secrets","d":"2011-09-03","img":"https://cdn.onefy.me/t/artwork/anime/658b21e4-99ef-4f2a-9722-9260482bdc37/episodes/episode-6e92adad.jpg"},
      "22": {"t":"Chasse aux démons","d":"2011-09-10","img":"https://cdn.onefy.me/t/artwork/anime/658b21e4-99ef-4f2a-9722-9260482bdc37/episodes/episode-b9c192fa.jpg"},
      "23": {"t":"Vérité","d":"2011-09-17","img":"https://cdn.onefy.me/t/artwork/anime/658b21e4-99ef-4f2a-9722-9260482bdc37/episodes/episode-719536e4.jpg"},
      "24": {"t":"Les bâtards de Satan","d":"2011-09-24","img":"https://cdn.onefy.me/t/artwork/anime/658b21e4-99ef-4f2a-9722-9260482bdc37/episodes/episode-6e443545.jpg"},
      "25": {"t":"Ô temps ! Arrête-toi !","d":"2011-10-01","img":"https://cdn.onefy.me/t/artwork/anime/658b21e4-99ef-4f2a-9722-9260482bdc37/episodes/episode-b347b47b.jpg"}
    }
  },

  "blue-exorcist-specials": {
    maj: "2026-10-18",
    affiche: "https://cdn.onefy.me/t/w_500,c_limit/artwork/anime/01409b06-4c83-4215-92e3-d28046079cde/poster-badece5f.png",
    langs: {"vostfr":10,"vf":0},
    eps: {
      "1": {"t":"Ura Ex 1","d":"2011-06-22"},
      "2": {"t":"Ura Ex 2","d":"2011-06-27"},
      "3": {"t":"Ura Ex 3","d":"2011-08-24"},
      "4": {"t":"Ura Ex 4","d":"2011-09-21"},
      "5": {"t":"Ura Ex 5","d":"2011-10-26"},
      "6": {"t":"Ura Ex 6","d":"2011-11-23"},
      "7": {"t":"Ura Ex 7","d":"2011-12-14"},
      "8": {"t":"Ura Ex 8","d":"2012-01-25"},
      "9": {"t":"Ura Ex 9","d":"2012-02-22"},
      "10": {"t":"Ura Ex 10","d":"2012-03-21"}
    }
  },

  "blue-exorcist-runaway-kuro": {
    maj: "2026-10-18",
    affiche: "https://cdn.onefy.me/t/w_500,c_limit/artwork/anime/df448622-684f-437a-9fe4-286901918c52/poster-cdea391d.png",
    langs: {"vostfr":1,"vf":0},
    eps: {}
  },

  "blue-exorcist-the-movie": {
    maj: "2026-10-18",
    affiche: "https://cdn.onefy.me/t/w_500,c_limit/artwork/anime/052a38c3-bbaa-45fc-8998-8f06b4a3bf15/poster-bae6b452.jpg",
    langs: {"vostfr":1,"vf":1},
    eps: {
      "1": {"t":"Film complet","d":"2012-12-27","img":"https://cdn.onefy.me/t/artwork/anime/052a38c3-bbaa-45fc-8998-8f06b4a3bf15/episodes/episode-ec08b1bb.jpg"}
    }
  },

  "blue-exorcist-kyoto-saga": {
    maj: "2026-10-18",
    affiche: "https://cdn.onefy.me/t/w_500,c_limit/artwork/anime/bae8ddcf-be32-48d0-88dc-972f6ba33382/poster-b0cbcfa0.jpg",
    langs: {"vostfr":12,"vf":12},
    eps: {
      "1": {"t":"Début des hostilités","d":"2017-01-06","img":"https://cdn.onefy.me/t/artwork/anime/bae8ddcf-be32-48d0-88dc-972f6ba33382/episodes/episode-fed2868d.jpg"},
      "2": {"t":"Panier de crabes","d":"2017-01-13","img":"https://cdn.onefy.me/t/artwork/anime/bae8ddcf-be32-48d0-88dc-972f6ba33382/episodes/episode-afa509ee.jpg"},
      "3": {"t":"Soupçons en chaîne","d":"2017-01-20","img":"https://cdn.onefy.me/t/artwork/anime/bae8ddcf-be32-48d0-88dc-972f6ba33382/episodes/episode-2a6fa383.jpg"},
      "4": {"t":"Sans foi ni loi","d":"2017-01-27","img":"https://cdn.onefy.me/t/artwork/anime/bae8ddcf-be32-48d0-88dc-972f6ba33382/episodes/episode-7901094e.jpg"},
      "5": {"t":"Le hasard des rencontres","d":"2017-02-03","img":"https://cdn.onefy.me/t/artwork/anime/bae8ddcf-be32-48d0-88dc-972f6ba33382/episodes/episode-a38d3783.jpg"},
      "6": {"t":"Paroles mielleuses","d":"2017-02-09","img":"https://cdn.onefy.me/t/artwork/anime/bae8ddcf-be32-48d0-88dc-972f6ba33382/episodes/episode-0a78bc2f.jpg"},
      "7": {"t":"Embrasement","d":"2017-02-16","img":"https://cdn.onefy.me/t/artwork/anime/bae8ddcf-be32-48d0-88dc-972f6ba33382/episodes/episode-1b354f83.jpg"},
      "8": {"t":"De père en fils","d":"2017-02-23","img":"https://cdn.onefy.me/t/artwork/anime/bae8ddcf-be32-48d0-88dc-972f6ba33382/episodes/episode-17f980ab.jpg"},
      "9": {"t":"Le chêne et le roseau","d":"2017-03-02","img":"https://cdn.onefy.me/t/artwork/anime/bae8ddcf-be32-48d0-88dc-972f6ba33382/episodes/episode-77f66f5b.jpg"},
      "10": {"t":"Inébranlable","d":"2017-03-09","img":"https://cdn.onefy.me/t/artwork/anime/bae8ddcf-be32-48d0-88dc-972f6ba33382/episodes/episode-eded7508.jpg"},
      "11": {"t":"De mille feux","d":"2017-03-16","img":"https://cdn.onefy.me/t/artwork/anime/bae8ddcf-be32-48d0-88dc-972f6ba33382/episodes/episode-0c07f405.jpg"},
      "12": {"t":"Sans préjugé","d":"2017-03-23","img":"https://cdn.onefy.me/t/artwork/anime/bae8ddcf-be32-48d0-88dc-972f6ba33382/episodes/episode-388ad0e4.jpg"}
    }
  },

  "blue-exorcist-shimane-illuminati-saga": {
    maj: "2026-10-18",
    affiche: "https://cdn.onefy.me/t/w_500,c_limit/artwork/anime/6770a0ad-790b-4e5b-9c78-903b78212618/poster-d4a97c01.jpg",
    langs: {"vostfr":12,"vf":12},
    eps: {
      "1": {"t":"Un monde grouillant","d":"2024-01-06","img":"https://cdn.onefy.me/t/artwork/anime/6770a0ad-790b-4e5b-9c78-903b78212618/episodes/episode-2a666af0.jpg"},
      "2": {"t":"L'antre du secret","d":"2024-01-13","img":"https://cdn.onefy.me/t/artwork/anime/6770a0ad-790b-4e5b-9c78-903b78212618/episodes/episode-40b426ed.jpg"},
      "3": {"t":"Le Cross festival","d":"2024-01-20","img":"https://cdn.onefy.me/t/artwork/anime/6770a0ad-790b-4e5b-9c78-903b78212618/episodes/episode-e7ee0c03.jpg"},
      "4": {"t":"La taupe","d":"2024-01-27","img":"https://cdn.onefy.me/t/artwork/anime/6770a0ad-790b-4e5b-9c78-903b78212618/episodes/episode-4f4b302a.jpg"},
      "5": {"t":"Destin","d":"2024-02-03","img":"https://cdn.onefy.me/t/artwork/anime/6770a0ad-790b-4e5b-9c78-903b78212618/episodes/episode-10f71b8c.jpg"},
      "6": {"t":"Plus personne sur qui compter","d":"2024-02-10","img":"https://cdn.onefy.me/t/artwork/anime/6770a0ad-790b-4e5b-9c78-903b78212618/episodes/episode-f9d75f7a.jpg"},
      "7": {"t":"Égarement","d":"2024-02-17","img":"https://cdn.onefy.me/t/artwork/anime/6770a0ad-790b-4e5b-9c78-903b78212618/episodes/episode-c7f1086b.jpg"},
      "8": {"t":"Détermination","d":"2024-02-24","img":"https://cdn.onefy.me/t/artwork/anime/6770a0ad-790b-4e5b-9c78-903b78212618/episodes/episode-5106a4fc.jpg"},
      "9": {"t":"À l'aide","d":"2024-03-02","img":"https://cdn.onefy.me/t/artwork/anime/6770a0ad-790b-4e5b-9c78-903b78212618/episodes/episode-f1b39ef9.jpg"},
      "10": {"t":"Camarades","d":"2024-03-09","img":"https://cdn.onefy.me/t/artwork/anime/6770a0ad-790b-4e5b-9c78-903b78212618/episodes/episode-3bbda637.jpg"},
      "11": {"t":"Pink Spider","d":"2024-03-16","img":"https://cdn.onefy.me/t/artwork/anime/6770a0ad-790b-4e5b-9c78-903b78212618/episodes/episode-122cef6c.jpg"},
      "12": {"t":"Intentions cachées","d":"2024-03-23","img":"https://cdn.onefy.me/t/artwork/anime/6770a0ad-790b-4e5b-9c78-903b78212618/episodes/episode-2f13319a.jpg"}
    }
  },

  "blue-exorcist-beyond-the-snow-saga": {
    maj: "2026-10-18",
    affiche: "https://cdn.onefy.me/t/w_500,c_limit/artwork/anime/db826569-fcae-4ec4-ab04-a9259f25e3c0/poster-9548e0d5.jpg",
    langs: {"vostfr":12,"vf":12},
    eps: {
      "1": {"t":"Motivation","d":"2024-10-05","img":"https://cdn.onefy.me/t/artwork/anime/db826569-fcae-4ec4-ab04-a9259f25e3c0/episodes/episode-7f4ddb75.jpg"},
      "2": {"t":"Souffrance","d":"2024-10-12","img":"https://cdn.onefy.me/t/artwork/anime/db826569-fcae-4ec4-ab04-a9259f25e3c0/episodes/episode-9fafa7a5.jpg"},
      "3": {"t":"Foyer","d":"2024-10-19","img":"https://cdn.onefy.me/t/artwork/anime/db826569-fcae-4ec4-ab04-a9259f25e3c0/episodes/episode-025e1023.jpg"},
      "4": {"t":"Adieux","d":"2024-10-26","img":"https://cdn.onefy.me/t/artwork/anime/db826569-fcae-4ec4-ab04-a9259f25e3c0/episodes/episode-892da661.jpg"},
      "5": {"t":"Les larmes aux yeux","d":"2024-11-02","img":"https://cdn.onefy.me/t/artwork/anime/db826569-fcae-4ec4-ab04-a9259f25e3c0/episodes/episode-26bac7f4.jpg"},
      "6": {"t":"Le Jingzhe","d":"2024-11-09","img":"https://cdn.onefy.me/t/artwork/anime/db826569-fcae-4ec4-ab04-a9259f25e3c0/episodes/episode-3ca5105a.jpg"},
      "7": {"t":"Feuilles anormales","d":"2024-11-16","img":"https://cdn.onefy.me/t/artwork/anime/db826569-fcae-4ec4-ab04-a9259f25e3c0/episodes/episode-12954fe0.jpg"},
      "8": {"t":"Joyeux (Merry Xmas) anniversaire !","d":"2024-11-23","img":"https://cdn.onefy.me/t/artwork/anime/db826569-fcae-4ec4-ab04-a9259f25e3c0/episodes/episode-363fe446.jpg"},
      "9": {"t":"Les noces","d":"2024-11-30","img":"https://cdn.onefy.me/t/artwork/anime/db826569-fcae-4ec4-ab04-a9259f25e3c0/episodes/episode-8944548a.jpg"},
      "10": {"t":"Sous la neige","d":"2024-12-07","img":"https://cdn.onefy.me/t/artwork/anime/db826569-fcae-4ec4-ab04-a9259f25e3c0/episodes/episode-a2cf9bca.jpg"},
      "11": {"t":"Au-delà des neiges","d":"2024-12-14","img":"https://cdn.onefy.me/t/artwork/anime/db826569-fcae-4ec4-ab04-a9259f25e3c0/episodes/episode-15d74ca2.jpg"},
      "12": {"t":"Adieux","d":"2024-12-21","img":"https://cdn.onefy.me/t/artwork/anime/db826569-fcae-4ec4-ab04-a9259f25e3c0/episodes/episode-1156ef48.jpg"}
    }
  },

  "blue-exorcist-the-blue-night-saga": {
    maj: "2026-10-18",
    affiche: "https://cdn.onefy.me/t/w_500,c_limit/artwork/anime/096f3408-115d-4cb2-bf27-b04fe5ab8b79/poster-11886822.jpg",
    langs: {"vostfr":12,"vf":12},
    eps: {
      "1": {"t":"Shirô et Yuri","d":"2025-01-04","img":"https://cdn.onefy.me/t/artwork/anime/096f3408-115d-4cb2-bf27-b04fe5ab8b79/episodes/episode-ac05b881.jpg"},
      "2": {"t":"Vérité","d":"2025-01-11","img":"https://cdn.onefy.me/t/artwork/anime/096f3408-115d-4cb2-bf27-b04fe5ab8b79/episodes/episode-e031f4b4.jpg"},
      "3": {"t":"Solitude","d":"2025-01-18","img":"https://cdn.onefy.me/t/artwork/anime/096f3408-115d-4cb2-bf27-b04fe5ab8b79/episodes/episode-8afe594e.jpg"},
      "4": {"t":"L'Éveil de Satan","d":"2025-01-25","img":"https://cdn.onefy.me/t/artwork/anime/096f3408-115d-4cb2-bf27-b04fe5ab8b79/episodes/episode-52e64ac2.jpg"},
      "5": {"t":"Au-delà du corps","d":"2025-02-01","img":"https://cdn.onefy.me/t/artwork/anime/096f3408-115d-4cb2-bf27-b04fe5ab8b79/episodes/episode-64a58a77.jpg"},
      "6": {"t":"Si seulement je n'existais pas","d":"2025-02-08","img":"https://cdn.onefy.me/t/artwork/anime/096f3408-115d-4cb2-bf27-b04fe5ab8b79/episodes/episode-a5d4b303.jpg"},
      "7": {"t":"La veille","d":"2025-02-15","img":"https://cdn.onefy.me/t/artwork/anime/096f3408-115d-4cb2-bf27-b04fe5ab8b79/episodes/episode-8998c1b4.jpg"},
      "8": {"t":"La nuit bleue","d":"2025-02-22","img":"https://cdn.onefy.me/t/artwork/anime/096f3408-115d-4cb2-bf27-b04fe5ab8b79/episodes/episode-90321852.jpg"},
      "9": {"t":"Combat à mort","d":"2025-03-01","img":"https://cdn.onefy.me/t/artwork/anime/096f3408-115d-4cb2-bf27-b04fe5ab8b79/episodes/episode-9c781ac0.jpg"},
      "10": {"t":"Lumière","d":"2025-03-08","img":"https://cdn.onefy.me/t/artwork/anime/096f3408-115d-4cb2-bf27-b04fe5ab8b79/episodes/episode-6c0dd960.jpg"},
      "11": {"t":"Promesse","d":"2025-03-15","img":"https://cdn.onefy.me/t/artwork/anime/096f3408-115d-4cb2-bf27-b04fe5ab8b79/episodes/episode-d7238571.jpg"},
      "12": {"t":"Merci","d":"2025-03-22","img":"https://cdn.onefy.me/t/artwork/anime/096f3408-115d-4cb2-bf27-b04fe5ab8b79/episodes/episode-d7048f0a.jpg"}
    }
  },

  "tougen-anki": {
    maj: "2026-10-18",
    affiche: "https://cdn.onefy.me/t/w_500,c_limit/artwork/anime/b9ca9813-3f0d-4dbf-b6fb-82c3eb5c5f24/poster-6b55dce5.jpg",
    langs: {"vostfr":24,"vf":24},
    eps: {
      "1": {"t":"Sang d'Oni","d":"2025-07-11","img":"https://cdn.onefy.me/t/artwork/anime/b9ca9813-3f0d-4dbf-b6fb-82c3eb5c5f24/episodes/episode-0e81fe47.jpg"},
      "2": {"t":"Il vous faudra enchaîner les victoires","d":"2025-07-18","img":"https://cdn.onefy.me/t/artwork/anime/b9ca9813-3f0d-4dbf-b6fb-82c3eb5c5f24/episodes/episode-7f4a1a64.jpg"},
      "3": {"t":"Hémocorrosion : effusion","d":"2025-07-25","img":"https://cdn.onefy.me/t/artwork/anime/b9ca9813-3f0d-4dbf-b6fb-82c3eb5c5f24/episodes/episode-565cbeae.jpg"},
      "4": {"t":"Travaille avec moi","d":"2025-08-01","img":"https://cdn.onefy.me/t/artwork/anime/b9ca9813-3f0d-4dbf-b6fb-82c3eb5c5f24/episodes/episode-b5c27c67.jpg"},
      "5": {"t":"Mauvaise nouvelle","d":"2025-08-08","img":"https://cdn.onefy.me/t/artwork/anime/b9ca9813-3f0d-4dbf-b6fb-82c3eb5c5f24/episodes/episode-3ade1a65.jpg"},
      "6": {"t":"Même la voie du solitaire a ses limites","d":"2025-08-15","img":"https://cdn.onefy.me/t/artwork/anime/b9ca9813-3f0d-4dbf-b6fb-82c3eb5c5f24/episodes/episode-25a38285.jpg"},
      "7": {"t":"La beauté est une bête","d":"2025-08-22","img":"https://cdn.onefy.me/t/artwork/anime/b9ca9813-3f0d-4dbf-b6fb-82c3eb5c5f24/episodes/episode-d379fea6.jpg"},
      "8": {"t":"Le héros peu fiable","d":"2025-08-29","img":"https://cdn.onefy.me/t/artwork/anime/b9ca9813-3f0d-4dbf-b6fb-82c3eb5c5f24/episodes/episode-9825c20f.jpg"},
      "9": {"t":"L'esprit de Momotaro","d":"2025-09-05","img":"https://cdn.onefy.me/t/artwork/anime/b9ca9813-3f0d-4dbf-b6fb-82c3eb5c5f24/episodes/episode-425456a5.jpg"},
      "10": {"t":"Les enfants de Kishin","d":"2025-09-12","img":"https://cdn.onefy.me/t/artwork/anime/b9ca9813-3f0d-4dbf-b6fb-82c3eb5c5f24/episodes/episode-5a4c8165.jpg"},
      "11": {"t":"Merci !","d":"2025-09-19","img":"https://cdn.onefy.me/t/artwork/anime/b9ca9813-3f0d-4dbf-b6fb-82c3eb5c5f24/episodes/episode-2eaa57a6.jpg"},
      "12": {"t":"Le jour de la tempête","d":"2025-09-26","img":"https://cdn.onefy.me/t/artwork/anime/b9ca9813-3f0d-4dbf-b6fb-82c3eb5c5f24/episodes/episode-87958b15.jpg"},
      "13": {"t":"Mikado, comme la porte des dieux","d":"2025-10-03","img":"https://cdn.onefy.me/t/artwork/anime/b9ca9813-3f0d-4dbf-b6fb-82c3eb5c5f24/episodes/episode-5fea59a4.jpg"},
      "14": {"t":"Règle personnelle","d":"2025-10-10","img":"https://cdn.onefy.me/t/artwork/anime/b9ca9813-3f0d-4dbf-b6fb-82c3eb5c5f24/episodes/episode-cb200023.jpg"},
      "15": {"t":"Je t'ai trouvé","d":"2025-10-24","img":"https://cdn.onefy.me/t/artwork/anime/b9ca9813-3f0d-4dbf-b6fb-82c3eb5c5f24/episodes/episode-945236e5.jpg"},
      "16": {"t":"Pas si mal","d":"2025-10-31","img":"https://cdn.onefy.me/t/artwork/anime/b9ca9813-3f0d-4dbf-b6fb-82c3eb5c5f24/episodes/episode-b04ec886.jpg"},
      "17": {"t":"L'Oni vengeur","d":"2025-11-07","img":"https://cdn.onefy.me/t/artwork/anime/b9ca9813-3f0d-4dbf-b6fb-82c3eb5c5f24/episodes/episode-3161a712.jpg"},
      "18": {"t":"Hanté par le doute","d":"2025-11-14","img":"https://cdn.onefy.me/t/artwork/anime/b9ca9813-3f0d-4dbf-b6fb-82c3eb5c5f24/episodes/episode-4d07aa6a.jpg"},
      "19": {"t":"La voix des faibles","d":"2025-11-21","img":"https://cdn.onefy.me/t/artwork/anime/b9ca9813-3f0d-4dbf-b6fb-82c3eb5c5f24/episodes/episode-5ff75d56.jpg"},
      "20": {"t":"Rage contre rage","d":"2025-11-28","img":"https://cdn.onefy.me/t/artwork/anime/b9ca9813-3f0d-4dbf-b6fb-82c3eb5c5f24/episodes/episode-7482e79b.jpg"},
      "21": {"t":"Une chance sans faille","d":"2025-12-05","img":"https://cdn.onefy.me/t/artwork/anime/b9ca9813-3f0d-4dbf-b6fb-82c3eb5c5f24/episodes/episode-47957a71.jpg"},
      "22": {"t":"Un combat futile","d":"2025-12-12","img":"https://cdn.onefy.me/t/artwork/anime/b9ca9813-3f0d-4dbf-b6fb-82c3eb5c5f24/episodes/episode-15f3a0a9.jpg"},
      "23": {"t":"Mon ami","d":"2025-12-19","img":"https://cdn.onefy.me/t/artwork/anime/b9ca9813-3f0d-4dbf-b6fb-82c3eb5c5f24/episodes/episode-146d5d8b.jpg"},
      "24": {"t":"À bientôt","d":"2025-12-26","img":"https://cdn.onefy.me/t/artwork/anime/b9ca9813-3f0d-4dbf-b6fb-82c3eb5c5f24/episodes/episode-f4c257c5.jpg"}
    }
  },

  "tougen-anki-nikko-kegon-falls-arc": {
    maj: "2026-10-18",
    affiche: "https://cdn.onefy.me/t/w_500,c_limit/artwork/anime/9fbe54e0-75f1-4732-844b-ca2e84f5ac38/poster-3572b0e4.png",
    langs: {"vostfr":3,"vf":0},
    suivant: {"n":4,"le":"2026-10-23T16:11:33.000Z"},
    eps: {}
  }
};
