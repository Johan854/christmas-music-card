{ // bloc isolé : aucune variable ne fuit vers les autres cartes
/*
 * Christmas Music Card (FR)
 * Carte Home Assistant « musique de Noël » : interrupteur de lecture avec disque vinyle qui tourne et égaliseur animé,
 * coupure du son, volume (curseur) et réveil de Noël (automatisation). Style verre, thème clair/sombre automatique,
 * éditeur visuel, textes en français.
 */
const CARD_VERSION = "1.0.0";

/* === NUANCE COMMUNE v2 (cartes Johan854) ===
 * Bloc identique dans toutes les cartes. Options : nuance, nuance_perso, intensite.
 * nuance "theme" (par défaut) : suit la variable carte-nuance du thème Home Assistant ;
 * si elle n'existe pas, la carte garde ses couleurs d'origine. Intensité : 0 = neutre, 1 = normal, 2 = très coloré. */
const GV_NUANCES = [["braise", "Braise (rouge)", "#e0524f"], ["ocean", "Océan (bleu)", "#2f8fd8"], ["lagon", "Lagon (turquoise)", "#1fb5a8"], ["foret", "Forêt (vert)", "#3fae5a"], ["lavande", "Lavande (violet)", "#8a63d8"], ["framboise", "Framboise (rose)", "#e05597"], ["ambre", "Ambre (orange)", "#e8902c"], ["ardoise", "Ardoise (neutre)", "#7d8595"]];
const GV_DEFAULTS = { nuance: "theme", intensite: 1 };
const gvAccent = (c) => {
  const p = c && c.nuance_perso;
  if (c && c.nuance === "perso") {
    if (Array.isArray(p) && p.length === 3) return "#" + p.map((v) => Math.max(0, Math.min(255, Math.round(+v || 0))).toString(16).padStart(2, "0")).join("");
    if (typeof p === "string" && /^#?[0-9a-f]{6}$/i.test(p.trim())) return "#" + p.trim().replace("#", "");
  }
  const n = GV_NUANCES.find((x) => x[0] === (c && c.nuance));
  return n ? n[2] : "var(--carte-nuance)";
};
/* Variables posées sur <ha-card> : --g-bg-x (fond dégradé teinté) et --acc-ui-x (couleur d'accent).
 * Sans nuance (thème sans carte-nuance), elles sont invalides : chaque carte retombe alors sur ses couleurs d'origine. */
const gvStyle = (c, dark) => {
  const i = Number(c && c.intensite), ai = Number.isFinite(i) ? Math.max(0, Math.min(2, i)) : 1;
  const m = (pct, base) => `color-mix(in srgb,var(--acc-ui) ${+(pct * ai).toFixed(1)}%,${base})`;
  const bg = dark ? `linear-gradient(160deg,${m(5, "#1b1e32")} 0%,${m(11, "#1f1b2c")} 55%,${m(22, "#1c1620")} 100%)`
    : `linear-gradient(160deg,${m(2, "#f8f9fd")} 0%,${m(5, "#eef1f8")} 55%,${m(11, "#f8f8fa")} 100%)`;
  return `--acc-ui:${gvAccent(c)};--g-bg-x:${bg};--acc-ui-x:color-mix(in srgb,var(--acc-ui) ${dark ? "80%,#fff" : "82%,#000"})`;
};
const GV_FIELDS = [
  { name: "nuance", selector: { select: { mode: "dropdown", options: [{ value: "theme", label: "Selon le thème (couleurs d'origine)" }, ...GV_NUANCES.map((n) => ({ value: n[0], label: n[1] })), { value: "perso", label: "Personnalisée" }] } } },
  { name: "nuance_perso", selector: { color_rgb: {} } },
  { name: "intensite", selector: { number: { min: 0, max: 2, step: 0.1, mode: "slider" } } }];
const GV_LABELS = { nuance: "Nuance de couleur", nuance_perso: "Couleur personnalisée (nuance « Personnalisée »)", intensite: "Intensité de la nuance" };
/* === FIN NUANCE COMMUNE === */
const DEFAULTS = {
  name: "Musique de Noël", subtitle: "", theme: "auto", ...GV_DEFAULTS,
  music_entity: "", // switch / input_boolean : lance la musique
  mute_entity: "", // switch : coupe le son
  volume_entity: "", // number / input_number
  alarm_entity: "", // automation (réveil de Noël)
  alarm_name: "Réveil de Noël",
  image: "", image_opacity: 0.35, // image de fond (facultatif)
  snow: true,
};
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const bad = (st) => !st || st.state === "unavailable" || st.state === "unknown";

class ChristmasMusicCard extends HTMLElement {
  static getConfigElement() { return document.createElement("christmas-music-card-editor"); }
  static getStubConfig(hass) {
    const f = (re, pre) => Object.keys((hass && hass.states) || {}).find((k) => pre.some((p) => k.startsWith(p)) && re.test(k)) || "";
    return { ...DEFAULTS, music_entity: f(/noel|noël|christmas|musique/i, ["switch.", "input_boolean."]), mute_entity: f(/mute|muet/i, ["switch."]), volume_entity: f(/volume/i, ["number.", "input_number."]) };
  }
  constructor() { super(); this.attachShadow({ mode: "open" }); this._sig = ""; this._vol = null; }

  setConfig(config) {
    if (!config || !config.music_entity) throw new Error("christmas-music-card : « music_entity » (l'interrupteur de la musique) est obligatoire");
    this._config = { ...DEFAULTS, ...config };
    this._sig = "";
    if (this._hass) this._render();
  }
  set hass(hass) {
    this._hass = hass;
    if (!this._config || this._dragging) return;
    const c = this._config;
    const sig = [c.music_entity, c.mute_entity, c.volume_entity, c.alarm_entity].filter(Boolean).map((e) => { const s = hass.states[e]; return s ? s.state + "|" + (s.attributes.last_triggered || "") : "x"; }).join(";") + (this._isDark() ? "d" : "l");
    if (sig !== this._sig) { this._sig = sig; this._render(); }
  }
  getCardSize() { return 4; }
  _isDark() {
    const t = this._config && this._config.theme;
    if (t === "dark") return true;
    if (t === "light") return false;
    const dm = this._hass && this._hass.themes && this._hass.themes.darkMode;
    return typeof dm === "boolean" ? dm : !!(window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches);
  }
  _more(id) { if (id) this.dispatchEvent(new CustomEvent("hass-more-info", { bubbles: true, composed: true, detail: { entityId: id } })); }
  _when(iso) {
    if (!iso) return "";
    const d = new Date(iso); if (isNaN(d)) return "";
    const lang = (this._hass.locale && this._hass.locale.language) || "fr";
    return new Intl.DateTimeFormat(lang, { day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" }).format(d);
  }

  _render() {
    const c = this._config, h = this._hass;
    if (!c || !h) return;
    const dark = this._isDark();
    const ms = h.states[c.music_entity], unknown = bad(ms), playing = !unknown && ms.state === "on";
    const mute = c.mute_entity ? h.states[c.mute_entity] : null, muted = !!(mute && mute.state === "on");
    const vs = c.volume_entity ? h.states[c.volume_entity] : null;
    const al = c.alarm_entity ? h.states[c.alarm_entity] : null, alOn = !!(al && al.state === "on");
    let volHtml = "";
    if (vs && !bad(vs) && !isNaN(Number(vs.state))) {
      const a = vs.attributes, min = isFinite(Number(a.min)) ? Number(a.min) : 0, max = isFinite(Number(a.max)) && Number(a.max) > min ? Number(a.max) : 100, step = Number(a.step) > 0 ? Number(a.step) : 1;
      const v = this._vol !== null ? this._vol : Number(vs.state), pct = Math.round(((v - min) / (max - min)) * 100);
      volHtml = `<div class="vol"><ha-icon icon="${muted || v <= min ? "mdi:volume-off" : pct < 50 ? "mdi:volume-medium" : "mdi:volume-high"}"></ha-icon>
        <input type="range" min="${min}" max="${max}" step="${step}" value="${v}" style="--p:${pct}%" aria-label="Volume"><b data-vp>${pct} %</b></div>`;
    }
    const okImg = c.image && !/^\s*(javascript|vbscript|data:text)/i.test(String(c.image)) && this._imgFailed !== c.image;
    const bgImg = okImg ? `<img class="bgimg" src="${esc(c.image)}" alt="" loading="lazy" style="opacity:${isFinite(Number(c.image_opacity)) ? Math.max(0, Math.min(1, Number(c.image_opacity))) : 0.35}">` : "";
    const flakes = c.snow ? Array.from({ length: 12 }, (_, i) => `<i class="fk" style="left:${(i * 41 + 7) % 100}%;animation-duration:${6 + (i % 5)}s;animation-delay:${-(i * 1.1)}s;font-size:${8 + (i % 4) * 3}px">❄</i>`).join("") : "";
    const eq = Array.from({ length: 7 }, (_, i) => `<u style="animation-delay:${-i * 0.17}s;animation-duration:${0.7 + (i % 3) * 0.25}s"></u>`).join("");
    this.shadowRoot.innerHTML = `<style>
      * { box-sizing:border-box; }
      ha-card.dark { --xm-text:#f4f6fb; --xm-muted:#a9afc0; --xm-bg:var(--g-bg-x,linear-gradient(160deg,#1b1e32 0%,#241a2a 55%,#2d1519 100%)); --xm-border:rgba(255,255,255,.14); --xm-shadow:0 .6em 2em rgba(0,0,0,.35); --xm-glass:rgba(255,255,255,.07); --xm-glass-b:rgba(255,255,255,.13); --xm-fill:rgba(255,255,255,.09); --xm-fill-b:rgba(255,255,255,.16); --xm-red:#ff6b6b; --xm-green:#6fd49a; --xm-gold:#ffcf6b; --xm-vinyl:#14161f; }
      ha-card.light { --xm-text:#1c2030; --xm-muted:#5d6477; --xm-bg:var(--g-bg-x,linear-gradient(160deg,#f8f9fd 0%,#eef1f8 55%,#f8eff0 100%)); --xm-border:rgba(20,24,40,.12); --xm-shadow:0 .4em 1.4em rgba(20,24,40,.12); --xm-glass:rgba(255,255,255,.7); --xm-glass-b:rgba(20,24,40,.1); --xm-fill:rgba(20,24,40,.06); --xm-fill-b:rgba(20,24,40,.14); --xm-red:#d63a3a; --xm-green:#2e9d4a; --xm-gold:#c98a14; --xm-vinyl:#23262f; }
      ha-card { container-type:inline-size; position:relative; display:flex; flex-direction:column; gap:12px; padding:16px; color:var(--xm-text); border-radius:24px; border:1px solid var(--xm-border); background:var(--xm-bg); box-shadow:var(--xm-shadow); overflow:hidden; }
      ha-card > * { position:relative; z-index:1; }
      button { font:inherit; color:inherit; cursor:pointer; border:0; background:none; padding:0; text-align:left; -webkit-tap-highlight-color:transparent; }
      ha-icon { --mdc-icon-size:1.3em; flex:none; }
      .bgimg { position:absolute !important; inset:0; width:100%; height:100%; object-fit:cover; object-position:center; pointer-events:none; z-index:0 !important; }
      .fk { position:absolute !important; top:-1.2em; z-index:0 !important; color:var(--xm-gold); opacity:.55; font-style:normal; animation:xm-fall linear infinite; pointer-events:none; } @keyframes xm-fall { to { transform:translateY(22em) rotate(200deg); opacity:.05; } }
      .head { display:flex; flex-direction:column; gap:3px; } .head b { font-size:1.1em; font-weight:650; } .sub { font-size:.8em; color:var(--xm-muted); }
      .state { display:flex; align-items:center; gap:.5em; font-size:.85em; font-weight:600; color:var(--xm-muted); } .state::before { content:""; width:.6em; height:.6em; border-radius:50%; background:currentColor; box-shadow:0 0 .6em currentColor; }
      .state.on { color:var(--xm-green); }
      .panel { display:flex; align-items:center; gap:16px; padding:14px; border-radius:20px; background:var(--xm-glass); border:1px solid var(--xm-glass-b); -webkit-backdrop-filter:blur(18px) saturate(140%); backdrop-filter:blur(18px) saturate(140%); }
      .panel.on { box-shadow:inset 0 0 3em color-mix(in srgb, var(--xm-red) 16%, transparent); }
      .disc { position:relative; flex:none; width:7.4em; height:7.4em; }
      .disc svg { width:100%; height:100%; display:block; } .rec { transform-origin:50px 50px; } .on .rec { animation:xm-spin 4s linear infinite; } @keyframes xm-spin { to { transform:rotate(360deg); } }
      .play { position:absolute; inset:0; margin:auto; width:2.6em; height:2.6em; border-radius:50%; display:grid; place-items:center; background:var(--xm-red); color:#fff; box-shadow:0 .3em 1em color-mix(in srgb, var(--xm-red) 55%, transparent); } .play:disabled { opacity:.4; }
      .on .play { background:var(--xm-green); animation:xm-pulse 1.8s ease-in-out infinite; } @keyframes xm-pulse { 50% { box-shadow:0 0 0 .6em color-mix(in srgb, var(--xm-green) 0%, transparent); } }
      .info { display:flex; flex-direction:column; gap:.6em; min-width:0; flex:1; }
      .big { font-size:1.2em; font-weight:700; } .eq { display:flex; align-items:flex-end; gap:.25em; height:2.2em; } .eq u { display:block; width:.45em; height:20%; border-radius:.2em; background:var(--xm-gold); text-decoration:none; opacity:.35; }
      .on .eq u { opacity:1; animation:xm-eq .9s ease-in-out infinite alternate; } @keyframes xm-eq { from { height:15%; } to { height:100%; } }
      .row { display:flex; align-items:center; gap:.7em; padding:.6em .85em; border-radius:1em; background:var(--xm-glass); border:1px solid var(--xm-glass-b); }
      .vol { flex:1; display:flex; align-items:center; gap:.6em; min-width:0; } .vol b { min-width:2.8em; text-align:right; font-variant-numeric:tabular-nums; font-size:.85em; }
      input[type=range] { flex:1; min-width:0; -webkit-appearance:none; appearance:none; height:.45em; border-radius:.3em; background:linear-gradient(90deg,var(--xm-gold) var(--p),var(--xm-fill-b) var(--p)); outline:none; }
      input[type=range]::-webkit-slider-thumb { -webkit-appearance:none; width:1.4em; height:1.4em; border-radius:50%; background:var(--xm-text); border:2px solid var(--xm-gold); } input[type=range]::-moz-range-thumb { width:1.2em; height:1.2em; border-radius:50%; background:var(--xm-text); border:2px solid var(--xm-gold); }
      .mute { display:flex; align-items:center; gap:.45em; padding:.5em .9em; border-radius:2em; font-size:.82em; font-weight:600; background:var(--xm-fill); border:1px solid var(--xm-fill-b); color:var(--xm-muted); } .mute.on { color:var(--xm-red); border-color:var(--xm-red); }
      .alarm { display:flex; align-items:center; justify-content:space-between; gap:.8em; width:100%; text-align:left; } .alarm .t { display:flex; align-items:center; gap:.6em; min-width:0; } .alarm .t ha-icon { color:var(--xm-gold); } .alarm small { display:block; color:var(--xm-muted); font-size:.74em; }
      .tg { flex:none; width:2.9em; height:1.6em; border-radius:1em; background:var(--xm-fill-b); position:relative; transition:background .2s; } .tg::after { content:""; position:absolute; top:.15em; left:.15em; width:1.3em; height:1.3em; border-radius:50%; background:var(--xm-text); transition:transform .2s; }
      .alarm.on .tg { background:var(--xm-green); } .alarm.on .tg::after { transform:translateX(1.3em); }
      @media (prefers-reduced-motion: reduce) { .fk, .on .rec, .on .eq u, .on .play { animation:none; } }
      @container (max-width:300px) { .disc { width:5.6em; height:5.6em; } }
    </style>
    <ha-card class="${dark ? "dark" : "light"}" style="${gvStyle(c, dark)}">${bgImg}${flakes}
      <div class="head"><b>${esc(c.name)}</b>${c.subtitle ? `<span class="sub">${esc(c.subtitle)}</span>` : ""}<span class="state ${playing ? "on" : ""}">${unknown ? "Indisponible" : playing ? "En lecture" : "Arrêtée"}</span></div>
      <div class="panel ${playing ? "on" : ""}">
        <div class="disc"><svg viewBox="0 0 100 100" aria-hidden="true"><g class="rec"><circle cx="50" cy="50" r="47" fill="var(--xm-vinyl)"/><g fill="none" stroke="rgba(255,255,255,.12)" stroke-width=".6"><circle cx="50" cy="50" r="42"/><circle cx="50" cy="50" r="37"/><circle cx="50" cy="50" r="32"/><circle cx="50" cy="50" r="27"/></g>
          <circle cx="50" cy="50" r="17" fill="var(--xm-red)"/><text x="50" y="56" text-anchor="middle" font-size="16" fill="#fff">❄</text><path d="M20 30 A34 34 0 0 1 40 16" stroke="rgba(255,255,255,.25)" stroke-width="2" fill="none" stroke-linecap="round"/></g></svg>
          <button class="play" ${unknown ? "disabled" : ""} data-play aria-label="${playing ? "Arrêter" : "Lancer"} la musique"><ha-icon icon="${playing ? "mdi:stop" : "mdi:play"}"></ha-icon></button></div>
        <div class="info"><span class="big">${playing ? "Joyeux Noël !" : "Prête à jouer"}</span><div class="eq">${eq}</div></div>
      </div>
      ${volHtml || mute ? `<div class="row">${volHtml}${mute && !bad(mute) ? `<button class="mute ${muted ? "on" : ""}" data-mute><ha-icon icon="${muted ? "mdi:volume-off" : "mdi:volume-high"}"></ha-icon>${muted ? "Son coupé" : "Couper le son"}</button>` : ""}</div>` : ""}
      ${al && !bad(al) ? `<div class="row"><button class="alarm ${alOn ? "on" : ""}" data-alarm><span class="t"><ha-icon icon="mdi:gift-outline"></ha-icon><span>${esc(c.alarm_name)}<small>${alOn ? "Activé" : "Désactivé"}${al.attributes.last_triggered ? " · dernier : " + esc(this._when(al.attributes.last_triggered)) : ""}</small></span></span><i class="tg"></i></button></div>` : ""}
    </ha-card>`;
    const r = this.shadowRoot;
    r.querySelectorAll("img.bgimg").forEach((im) => im.addEventListener("error", () => { this._imgFailed = c.image; this._sig = ""; this._render(); }));
    const tg = (e) => h.callService("homeassistant", "toggle", { entity_id: e });
    const p = r.querySelector("[data-play]"); if (p) p.addEventListener("click", () => tg(c.music_entity));
    const m = r.querySelector("[data-mute]"); if (m) m.addEventListener("click", () => tg(c.mute_entity));
    const a = r.querySelector("[data-alarm]"); if (a) a.addEventListener("click", () => h.callService("automation", alOn ? "turn_off" : "turn_on", { entity_id: c.alarm_entity }));
    const inp = r.querySelector("input[type=range]");
    if (inp) {
      inp.addEventListener("pointerdown", () => { this._dragging = true; });
      inp.addEventListener("input", () => { this._vol = Number(inp.value); const mn = Number(inp.min), mx = Number(inp.max); const pc = Math.round(((this._vol - mn) / (mx - mn)) * 100); inp.style.setProperty("--p", pc + "%"); const b = r.querySelector("[data-vp]"); if (b) b.textContent = pc + " %"; });
      inp.addEventListener("change", () => {
        const dom = c.volume_entity.split(".")[0];
        h.callService(dom, "set_value", { entity_id: c.volume_entity, value: Number(inp.value) });
        this._dragging = false; setTimeout(() => { this._vol = null; this._sig = ""; }, 2500);
      });
    }
  }
}

/* ---------- Éditeur visuel ---------- */
const LABELS = { ...GV_LABELS, name: "Titre", subtitle: "Sous-titre (ex. le morceau, facultatif)", music_entity: "Musique de Noël (interrupteur)", mute_entity: "Couper le son (interrupteur)", volume_entity: "Volume (number / input_number)", alarm_entity: "Réveil de Noël (automatisation)", alarm_name: "Nom du réveil", image: "Image de fond (URL, facultatif)", image_opacity: "Opacité de l'image de fond", snow: "Flocons animés", theme: "Thème" };
class ChristmasMusicCardEditor extends HTMLElement {
  setConfig(config) { this._config = { ...DEFAULTS, ...config }; if (!this._form) this._build(); else this._form.data = this._config; }
  set hass(h) { this._hass = h; if (this._form) this._form.hass = h; }
  _build() {
    const el = document.createElement("ha-form");
    el.hass = this._hass; el.data = this._config; el.computeLabel = (s) => LABELS[s.name] || s.name;
    el.schema = [
      { name: "music_entity", required: true, selector: { entity: { domain: ["switch", "input_boolean"] } } },
      { name: "volume_entity", selector: { entity: { domain: ["number", "input_number"] } } },
      { name: "mute_entity", selector: { entity: { domain: ["switch", "input_boolean"] } } },
      { type: "grid", name: "", schema: [{ name: "alarm_entity", selector: { entity: { domain: "automation" } } }, { name: "alarm_name", selector: { text: {} } }] },
      { name: "image", selector: { text: {} } },
      { name: "image_opacity", selector: { number: { min: 0.05, max: 1, step: 0.05, mode: "slider" } } },
      { type: "grid", name: "", schema: [{ name: "name", selector: { text: {} } }, { name: "subtitle", selector: { text: {} } }] },
      { type: "grid", name: "", schema: [{ name: "theme", selector: { select: { mode: "dropdown", options: [{ value: "auto", label: "Automatique" }, { value: "light", label: "Clair" }, { value: "dark", label: "Sombre" }] } } }, { name: "snow", selector: { boolean: {} } }] },
      { type: "expandable", name: "", title: "Nuance de couleur", schema: GV_FIELDS },
    ];
    el.addEventListener("value-changed", (ev) => {
      ev.stopPropagation();
      const cfg = { ...ev.detail.value };
      ["mute_entity", "volume_entity", "alarm_entity", "subtitle", "image"].forEach((k) => { if (!cfg[k]) delete cfg[k]; });
      this._config = cfg;
      this.dispatchEvent(new CustomEvent("config-changed", { detail: { config: cfg }, bubbles: true, composed: true }));
    });
    this._form = el; this.appendChild(el);
  }
}

customElements.define("christmas-music-card", ChristmasMusicCard);
customElements.define("christmas-music-card-editor", ChristmasMusicCardEditor);
window.customCards = window.customCards || [];
window.customCards.push({ type: "christmas-music-card", name: "Christmas Music Card (FR)", description: "Musique de Noël : disque vinyle animé, égaliseur, volume, coupure du son et réveil de Noël.", preview: true });
console.info(`%c CHRISTMAS-MUSIC-CARD %c v${CARD_VERSION} `, "color:#fff;background:#d63a3a;font-weight:700;border-radius:3px 0 0 3px;padding:2px 4px", "color:#d63a3a;background:#fff;font-weight:700;border-radius:0 3px 3px 0;padding:2px 4px");
}
