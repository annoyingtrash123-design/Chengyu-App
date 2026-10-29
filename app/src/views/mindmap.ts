import { api } from "../api";
import { emptyFilters } from "../filters";
import type { Filters, Kind, Summary } from "../types";
import { h, clear, en, pageHeader, state, themeLabel, KIND_LABEL, FREQUENCY_LABEL } from "../ui";
import { chipGroup } from "./filterpanel";
import { showFilters } from "./list";

/**
 * Contents map: every entry as zoomable bubbles. Group by labels, type or star rating (each with
 * a second layer inside), narrow with type / star filters, and keep tapping down to the entries.
 */

type GroupBy = "labels" | "kinds" | "stars";

interface Node {
  zh: string;
  en: string;
  hue: number;
  items: Summary[];
  /** Filters that reproduce this bubble in the List tab. */
  filters: Partial<Filters>;
  /** Next layer; undefined means the next layer is the entries themselves. */
  split?: (items: Summary[], base: Partial<Filters>, hue: number) => Node[];
  entry?: Summary;
  more?: number;
  kids?: Node[];
}

const SVG = "http://www.w3.org/2000/svg";
const svg = (tag: string, attrs: Record<string, string | number> = {}) => {
  const el = document.createElementNS(SVG, tag);
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, String(v));
  return el;
};
const fmt = (n: number) => n.toLocaleString("en-US");
const KINDS: Kind[] = ["chengyu", "suyu", "mingju", "phrase", "guanyongyu", "xiehouyu"];
const MAX_ENTRIES = 60;
const PREVIEW = 90;

let allEntries: Promise<Summary[]> | null = null;
const loadAll = () => (allEntries ??= api.search("", emptyFilters(), 0, 100000).then((r) => r.items));

const prefs: { by: GroupBy; kinds: Kind[]; stars: number[] } = { by: "labels", kinds: [], stars: [] };
/** Names of the bubbles zoomed into, so coming back from an entry returns to the same level. */
let trail: string[] = [];

type Circle = { x: number; y: number; r: number };

/**
 * Tightly pack circles of the given radii. With one size, they fill a circle of radius `fit`;
 * with half-width and half-height, they spread to fill that rectangle, corners included.
 */
function pack(radii: number[], hw: number, maybeHh?: number): Circle[] {
  if (!radii.length) return [];
  const round = maybeHh === undefined;
  const hh = maybeHh ?? hw;
  const pad = Math.max(...radii) * (round ? 0.04 : 0.03);
  // How far a circle reaches out, relative to the frame: distance from the centre, or the box edges.
  const reach = (x: number, y: number, r: number) => (round ? Math.hypot(x, y) + r : Math.max((Math.abs(x) + r) / hw, (Math.abs(y) + r) / hh));
  const order = radii.map((r, i) => ({ r, i })).sort((a, b) => b.r - a.r);
  const placed: (Circle & { i: number })[] = [];
  for (const { r, i } of order) {
    if (!placed.length) {
      placed.push({ x: 0, y: 0, r, i });
      continue;
    }
    let best = { x: 0, y: 0 };
    let bestD = Infinity;
    for (const p of placed) {
      for (let k = 0; k < 40; k++) {
        const a = (k / 40) * Math.PI * 2;
        const x = p.x + Math.cos(a) * (p.r + r + pad);
        const y = p.y + Math.sin(a) * (p.r + r + pad);
        const d = reach(x, y, r);
        if (d >= bestD) continue;
        if (placed.every((q) => Math.hypot(q.x - x, q.y - y) >= q.r + r + pad - 1e-6)) {
          best = { x, y };
          bestD = d;
        }
      }
    }
    placed.push({ ...best, r, i });
  }
  const out: Circle[] = [];
  if (round) {
    const k = hw / Math.max(...placed.map((p) => Math.hypot(p.x, p.y) + p.r));
    placed.forEach((p) => (out[p.i] = { x: p.x * k, y: p.y * k, r: p.r * k }));
    return out;
  }
  // Centre the cluster in the box, then scale it up until it touches the sides.
  const x0 = Math.min(...placed.map((p) => p.x - p.r));
  const x1 = Math.max(...placed.map((p) => p.x + p.r));
  const y0 = Math.min(...placed.map((p) => p.y - p.r));
  const y1 = Math.max(...placed.map((p) => p.y + p.r));
  const k = Math.min((2 * hw) / (x1 - x0), (2 * hh) / (y1 - y0));
  placed.forEach((p) => (out[p.i] = { x: (p.x - (x0 + x1) / 2) * k, y: (p.y - (y0 + y1) / 2) * k, r: p.r * k }));
  return out;
}

