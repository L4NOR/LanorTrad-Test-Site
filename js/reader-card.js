/* =========================================================================
   LanorTrad — Carte de lecteur collectionnable.
   Bâtie sur les données locales (LTstore) + identité Supabase si connecté.
   - Rang + progression vers le rang suivant
   - Badges (hauts faits) dérivés des données locales
   - Numéro collector stable par appareil
   - Holo dont l'intensité dépend du rang
   - Export image : rendu Canvas 2D natif (aucune dépendance) + partage natif
   La carte adopte la couleur de l'univers le plus lu (lien avec l'ambiance).
     window.LTreaderCard.render(mountEl, { identity })
       identity = { username, avatarUrl } | undefined
   ========================================================================= */
(function () {
  "use strict";

  var reduce = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  var TIERS = [
    { min: 0,   name: "Nouveau venu",      grade: "—" },
    { min: 1,   name: "Lecteur",           grade: "D" },
    { min: 10,  name: "Lecteur assidu",    grade: "C" },
    { min: 50,  name: "Dévoreur de pages", grade: "B" },
    { min: 150, name: "Maître lecteur",    grade: "A" },
    { min: 350, name: "Légende LanorTrad", grade: "S" }
  ];
  function tierFor(n) {
    var cur = TIERS[0], next = null;
    for (var i = 0; i < TIERS.length; i++) {
      if (n >= TIERS[i].min) { cur = TIERS[i]; next = TIERS[i + 1] || null; }
    }
    return { cur: cur, next: next };
  }

  function esc(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
  }
  function nf(x) { return Number(x).toLocaleString("fr-FR"); }

  function serial() {
    var s = "";
    try { s = localStorage.getItem("lt-card-serial") || ""; } catch (e) {}
    if (!/^\d{4}$/.test(s)) {
      s = String(Math.floor(1000 + Math.random() * 9000));
      try { localStorage.setItem("lt-card-serial", s); } catch (e) {}
    }
    return s;
  }

  function badgesFor(d) {
    var b = [];
    if (d.started >= 1)        b.push({ i: "📖", t: "Première lecture" });
    if (d.follows >= 3)        b.push({ i: "🔔", t: "Fidèle" });
    if (d.started >= 3)        b.push({ i: "🧭", t: "Explorateur" });
    if (d.maxCh >= 100)        b.push({ i: "🏃", t: "Marathon" });
    if (d.chaptersRead >= 350) b.push({ i: "👑", t: "Légende" });
    return b;
  }

  /* ----------------------------------------------------------------- Rendu DOM */
  function render(mount, opts) {
    if (!mount || !window.LTstore) return;
    opts = opts || {};
    var identity = opts.identity || null;
    var store = window.LTstore;
    var follows = store.follows();
    var hist = store.history();

    var chaptersRead = 0, fav = null, favCh = -1;
    hist.forEach(function (h) {
      var n = parseFloat(h.p.chapter) || 0;
      chaptersRead += Math.floor(n);
      if (n > favCh) { favCh = n; fav = h.s; }
    });

    var accent = (fav && fav.accent) || "#a855f7";
    var t = tierFor(chaptersRead);
    var rank = t.cur, next = t.next;

    var pct = 1, cap = "Rang maximal atteint";
    if (next) {
      pct = Math.max(0, Math.min(1, (chaptersRead - rank.min) / (next.min - rank.min)));
      cap = "Plus que " + (next.min - chaptersRead) + " ch. avant " + next.name;
    }

    var badges = badgesFor({ started: hist.length, follows: follows.length, maxCh: favCh, chaptersRead: chaptersRead });

    var localPseudo = "";
    try { localPseudo = localStorage.getItem("lt-pseudo") || ""; } catch (e) {}
    var loggedIn = !!(identity && identity.username);
    var displayName = loggedIn ? identity.username : (localPseudo || "Lecteur LanorTrad");
    var avatarUrl = identity && identity.avatarUrl;
    var emblem = fav ? fav.cover : (avatarUrl || "images/icons/icon-192x192.png");
    var sn = serial();

    // Données conservées pour l'export image
    mount.__rcData = {
      accent: accent, rank: rank, pct: pct, cap: cap,
      chaptersRead: chaptersRead, follows: follows.length,
      favTitle: fav ? fav.title : "—", displayName: displayName,
      emblem: emblem, serial: sn, badges: badges
    };

    var nameInner =
      (loggedIn && avatarUrl ? '<img class="rc-name-av" src="' + esc(avatarUrl) + '" alt="">' : "") +
      esc(displayName) +
      (loggedIn ? "" : ' <span class="rc-edit" aria-hidden="true">✎</span>');

    mount.innerHTML =
      '<div class="rc-wrap" data-reveal>' +
        '<div class="rc-card" id="rc-card" data-grade="' + esc(rank.grade) + '" style="--rc:' + esc(accent) + '">' +
          '<div class="rc-holo"></div>' +
          '<div class="rc-glare" id="rc-glare"></div>' +
          '<div class="rc-content">' +
            '<div class="rc-top">' +
              '<span class="rc-brand">Lanor<span>Trad</span></span>' +
              '<span class="rc-grade">Rang · ' + esc(rank.grade) + '</span>' +
            '</div>' +
            '<div class="rc-id">' +
              '<div class="rc-emblem"><img src="' + esc(emblem) + '" alt="" crossorigin="anonymous"></div>' +
              '<div class="rc-rank">' + esc(rank.name) + '</div>' +
              '<button class="rc-name' + (loggedIn ? " locked" : "") + '" id="rc-name" type="button"' +
                (loggedIn ? " disabled" : "") + '>' + nameInner + '</button>' +
            '</div>' +
            '<div class="rc-prog">' +
              '<div class="rc-prog-bar"><i style="width:' + Math.round(pct * 100) + '%"></i></div>' +
              '<div class="rc-prog-cap">' + esc(cap) + '</div>' +
            '</div>' +
            '<div class="rc-stats">' +
              stat("Chapitres parcourus", nf(chaptersRead), true) +
              stat("Séries suivies", nf(follows.length)) +
              stat("Univers n°1", fav ? esc(fav.title) : "—", true) +
            '</div>' +
            (badges.length
              ? '<div class="rc-badges">' + badges.map(function (x) {
                  return '<span class="rc-badge" title="' + esc(x.t) + '"><span class="bi">' + x.i + '</span>' + esc(x.t) + '</span>';
                }).join("") + '</div>'
              : '<div class="rc-badges-empty">Commence à lire pour débloquer des badges</div>') +
            '<div class="rc-serial">N° LT-' + sn + '</div>' +
          '</div>' +
        '</div>' +
        '<div class="rc-actions">' +
          '<button class="rc-share" id="rc-share" type="button">' +
            '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><path d="m8.6 13.5 6.8 4M15.4 6.5l-6.8 4"/></svg>' +
            'Partager ma carte</button>' +
        '</div>' +
      '</div>';

    wire(mount, { loggedIn: loggedIn });
  }

  function stat(k, v, accentVal) {
    return '<div class="rc-stat"><span class="rc-k">' + k + '</span>' +
      '<span class="rc-v' + (accentVal ? " accent" : "") + '">' + v + '</span></div>';
  }

  function wire(mount, ctx) {
    var card = mount.querySelector("#rc-card");
    var glare = mount.querySelector("#rc-glare");
    var wrap = mount.querySelector(".rc-wrap");

    if (card && glare && wrap && !reduce) {
      wrap.addEventListener("pointermove", function (e) {
        var r = card.getBoundingClientRect();
        var px = (e.clientX - r.left) / r.width - 0.5;
        var py = (e.clientY - r.top) / r.height - 0.5;
        card.style.transform = "rotateY(" + (px * 14) + "deg) rotateX(" + (-py * 14) + "deg)";
        glare.style.background = "radial-gradient(circle at " + ((px + 0.5) * 100) + "% " +
          ((py + 0.5) * 100) + "%, rgba(255,255,255,.32), rgba(255,255,255,0) 45%)";
      });
      wrap.addEventListener("pointerleave", function () {
        card.style.transform = "rotateY(0deg) rotateX(0deg)";
        glare.style.background = "none";
      });
    }

    if (!ctx.loggedIn) {
      var nameBtn = mount.querySelector("#rc-name");
      if (nameBtn) nameBtn.addEventListener("click", function () {
        var cur = "";
        try { cur = localStorage.getItem("lt-pseudo") || ""; } catch (e) {}
        var v = prompt("Ton pseudo de lecteur :", cur);
        if (v && v.trim()) {
          try { localStorage.setItem("lt-pseudo", v.trim().slice(0, 24)); } catch (e) {}
          render(mount, { identity: window.__ltCardIdentity || null });
        }
      });
    }

    var shareBtn = mount.querySelector("#rc-share");
    if (shareBtn) shareBtn.addEventListener("click", function () { exportImage(mount, shareBtn); });
  }

  /* ------------------------------------------------- Export image (Canvas 2D) */
  function hexToRgb(h) {
    h = String(h).replace("#", "");
    if (h.length === 3) h = h.split("").map(function (c) { return c + c; }).join("");
    return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
  }
  function mix(a, b, t) {
    var A = hexToRgb(a), B = hexToRgb(b);
    return "rgb(" + Math.round(A[0] * t + B[0] * (1 - t)) + "," +
      Math.round(A[1] * t + B[1] * (1 - t)) + "," + Math.round(A[2] * t + B[2] * (1 - t)) + ")";
  }
  function rgba(h, al) { var A = hexToRgb(h); return "rgba(" + A[0] + "," + A[1] + "," + A[2] + "," + al + ")"; }
  function rrect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  function drawCard(d, img) {
    var W = 640, H = 900, dpr = 2, pad = 44, ac = d.accent;
    var cv = document.createElement("canvas");
    cv.width = W * dpr; cv.height = H * dpr;
    var ctx = cv.getContext("2d");
    ctx.scale(dpr, dpr);

    var g = ctx.createLinearGradient(W * 0.2, 0, W * 0.55, H);
    g.addColorStop(0, mix(ac, "#190f2c", 0.42));
    g.addColorStop(0.72, "#0a0711");
    g.addColorStop(1, "#0a0711");
    rrect(ctx, 0, 0, W, H, 30); ctx.fillStyle = g; ctx.fill();
    ctx.lineWidth = 2; ctx.strokeStyle = rgba(ac, 0.5); rrect(ctx, 1, 1, W - 2, H - 2, 29); ctx.stroke();

    // Marque
    ctx.textBaseline = "alphabetic"; ctx.textAlign = "left";
    ctx.font = "800 26px Sora, system-ui, sans-serif";
    ctx.fillStyle = "#fff"; ctx.fillText("Lanor", pad, 74);
    var lw = ctx.measureText("Lanor").width;
    ctx.fillStyle = mix(ac, "#ff8fb0", 0.6); ctx.fillText("Trad", pad + lw, 74);

    // Pastille de rang
    var gp = "Rang · " + d.rank.grade;
    ctx.font = "800 18px Sora, system-ui, sans-serif";
    var pw = ctx.measureText(gp).width + 28, ph = 30, gx = W - pad - pw, gy = 48;
    rrect(ctx, gx, gy, pw, ph, 15); ctx.fillStyle = mix(ac, "#ffd9a0", 0.6); ctx.fill();
    ctx.fillStyle = "#0a0711"; ctx.textAlign = "center"; ctx.fillText(gp, gx + pw / 2, gy + 21);

    // Emblème
    var ecx = W / 2, ecy = 214, er = 80;
    ctx.save(); ctx.shadowColor = rgba(ac, 0.6); ctx.shadowBlur = 42;
    ctx.beginPath(); ctx.arc(ecx, ecy, er, 0, Math.PI * 2);
    ctx.fillStyle = mix(ac, "#3a0d1e", 0.5); ctx.fill(); ctx.restore();
    if (img) {
      ctx.save(); ctx.beginPath(); ctx.arc(ecx, ecy, er, 0, Math.PI * 2); ctx.clip();
      var iw = img.naturalWidth || img.width, ih = img.naturalHeight || img.height;
      var s = Math.max((er * 2) / iw, (er * 2) / ih), dw = iw * s, dh = ih * s;
      ctx.drawImage(img, ecx - dw / 2, ecy - dh / 2, dw, dh); ctx.restore();
    }
    ctx.lineWidth = 2; ctx.strokeStyle = rgba(ac, 0.6);
    ctx.beginPath(); ctx.arc(ecx, ecy, er, 0, Math.PI * 2); ctx.stroke();

    // Rang + pseudo
    ctx.textAlign = "center";
    ctx.font = "800 34px Sora, system-ui, sans-serif"; ctx.fillStyle = "#fff";
    ctx.fillText(d.rank.name, W / 2, 354);
    ctx.font = "400 17px Inter, system-ui, sans-serif"; ctx.fillStyle = mix(ac, "#d9cff0", 0.35);
    ctx.fillText(d.displayName, W / 2, 382);

    // Barre de progression
    var by = 410, bw = W - 2 * pad, bh = 12;
    rrect(ctx, pad, by, bw, bh, 6); ctx.fillStyle = "rgba(255,255,255,0.12)"; ctx.fill();
    var fw = Math.max(bh, bw * d.pct);
    var pg = ctx.createLinearGradient(pad, 0, pad + bw, 0);
    pg.addColorStop(0, mix(ac, "#ffffff", 0.7)); pg.addColorStop(1, ac);
    rrect(ctx, pad, by, fw, bh, 6); ctx.fillStyle = pg; ctx.fill();
    ctx.font = "400 14px Inter, system-ui, sans-serif"; ctx.fillStyle = "#b9a9d6";
    ctx.fillText(d.cap, W / 2, by + 36);

    // Stats
    var rows = [
      ["Chapitres parcourus", nf(d.chaptersRead), true],
      ["Séries suivies", nf(d.follows), false],
      ["Univers n°1", d.favTitle, true]
    ];
    var sy = 470;
    rows.forEach(function (r) {
      ctx.strokeStyle = "rgba(255,255,255,0.12)"; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(pad, sy); ctx.lineTo(W - pad, sy); ctx.stroke();
      ctx.textAlign = "left"; ctx.font = "400 16px Inter, system-ui, sans-serif"; ctx.fillStyle = "#b9a9d6";
      ctx.fillText(r[0], pad, sy + 27);
      ctx.textAlign = "right"; ctx.font = "700 17px Sora, system-ui, sans-serif";
      ctx.fillStyle = r[2] ? mix(ac, "#ffe1a0", 0.55) : "#fff";
      ctx.fillText(String(r[1]), W - pad, sy + 27);
      sy += 44;
    });

    // Badges (pastilles centrées, jusqu'à 2 rangées)
    sy += 18;
    ctx.font = "400 13px Inter, system-ui, sans-serif";
    var items = d.badges.map(function (bd) {
      return { bd: bd, w: ctx.measureText(bd.t).width + 44 };
    });
    var maxW = W - 2 * pad, rws = [[]], rw = 0;
    items.forEach(function (it) {
      var add = it.w + (rws[rws.length - 1].length ? 8 : 0);
      if (rw + add > maxW) { rws.push([]); rw = 0; add = it.w; }
      rws[rws.length - 1].push(it); rw += add;
    });
    rws.forEach(function (row) {
      if (!row.length) return;
      var total = row.reduce(function (a, it) { return a + it.w; }, 0) + 8 * (row.length - 1);
      var sx = (W - total) / 2, bh2 = 26;
      row.forEach(function (it) {
        rrect(ctx, sx, sy, it.w, bh2, 13);
        ctx.fillStyle = "rgba(255,255,255,0.07)"; ctx.fill();
        ctx.lineWidth = 1; ctx.strokeStyle = rgba(ac, 0.3); ctx.stroke();
        ctx.textBaseline = "middle"; ctx.textAlign = "left";
        ctx.font = "15px system-ui, sans-serif"; ctx.fillStyle = "#fff";
        ctx.fillText(it.bd.i, sx + 11, sy + bh2 / 2 + 1);
        ctx.font = "400 13px Inter, system-ui, sans-serif"; ctx.fillStyle = "#efe7ff";
        ctx.fillText(it.bd.t, sx + 32, sy + bh2 / 2 + 1);
        sx += it.w + 8;
      });
      ctx.textBaseline = "alphabetic";
      sy += bh2 + 8;
    });

    // Numéro collector
    ctx.textAlign = "center"; ctx.font = "700 14px Sora, system-ui, sans-serif";
    ctx.fillStyle = mix(ac, "#8a7fae", 0.4);
    ctx.fillText("N° LT-" + d.serial, W / 2, H - 34);

    return cv;
  }

  function exportImage(mount, btn) {
    var d = mount.__rcData;
    if (!d) return;
    var toast = (window.LT && window.LT.toast) || function () {};
    btn.disabled = true; var prev = btn.textContent; btn.textContent = "Génération…";

    var finish = function (img) {
      var fontsReady = (document.fonts && document.fonts.ready) ? document.fonts.ready : Promise.resolve();
      fontsReady.then(function () {
        var cv;
        try { cv = drawCard(d, img); } catch (e) { cv = null; }
        if (!cv) { btn.disabled = false; btn.textContent = prev; toast("Export impossible."); return; }
        var done = function (blob) {
          btn.disabled = false; btn.textContent = prev;
          if (!blob) { toast("Export impossible."); return; }
          var fname = "carte-lecteur-lanortrad.png";
          var file = window.File ? new File([blob], fname, { type: "image/png" }) : null;
          if (file && navigator.canShare && navigator.canShare({ files: [file] })) {
            navigator.share({ files: [file], title: "Ma carte de lecteur LanorTrad" }).catch(function () {});
          } else {
            var a = document.createElement("a");
            a.href = URL.createObjectURL(blob); a.download = fname; a.click();
            setTimeout(function () { URL.revokeObjectURL(a.href); }, 4000);
            toast("Carte téléchargée ✓");
          }
        };
        try { cv.toBlob(done, "image/png"); }
        catch (e) { btn.disabled = false; btn.textContent = prev; toast("Export impossible (image protégée)."); }
      });
    };

    var img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = function () { finish(img); };
    img.onerror = function () { finish(null); };   // CORS/échec → carte sans emblème
    img.src = d.emblem;
  }

  window.LTreaderCard = { render: render };
})();
