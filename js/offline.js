/* =========================================================================
   LanorTrad — Mode hors ligne + mini-jeu « Oni Runner »

   Quand la connexion tombe pendant la navigation (métro, ascenseur, forfait
   épuisé…), le site ne se contente pas de casser :

     1. Un bandeau discret prévient « Connexion perdue » et rappelle que les
        chapitres déjà lus restent lisibles (service worker).
     2. Un bouton « Jouer » ouvre un mini-jeu façon dinosaure de Chrome, mais
        maison : un petit Oni qui court, saute les piles de tomes et esquive
        les corbeaux. Le record est gardé en local.
     3. Si une page NON mise en cache est demandée hors ligne, le service
        worker sert offline.html, qui ouvre directement le jeu.

   Le bandeau ne bloque jamais la lecture : c'est le lecteur qui décide de
   jouer. Retour de la connexion => le bandeau le dit et la partie en cours
   n'est pas coupée (on propose juste de reprendre la lecture).

   API : window.LToffline.open() / .close() / .isOffline() / .notify(bool)
   Ouvrir le jeu depuis n'importe quel lien : page.html?jeu=1
   ========================================================================= */
(function () {
  "use strict";

  var BEST_KEY  = "lt-oni-best";
  var PLAYS_KEY = "lt-oni-plays";

  var bar = null, barHide = 0;        // bandeau « hors ligne »
  var wrap = null, canvas = null, ctx = null;   // overlay du jeu
  var els = {}, G = null, ro = null;
  var dropped = false;                // la connexion est-elle tombée pendant la visite ?
  var shown = false;                  // jeu affiché ? (le [hidden] part avec un délai d'animation)

  function lite() { return !!(window.LTperf && window.LTperf.isLite()); }
  function num(k) { try { return parseInt(localStorage.getItem(k), 10) || 0; } catch (e) { return 0; } }
  function put(k, v) { try { localStorage.setItem(k, String(v)); } catch (e) {} }
  function isOffline() { return navigator.onLine === false; }
  function el(html) { var d = document.createElement("div"); d.innerHTML = html.trim(); return d.firstElementChild; }

  /* ====================================================================== */
  /*  Bandeau hors ligne                                                     */
  /* ====================================================================== */

  function buildBar() {
    if (bar) return bar;
    bar = el(
      '<div class="lt-off-bar" role="status" aria-live="polite">' +
        '<span class="lt-off-ico" aria-hidden="true">📴</span>' +
        '<div class="lt-off-txt"><b></b><small></small></div>' +
        '<button class="lt-off-play" type="button">🎮 Jouer</button>' +
        '<button class="lt-off-x" type="button" aria-label="Masquer">✕</button>' +
      '</div>');
    bar.querySelector(".lt-off-play").addEventListener("click", function () { open(); });
    bar.querySelector(".lt-off-x").addEventListener("click", function () { hideBar(); });
    document.body.appendChild(bar);
    return bar;
  }

  function showBar(kind) {
    var b = buildBar();
    clearTimeout(barHide);
    var off = kind !== "online";
    b.classList.toggle("ok", !off);
    b.querySelector(".lt-off-ico").textContent = off ? "📴" : "🌐";
    b.querySelector(".lt-off-txt b").textContent = off ? "Connexion perdue" : "De retour en ligne";
    b.querySelector(".lt-off-txt small").textContent = off
      ? "Tes chapitres déjà lus restent lisibles. Une partie en attendant ?"
      : "Tout est revenu, tu peux reprendre ta lecture.";
    b.querySelector(".lt-off-play").hidden = !off;
    // Laisse le temps au navigateur d'appliquer l'état initial avant la transition
    requestAnimationFrame(function () { b.classList.add("on"); });
    if (!off) barHide = setTimeout(hideBar, 4200);
  }

  function hideBar() {
    if (!bar) return;
    clearTimeout(barHide);
    bar.classList.remove("on");
  }

  /* ====================================================================== */
  /*  Overlay du jeu                                                         */
  /* ====================================================================== */

  function build() {
    if (wrap) return;
    wrap = el(
      '<div class="lt-game" role="dialog" aria-modal="true" aria-label="Mini-jeu hors ligne : Oni Runner" hidden>' +
        '<div class="lt-game-panel">' +
          '<header class="lt-game-head">' +
            '<div class="lt-game-id"><span class="eyebrow">Hors ligne</span><h2>Oni Runner</h2></div>' +
            '<div class="lt-game-scores">' +
              '<span>Score <b class="js-score">0</b></span>' +
              '<span>Record <b class="js-best">0</b></span>' +
            '</div>' +
            '<button class="lt-game-x" type="button" aria-label="Fermer le jeu">✕</button>' +
          '</header>' +
          '<div class="lt-game-stage"><canvas></canvas></div>' +
          '<footer class="lt-game-foot">' +
            '<p class="lt-game-help"><b>Espace</b> ou <b>↑</b> pour sauter · <b>↓</b> pour se baisser · ' +
              'sur mobile : tape en haut pour sauter, en bas pour te baisser.</p>' +
            '<div class="lt-game-net" hidden><span>🌐 La connexion est revenue.</span>' +
              '<button class="lt-game-resume" type="button">Reprendre la lecture</button></div>' +
          '</footer>' +
        '</div>' +
      '</div>');
    document.body.appendChild(wrap);

    els.score = wrap.querySelector(".js-score");
    els.best  = wrap.querySelector(".js-best");
    els.net   = wrap.querySelector(".lt-game-net");
    canvas    = wrap.querySelector("canvas");
    ctx       = canvas.getContext("2d");

    wrap.querySelector(".lt-game-x").addEventListener("click", close);
    wrap.querySelector(".lt-game-resume").addEventListener("click", close);
    wrap.addEventListener("click", function (e) { if (e.target === wrap) close(); });

    canvas.addEventListener("pointerdown", function (e) {
      e.preventDefault();
      var r = canvas.getBoundingClientRect();
      if ((e.clientY - r.top) / r.height > 0.62) duck(true); else jump();
    });
    ["pointerup", "pointercancel", "pointerleave"].forEach(function (ev) {
      canvas.addEventListener(ev, function () { duck(false); release(); });
    });

    if (window.ResizeObserver) {
      ro = new ResizeObserver(function () { if (G) resize(); });
      ro.observe(wrap.querySelector(".lt-game-stage"));
    } else {
      window.addEventListener("resize", function () { if (G) resize(); });
    }
  }

  function open() {
    build();
    if (shown) return;
    shown = true;
    wrap.hidden = false;
    document.body.classList.add("lt-game-active");
    requestAnimationFrame(function () { wrap.classList.add("on"); });
    // Le bandeau vert « c'est revenu » n'a de sens que si la connexion est
    // effectivement tombée à un moment (jeu ouvert depuis un lien : rien).
    els.net.hidden = true;
    hideBar();                    // le bandeau ferait doublon derrière le jeu
    start();
    wrap.querySelector(".lt-game-x").focus({ preventScroll: true });
    document.addEventListener("keydown", onKeyDown, { passive: false });
    document.addEventListener("keyup", onKeyUp);
  }

  function close() {
    if (!wrap || !shown) return;
    shown = false;
    stop();
    wrap.classList.remove("on");
    document.body.classList.remove("lt-game-active");
    document.removeEventListener("keydown", onKeyDown);
    document.removeEventListener("keyup", onKeyUp);
    setTimeout(function () { if (wrap && !shown) wrap.hidden = true; }, 260);
    if (isOffline()) showBar("offline");     // toujours coupé : on le rappelle
  }

  /* ---------------------------- clavier ---------------------------- */
  function onKeyDown(e) {
    var k = e.key;
    if (k === "Escape") { close(); return; }
    if (k === " " || k === "Spacebar" || k === "ArrowUp" || k === "w" || k === "W") { e.preventDefault(); jump(); }
    else if (k === "ArrowDown" || k === "s" || k === "S") { e.preventDefault(); duck(true); }
  }
  function onKeyUp(e) {
    var k = e.key;
    if (k === "ArrowDown" || k === "s" || k === "S") duck(false);
    if (k === " " || k === "Spacebar" || k === "ArrowUp" || k === "w" || k === "W") release();
  }

  /* ====================================================================== */
  /*  Le jeu                                                                 */
  /* ====================================================================== */

  /* Physique de base, calibrée pour une scène de 200 px de haut ; tout est
     multiplié par G.s (échelle) pour que le jeu reste identique quelle que
     soit la hauteur réelle du cadre (mobile ↔ grand écran). */
  var GRAVITY = 0.8, JUMP = -11.8, FLOOR_H = 26;

  function start() {
    G = {
      w: 0, h: 0, dpr: 1, ground: 0, s: 1,
      state: "ready",              // ready | run | over | paused
      score: 0, best: num(BEST_KEY), speed: 5.2, dist: 0, night: false,
      player: null, obs: [], parts: [], stars: [], hills: [], spawnIn: 60,
      last: 0, raf: 0, blink: 0
    };
    resize();
    reset();
    els.best.textContent = G.best;
    G.last = performance.now();
    G.raf = requestAnimationFrame(frame);
  }

  function stop() {
    if (!G) return;
    cancelAnimationFrame(G.raf);
    // Fermer en pleine partie ne doit pas faire perdre un record.
    if (G.score > num(BEST_KEY)) put(BEST_KEY, G.score);
    G = null;
  }

  function reset() {
    G.state = "ready"; G.score = 0; G.dist = 0; G.speed = 5.2 * G.s; G.night = false;
    G.obs = []; G.parts = []; G.spawnIn = 55;
    G.player = { x: Math.round(G.w * 0.14), y: 0, w: 26 * G.s, h: 38 * G.s, vy: 0, duck: false, onGround: true };
    G.player.y = G.ground - G.player.h;
    els.score.textContent = "0";
  }

  function resize() {
    // clientWidth/Height et non getBoundingClientRect : le panneau a une
    // transform d'ouverture (scale) qui fausserait la taille du canvas.
    var stage = wrap.querySelector(".lt-game-stage");
    G.w = Math.max(260, stage.clientWidth);
    G.h = Math.max(150, stage.clientHeight);
    G.dpr = lite() ? 1 : Math.min(2, window.devicePixelRatio || 1);
    canvas.width  = Math.round(G.w * G.dpr);
    canvas.height = Math.round(G.h * G.dpr);
    ctx.setTransform(G.dpr, 0, 0, G.dpr, 0, 0);
    G.s = Math.max(.9, Math.min(1.7, G.h / 190));
    G.ground = G.h - FLOOR_H * G.s;

    // Décor régénéré à la taille de la scène
    G.stars = [];
    var n = lite() ? 0 : Math.round(G.w / 16);
    for (var i = 0; i < n; i++)
      G.stars.push({ x: Math.random() * G.w, y: Math.random() * (G.ground - 30), r: Math.random() * 1.3 + .3, a: Math.random() * .5 + .2 });
    G.hills = [];
    if (!lite()) for (var x = -80; x < G.w + 260; x += 105 + Math.random() * 70)
      G.hills.push({ x: x, h: (18 + Math.random() * 34) * G.s, w: (90 + Math.random() * 90) * G.s });

    if (G.player) {
      G.player.x = Math.round(G.w * 0.14);
      G.player.w = 26 * G.s;
      G.player.h = (G.player.duck && G.player.onGround ? 24 : 38) * G.s;
      if (G.player.onGround) G.player.y = G.ground - G.player.h;
    }
  }

  /* ---------------------------- actions ---------------------------- */
  function jump() {
    if (!G) return;
    if (G.state === "ready") { G.state = "run"; return; }
    if (G.state === "paused") { G.state = "run"; G.last = performance.now(); return; }
    if (G.state === "over") { reset(); G.state = "run"; return; }
    var p = G.player;
    if (p.onGround) {
      p.vy = JUMP * G.s; p.onGround = false; p.duck = false;
      for (var i = 0; i < (lite() ? 0 : 6); i++) puff(p.x + p.w / 2, G.ground);
    }
  }
  function release() { if (G && G.player && G.player.vy < -5.5 * G.s) G.player.vy = -5.5 * G.s; }
  function duck(on) {
    if (!G || !G.player) return;
    if (on && (G.state === "over" || G.state === "ready")) { jump(); return; }  // tape n'importe où pour (re)lancer
    G.player.duck = !!on;
  }
  function puff(x, y) {
    G.parts.push({ x: x + (Math.random() - .5) * 10, y: y - Math.random() * 4,
      vx: -(Math.random() * 1.6 + .4), vy: -(Math.random() * 1.2), r: Math.random() * 3 + 1.5, life: 1 });
  }

  /* ---------------------------- boucle ----------------------------- */
  function frame(now) {
    if (!G) return;
    G.raf = requestAnimationFrame(frame);
    var dt = (now - G.last) / 16.667;
    G.last = now;
    if (!isFinite(dt) || dt <= 0) dt = 1;
    if (dt > 3) dt = 3;                       // onglet revenu au premier plan
    if (G.state === "run") update(dt);
    G.blink += dt;
    draw();
  }

  function update(dt) {
    var p = G.player;

    G.dist  += G.speed * dt;
    G.score  = Math.floor(G.dist / (20 * G.s));        // ~15 points/seconde au départ
    G.speed  = Math.min(13.5, 5.2 + G.score / 350) * G.s;
    G.night  = Math.floor(G.score / 700) % 2 === 1;    // bascule jour/nuit, clin d'œil au dino
    els.score.textContent = G.score;

    // Physique du héros
    p.vy += GRAVITY * G.s * dt;
    p.y  += p.vy * dt;
    p.h = (p.duck && p.onGround ? 24 : 38) * G.s;
    if (p.y >= G.ground - p.h) { p.y = G.ground - p.h; p.vy = 0; p.onGround = true; }

    // Obstacles
    G.spawnIn -= dt;
    if (G.spawnIn <= 0) {
      spawn();
      var gap = 62 + Math.random() * 55 - (G.speed / G.s) * 2.6;
      G.spawnIn = Math.max(30, gap);
    }
    for (var i = G.obs.length - 1; i >= 0; i--) {
      var o = G.obs[i];
      o.x -= G.speed * dt;
      if (o.flap !== undefined) o.flap += dt * .25;
      if (o.x + o.w < -20) { G.obs.splice(i, 1); continue; }
      if (hit(p, o)) { over(); return; }
    }

    // Poussière
    for (var j = G.parts.length - 1; j >= 0; j--) {
      var q = G.parts[j];
      q.x += (q.vx - G.speed * .35) * dt; q.y += q.vy * dt; q.life -= .04 * dt;
      if (q.life <= 0) G.parts.splice(j, 1);
    }
  }

  function spawn() {
    var x = G.w + 20, s = G.s;
    // Corbeaux à partir d'un certain score : il faut se baisser (ou sauter tôt)
    if (G.score > 150 && Math.random() < .32) {
      var high = Math.random() < .5;
      G.obs.push({ type: "crow", x: x, y: G.ground - (high ? 62 : 42) * s, w: 30 * s, h: 20 * s, flap: 0 });
      return;
    }
    var n = 1 + Math.floor(Math.random() * (G.score > 350 ? 3 : 2));   // 1 à 3 tomes
    var hgt = (24 + Math.round(Math.random() * 10)) * s;
    G.obs.push({ type: "tome", x: x, y: G.ground - hgt, w: n * 15 * s, h: hgt, n: n });
  }

  function hit(p, o) {
    var i = 4 * G.s;                                   // tolérance : boîtes un peu plus petites que le dessin
    var px = p.x + i, py = p.y + i, pw = p.w - i * 2, ph = p.h - i * 1.6;
    var ox = o.x + i * .7, oy = o.y + i * .7, ow = o.w - i * 1.4, oh = o.h - i * 1.4;
    return px < ox + ow && px + pw > ox && py < oy + oh && py + ph > oy;
  }

  function over() {
    G.state = "over";
    put(PLAYS_KEY, num(PLAYS_KEY) + 1);
    if (G.score > G.best) { G.best = G.score; put(BEST_KEY, G.best); els.best.textContent = G.best; }
  }

  /* ---------------------------- rendu ------------------------------ */
  function draw() {
    var w = G.w, h = G.h, night = G.night;
    var sky = ctx.createLinearGradient(0, 0, 0, h);
    if (night) { sky.addColorStop(0, "#07060f"); sky.addColorStop(1, "#140d24"); }
    else { sky.addColorStop(0, "#0d0c1c"); sky.addColorStop(1, "#1c1533"); }
    ctx.fillStyle = sky; ctx.fillRect(0, 0, w, h);

    // Étoiles / lune
    if (G.stars.length) {
      ctx.save();
      for (var i = 0; i < G.stars.length; i++) {
        var s = G.stars[i];
        s.x -= G.speed * .06;
        if (s.x < -2) { s.x = w + 2; s.y = Math.random() * (G.ground - 30); }
        ctx.globalAlpha = s.a * (night ? 1 : .55);
        ctx.fillStyle = "#e9e6ff";
        ctx.beginPath(); ctx.arc(s.x, s.y, s.r, 0, 6.284); ctx.fill();
      }
      ctx.restore();
    }
    if (night && !lite()) {
      ctx.save();
      ctx.globalAlpha = .85; ctx.fillStyle = "#f3e8ff";
      ctx.beginPath(); ctx.arc(w - 52, 42, 15, 0, 6.284); ctx.fill();
      ctx.globalCompositeOperation = "destination-out";
      ctx.beginPath(); ctx.arc(w - 45, 36, 13, 0, 6.284); ctx.fill();
      ctx.restore();
    }

    // Collines / toits en parallaxe
    if (G.hills.length) {
      ctx.fillStyle = night ? "rgba(88,52,150,.22)" : "rgba(99,102,241,.15)";
      for (var k = 0; k < G.hills.length; k++) {
        var hl = G.hills[k];
        hl.x -= G.speed * .18;
        if (hl.x + hl.w < -10) { hl.x += G.w + 340; hl.h = (18 + Math.random() * 34) * G.s; }
        ctx.beginPath();
        ctx.moveTo(hl.x, G.ground);
        ctx.lineTo(hl.x + hl.w / 2, G.ground - hl.h);
        ctx.lineTo(hl.x + hl.w, G.ground);
        ctx.closePath(); ctx.fill();
      }
    }

    // Sol
    ctx.strokeStyle = night ? "rgba(217,70,239,.65)" : "rgba(168,85,247,.65)";
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(0, G.ground + 1); ctx.lineTo(w, G.ground + 1); ctx.stroke();
    ctx.strokeStyle = "rgba(255,255,255,.16)";
    ctx.lineWidth = 2;
    ctx.setLineDash([14, 22]);
    ctx.lineDashOffset = -(G.dist % 36);
    ctx.beginPath(); ctx.moveTo(0, G.ground + 9); ctx.lineTo(w, G.ground + 9); ctx.stroke();
    ctx.setLineDash([]);

    // Poussière
    for (var d = 0; d < G.parts.length; d++) {
      var q = G.parts[d];
      ctx.globalAlpha = Math.max(0, q.life) * .5;
      ctx.fillStyle = "#cbb8ff";
      ctx.beginPath(); ctx.arc(q.x, q.y, q.r, 0, 6.284); ctx.fill();
    }
    ctx.globalAlpha = 1;

    for (var o = 0; o < G.obs.length; o++)
      G.obs[o].type === "crow" ? drawCrow(G.obs[o]) : drawTomes(G.obs[o]);

    drawOni(G.player);

    if (G.state !== "run") drawMessage();
  }

  function rr(x, y, w, h, r) {
    r = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  /* Le héros : petit Oni (corne + kimono), clin d'œil à Tougen Anki. */
  function drawOni(p) {
    var x = p.x, y = p.y, w = p.w, h = p.h;
    var run = G.state === "run" && p.onGround;
    var phase = Math.sin(G.dist * .35);

    ctx.save();
    // Ombre au sol
    ctx.globalAlpha = .35; ctx.fillStyle = "#000";
    ctx.beginPath(); ctx.ellipse(x + w / 2, G.ground + 3, w * .48, 3.5, 0, 0, 6.284); ctx.fill();
    ctx.globalAlpha = 1;

    // Jambes
    ctx.fillStyle = "#4c1d95";
    var lw = w * .23, lh = h * .22, legY = y + h - lh, swing = run ? phase * lh * .38 : 0;
    rr(x + w * .15, legY, lw, lh + swing, lw / 2); ctx.fill();
    rr(x + w - w * .15 - lw, legY, lw, lh - swing, lw / 2); ctx.fill();

    // Corps (kimono)
    var g = ctx.createLinearGradient(x, y, x + w, y + h);
    g.addColorStop(0, "#6366f1"); g.addColorStop(.55, "#a855f7"); g.addColorStop(1, "#d946ef");
    ctx.fillStyle = g;
    rr(x + w * .07, y + h * .38, w * .86, h * .55, w * .26); ctx.fill();

    // Tête
    var hx = x + w / 2, hy = y + h * .28;
    ctx.fillStyle = "#f6e7ff";
    ctx.beginPath(); ctx.arc(hx, hy, w * .38, 0, 6.284); ctx.fill();

    // Cornes
    ctx.fillStyle = "#ffd166";
    ctx.beginPath();
    ctx.moveTo(hx - w * .30, hy - w * .22); ctx.lineTo(hx - w * .16, hy - w * .58); ctx.lineTo(hx - w * .06, hy - w * .20);
    ctx.closePath(); ctx.fill();
    ctx.beginPath();
    ctx.moveTo(hx + w * .30, hy - w * .22); ctx.lineTo(hx + w * .16, hy - w * .58); ctx.lineTo(hx + w * .06, hy - w * .20);
    ctx.closePath(); ctx.fill();

    // Yeux (clignement discret) + écharpe
    var blink = (G.blink % 190) < 6, eye = w * .08, ex = w * .19;
    ctx.fillStyle = "#1b1030";
    if (blink) {
      ctx.fillRect(hx - ex - eye, hy - eye * .3, eye * 2, eye * .6);
      ctx.fillRect(hx + ex - eye, hy - eye * .3, eye * 2, eye * .6);
    } else {
      ctx.beginPath(); ctx.arc(hx - ex, hy, eye, 0, 6.284); ctx.fill();
      ctx.beginPath(); ctx.arc(hx + ex, hy, eye, 0, 6.284); ctx.fill();
    }
    // Écharpe rouge (elle flotte quand il court)
    ctx.fillStyle = "#ef4444";
    rr(x + w * .04, y + h * .36, w * .92, h * .1, h * .05); ctx.fill();
    if (!lite()) {
      ctx.fillStyle = "rgba(239,68,68,.85)";
      var tail = (run ? 8 + phase * 4 : 6) * (w / 26);
      rr(x - tail, y + h * .37, tail, h * .09, h * .045); ctx.fill();
    }
    ctx.restore();
  }

  /* Obstacle : pile de tomes (les scans qu'on n'a pas encore lus…) */
  function drawTomes(o) {
    var colors = ["#a855f7", "#6366f1", "#d946ef", "#22d3ee"];
    for (var i = 0; i < o.n; i++) {
      var x = o.x + i * (o.w / o.n), w = o.w / o.n - 2;
      ctx.fillStyle = colors[(i + o.n) % colors.length];
      rr(x, o.y, w, o.h, 2); ctx.fill();
      ctx.fillStyle = "rgba(255,255,255,.55)";
      ctx.fillRect(x + 2, o.y + 4, w - 4, 1.5);
      ctx.fillRect(x + 2, o.y + o.h - 6, w - 4, 1.5);
    }
  }

  /* Obstacle volant : corbeau (il faut se baisser) */
  function drawCrow(o) {
    var up = Math.sin(o.flap * 6) > 0;
    var cx = o.x + o.w * .5, cy = o.y + o.h * .55, tip = o.h * .75;
    // Ailes d'abord (elles passent derrière le corps)
    ctx.fillStyle = "#e879f9";
    ctx.beginPath();
    ctx.moveTo(o.x + o.w * .12, cy);
    ctx.lineTo(cx, up ? o.y - tip : o.y + o.h + tip);
    ctx.lineTo(o.x + o.w * .88, cy);
    ctx.closePath(); ctx.fill();
    // Corps
    ctx.fillStyle = "#2a1b45";
    ctx.strokeStyle = "#f0abfc";
    ctx.lineWidth = Math.max(1.5, 2 * G.s);
    ctx.beginPath();
    ctx.ellipse(cx, cy, o.w * .38, o.h * .34, 0, 0, 6.284);
    ctx.fill(); ctx.stroke();
    // Bec + œil
    ctx.fillStyle = "#fbbf24";
    ctx.beginPath();
    ctx.moveTo(o.x, cy - o.h * .06);
    ctx.lineTo(o.x - o.w * .16, cy + o.h * .04);
    ctx.lineTo(o.x, cy + o.h * .16);
    ctx.closePath(); ctx.fill();
    ctx.fillStyle = "#fff";
    ctx.beginPath(); ctx.arc(o.x + o.w * .22, cy - o.h * .08, Math.max(1.4, 2 * G.s), 0, 6.284); ctx.fill();
  }

  /* Messages d'état (prêt / perdu / pause) dessinés au centre */
  function drawMessage() {
    var w = G.w, h = G.h, title, sub;
    if (G.state === "ready") { title = "Prêt ?"; sub = "Espace, ↑ ou tape l'écran pour lancer"; }
    else if (G.state === "paused") { title = "Pause"; sub = "Appuie sur Espace pour reprendre"; }
    else { title = "Perdu — " + G.score + " pts"; sub = (G.score >= G.best && G.score > 0 ? "Nouveau record ! " : "") + "Espace ou tape l'écran pour rejouer"; }

    ctx.save();
    ctx.fillStyle = "rgba(7,7,14,.55)";
    ctx.fillRect(0, 0, w, h);
    ctx.textAlign = "center";
    ctx.fillStyle = "#ecebff";
    ctx.font = "700 22px Sora, system-ui, sans-serif";
    ctx.fillText(title, w / 2, h / 2 - 4);
    ctx.fillStyle = "#b9b8d6";
    ctx.font = "500 13px Inter, system-ui, sans-serif";
    ctx.fillText(sub, w / 2, h / 2 + 20);
    ctx.restore();
  }

  /* ====================================================================== */
  /*  Branchements                                                           */
  /* ====================================================================== */

  // Onglet caché ou fenêtre en arrière-plan : on met la partie en pause.
  document.addEventListener("visibilitychange", function () {
    if (document.hidden && G && G.state === "run") G.state = "paused";
  });
  window.addEventListener("blur", function () { if (G && G.state === "run") G.state = "paused"; });

  window.addEventListener("offline", function () {
    dropped = true;
    showBar("offline");
    if (wrap && !wrap.hidden) els.net.hidden = true;
  });
  window.addEventListener("online", function () {
    if (!dropped) return;                              // rien n'était tombé : pas de message
    showBar("online");
    // La partie en cours n'est PAS coupée : on propose juste de reprendre.
    if (wrap && !wrap.hidden) els.net.hidden = false;
  });

  function boot() {
    if (isOffline()) { dropped = true; showBar("offline"); }
    // page.html?jeu=1 (ou ?game=1) ouvre le jeu directement — utilisé par
    // offline.html et par le lien « jouer » de la page 404.
    var qs = location.search;
    if (/[?&](jeu|game)=1/.test(qs)) open();
    document.addEventListener("click", function (e) {
      var t = e.target.closest("[data-play-offline]");
      if (t) { e.preventDefault(); open(); }
    });
  }

  window.LToffline = {
    open: function () { open(); },
    close: close,
    isOffline: isOffline,
    notify: function (off) { showBar(off === false ? "online" : "offline"); },
    best: function () { return num(BEST_KEY); }
  };

  // Voir js/core.js : avec des scripts en `defer`, readyState vaut déjà
  // "interactive" ici. Seul "complete" prouve que DOMContentLoaded est passé.
  if (document.readyState === "complete") boot();
  else document.addEventListener("DOMContentLoaded", boot);
})();
