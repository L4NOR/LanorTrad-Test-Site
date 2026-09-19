/* =========================================================================
   LanorTrad — « Ton année sur LanorTrad » (bilan de fin d'année).

   Chargé par js/core.js, et seulement en décembre et en janvier (ou avec
   ?bilan dans l'adresse), sur l'accueil et la Bibliothèque. Le reste de
   l'année, personne ne télécharge ce fichier.

   D'OÙ VIENNENT LES CHIFFRES
     • le journal local (js/store.js, « lt-journal ») : chaque chapitre
       terminé, l'heure, le jour, le temps de lecture active. Pour tout le
       monde, compte ou pas, mais seulement sur cet appareil et depuis que le
       journal existe ;
     • pour un membre connecté, son propre journal d'XP (xp_events, lisible
       par lui seul) : lectures, commentaires, forum, quiz, pronostics, cases
       devinées — et ses succès de l'année, sa réaction préférée.
   Les deux sources sont fusionnées (un chapitre compté des deux côtés ne
   l'est qu'une fois). Chaque diapo dit d'où vient ce qu'elle affiche.

   Présentation « stories » : appui à droite pour avancer, à gauche pour
   revenir, flèches du clavier, Échap pour fermer. La dernière diapo fabrique
   une carte image (Canvas 2D, sans dépendance) à partager.
   ========================================================================= */
