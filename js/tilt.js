/* =========================================================================
   LanorTrad — Tilt 3D des cartes (parallaxe souris + reflet lumineux)
   ========================================================================= */
(function () {
  "use strict";
  const MAX = 12;               // degrés max
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (reduce) return;

  function attach(card) {
    const inner = card.querySelector(".inner");
    const shine = card.querySelector(".shine");
    if (!inner || card.dataset.tilt === "on") return;
    card.dataset.tilt = "on";

    let raf = null, tx = 0, ty = 0;
    function move(e) {
      const r = card.getBoundingClientRect();
      const px = (e.clientX - r.left) / r.width;
      const py = (e.clientY - r.top) / r.height;
      tx = (py - .5) * -2 * MAX;
      ty = (px - .5) *  2 * MAX;
      if (shine) { shine.style.setProperty("--mx", `${px * 100}%`); shine.style.setProperty("--my", `${py * 100}%`); }
      if (!raf) raf = requestAnimationFrame(apply);
    }
    function apply() {
      raf = null;
      inner.style.transform = `rotateX(${tx}deg) rotateY(${ty}deg) translateY(-6px)`;
    }
    function leave() {
      if (raf) cancelAnimationFrame(raf), raf = null;
      inner.style.transform = "";
    }
    card.addEventListener("pointermove", move);
    card.addEventListener("pointerleave", leave);
  }

  function scan() { document.querySelectorAll(".m-card").forEach(attach); }
  document.addEventListener("lt:ready", scan);
  document.addEventListener("lt:cards", scan);
  window.LTtiltScan = scan;
})();
