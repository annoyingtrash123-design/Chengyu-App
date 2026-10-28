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

let allEntries: Promise<Summary[]> | null = null;
const loadAll = () => (allEntries ??= api.search("", emptyFilters(), 0, 100000).then((r) => r.items));

const prefs: { by: GroupBy; kinds: Kind[]; stars: number[] } = { by: "labels", kinds: [], stars: [] };

/** Tightly pack circles of the given radii around the centre, scaled to fit radius `fit`. */
function pack(radii: number[], fit: number): { x: number; y: number; r: number }[] {
  if (!radii.length) return [];
  const pad = Math.max(...radii) * 0.04;
  const order = radii.map((r, i) => ({ r, i })).sort((a, b) => b.r - a.r);
  const placed: { x: number; y: number; r: number; i: number }[] = [];
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
        const d = Math.hypot(x, y) + r;
        if (d >= bestD) continue;
        if (placed.every((q) => Math.hypot(q.x - x, q.y - y) >= q.r + r + pad - 1e-6)) {
          best = { x, y };
          bestD = d;
        }
      }
    }
    placed.push({ ...best, r, i });
  }
  const R = Math.max(...placed.map((p) => Math.hypot(p.x, p.y) + p.r));
  const k = fit / R;
  const out: { x: number; y: number; r: number }[] = [];
  placed.forEach((p) => (out[p.i] = { x: p.x * k, y: p.y * k, r: p.r * k }));
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

  function draw(node: Node, enter: "in" | "out") {
    const kids = kidsOf(node);
    const layout = pack(kids.map((k) => Math.sqrt(weight(k))), 47);
    const svgRoot = svg("svg", { viewBox: "-50 -50 100 100", class: "map-svg", role: "img", "aria-label": `${node.zh} ${node.en}` });
    const defs = svg("defs");
    const shadow = svg("filter", { id: "mapShadow", x: "-20%", y: "-20%", width: "140%", height: "140%" });
    shadow.appendChild(svg("feDropShadow", { dx: 0, dy: 0.5, stdDeviation: 0.7, "flood-opacity": dark() ? 0.5 : 0.18 }));
    defs.appendChild(shadow);
    svgRoot.appendChild(defs);
    const layer = svg("g", { class: `map-layer enter-${enter}` });
    svgRoot.appendChild(layer);

    kids.forEach((k, i) => {
      const { x, y, r } = layout[i];
      const g = svg("g", { class: `map-bubble${k.entry ? " is-entry" : ""}${k.more !== undefined ? " is-more" : ""}`, tabindex: 0, role: "button" });
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
        const show = inner.slice(0, 90);
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
      } else if (r > 3) {
        const fs = Math.min(r / 2.6, 6);
        const lines: [string, string, number][] = [[k.zh, "map-label", fs]];
        if (en() && r > 8 && k.en) lines.push([k.en, "map-sub", fs * 0.5]);
        lines.push([fmt(k.items.length), "map-count", fs * 0.62]);
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
        else zoomInto(svgRoot, layer, g, { x, y, r }, k);
      };
      g.addEventListener("click", go);
      g.addEventListener("keydown", (e) => (e as KeyboardEvent).key === "Enter" && go());
      layer.appendChild(g);
    });
    clear(stage, svgRoot);
    requestAnimationFrame(() => requestAnimationFrame(() => layer.classList.add("shown")));
    drawCrumbs();
    hint.textContent = kids.some((k) => k.entry)
      ? en() ? "Tap an expression to open it · bigger bubbles are more common" : "点词条打开 · 气泡越大越常用"
      : en() ? "Tap a bubble to zoom in" : "点气泡放大查看";
  }

  /** Fly the camera into a bubble until it fills the frame, then show what's inside. */
  function zoomInto(svgRoot: SVGElement, layer: SVGElement, picked: SVGElement, c: { x: number; y: number; r: number }, node: Node) {
    layer.classList.add("zooming");
    picked.classList.add("picked");
    const from = [-50, -50, 100, 100];
    const to = [c.x - c.r, c.y - c.r, c.r * 2, c.r * 2];
    const t0 = performance.now();
    const D = 560;
    const ease = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
    const step = (now: number) => {
      const t = Math.min(1, (now - t0) / D);
      const e = ease(t);
      svgRoot.setAttribute("viewBox", from.map((v, i) => v + (to[i] - v) * e).join(" "));
      if (t < 1) requestAnimationFrame(step);
      else {
        path.push(node);
        // One history entry per level, so the phone's back button steps back out one level.
        history.pushState({ mapDepth: path.length - 1 }, "");
        draw(node, "in");
      }
    };
    requestAnimationFrame(step);
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
  }

  let pendingRestart = false;
  const startOver = () => {
    const r = rootNode();
    path = [r];
    draw(r, "out");
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
    const depth = (e.state as { mapDepth?: number } | null)?.mapDepth ?? 0;
    if (pendingRestart && depth === 0) {
      pendingRestart = false;
      return startOver();
    }
    if (depth < path.length - 1) {
      path = path.slice(0, depth + 1);
      draw(path[depth], "out");
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
  restart();
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