// ---------- the layers ----------

const broadLabels = () => state.meta!.themes.filter((t) => !t.group);
const detailOf = (g: string) => state.meta!.themes.filter((t) => t.group === g);
let groupMap: Map<string, string> | null = null;
const groupOf = (id: string) => {
  groupMap ??= new Map(state.meta!.themes.map((t) => [t.id, t.group ?? t.id]));
  return groupMap.get(id) ?? id;
};
const split2 = (label: string) => {
  const [zh, ...rest] = themeLabel(label).split(" ");
  return { zh, en: rest.join(" ") };
};

function byBroadLabel(items: Summary[], base: Partial<Filters>, deeper: boolean): Node[] {
  const list = broadLabels();
  return list.map((g, i) => ({
    ...split2(g.id),
    hue: Math.round((i / list.length) * 360),
    items: items.filter((s) => s.themes.some((t) => groupOf(t) === g.id)),
    filters: { ...base, themes: [g.id] },
    split: deeper && detailOf(g.id).length ? (its: Summary[], b: Partial<Filters>, hu: number) => byDetail(g.id, its, b, hu) : undefined,
  }));
}

function byDetail(group: string, items: Summary[], base: Partial<Filters>, hue: number): Node[] {
  const kids: Node[] = detailOf(group).map((t, i) => ({
    ...split2(t.id),
    hue: hue + (i % 2 ? 9 : -9),
    items: items.filter((s) => s.themes.includes(t.id)),
    filters: { ...base, themes: [t.id] },
  }));
  const rest = items.filter((s) => s.themes.includes(group) && !s.themes.some((t) => t !== group && groupOf(t) === group));
  if (rest.length) kids.push({ zh: "其他", en: "Other", hue, items: rest, filters: { ...base, themes: [group] } });
  return kids;
}

function byKind(items: Summary[], base: Partial<Filters>): Node[] {
  return KINDS.map((k, i) => ({
    zh: KIND_LABEL[k].zh,
    en: KIND_LABEL[k].en,
    hue: [6, 205, 280, 150, 35, 320][i],
    items: items.filter((s) => s.kind === k),
    filters: { ...base, kinds: [k] },
    split: (its: Summary[], b: Partial<Filters>) => byBroadLabel(its, b, true),
  }));
}

function byStars(items: Summary[], base: Partial<Filters>): Node[] {
  return [1, 2, 3].map((q, i) => ({
    zh: `${FREQUENCY_LABEL[q].stars} ${FREQUENCY_LABEL[q].zh}`,
    en: FREQUENCY_LABEL[q].en,
    hue: [42, 205, 150][i],
    items: items.filter((s) => s.frequency === q),
    filters: { ...base, frequencies: [q] },
    split: (its: Summary[], b: Partial<Filters>) => byBroadLabel(its, b, true),
  }));
}