(function () {
  "use strict";

  const AN = window.LT_BILAN || new Date().getFullYear();
  const TOME = 190;                 // pages d'un tome relié, en ordre de grandeur
  const JOURS = ["dimanche", "lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi"];
  const esc = s => String(s == null ? "" : s)
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
  const nf = n => Number(n).toLocaleString("fr-FR");
  const pl = (n, un, plusieurs) => `${nf(n)} ${n > 1 ? (plusieurs || un + "s") : un}`;
  const dateFr = iso => new Date(iso + "T12:00:00").toLocaleDateString("fr-FR", { day: "numeric", month: "long" });

  function feuille() {
    if (document.getElementById("bilan-css")) return;
    const l = document.createElement("link");
    l.id = "bilan-css"; l.rel = "stylesheet"; l.href = "/css/bilan.css";
    document.head.appendChild(l);
  }
  function script(src, pret) {
    if (pret()) return Promise.resolve();
    return new Promise(ok => {
      const s = document.createElement("script");
      s.src = src; s.onload = ok; s.onerror = ok;
      document.head.appendChild(s);
    });
  }

  /* ------------------------------------------------------ Côté compte */
  async function serveur() {
    const c = window.LTsb && window.LTsb();
    if (!c) return null;
    let session = null;
    try { session = (await c.auth.getSession()).data.session; } catch {}
    if (!session) return null;
    const uid = session.user.id, de = `${AN}-01-01`, a = `${AN + 1}-01-01`;
    const rows = [];
    for (let i = 0; i < 10; i++) {                       // PostgREST plafonne à 1000 lignes
      const { data, error } = await c.from("xp_events").select("kind,ref,xp,created_at")
        .eq("user_id", uid).gte("created_at", de).lt("created_at", a)
        .order("created_at").range(i * 1000, i * 1000 + 999);
      if (error || !data) break;
      rows.push(...data);
      if (data.length < 1000) break;
    }
    const sel = async q => { try { const { data } = await q; return data; } catch { return null; } };
    const profil = await sel(c.from("profiles").select("username,xp,streak_best").eq("id", uid).maybeSingle());
    const succes = await sel(c.from("user_achievements").select("key,earned_at,achievements(name,secret)")
      .eq("user_id", uid).gte("earned_at", de).lt("earned_at", a));
    const moods = await sel(c.from("chapter_moods").select("emoji")
      .eq("user_id", uid).gte("created_at", de).lt("created_at", a));
    return { rows, profil, succes: succes || [], moods: moods || [] };
  }

  /* --------------------------------------------------- Les chiffres */
  async function donnees() {
    const loc = (window.LTstore && window.LTstore.journal()[String(AN)]) || null;
    const srv = await serveur().catch(() => null);
    const lus = new Set();
    if (loc) for (const m in loc.lus) for (const n of loc.lus[m]) lus.add(m + "|" + n);

    const K = { comment: 0, forum: 0, quiz: 0, prono: 0, devine: 0, xp: 0 };
    const heures = Array(24).fill(0), jours = Array(7).fill(0);
    let debut = loc ? loc.debut : null;
    const lecturesSrv = srv ? srv.rows.filter(r => r.kind === "read") : [];
    if (srv) {
      srv.rows.forEach(r => {
        K.xp += r.xp || 0;
        if (r.kind === "read") {
          const i = (r.ref || "").lastIndexOf(":");
          if (i > 0) lus.add(r.ref.slice(0, i) + "|" + r.ref.slice(i + 1));
        } else if (K[r.kind] != null) K[r.kind]++;
      });
      if (srv.rows.length) {
        const premier = srv.rows[0].created_at.slice(0, 10);
        if (!debut || premier < debut) debut = premier;
      }
    }
    // Habitudes : les horodatages du compte sont complets ; sinon, le journal local.
    if (lecturesSrv.length) lecturesSrv.forEach(r => { const d = new Date(r.created_at); heures[d.getHours()]++; jours[d.getDay()]++; });
    else if (loc) { loc.heures.forEach((v, i) => { heures[i] += v; }); loc.jours.forEach((v, i) => { jours[i] += v; }); }

    const parSerie = {};
    let pages = 0;
    for (const k of lus) {
      const i = k.lastIndexOf("|"), m = k.slice(0, i), n = k.slice(i + 1);
      parSerie[m] = (parSerie[m] || 0) + 1;
      const c = ((window.CHAPTERS || {})[m] || []).find(x => String(x.num) === n);
      if (c) pages += c.pages || 0;
    }
    const top = Object.entries(parSerie)
      .map(([id, n]) => ({ s: window.LT.seriesById(id), n }))
      .filter(x => x.s).sort((a, b) => b.n - a.n);
    const max = t => (t.some(Boolean) ? t.indexOf(Math.max(...t)) : null);

    let rang = null;
    if (srv && srv.profil && srv.profil.xp != null) {
      await script("/js/xp.js", () => !!window.LTxp);
      if (window.LTxp) rang = window.LTxp.rankOf(window.LTxp.levelFromXp(srv.profil.xp)).name;
    }
    const emo = {};
    (srv ? srv.moods : []).forEach(m => { emo[m.emoji] = (emo[m.emoji] || 0) + 1; });
    const moodFav = Object.keys(emo).sort((a, b) => emo[b] - emo[a])[0] || null;

    return {
      chapitres: lus.size, pages, top, debut,
      source: srv && srv.rows.length ? "compte" : "appareil",
      local: !!(loc && Object.keys(loc.lus).length),
      connecte: !!srv, pseudo: srv && srv.profil ? srv.profil.username : null,
      heure: max(heures), jour: max(jours), sec: loc ? loc.sec : 0,
      K, rang, record: srv && srv.profil ? srv.profil.streak_best || 0 : 0,
      succes: (srv ? srv.succes : []).filter(x => x.achievements && !x.achievements.secret).map(x => x.achievements.name),
      moodFav,
    };
  }

  /* ------------------------------------------------------ Les diapos */
  const equipe = h => h >= 22 || h < 5 ? "Team nuit blanche" : h < 12 ? "Team café du matin"
                    : h < 18 ? "Team pause de l'après-midi" : "Team soirée";
  const duree = s => { const h = Math.floor(s / 3600), m = Math.round((s % 3600) / 60); return h ? `${h} h${m ? " " + String(m).padStart(2, "0") : ""}` : `${m} min`; };

  function diapos(D) {
    const S = [];
    const fav = D.top[0] && D.top[0].s;
    const ou = D.source === "compte" ? (D.local ? "avec ton compte et sur cet appareil" : "avec ton compte") : "sur cet appareil";
    const provenance = D.debut ? `Compté ${ou} depuis le ${esc(dateFr(D.debut))}.` : "";

    S.push({ cls: "intro", html: `
      <p class="bl-sur">${D.pseudo ? esc(D.pseudo) + ", voilà" : "Voilà"} ton année</p>
      <h2 class="bl-geant">${AN}</h2>
      <p>Tes chapitres, ta série préférée, tes heures de lecture : on a fait les comptes.</p>
      <p class="bl-aide">Appuie à droite pour avancer.</p>` });

    if (!D.chapitres) {
      S.push({ html: `
        <p class="bl-sur">Cette année</p>
        <h2>Pas encore de chapitre au compteur</h2>
        <p>Le compteur démarre au premier chapitre que tu termines${D.source === "appareil" ? " sur cet appareil" : ""}. Rendez-vous l'an prochain pour un vrai bilan !</p>` });
    } else {
      const tomes = Math.round(D.pages / TOME);
      S.push({ html: `
        <p class="bl-sur">Cette année, tu as lu</p>
        <h2 class="bl-geant">${nf(D.chapitres)}</h2>
        <p class="bl-sous">${D.chapitres > 1 ? "chapitres" : "chapitre"}</p>
        ${D.pages ? `<p>À peu près ${pl(D.pages, "page")}${tomes >= 1 ? `, l'équivalent d'environ ${pl(tomes, "tome relié", "tomes reliés")}` : ""}.</p>` : ""}
        <p class="bl-note">${provenance}</p>` });
    }

    if (fav) S.push({ accent: fav.accent, html: `
      <p class="bl-sur">Ta série de l'année</p>
      <img class="bl-cover" src="${window.LT.cover(fav.cover, 480)}" alt="">
      <h2>${esc(fav.title)}</h2>
      <p>${pl(D.top[0].n, "chapitre lu", "chapitres lus")}.</p>
      ${D.top.length > 1 ? `<p class="bl-note">Juste derrière : ${D.top.slice(1, 3).map(x => `${esc(x.s.title)} (${nf(x.n)})`).join(", ")}.</p>` : ""}` });

    if (D.heure != null) S.push({ html: `
      <p class="bl-sur">Tes habitudes</p>
      <h2>${equipe(D.heure)}</h2>
      <p>Ton heure préférée pour finir un chapitre : <b>${D.heure} h</b>.${D.jour != null ? ` Ton jour : le <b>${JOURS[D.jour]}</b>.` : ""}</p>
      ${D.sec >= 600 ? `<p><b>${duree(D.sec)}</b> de lecture active au compteur de cet appareil.</p>` : ""}` });

    const K = D.K;
    const lignes = [
      K.xp ? `✨ <b>${nf(K.xp)} XP</b> gagnés${D.rang ? ` · rang <b>${esc(D.rang)}</b>` : ""}` : "",
      K.comment ? `💬 ${pl(K.comment, "commentaire")} de chapitre` : "",
      K.forum ? `🗣️ ${pl(K.forum, "message")} sur le forum` : "",
      K.prono ? `🔮 ${pl(K.prono, "pronostic gagné", "pronostics gagnés")}` : "",
      K.devine ? `🧩 ${pl(K.devine, "case devinée", "cases devinées")}` : "",
      K.quiz ? `🧠 ${pl(K.quiz, "quiz joué", "quiz joués")}` : "",
      D.record >= 2 ? `🔥 record de série : <b>${pl(D.record, "jour")}</b> d'affilée` : "",
      D.moodFav ? `Ta réaction préférée en fin de chapitre : <span class="bl-emo">${D.moodFav}</span>` : "",
      D.succes.length ? `🏆 ${D.succes.length > 1 ? "Succès débloqués" : "Succès débloqué"} : ${D.succes.slice(0, 3).map(esc).join(", ")}${D.succes.length > 3 ? "…" : ""}` : "",
    ].filter(Boolean);
    if (D.connecte && lignes.length) S.push({ html: `
      <p class="bl-sur">Côté communauté</p>
      <h2>Tu n'as pas fait que lire</h2>
      <ul class="bl-liste">${lignes.map(l => `<li>${l}</li>`).join("")}</ul>` });

    S.push({ cls: "fin", accent: fav && fav.accent, html: `
      <p class="bl-sur">Merci d'avoir lu avec nous</p>
      <div class="bl-carte"><canvas aria-label="Ta carte de l'année"></canvas></div>
      <div class="bl-acts">
        <button type="button" class="btn btn-primary btn-sm" data-bl="partager">Partager ma carte</button>
      </div>
      <p class="bl-note">À l'année prochaine. Lanor, Taichoskii et Zerox</p>` });
    return S;
  }

  /* ---------------------------------------------- La carte à partager */
  function rrect(ctx, x, y, w, h, r) {
    ctx.beginPath(); ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
  }
  function dessinerCarte(cv, D, img) {
    const W = 1080, H = 1350, ac = (D.top[0] && D.top[0].s.accent) || "#a855f7";
    cv.width = W; cv.height = H;
    const ctx = cv.getContext("2d");
    const g = ctx.createLinearGradient(0, 0, W * 0.4, H);
    g.addColorStop(0, ac); g.addColorStop(0.55, "#140c24"); g.addColorStop(1, "#07070d");
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);

    ctx.fillStyle = "#fff"; ctx.textBaseline = "alphabetic";
    ctx.font = "800 44px Sora, system-ui, sans-serif"; ctx.fillText("LanorTrad", 80, 120);
    ctx.font = "600 40px Inter, system-ui, sans-serif"; ctx.globalAlpha = .8;
    ctx.fillText(`Mon année ${AN}`, 80, 180); ctx.globalAlpha = 1;

    ctx.font = "800 260px Sora, system-ui, sans-serif"; ctx.fillText(nf(D.chapitres), 72, 450);
    ctx.font = "700 54px Sora, system-ui, sans-serif";
    ctx.fillText(D.chapitres > 1 ? "chapitres lus" : "chapitre lu", 80, 530);
    if (D.pages) { ctx.font = "400 38px Inter, system-ui, sans-serif"; ctx.globalAlpha = .8; ctx.fillText(`≈ ${pl(D.pages, "page")}`, 80, 590); ctx.globalAlpha = 1; }

    const fav = D.top[0];
    if (fav) {
      const y0 = 680;
      if (img) {
        ctx.save(); rrect(ctx, 80, y0, 260, 370, 24); ctx.clip();
        const s = Math.max(260 / img.naturalWidth, 370 / img.naturalHeight);
        ctx.drawImage(img, 80 + (260 - img.naturalWidth * s) / 2, y0 + (370 - img.naturalHeight * s) / 2, img.naturalWidth * s, img.naturalHeight * s);
        ctx.restore();
      }
      const x = img ? 390 : 80;
      ctx.font = "600 34px Inter, system-ui, sans-serif"; ctx.globalAlpha = .75; ctx.fillText("Série de l'année", x, y0 + 60); ctx.globalAlpha = 1;
      ctx.font = "800 64px Sora, system-ui, sans-serif";
      const mots = fav.s.title.split(" "); let ligne = "", y = y0 + 140;
      mots.forEach(m => {                                   // retour à la ligne des titres longs
        if (ctx.measureText(ligne + m).width > W - x - 70 && ligne) { ctx.fillText(ligne.trim(), x, y); ligne = ""; y += 74; }
        ligne += m + " ";
      });
      ctx.fillText(ligne.trim(), x, y);
      ctx.font = "400 38px Inter, system-ui, sans-serif"; ctx.fillText(pl(fav.n, "chapitre", "chapitres"), x, y + 64);
    }

    const bas = [
      D.heure != null ? ["Heure préférée", `${D.heure} h`] : null,
      D.sec >= 600 ? ["Lecture active", duree(D.sec)] : null,
      D.K.xp ? ["XP gagnés", nf(D.K.xp)] : null,
    ].filter(Boolean);
    bas.forEach((b, i) => {
      const x = 80 + i * 320;
      ctx.font = "400 30px Inter, system-ui, sans-serif"; ctx.globalAlpha = .7; ctx.fillText(b[0], x, 1150); ctx.globalAlpha = 1;
      ctx.font = "700 50px Sora, system-ui, sans-serif"; ctx.fillText(b[1], x, 1215);
    });
    ctx.font = "600 30px Inter, system-ui, sans-serif"; ctx.globalAlpha = .6;
    ctx.fillText("lanortrad.com", 80, H - 60); ctx.globalAlpha = 1;
  }

  function preparerCarte(root, D) {
    const cv = root.querySelector(".bl-carte canvas");
    if (!cv) return;
    const fav = D.top[0] && D.top[0].s;
    const fin = img => (document.fonts ? document.fonts.ready : Promise.resolve()).then(() => dessinerCarte(cv, D, img));
    if (!fav) { fin(null); return; }
    const img = new Image();
    img.onload = () => fin(img); img.onerror = () => fin(null);
    img.src = window.LT.cover(fav.cover, 480);
  }

  function partager(root) {
    const cv = root.querySelector(".bl-carte canvas");
    if (!cv) return;
    cv.toBlob(blob => {
      if (!blob) { window.LT.toast("La carte n'a pas pu être créée."); return; }
      const nom = `mon-annee-${AN}-lanortrad.png`;
      const f = window.File ? new File([blob], nom, { type: "image/png" }) : null;
      if (f && navigator.canShare && navigator.canShare({ files: [f] })) {
        navigator.share({ files: [f], title: `Mon année ${AN} sur LanorTrad` }).catch(() => {});
        return;
      }
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob); a.download = nom; a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 4000);
      window.LT.toast("Carte téléchargée ✓");
    }, "image/png");
  }

  /* ---------------------------------------------------- Le diaporama */
  let ouvert = false;
  async function ouvrir() {
    if (ouvert) return;
    ouvert = true;
    feuille();
    const root = window.LT.el(`<div class="bl" role="dialog" aria-modal="true" aria-label="Ton année ${AN} sur LanorTrad">
      <div class="bl-barres"></div>
      <button type="button" class="bl-x" aria-label="Fermer">✕</button>
      <div class="bl-scene"><div class="bl-slide"><p class="bl-sur">On fait les comptes…</p></div></div>
      <button type="button" class="bl-nav prev" aria-label="Précédent"></button>
      <button type="button" class="bl-nav next" aria-label="Suivant"></button>
    </div>`);
    document.body.appendChild(root);
    document.documentElement.classList.add("bl-open");
    root.querySelector(".bl-x").focus({ preventScroll: true });

    const D = await donnees();
    const S = diapos(D);
    let i = 0;
    const barres = root.querySelector(".bl-barres");
    barres.innerHTML = S.map(() => "<i></i>").join("");
    const montrer = k => {
      i = Math.max(0, Math.min(S.length - 1, k));
      const d = S[i];
      const sl = root.querySelector(".bl-slide");
      sl.className = "bl-slide " + (d.cls || "");
      sl.innerHTML = d.html;
      root.style.setProperty("--bl-accent", d.accent || (D.top[0] && D.top[0].s.accent) || "#a855f7");
      [...barres.children].forEach((b, k2) => b.classList.toggle("on", k2 <= i));
      root.querySelector(".prev").hidden = i === 0;
      root.querySelector(".next").hidden = i === S.length - 1;
      if (d.cls === "fin") preparerCarte(root, D);
    };
    const fermer = () => {
      root.remove(); ouvert = false;
      document.documentElement.classList.remove("bl-open");
      document.removeEventListener("keydown", clavier);
    };
    const clavier = e => {
      if (e.key === "Escape") fermer();
      else if (e.key === "ArrowRight") montrer(i + 1);
      else if (e.key === "ArrowLeft") montrer(i - 1);
    };
    document.addEventListener("keydown", clavier);
    root.addEventListener("click", e => {
      if (e.target.closest(".bl-x")) return fermer();
      if (e.target.closest("[data-bl=partager]")) return partager(root);
      if (e.target.closest(".bl-nav.next")) return montrer(i + 1);
      if (e.target.closest(".bl-nav.prev")) return montrer(i - 1);
    });
    montrer(0);
  }

  /* ------------------------------------------------------ Le bandeau */
  function bandeau() {
    const main = document.querySelector("main");
    if (!main || document.querySelector(".bl-bandeau")) return;
    const cle = "lt-bilan-cache-" + AN;
    const biblio = window.LT.page === "bibliotheque.html";
    let cache = false;
    try { cache = localStorage.getItem(cle) === "1"; } catch {}
    if (cache && !biblio) return;                    // sur la Bibliothèque, il reste toujours accessible
    const b = window.LT.el(`<section class="wrap bl-bandeau-wrap"><div class="bl-bandeau">
        <span class="bl-bandeau-ic" aria-hidden="true">🎉</span>
        <div class="bl-bandeau-txt"><strong>Ton année ${AN} sur LanorTrad</strong>
          <span>Chapitres lus, série préférée, heures de lecture : ton bilan t'attend.</span></div>
        <button type="button" class="btn btn-primary btn-sm" data-bl-open>Voir mon bilan</button>
        ${biblio ? "" : `<button type="button" class="bl-bandeau-x" aria-label="Masquer">✕</button>`}
      </div></section>`);
    feuille();
    // Accueil : sous le héros, pas par-dessus. Ailleurs : en tête de page.
    const hero = main.querySelector(".hero");
    if (hero) hero.after(b); else main.prepend(b);
    b.addEventListener("click", e => {
      if (e.target.closest("[data-bl-open]")) ouvrir();
      if (e.target.closest(".bl-bandeau-x")) { try { localStorage.setItem(cle, "1"); } catch {} b.remove(); }
    });
  }

  bandeau();
  if (/[?&]bilan\b/.test(location.search)) ouvrir();
  window.LTbilan = { ouvrir };
})();
