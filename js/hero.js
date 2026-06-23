/* =========================================================================
   LanorTrad — Héros 3D : pile de couvertures qui tourne + parallaxe souris
   ========================================================================= */
(function () {
  "use strict";

  function init() {
    const stage = document.querySelector(".hero-3d");
    const deck = document.querySelector(".deck");
    const dotsWrap = document.querySelector(".hero-dots");
    if (!stage || !deck || !window.SERIES) return;

    const items = window.SERIES.filter(s => s.featured);
    if (!items.length) return;

    // Cartes
    deck.innerHTML = "";
    items.forEach((s, i) => {
      const card = document.createElement("div");
      card.className = "deck-card";
      card.dataset.i = i;
      card.innerHTML = `
        <img src="${s.cover}" alt="${s.title}" loading="${i < 2 ? "eager" : "lazy"}">
        <span class="reflect"></span>
        <div class="glass-label"><h3>${s.title}</h3><p>${s.genres.slice(0,3).join(" · ")}</p></div>`;
      deck.appendChild(card);
    });
    const glow = document.createElement("div");
    glow.className = "deck-glow";
    stage.appendChild(glow);

    // Dots
    if (dotsWrap) {
      dotsWrap.innerHTML = items.map((_, i) => `<button data-i="${i}" aria-label="Série ${i+1}"></button>`).join("");
      dotsWrap.querySelectorAll("button").forEach(b =>
        b.addEventListener("click", () => setActive(+b.dataset.i, true)));
    }

    const cards = [...deck.children];
    let active = 0, timer = null, visible = true;

    function setActive(idx, manual) {
      active = (idx + items.length) % items.length;
      cards.forEach((c, i) => {
        let pos = (i - active + items.length) % items.length;
        c.classList.remove("front", "mid", "back", "hidden");
        c.classList.add(pos === 0 ? "front" : pos === 1 ? "mid" : pos === 2 ? "back" : "hidden");
      });
      if (dotsWrap) dotsWrap.querySelectorAll("button").forEach((b, i) => b.classList.toggle("on", i === active));
      const s = items[active];
      glow.style.background = `radial-gradient(circle, ${s.accent}, transparent 70%)`;
      updateCopy(s);
      if (manual) restart();
    }

    function updateCopy(s) {
      const t = document.getElementById("h-title");
      const d = document.getElementById("h-desc");
      const c = document.getElementById("h-chips");
      const read = document.getElementById("h-read");
      const more = document.getElementById("h-more");
      if (t) { t.classList.remove("swap"); void t.offsetWidth; t.textContent = s.title; t.classList.add("swap"); }
      if (d) d.textContent = s.description;
      if (c) c.innerHTML = s.genres.map(g => `<span class="hero-chip">${g}</span>`).join("");
      if (more) more.href = s.url;
      if (read) {
        if (window.LT.playable(s)) { read.href = `reader.html?manga=${encodeURIComponent(s.id)}`; read.querySelector("span").textContent = "Lire maintenant"; }
        else { read.href = s.url; read.querySelector("span").textContent = "Voir l'œuvre"; }
      }
    }

    function next() { setActive(active + 1); }
    function restart() { clearInterval(timer); if (visible) timer = setInterval(next, 5200); }

    // Le carrousel ne tourne (et ne consomme CPU/batterie) que lorsque le héros est visible.
    if ("IntersectionObserver" in window) {
      new IntersectionObserver(entries => {
        visible = entries[0].isIntersecting;
        if (visible) restart(); else clearInterval(timer);
      }, { threshold: 0.15 }).observe(stage);
    }

    // Écriture du transform coalescée en rAF : plusieurs événements
    // (pointermove ~60/s, deviceorientation ~60/s) = une seule écriture par frame.
    let tiltRAF = 0, pendingTilt = "";
    function tilt(t) {
      pendingTilt = t;
      if (tiltRAF) return;
      tiltRAF = requestAnimationFrame(() => { tiltRAF = 0; deck.style.transform = pendingTilt; });
    }

    // Parallaxe souris sur la scène
    if (!matchMedia("(prefers-reduced-motion: reduce)").matches) {
      stage.addEventListener("pointermove", e => {
        const r = stage.getBoundingClientRect();
        const px = (e.clientX - r.left) / r.width - .5;
        const py = (e.clientY - r.top) / r.height - .5;
        tilt(`rotateY(${px * 18}deg) rotateX(${py * -14}deg)`);
      });
      stage.addEventListener("pointerleave", () => { tilt(""); });

      // Gyroscope (mobile) : la pile réagit à l'inclinaison
      if (window.DeviceOrientationEvent) {
        const applyGyro = e => {
          if (e.gamma == null) return;
          const x = Math.max(-1, Math.min(1, e.gamma / 35));
          const y = Math.max(-1, Math.min(1, ((e.beta || 0) - 45) / 35));
          tilt(`rotateY(${x * 16}deg) rotateX(${y * -12}deg)`);
        };
        if (typeof DeviceOrientationEvent.requestPermission === "function") {
          addEventListener("touchend", function ask() {
            DeviceOrientationEvent.requestPermission().then(p => { if (p === "granted") addEventListener("deviceorientation", applyGyro); }).catch(() => {});
          }, { once: true });
        } else {
          addEventListener("deviceorientation", applyGyro);
        }
      }
    }
    deck.addEventListener("pointerenter", () => clearInterval(timer));
    deck.addEventListener("pointerleave", restart);

    setActive(0);
    restart();
  }

  document.addEventListener("lt:ready", init);
})();