/** Children of a bubble (memoised): the next layer, or its entries (most common first). */
function kidsOf(n: Node): Node[] {
  if (n.kids) return n.kids;
  if (n.entry || n.more !== undefined) return (n.kids = []);
  if (n.split) return (n.kids = n.split(n.items, n.filters, n.hue).filter((k) => k.items.length));
  const sorted = [...n.items].sort((a, b) => a.frequency - b.frequency || a.text.length - b.text.length);
  const kids: Node[] = sorted.slice(0, MAX_ENTRIES).map((s) => ({ zh: s.text, en: s.meaning.en, hue: n.hue, items: [s], filters: n.filters, entry: s }));
  if (sorted.length > MAX_ENTRIES) kids.push({ zh: `+${fmt(sorted.length - MAX_ENTRIES)}`, en: "more", hue: n.hue, items: [], filters: n.filters, more: sorted.length - MAX_ENTRIES });
  return (n.kids = kids);
}

const weight = (n: Node) => (n.entry ? [0, 3, 2, 1.3][n.entry.frequency] : n.more !== undefined ? 2.5 : n.items.length);

// ---------- drawing ----------

const dark = () => matchMedia("(prefers-color-scheme: dark)").matches;

/** A soft radial gradient for a hue (lighter variant for previews), shared via <defs>. */
function gradient(defs: SVGElement, hue: number, light: boolean): string {
  const id = `g${hue}${light ? "l" : "b"}${dark() ? "d" : ""}`.replace("-", "m");
  if (!defs.querySelector(`#${id}`)) {
    const g = svg("radialGradient", { id, cx: "35%", cy: "30%", r: "75%" });
    const [a, b] = dark() ? (light ? [34, 28] : [30, 21]) : light ? [97, 91] : [94, 81];
    g.appendChild(svg("stop", { offset: "0%", "stop-color": `hsl(${hue} ${dark() ? 40 : 85}% ${a}%)` }));
    g.appendChild(svg("stop", { offset: "100%", "stop-color": `hsl(${hue} ${dark() ? 38 : 68}% ${b}%)` }));
    defs.appendChild(g);
  }
  return `url(#${id})`;
}

