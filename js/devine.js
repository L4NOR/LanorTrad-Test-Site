/* =========================================================================
   LanorTrad — « Devine la case » (jeu quotidien, page Classement).

   Chaque jour, une case recadrée tirée de nos séries, la même pour tout le
   monde. On devine d'abord la SÉRIE (chaque erreur dézoome un peu), puis le
   CHAPITRE (trois essais, avec « plus haut / plus bas »). Jusqu'à 50 points,
   crédités en XP pour les membres connectés (supabase/devine.sql).

   Tout se calcule ici, sans serveur : le tirage part de la date (Europe/Paris)
   passée dans un générateur pseudo-aléatoire, donc identique partout. La case
   est choisie parmi plusieurs positions de la page : on garde la plus
   « dessinée » (écart-type de luminosité), pour ne pas tomber sur un fond
   blanc ou le milieu d'une bulle.

   Spoilers : on ne tire jamais dans le cinquième le plus récent d'une série,
   et la page entière n'est montrée à la fin qu'à qui a déjà lu ce chapitre
   (sinon, derrière un clic).

   La partie du jour est gardée sur l'appareil (une partie par jour).
   API : window.LTdevine.mount(element)
   ========================================================================= */
(function () {
  "use strict";

  const KEY = "lt-devine-v1";
  const LANCEMENT = "2026-09-19";              // case n°1
  const ZOOMS = [0.24, 0.42, 0.66];            // côté du carré, en part de la largeur de page
  const PTS_SERIE = [20, 15, 10, 5, 0];         // selon le nombre d'erreurs avant de trouver
  const PTS_CHAP = [30, 20, 10];                // chapitre exact au 1er, 2e, 3e essai
  const PRES = 5, PTS_PRES = 5;                 // à ±5 chapitres : un petit lot de consolation

  const esc = s => String(s == null ? "" : s)
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/'/g, "&#39;");

  // Date du jour à Paris, au format AAAA-MM-JJ (le « fr-CA » donne cet ordre).
  const jourParis = () => new Intl.DateTimeFormat("fr-CA", {
    timeZone: "Europe/Paris", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
  const numero = d => Math.round((Date.parse(d) - Date.parse(LANCEMENT)) / 864e5) + 1;

  // FNV-1a puis mulberry32 : court, rapide, et surtout le même partout.
  function hash(str) { let h = 2166136261; for (const ch of str) { h ^= ch.codePointAt(0); h = Math.imul(h, 16777619); } return h >>> 0; }
  function rng(seed) {
    return function () {
      seed = (seed + 0x6D2B79F5) | 0;
      let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  const officiels = s => ((window.CHAPTERS || {})[s.id] || []).filter(c => !window.LT.estBonus(c.num));
  const pool = () => (window.SERIES || []).filter(s => s.type === "manga" && officiels(s).length >= 5);

  /* ------------------------------------------------------------ Le tirage */
  function tirage(d) {
    const P = pool();
    if (!P.length) return null;
    const r = rng(hash("devine:" + d));
    const s = P[Math.floor(r() * P.length)];
    // Liste du plus récent au plus ancien : on écarte le cinquième le plus
    // récent, là où se jouent les révélations que tout le monde n'a pas lues.
    const L = officiels(s);
    const anciens = L.slice(Math.ceil(L.length * 0.2));
    const c = anciens[Math.floor(r() * anciens.length)];
    return { s, c, u: r(), graine: Math.floor(r() * 2147483647) };
  }

  function pagesDe(manga) {
    const deja = (window.CHAPTER_FILES || {})[manga];
    if (deja) return Promise.resolve(deja);
    const src = (window.CHAPTER_PAGES || {})[manga];
    if (!src) return Promise.resolve(null);
    return new Promise(ok => {
      const sc = document.createElement("script");
      sc.src = src;
      sc.onload = () => ok((window.CHAPTER_FILES || {})[manga] || null);
      sc.onerror = () => ok(null);
      document.head.appendChild(sc);
    });
  }

  const charger = src => new Promise((ok, ko) => {
    const im = new Image();
    im.decoding = "async";
    im.onload = () => ok(im);
    im.onerror = ko;
    im.src = src;
  });

  // La position la plus « dessinée » parmi 18 essais (déterministes).
  function meilleurCentre(im, graine) {
    const W = im.naturalWidth, H = im.naturalHeight, cote = Math.min(ZOOMS[0] * W, H);
    const cv = document.createElement("canvas");
    cv.width = cv.height = 24;
    const ctx = cv.getContext("2d", { willReadFrequently: true });
    const r = rng(graine);
    let best = null;
    for (let k = 0; k < 18; k++) {
      const x = cote / 2 + r() * (W - cote), y = cote / 2 + r() * (H - cote);
      ctx.drawImage(im, x - cote / 2, y - cote / 2, cote, cote, 0, 0, 24, 24);
      const d = ctx.getImageData(0, 0, 24, 24).data;
      let m = 0, m2 = 0;
      for (let i = 0; i < d.length; i += 4) { const l = (d[i] * 3 + d[i + 1] * 6 + d[i + 2]) / 10; m += l; m2 += l * l; }
      const n = d.length / 4;
      m /= n;
      const note = Math.sqrt(Math.max(0, m2 / n - m * m)) - Math.max(0, m - 225) * 2;
      if (!best || note > best.note) best = { x, y, note };
    }
    return best;
  }

  function dessiner(canvas, im, centre, niveau) {
    const W = im.naturalWidth, H = im.naturalHeight, ctx = canvas.getContext("2d");
    if (niveau >= ZOOMS.length) {                       // page entière (fin de partie)
      canvas.width = 600; canvas.height = Math.round(600 * H / W);
      ctx.drawImage(im, 0, 0, canvas.width, canvas.height);
      return;
    }
    const cote = Math.min(ZOOMS[niveau] * W, H);
    const x = Math.min(Math.max(centre.x - cote / 2, 0), W - cote);
    const y = Math.min(Math.max(centre.y - cote / 2, 0), H - cote);
    canvas.width = canvas.height = 600;
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(im, x, y, cote, cote, 0, 0, 600, 600);
  }

  /* ------------------------------------------------------------- L'état */
  function lire(d) {
    try { const e = JSON.parse(localStorage.getItem(KEY) || "null"); if (e && e.jour === d) return e; } catch {}
    return { jour: d, rates: [], trouvee: false, essais: [], fini: false, xp: null };
  }
  const ecrire = e => { try { localStorage.setItem(KEY, JSON.stringify(e)); } catch {} };

  function points(e, cible) {
    const ps = e.trouvee ? PTS_SERIE[Math.min(e.rates.length, PTS_SERIE.length - 1)] : 0;
    const k = e.essais.indexOf(cible);
    const pc = k >= 0 ? PTS_CHAP[k] : (e.essais.some(g => Math.abs(g - cible) <= PRES) ? PTS_PRES : 0);
    return { serie: ps, chap: pc, total: ps + pc };
  }

  /* ------------------------------------------------------------- Montage */
  async function mount(box) {
    if (!box) return;
    const d = jourParis();
    const t = tirage(d);
    if (!t || !t.c) { box.innerHTML = ""; return; }
    const files = await pagesDe(t.s.id);
    const f = files && files[t.c.num] && files[t.c.num].f;
    if (!f || !f.length) { box.innerHTML = ""; return; }
    // Ni la première page (titre, couverture), ni la dernière (souvent les crédits).
    const idx = Math.min(f.length - 2, Math.max(1, Math.floor(f.length * (0.15 + t.u * 0.7))));
    const src = encodeURI(`Manga/${t.s.id}/${t.c.folder}/${f[idx]}`);
    let im;
    try { im = await charger(src); } catch { box.innerHTML = ""; return; }
    let centre;
    try { centre = meilleurCentre(im, t.graine); } catch { box.innerHTML = ""; return; }   // image illisible par le canvas
    const G = { d, t, im, centre, page: idx + 1, cible: Math.round(parseFloat(t.c.num)), max: Math.round(parseFloat(officiels(t.s)[0].num)) };
    const e = lire(d);
    rendre(box, G, e);
    // Partie finie mais XP pas encore passé (réseau coupé, page fermée trop tôt).
    if (e.fini && e.xp == null) reclamer(e, G);
  }

  function rendre(box, G, e) {
    const P = pool();
    const niveau = e.fini ? ZOOMS.length - 1 : Math.min(e.rates.length, ZOOMS.length - 1);
    const pts = points(e, G.cible);
    let jeu;

    if (!e.trouvee && !e.fini) {
      jeu = `<p class="dv-q">De quelle série vient cette case ?</p>
        <div class="dv-series">${P.map(s => `<button type="button" class="dv-s${e.rates.includes(s.id) ? " bad" : ""}" data-serie="${esc(s.id)}" ${e.rates.includes(s.id) ? "disabled" : ""}>
            <img src="${window.LT.cover(s.cover, 120)}" alt="" loading="lazy"><span>${esc(s.title)}</span></button>`).join("")}</div>
        <p class="dv-aide">Chaque erreur dézoome un peu la case. Trouvée du premier coup : ${PTS_SERIE[0]} points.</p>`;
    } else if (!e.fini) {
      const donnee = e.rates.length >= P.length - 1;       // trouvée par élimination
      jeu = `<p class="dv-q">${donnee ? `C'était <b>${esc(G.t.s.title)}</b>, la dernière qui restait.` : `Bien vu, c'est <b>${esc(G.t.s.title)}</b> !`} Et le chapitre ?</p>
        <form class="dv-form"><input type="number" name="n" min="1" max="${G.max}" required inputmode="numeric" placeholder="1 à ${G.max}" aria-label="Numéro de chapitre">
          <button class="btn btn-primary btn-sm" type="submit">Valider</button></form>
        ${essais(e, G)}
        <p class="dv-aide">${3 - e.essais.length} essai${3 - e.essais.length > 1 ? "s" : ""} restant${3 - e.essais.length > 1 ? "s" : ""}. Chapitre exact du premier coup : ${PTS_CHAP[0]} points.</p>`;
    } else {
      const lu = (() => { const p = window.LTstore && window.LTstore.progress(G.t.s.id); return p && parseFloat(p.chapter) >= G.cible; })();
      jeu = `<p class="dv-q">Réponse : <b>${esc(G.t.s.title)}</b>, <b>chapitre ${G.cible}</b>, page ${G.page}.</p>
        ${e.trouvee ? essais(e, G) : ""}
        <div class="dv-score"><b>${pts.total}</b> point${pts.total > 1 ? "s" : ""}<span>série ${pts.serie} · chapitre ${pts.chap}</span></div>
        <p class="dv-xp" id="dv-xp">${xpTexte(e)}</p>
        <div class="dv-acts">
          <button type="button" class="btn btn-primary btn-sm" data-dv="partager">Partager mon résultat</button>
          <button type="button" class="btn btn-ghost btn-sm" data-dv="page">${lu ? "Voir la page entière" : "Voir la page entière (spoiler ?)"}</button>
          <a class="btn btn-ghost btn-sm" href="${window.LT.urlChapter(G.t.s, G.t.c.num)}">Lire ce chapitre</a>
        </div>
        <p class="dv-aide">Nouvelle case demain, à minuit.</p>`;
    }

    box.innerHTML = `<section class="dv" aria-labelledby="dv-t">
      <div class="lb-mtitle"><h2 id="dv-t">Devine la case <span class="dv-n">n°${numero(G.d)}</span></h2>
        <span class="lb-mnote">Une case par jour · jusqu'à 50 XP</span></div>
      <div class="dv-body">
        <div class="dv-case"><canvas aria-label="La case du jour"></canvas>
          ${e.fini ? "" : `<span class="dv-zoom">Zoom ${niveau + 1}/${ZOOMS.length}</span>`}</div>
        <div class="dv-jeu">${jeu}</div>
      </div>
    </section>`;
    dessiner(box.querySelector("canvas"), G.im, G.centre, niveau);

    box.onclick = ev => {
      const b = ev.target.closest("[data-serie]");
      if (b && !b.disabled) {
        if (b.dataset.serie === G.t.s.id) { e.trouvee = true; window.LT.toast("🎯 C'est ça ! Place au chapitre."); }
        else {
          e.rates.push(b.dataset.serie);
          if (e.rates.length >= P.length - 1) {      // une seule série restante : on la donne
            e.trouvee = true;
            window.LT.toast(`C'était ${G.t.s.title}. Place au chapitre !`);
          } else window.LT.toast("Raté ! La case s'élargit…");
        }
        ecrire(e); rendre(box, G, e);
        return;
      }
      const a = ev.target.closest("[data-dv]");
      if (!a) return;
      if (a.dataset.dv === "page") {
        const lu = (() => { const p = window.LTstore && window.LTstore.progress(G.t.s.id); return p && parseFloat(p.chapter) >= G.cible; })();
        if (!lu && !confirm(`Tu n'as pas encore lu le chapitre ${G.cible} de ${G.t.s.title} : la page entière peut spoiler. L'afficher quand même ?`)) return;
        dessiner(box.querySelector("canvas"), G.im, G.centre, ZOOMS.length);
        a.remove();
      } else if (a.dataset.dv === "partager") partager(e, G);
    };

    const form = box.querySelector(".dv-form");
    if (form) {
      form.n.focus({ preventScroll: true });
      form.addEventListener("submit", ev => {
        ev.preventDefault();
        const g = Math.round(Number(form.n.value));
        if (!g || g < 1 || g > G.max) return;
        if (e.essais.includes(g)) { window.LT.toast("Déjà essayé !"); return; }
        e.essais.push(g);
        if (g === G.cible || e.essais.length >= 3) {
          e.fini = true;
          window.LT.toast(g === G.cible ? "🎯 Chapitre exact !" : `Raté : c'était le chapitre ${G.cible}.`);
        }
        ecrire(e); rendre(box, G, e);
        if (e.fini) reclamer(e, G);
      });
    }
  }

  function essais(e, G) {
    if (!e.essais.length) return "";
    return `<ul class="dv-essais">${e.essais.map(g => {
      const diff = G.cible - g;
      const txt = diff === 0 ? "🎯 exact" : `${diff > 0 ? "⬆️ plus haut" : "⬇️ plus bas"}${Math.abs(diff) <= PRES ? " · tout près !" : ""}`;
      return `<li><b>Ch. ${g}</b> ${txt}</li>`;
    }).join("")}</ul>`;
  }

  function xpTexte(e) {
    if (e.xp === "hors") return "Connecte-toi sur le forum la prochaine fois : ces points deviennent de l'XP.";
    if (typeof e.xp === "number") return e.xp > 0 ? `✨ +${e.xp} XP` : "Pas d'XP cette fois.";
    return "";
  }

  // Les points deviennent de l'XP pour les membres connectés (une fois par jour).
  async function reclamer(e, G) {
    const total = points(e, G.cible).total;
    const c = window.LTsb && window.LTsb();
    let r = null;
    try {
      const s = c && (await c.auth.getSession()).data.session;
      if (!s) { e.xp = "hors"; }
      else {
        ({ data: r } = await c.rpc("claim_devine", { p_day: G.d, p_score: total }));
        e.xp = r && r.ok ? (r.xp || 0) : null;
      }
    } catch { e.xp = null; }
    ecrire(e);
    const p = document.getElementById("dv-xp");
    if (p) p.textContent = xpTexte(e);
    if (r && r.ok && r.xp > 0) window.LT.toast(`✨ +${r.xp} XP`);
  }

  function partager(e, G) {
    const serie = e.rates.map(() => "🟥").join("") + (e.trouvee ? "🟩" : "");
    const chap = e.essais.map(g => g === G.cible ? "🎯" : g < G.cible ? "⬆️" : "⬇️").join("");
    const pts = points(e, G.cible).total;
    const texte = `Devine la case n°${numero(G.d)} · LanorTrad\nSérie ${serie}\nChapitre ${chap || "—"}\n${pts} point${pts > 1 ? "s" : ""}\n${location.origin}/classement.html`;
    if (navigator.share && matchMedia("(pointer: coarse)").matches) {
      navigator.share({ text: texte }).catch(() => {});
      return;
    }
    (navigator.clipboard ? navigator.clipboard.writeText(texte) : Promise.reject())
      .then(() => window.LT.toast("📋 Résultat copié, colle-le sur Discord !"))
      .catch(() => window.LT.toast("Copie impossible sur ce navigateur."));
  }

  window.LTdevine = { mount };
})();
