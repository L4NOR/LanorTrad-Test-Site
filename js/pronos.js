/* =========================================================================
   LanorTrad — Pronostics de chapitre.

   La team pose une question sur un chapitre à venir, les membres votent, et
   à la sortie chaque bon pronostic rapporte +30 XP. BASE : supabase/pronostics.sql.

   Deux surfaces :
     • page Classement : tous les pronostics + les outils de la team
       (créer, clore, donner la réponse, supprimer) pour un compte admin/modo ;
     • écran de fin du lecteur : ceux de la série qu'on vient de lire.

   Les totaux ne s'affichent qu'après son propre vote (ou une fois les votes
   clos) : voir la majorité avant de choisir, c'est voter comme elle.

   Lecture sans compte : l'API REST en fetch, comme js/pulse.js (pas besoin
   de supabase-js). Voter demande un compte (même compte que le forum).
   Sans le SQL déployé, rien ne s'affiche.

   API : window.LTpronos.mount(element, { manga?, staffTools? })
   ========================================================================= */
(function () {
  "use strict";

  const esc = s => String(s == null ? "" : s)
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
  const XP = 30;

  function cfg() {
    const C = window.LT_SUPABASE || {};
    return (C.url && C.anonKey && !/VOTRE_|YOUR_/i.test(C.url + C.anonKey)) ? C : null;
  }
  const client = () => (window.LTsb && window.LTsb()) || null;

  async function rpc(name, args) {
    const c = client();
    if (c) {
      const { data, error } = await c.rpc(name, args || {});
      if (error) throw error;
      return data;
    }
    const C = cfg();
    if (!C) throw new Error("supabase absent");
    const r = await fetch(`${C.url}/rest/v1/rpc/${name}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", apikey: C.anonKey, Authorization: "Bearer " + C.anonKey },
      body: JSON.stringify(args || {}),
    });
    if (!r.ok) throw new Error("HTTP " + r.status);
    return r.json();
  }

  async function connecte() {
    const c = client();
    if (!c) return false;
    try { return !!(await c.auth.getSession()).data.session; } catch { return false; }
  }

  const titre = id => { const s = window.LT.seriesById(id); return s ? s.title : id; };
  const quand = iso => new Date(iso).toLocaleString("fr-FR", { weekday: "long", day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" }).replace(":", " h ");

  /* ------------------------------------------------------------ Une carte */
  /* La question porte sur les tout derniers chapitres : pour qui n'est pas à
     jour, elle peut déjà en dire trop (« Qui remporte le combat contre X ? »).
     On la floute tant que la progression locale est en retard d'au moins un
     chapitre sur celui que le pronostic précède. */
  function enRetard(p) {
    const prog = window.LTstore && window.LTstore.progress(p.manga);
    const lu = prog ? parseFloat(prog.chapter) : 0;
    return !(lu >= parseFloat(p.chapter) - 1);
  }

  function carte(p, staff) {
    const n = p.options.length;
    const masque = !staff && p.status === "open" && p.mine == null && enRetard(p);
    const total = Number(p.total) || 0;
    const voir = p.mine != null || p.status !== "open";          // totaux visibles ?
    const etat = p.status === "resolved" ? `<span class="pr-etat ok">Réponse donnée</span>`
               : p.status === "closed"   ? `<span class="pr-etat">Votes clos</span>`
               : `<span class="pr-etat on">Ouvert</span>`;
    const opts = p.options.map((o, i) => {
      const k = i + 1, c = Number((p.counts || {})[k]) || 0;
      const pc = total ? Math.round(c * 100 / total) : 0;
      const cls = [
        "pr-opt",
        p.mine === k ? "mine" : "",
        p.answer === k ? "good" : "",
        p.answer != null && p.mine === k && p.answer !== k ? "bad" : "",
      ].filter(Boolean).join(" ");
      return `<button type="button" class="${cls}" data-vote="${k}" ${p.status === "open" ? "" : "disabled"}>
        ${voir ? `<i class="pr-bar" style="width:${pc}%"></i>` : ""}
        <span class="pr-txt">${esc(o)}</span>
        ${voir ? `<span class="pr-pc">${pc} %</span>` : ""}
      </button>`;
    }).join("");

    let pied = `${total} pronostic${total > 1 ? "s" : ""}`;
    if (p.status === "open" && p.closes_at) pied += ` · votes ouverts jusqu'à ${esc(quand(p.closes_at))}`;
    if (p.status === "open" && p.mine == null) pied += " · les résultats s'affichent après ton vote";
    if (p.status === "open" && p.mine != null) pied += " · tu peux changer d'avis tant que c'est ouvert";
    let verdict = "";
    if (p.status === "resolved" && p.mine != null)
      verdict = p.mine === p.answer ? `<div class="pr-verdict ok">🎯 Bien vu ! +${XP} XP</div>`
                                    : `<div class="pr-verdict">Raté cette fois. La prochaine sera la bonne.</div>`;

    const outils = staff ? `<div class="pr-staff">
        ${p.status === "open" ? `<button type="button" class="pr-link" data-act="close">Clore les votes</button>` : ""}
        ${p.status !== "resolved" ? `<label>Bonne réponse <select data-act="answer-pick">
            <option value="">—</option>${p.options.map((o, i) => `<option value="${i + 1}">${esc(o)}</option>`).join("")}
          </select></label><button type="button" class="btn btn-primary btn-sm" data-act="resolve">Valider</button>
          <button type="button" class="pr-link pr-del" data-act="delete">Supprimer</button>` : ""}
      </div>` : "";

    return `<article class="pr-card${masque ? " masque" : ""}" data-id="${p.id}" style="--accent:${esc((window.LT.seriesById(p.manga) || {}).accent || "#a855f7")}">
      <div class="pr-head"><a class="pr-serie" href="${window.LT.urlSeries(p.manga)}">${esc(titre(p.manga))} · ch. ${esc(p.chapter)}</a>${etat}</div>
      ${masque ? `<button type="button" class="pr-lever" data-act="lever">Tu n'es pas à jour sur ${esc(titre(p.manga))} : la question peut spoiler. <u>Afficher quand même</u></button>` : ""}
      <h3 class="pr-q">${esc(p.question)}</h3>
      <div class="pr-opts" style="--n:${n}">${opts}</div>
      ${verdict}
      <div class="pr-foot">${pied}</div>
      ${outils}
    </article>`;
  }

  /* -------------------------------------------------- Formulaire de la team */
  function formulaire() {
    const series = (window.SERIES || []).filter(s => s.type !== "oneshot" && ((window.CHAPTERS || {})[s.id] || []).length);
    const suivant = s => { const L = (window.CHAPTERS || {})[s.id] || []; const d = L.length ? Math.floor(parseFloat(L[0].num)) + 1 : 1; return String(d); };
    return `<details class="pr-new">
      <summary>➕ Poser un pronostic</summary>
      <form id="pr-form">
        <div class="pr-row">
          <label>Série <select name="manga">${series.map(s => `<option value="${esc(s.id)}" data-next="${suivant(s)}">${esc(s.title)}</option>`).join("")}</select></label>
          <label>Chapitre qui tranchera <input name="chapter" required maxlength="12" value="${series[0] ? suivant(series[0]) : ""}"></label>
        </div>
        <label>Question <input name="question" required minlength="5" maxlength="200" placeholder="Qui remporte le combat ?"></label>
        <div class="pr-row">
          <label>Réponse 1 <input name="o1" required maxlength="80"></label>
          <label>Réponse 2 <input name="o2" required maxlength="80"></label>
        </div>
        <div class="pr-row">
          <label>Réponse 3 <input name="o3" maxlength="80" placeholder="facultatif"></label>
          <label>Réponse 4 <input name="o4" maxlength="80" placeholder="facultatif"></label>
        </div>
        <label>Fin des votes <input name="closes" type="datetime-local"> <small>facultatif : sinon, c'est toi qui clos</small></label>
        <button class="btn btn-primary btn-sm" type="submit">Publier le pronostic</button>
      </form>
    </details>`;
  }

  /* ------------------------------------------------------------ Montage */
  async function mount(box, opts) {
    if (!box || !cfg()) return;
    const o = opts || {};
    let data;
    try { data = await rpc("predictions_list", { p_manga: o.manga || null }); } catch { box.innerHTML = ""; return; }
    if (!data || !data.ok) { box.innerHTML = ""; return; }
    const staff = !!(data.staff && o.staffTools);
    const items = data.items || [];
    // Dans le lecteur : ceux encore en jeu, et les tranchés où l'on avait
    // voté (pour voir si on avait raison). Les autres n'y ont rien à faire.
    const liste = o.manga ? items.filter(p => p.status !== "resolved" || p.mine != null) : items;
    if (!liste.length && !staff) { box.innerHTML = ""; return; }

    box.innerHTML = `<section class="pr" aria-labelledby="pr-t-${o.manga ? "l" : "c"}">
      <div class="pr-title"><h2 id="pr-t-${o.manga ? "l" : "c"}">${o.manga ? "Et au prochain chapitre ?" : "Pronostics"}</h2>
        <span class="pr-note">+${XP} XP par bon pronostic</span></div>
      ${staff ? formulaire() : ""}
      ${liste.length ? `<div class="pr-list">${liste.map(p => carte(p, staff)).join("")}</div>`
                     : `<p class="pr-vide">Aucun pronostic en cours. Pose le premier !</p>`}
    </section>`;
    brancher(box, o, liste);
  }

  function brancher(box, o, liste) {
    const refaire = () => mount(box, o);
    const form = box.querySelector("#pr-form");
    if (form) {
      const sel = form.querySelector("[name=manga]");
      sel.addEventListener("change", () => { form.chapter.value = sel.selectedOptions[0].dataset.next || ""; });
      form.addEventListener("submit", async e => {
        e.preventDefault();
        const f = e.target;
        f.querySelector("button[type=submit]").disabled = true;
        const closes = f.closes.value ? new Date(f.closes.value).toISOString() : null;
        let r;
        try {
          r = await rpc("create_prediction", {
            p_manga: f.manga.value, p_chapter: f.chapter.value.trim(), p_question: f.question.value.trim(),
            p_options: [f.o1.value, f.o2.value, f.o3.value, f.o4.value], p_closes_at: closes,
          });
        } catch { r = null; }
        if (!r || !r.ok) { window.LT.toast("Le pronostic n'a pas pu être publié."); f.querySelector("button[type=submit]").disabled = false; return; }
        window.LT.toast("🔮 Pronostic publié");
        refaire();
      });
    }

    // Un seul écouteur, posé par affectation : un nouveau montage le
    // remplace au lieu de l'empiler (sinon chaque clic voterait deux fois).
    box.onclick = async e => {
      const card = e.target.closest(".pr-card");
      if (!card) return;
      const id = Number(card.dataset.id);
      const v = e.target.closest("[data-vote]");
      if (v && !v.disabled && !card.classList.contains("masque")) {
        if (!(await connecte())) { window.LT.toast("Connecte-toi sur le forum pour voter (même compte)."); return; }
        let r;
        try { r = await rpc("vote_prediction", { p_id: id, p_choice: Number(v.dataset.vote) }); } catch { r = null; }
        if (!r || !r.ok) { window.LT.toast(r && r.error === "closed" ? "Les votes sont clos." : "Ton vote n'est pas passé, réessaie."); return; }
        const p = liste.find(x => x.id === id);
        Object.assign(p, r.item);
        // On ne reconstruit que la carte : pas de saut de page sous le doigt.
        const tmp = document.createElement("div");
        tmp.innerHTML = carte(p, !!card.querySelector(".pr-staff")).trim();
        card.replaceWith(tmp.firstChild);
        window.LT.toast("🔮 Pronostic enregistré");
        return;
      }
      const act = e.target.closest("[data-act]");
      if (!act || act.tagName === "SELECT") return;
      if (act.dataset.act === "lever") { card.classList.remove("masque"); act.remove(); return; }
      if (act.dataset.act === "close") {
        if (!confirm("Clore les votes de ce pronostic ?")) return;
        await rpc("close_prediction", { p_id: id }).catch(() => null);
        refaire();
      } else if (act.dataset.act === "resolve") {
        const pick = card.querySelector("[data-act=answer-pick]");
        const k = Number(pick && pick.value);
        if (!k) { window.LT.toast("Choisis d'abord la bonne réponse."); return; }
        if (!confirm(`Valider « ${pick.selectedOptions[0].textContent} » comme bonne réponse ? Les bons pronostics gagnent ${XP} XP, et ce n'est plus modifiable.`)) return;
        let r;
        try { r = await rpc("resolve_prediction", { p_id: id, p_answer: k }); } catch { r = null; }
        if (!r || !r.ok) { window.LT.toast("La réponse n'a pas pu être enregistrée."); return; }
        window.LT.toast(`🎯 Réponse enregistrée · ${r.winners} bon${r.winners > 1 ? "s" : ""} pronostic${r.winners > 1 ? "s" : ""}`);
        refaire();
      } else if (act.dataset.act === "delete") {
        if (!confirm("Supprimer ce pronostic et ses votes ?")) return;
        await rpc("delete_prediction", { p_id: id }).catch(() => null);
        refaire();
      }
    };
  }

  window.LTpronos = { mount };
})();