export async function renderMap(root: HTMLElement) {
  const all = await loadAll();
  const crumbs = h("div", { class: "map-crumbs" });
  const stage = h("div", { class: "map-stage" });
  const hint = h("p", { class: "muted small center map-hint" });
  let path: Node[] = [];

  const rootNode = (): Node => {
    const items = all.filter((s) => (!prefs.kinds.length || prefs.kinds.includes(s.kind)) && (!prefs.stars.length || prefs.stars.includes(s.frequency)));
    const base: Partial<Filters> = { kinds: prefs.kinds, frequencies: prefs.stars };
    const split =
      prefs.by === "labels"
        ? (its: Summary[], b: Partial<Filters>) => byBroadLabel(its, b, true)
        : prefs.by === "kinds"
          ? byKind
          : byStars;
    return { zh: "全部词条", en: "All entries", hue: 6, items, filters: base, split };
  };

  const ease = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
  /** Glide the camera (the SVG viewBox) from one rectangle to another. */
  function fly(svgRoot: SVGElement, from: number[], to: number[], done: () => void) {
    const t0 = performance.now();
    const D = 620;
    const step = (now: number) => {
      const t = Math.min(1, (now - t0) / D);
      const e = ease(t);
      svgRoot.setAttribute("viewBox", from.map((v, i) => v + (to[i] - v) * e).join(" "));
      if (t < 1) requestAnimationFrame(step);
      else {
        if (cam?.svg === svgRoot) cam.box = to.slice();
        flying--;
        done();
      }
    };
    flying++;
    requestAnimationFrame(step);
  }

  // ---------- pinch / wheel zoom inside the map (the page itself never zooms) ----------

  /** The level on screen: its full view box and the current, possibly zoomed-in, camera. */
  let cam: { svg: SVGElement; base: number[]; box: number[] } | null = null;
  let flying = 0; // camera flights in progress
  const MAX_ZOOM = 8;
  /** Zoom to width `w` keeping the view-box point (px, py) under the stage point (sx, sy) (0–1). */
  function setCam(w: number, px: number, py: number, sx: number, sy: number) {
    if (!cam) return;
    const [bx, by, bw, bh] = cam.base;
    w = Math.max(bw / MAX_ZOOM, Math.min(bw, w));
    const hh = (w * bh) / bw;
    const x = Math.max(bx, Math.min(bx + bw - w, px - sx * w));
    const y = Math.max(by, Math.min(by + bh - hh, py - sy * hh));
    cam.box = [x, y, w, hh];
    cam.svg.setAttribute("viewBox", cam.box.join(" "));
  }
  const pts = new Map<number, { x: number; y: number }>();
  let gesture: { box: number[]; dist: number; mx: number; my: number } | null = null;
  let moved = false;
  /** Fraction across / down the stage, and the view-box point under it (for the camera at gesture start). */
  const at = (x: number, y: number, box: number[]) => {
    const r = stage.getBoundingClientRect();
    const sx = (x - r.left) / r.width;
    const sy = (y - r.top) / r.height;
    return { sx, sy, px: box[0] + sx * box[2], py: box[1] + sy * box[3] };
  };
  const startGesture = () => {
    if (!cam) return;
    const p = [...pts.values()];
    const mx = p.reduce((a, q) => a + q.x, 0) / p.length;
    const my = p.reduce((a, q) => a + q.y, 0) / p.length;
    const dist = p.length > 1 ? Math.hypot(p[0].x - p[1].x, p[0].y - p[1].y) : 0;
    gesture = { box: cam.box.slice(), dist, mx, my };
  };
  stage.addEventListener("pointerdown", (e) => {
    if (flying) return;
    if (!pts.size) moved = false;
    pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
    startGesture();
  });
  stage.addEventListener("pointermove", (e) => {
    if (!pts.has(e.pointerId) || !gesture || !cam || flying) return;
    pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const p = [...pts.values()];
    const mx = p.reduce((a, q) => a + q.x, 0) / p.length;
    const my = p.reduce((a, q) => a + q.y, 0) / p.length;
    const dist = p.length > 1 ? Math.hypot(p[0].x - p[1].x, p[0].y - p[1].y) : 0;
    if (!moved && Math.hypot(mx - gesture.mx, my - gesture.my) < 8 && Math.abs(dist - gesture.dist) < 8) return;
    if (!moved) {
      moved = true;
      stage.setPointerCapture(e.pointerId);
    }
    const g = at(gesture.mx, gesture.my, gesture.box);
    const now = at(mx, my, gesture.box);
    const w = gesture.dist && dist ? (gesture.box[2] * gesture.dist) / dist : gesture.box[2];
    setCam(w, g.px, g.py, now.sx, now.sy);
  });
  const lift = (e: PointerEvent) => {
    pts.delete(e.pointerId);
    if (pts.size) startGesture();
    else gesture = null;
  };
  stage.addEventListener("pointerup", lift);
  stage.addEventListener("pointercancel", lift);
  // A drag or pinch is not a tap on the bubble under the finger.
  stage.addEventListener("click", (e) => moved && (e.stopPropagation(), e.preventDefault(), (moved = false)), true);
  stage.addEventListener(
    "wheel",
    (e) => {
      if (!cam || flying) return;
      e.preventDefault();
      const a = at(e.clientX, e.clientY, cam.box);
      setCam(cam.box[2] * Math.exp(e.deltaY * 0.002), a.px, a.py, a.sx, a.sy);
    },
    { passive: false },
  );
  // Double-tap: zoom back out to the whole level.
  stage.addEventListener("dblclick", () => cam && !flying && fly(cam.svg, cam.box, cam.base, () => {}));

  /**
   * Show a level. "in": right after zooming into it (its bubbles are already where the preview was).
   * "out": coming back up from `fromChild`: start zoomed into that bubble and pull the camera back.
   * "fade": a fresh start (new grouping or filters).
   */
  /** The view box for the stage's shape: 100 units along the short side. */
  function frame() {
    // Fill the space left between the controls and the tab bar (less a line for the hint).
    const tabs = document.getElementById("tabs")?.getBoundingClientRect().height ?? 0;
    const room = window.innerHeight - stage.getBoundingClientRect().top - window.scrollY - tabs - 34;
    stage.style.height = `${Math.max(300, Math.round(room))}px`;
    const a = stage.clientWidth / Math.max(1, stage.clientHeight) || 1;
    const w = a < 1 ? 100 : 100 * a;
    const hgt = a < 1 ? 100 / a : 100;
    return { a, w, h: hgt, box: [-w / 2, -hgt / 2, w, hgt] };
  }
  /** Camera rectangle (stage-shaped) that just fits a bubble. */
  const around = (c: Circle, a: number) => (a < 1 ? [c.x - c.r, c.y - c.r / a, 2 * c.r, (2 * c.r) / a] : [c.x - c.r * a, c.y - c.r, 2 * c.r * a, 2 * c.r]);

  /** Slide and scale each bubble group from one set of circles to another. */
  function morph(gs: SVGElement[], from: Circle[], to: Circle[], dur: number, done: () => void) {
    const t0 = performance.now();
    const step = (now: number) => {
      const t = dur ? Math.min(1, (now - t0) / dur) : 0;
      const e = ease(t);
      gs.forEach((g, i) => {
        const f = from[i] ?? { x: 0, y: 0, r: 0.01 };
        const x = f.x + (to[i].x - f.x) * e;
        const y = f.y + (to[i].y - f.y) * e;
        const sc = (f.r + (to[i].r - f.r) * e) / to[i].r;
        g.setAttribute("transform", `translate(${x} ${y}) scale(${sc}) translate(${-to[i].x} ${-to[i].y})`);
      });
      if (!dur) return;
      if (t < 1) requestAnimationFrame(step);
      else done();
    };
    step(t0);
  }

  /** What's on screen now, so going back can fold it into its bubble first. */
  let shown: { gs: SVGElement[]; layout: Circle[]; preview: Circle[]; layer: SVGElement } | null = null;

  function draw(node: Node, enter: "in" | "out" | "fade", fromChild?: Node) {
    const kids = kidsOf(node);
    const fr = frame();
    const radii = kids.map((k) => Math.sqrt(weight(k)));
    const layout = pack(radii, fr.w / 2 - 1.5, fr.h / 2 - 1.5);
    // Where these bubbles sat in the parent's preview, in this level's coordinates.
    const preview = pack(radii.slice(0, PREVIEW), (Math.min(fr.w, fr.h) / 2) * 0.94);
    const svgRoot = svg("svg", { viewBox: fr.box.join(" "), class: "map-svg", role: "img", "aria-label": `${node.zh} ${node.en}` });
    const defs = svg("defs");
    const shadow = svg("filter", { id: "mapShadow", x: "-20%", y: "-20%", width: "140%", height: "140%" });
    shadow.appendChild(svg("feDropShadow", { dx: 0, dy: 0.5, stdDeviation: 0.7, "flood-opacity": dark() ? 0.5 : 0.18 }));
    defs.appendChild(shadow);
    svgRoot.appendChild(defs);
    const layer = svg("g", { class: `map-layer enter-${enter}` });
    const gs: SVGElement[] = [];
    let backFrom: number[] | null = null;
    svgRoot.appendChild(layer);

    kids.forEach((k, i) => {
      const { x, y, r } = layout[i];
      const g = svg("g", { class: `map-bubble${k.entry ? " is-entry" : ""}${k.more !== undefined ? " is-more" : ""}${k === fromChild ? " picked" : ""}`, tabindex: 0, role: "button" });
      if (k === fromChild) backFrom = around({ x, y, r }, fr.a);
      gs.push(g);
      const ring = dark() ? `hsl(${k.hue} 45% 45%)` : `hsl(${k.hue} 60% 70%)`;
      g.appendChild(
        svg("circle", {
          cx: x,
          cy: y,
          r,
          fill: k.entry ? (dark() ? "#2a2e33" : "#ffffff") : gradient(defs, k.hue, false),
          stroke: k.entry ? ring : dark() ? `hsl(${k.hue} 40% 40%)` : "#ffffff",
          "stroke-width": k.entry ? 0.25 : 0.45,
          filter: "url(#mapShadow)",
          class: "bubble-body",
        }),
      );
      // A faint preview of what's inside, laid out exactly as it appears once zoomed in.
      const inner = kidsOf(k);
      if (inner.length && r > 2.2) {
        const show = inner.slice(0, PREVIEW);
        const lay = pack(show.map((c) => Math.sqrt(weight(c))), r * 0.94);
        const pv = svg("g", { class: "map-preview" });
        show.forEach((c, j) =>
          pv.appendChild(
            svg("circle", {
              cx: x + lay[j].x,
              cy: y + lay[j].y,
              r: lay[j].r,
              fill: c.entry ? (dark() ? "#3a3f45" : "#ffffff") : gradient(defs, c.hue, true),
              stroke: ring,
              "stroke-width": 0.12,
            }),
          ),
        );
        g.appendChild(pv);
      }
      const lab = svg("g", { class: "map-text" });
      const text = (str: string, tx: number, ty: number, size: number, cls: string) => {
        const t = svg("text", { x: tx, y: ty, "font-size": size, class: cls });
        t.textContent = str;
        lab.appendChild(t);
      };
      if (k.entry) {
        const chars = [...k.zh];
        const fs = Math.min((r * 1.7) / Math.max(chars.length, 2), r * 0.62);
        if (chars.length <= 5 || fs > r * 0.34) text(k.zh, x, y + fs * 0.36, fs, "map-entry");
        else {
          const half = Math.ceil(chars.length / 2);
          const fs2 = Math.min((r * 1.7) / half, r * 0.5);
          text(chars.slice(0, half).join(""), x, y - fs2 * 0.58 + fs2 * 0.36, fs2, "map-entry");
          text(chars.slice(half).join(""), x, y + fs2 * 0.58 + fs2 * 0.36, fs2, "map-entry");
        }
      } else if (k.more !== undefined) {
        text(k.zh, x, y + r * 0.13, r * 0.36, "map-label");
      } else if (r > 1.2) {
        // Small bubbles get small labels too: they become readable when you pinch to zoom.
        const fs = Math.min(r / 2.6, 6);
        const lines: [string, string, number][] = [[k.zh, "map-label", fs]];
        if (en() && r > 8 && k.en) lines.push([k.en, "map-sub", fs * 0.5]);
        if (r > 2) lines.push([fmt(k.items.length), "map-count", fs * 0.62]);
        const tot = lines.reduce((s, l) => s + l[2] * 1.15, 0);
        let yy = y - tot / 2;
        for (const [str, cls, size] of lines) {
          yy += size * 1.15;
          const maxChars = Math.floor((1.6 * r) / (0.52 * size));
          text(cls === "map-sub" && str.length > maxChars ? str.slice(0, Math.max(1, maxChars - 1)).trimEnd() + "…" : str, x, yy - size * 0.22, size, cls);
        }
      }
      g.appendChild(lab);
      const title = svg("title");
      title.textContent = k.entry ? `${k.zh} — ${k.en}` : `${k.zh} ${k.en} · ${fmt(k.items.length)}`;
      g.appendChild(title);
      const go = () => {
        if (k.entry) location.hash = `#/entry/${k.entry.id}`;
        else if (k.more !== undefined) showFilters(k.filters);
        else zoomInto(svgRoot, layer, g, { x, y, r }, k, fr);
      };
      g.addEventListener("click", go);
      g.addEventListener("keydown", (e) => (e as KeyboardEvent).key === "Enter" && go());
      layer.appendChild(g);
    });
    const start = backFrom as number[] | null; // set inside the loop above
    cam = { svg: svgRoot, base: fr.box, box: fr.box.slice() };
    if (enter === "out" && start) {
      svgRoot.setAttribute("viewBox", start.join(" "));
      layer.classList.add("zooming");
      clear(stage, svgRoot);
      fly(svgRoot, start, fr.box, () => {
        layer.classList.remove("zooming");
        layer.querySelector(".picked")?.classList.remove("picked");
      });
    } else if (enter === "in") {
      // Bubbles start where the preview showed them, then spread out to fill the screen.
      morph(gs, preview, layout, 0, () => {}); // (sets the start positions only)
      clear(stage, svgRoot);
      morph(gs, preview, layout, 520, () => {
        gs.forEach((g) => g.removeAttribute("transform"));
        layer.classList.add("shown");
      });
    } else {
      clear(stage, svgRoot);
      requestAnimationFrame(() => requestAnimationFrame(() => layer.classList.add("shown")));
    }
    shown = { gs, layout, preview, layer };
    trail = path.slice(1).map((n) => n.zh);
    drawCrumbs();
    hint.textContent = kids.some((k) => k.entry)
      ? en() ? "Tap an expression to open it · bigger bubbles are more common · pinch to zoom" : "点词条打开 · 气泡越大越常用 · 双指缩放"
      : en() ? "Tap a bubble to go in · pinch to zoom" : "点气泡进入 · 双指缩放";
  }

  /** Fly the camera into a bubble until it fills the frame, then show what's inside. */
  function zoomInto(svgRoot: SVGElement, layer: SVGElement, picked: SVGElement, c: Circle, node: Node, fr: ReturnType<typeof frame>) {
    layer.classList.add("zooming");
    picked.classList.add("picked");
    fly(svgRoot, cam?.box ?? fr.box, around(c, fr.a), () => {
      path.push(node);
      // One history entry per level, so the phone's back button steps back out one level.
      history.pushState({ mapDepth: path.length - 1 }, "");
      draw(node, "in");
    });
  }

  function drawCrumbs() {
    clear(
      crumbs,
      path.map((n, i) => {
        const last = i === path.length - 1;
        const label = `${n.zh}${en() && n.en ? ` ${n.en}` : ""} · ${fmt(n.items.length)}`;
        return [
          i ? h("span", { class: "muted" }, "›") : null,
          last
            ? h("strong", null, label)
            : h("button", { class: "link-btn", onclick: () => history.go(i - (path.length - 1)) }, label),
        ];
      }),
      path.length > 1 ? h("button", { class: "btn small map-open", onclick: () => showFilters(path[path.length - 1].filters) }, en() ? "Open in List" : "在列表中查看") : null,
    );
    crumbs.scrollLeft = crumbs.scrollWidth; // keep the current level in view
  }

  let pendingRestart = false;
  const startOver = () => {
    const r = rootNode();
    path = [r];
    draw(r, "fade");
  };
  /** New grouping or filters: back out of any zoom levels (so history stays in step), then redraw. */
  const restart = () => {
    if (path.length > 1) {
      pendingRestart = true;
      history.go(1 - path.length);
    } else startOver();
  };
  const onPop = (e: PopStateEvent) => {
    if (!stage.isConnected) return window.removeEventListener("popstate", onPop);
    // Opening an entry changes the hash, which also fires popstate: that's leaving the map, not going back.
    if (!location.hash.startsWith("#/map")) return;
    const depth = (e.state as { mapDepth?: number } | null)?.mapDepth ?? 0;
    if (pendingRestart && depth === 0) {
      pendingRestart = false;
      return startOver();
    }
    if (depth < path.length - 1) {
      const from = path[depth + 1];
      const oneStep = depth === path.length - 2;
      path = path.slice(0, depth + 1);
      const now = shown;
      if (oneStep && now) {
        // Fold this level back into its bubble's round preview, then pull the camera out.
        now.layer.classList.add("leaving");
        if (cam && cam.box[2] < cam.base[2]) fly(cam.svg, cam.box, cam.base, () => {});
        morph(now.gs, now.layout, now.layout.map((_c, i) => now.preview[i] ?? { x: 0, y: 0, r: 0.01 }), 380, () => draw(path[depth], "out", from));
      } else draw(path[depth], "out", from);
    } else if (depth > path.length - 1) history.replaceState({ mapDepth: path.length - 1 }, "");
  };
  window.addEventListener("popstate", onPop);

  const groups: [GroupBy, string, string][] = [
    ["labels", "标签", "Labels"],
    ["kinds", "类型", "Type"],
    ["stars", "星级", "Stars"],
  ];
  const seg = h("div", { class: "seg" });
  groups.forEach(([v, zh, e]) => {
    const b = h("button", { class: `seg-btn ${prefs.by === v ? "on" : ""}` }, en() ? `${zh} ${e}` : zh);
    b.addEventListener("click", () => {
      prefs.by = v;
      seg.querySelectorAll(".seg-btn").forEach((x) => x.classList.toggle("on", x === b));
      restart();
    });
    seg.appendChild(b);
  });
  const controls = h(
    "div",
    { class: "map-controls" },
    seg,
    h(
      "div",
      { class: "map-filters" },
      chipGroup<Kind>(KINDS, prefs.kinds, (k) => KIND_LABEL[k].zh, (v) => { prefs.kinds = v; restart(); }),
      h("span", { class: "map-sep" }),
      chipGroup<number>([1, 2, 3], prefs.stars, (q) => FREQUENCY_LABEL[q].stars, (v) => { prefs.stars = v; restart(); }),
    ),
  );

  clear(root, pageHeader(en() ? "Contents map" : "内容总览", { back: true }), controls, crumbs, stage, hint);
  // Back from an entry: return to the level it was opened from (history still holds the levels above).
  const depth = (history.state as { mapDepth?: number } | null)?.mapDepth ?? 0;
  const r = rootNode();
  path = [r];
  for (const name of trail.slice(0, depth)) {
    const next = kidsOf(path[path.length - 1]).find((k) => k.zh === name && !k.entry);
    if (!next) break;
    path.push(next);
  }
  if (path.length - 1 < depth) history.replaceState({ mapDepth: path.length - 1 }, "");
  draw(path[path.length - 1], "fade");
}

/** Card on Me that opens the full-screen map. */
export function contentsMapCard(): HTMLElement {
  const meta = state.meta!;
  const preview = svg("svg", { viewBox: "-50 -50 100 100", class: "map-mini", "aria-hidden": "true" });
  const defs = svg("defs");
  preview.appendChild(defs);
  const list = broadLabels();
  const lay = pack(list.map((g) => Math.sqrt(meta.theme_counts[g.id] ?? 1)), 47);
  list.forEach((_g, i) =>
    preview.appendChild(svg("circle", { cx: lay[i].x, cy: lay[i].y, r: lay[i].r, fill: gradient(defs, Math.round((i / list.length) * 360), false), stroke: dark() ? "#444" : "#fff", "stroke-width": 0.5 })),
  );
  return h(
    "a",
    { class: "card map-card", href: "#/map" },
    preview,
    h(
      "div",
      { class: "map-card-text" },
      h("h3", null, en() ? "Contents map 内容总览" : "内容总览"),
      h("p", { class: "small muted" }, en() ? `Explore all ${fmt(meta.total)} entries as bubbles — by label, type or stars, down to each expression.` : `以气泡浏览全部 ${fmt(meta.total)} 条词目：按标签、类型或星级，逐层放大到每个词条。`),
      h("span", { class: "btn small primary" }, en() ? "Open map" : "打开"),
    ),
  );
}
