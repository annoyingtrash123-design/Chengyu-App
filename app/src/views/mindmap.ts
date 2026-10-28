import { api } from "../api";
import { emptyFilters } from "../filters";
import type { Filters, Kind } from "../types";
import { h, clear, en, state, themeLabel, KIND_LABEL, FREQUENCY_LABEL } from "../ui";
import { showFilters } from "./list";

/** A bubble: either opens into child bubbles, or (a leaf) opens the List tab with `filters`. */
interface Bubble {
  zh: string;
  en: string;
  count: number;
  hue: number;
  children?: () => Promise<Bubble[]>;
  filters?: Partial<Filters>;
}

const SVG = "http://www.w3.org/2000/svg";
const svg = (tag: string, attrs: Record<string, string | number>) => {
  const el = document.createElementNS(SVG, tag);
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, String(v));
  return el;
};

/** Pack circles (radii) tightly around the centre; returns centres scaled to fit a circle of radius `fit`. */
function pack(radii: number[], fit: number): { x: number; y: number; r: number }[] {
  const pad = 0.6;
  const order = radii.map((r, i) => ({ r, i })).sort((a, b) => b.r - a.r);
  const placed: { x: number; y: number; r: number; i: number }[] = [];
  for (const { r, i } of order) {
    if (!placed.length) {
      placed.push({ x: 0, y: 0, r, i });
      continue;
    }
    let best: { x: number; y: number } | null = null;
    let bestD = Infinity;
    for (const p of placed) {
      for (let k = 0; k < 36; k++) {
        const a = (k / 36) * Math.PI * 2;
        const x = p.x + Math.cos(a) * (p.r + r + pad);
        const y = p.y + Math.sin(a) * (p.r + r + pad);
        const d = Math.hypot(x, y);
        if (d >= bestD) continue;
        if (placed.every((q) => Math.hypot(q.x - x, q.y - y) >= q.r + r + pad - 1e-6)) {
          best = { x, y };
          bestD = d;
        }
      }
    }
    placed.push({ ...best!, r, i });
  }
  // Centre the cluster, then scale it into the frame.
  const cx = placed.reduce((s, p) => s + p.x * p.r * p.r, 0) / placed.reduce((s, p) => s + p.r * p.r, 0);
  const cy = placed.reduce((s, p) => s + p.y * p.r * p.r, 0) / placed.reduce((s, p) => s + p.r * p.r, 0);
  const R = Math.max(...placed.map((p) => Math.hypot(p.x - cx, p.y - cy) + p.r));
  const k = fit / R;
  const out: { x: number; y: number; r: number }[] = [];
  placed.forEach((p) => (out[p.i] = { x: (p.x - cx) * k, y: (p.y - cy) * k, r: p.r * k }));
  return out;
}

const fmt = (n: number) => n.toLocaleString("en-US");

async function tierCounts(): Promise<number[]> {
  return Promise.all([1, 2, 3].map(async (q) => (await api.search("", { ...emptyFilters(), frequencies: [q] }, 0, 1)).total));
}

function rootBubble(): Bubble {
  const meta = state.meta!;
  const themes = meta.themes;
  const kinds: Kind[] = ["chengyu", "suyu", "mingju", "phrase", "guanyongyu", "xiehouyu"];
  const broad = themes.filter((t) => !t.group);
  const hueOf = (i: number, n: number) => Math.round((i / n) * 360);
  return {
    zh: "词典全貌",
    en: "The whole dictionary",
    count: meta.total,
    hue: 6,
    children: async () => [
      {
        zh: "类型",
        en: "Types",
        count: meta.total,
        hue: 6,
        children: async () =>
          kinds.map((k, i) => ({ zh: KIND_LABEL[k].zh, en: KIND_LABEL[k].en, count: meta.kinds[k] ?? 0, hue: hueOf(i, kinds.length), filters: { kinds: [k] } })),
      },
      {
        zh: "标签",
        en: "Labels",
        count: meta.total,
        hue: 210,
        children: async () =>
          broad.map((g, i) => {
            const hue = hueOf(i, broad.length);
            const kids = themes.filter((t) => t.group === g.id);
            const [zh, ...rest] = themeLabel(g.id).split(" ");
            return {
              zh,
              en: rest.join(" "),
              count: meta.theme_counts[g.id] ?? 0,
              hue,
              filters: { themes: [g.id] },
              children: kids.length
                ? async () =>
                    kids.map((t) => {
                      const [z, ...e] = themeLabel(t.id).split(" ");
                      return { zh: z, en: e.join(" "), count: meta.theme_counts[t.id] ?? 0, hue, filters: { themes: [t.id] } };
                    })
                : undefined,
            };
          }),
      },
      {
        zh: "常用度",
        en: "How common",
        count: meta.total,
        hue: 45,
        children: async () => {
          const c = await tierCounts();
          return [1, 2, 3].map((q, i) => ({
            zh: `${FREQUENCY_LABEL[q].stars} ${FREQUENCY_LABEL[q].zh}`,
            en: FREQUENCY_LABEL[q].en,
            count: c[i],
            hue: 45 - i * 12,
            filters: { frequencies: [q] },
          }));
        },
      },
    ],
  };
}

/**
 * Zoomable bubble map of everything in the app: tap a bubble to look inside it;
 * tap a bubble with nothing inside to open those entries in the List tab.
 */
export function contentsMap(): HTMLElement {
  const stack: Bubble[] = [];
  const crumbs = h("div", { class: "map-crumbs" });
  const stage = h("div", { class: "map-stage" });
  const hint = h("p", { class: "muted small center" });
  const dark = () => matchMedia("(prefers-color-scheme: dark)").matches;

  async function show(node: Bubble) {
    const kids = (await node.children!()).filter((b) => b.count > 0);
    const S = 100;
    const layout = pack(kids.map((b) => Math.sqrt(b.count)), 47);
    const root = svg("svg", { viewBox: `-50 -50 ${S} ${S}`, class: "map-svg", role: "img", "aria-label": `${node.zh} ${node.en}` });
    const g = svg("g", { class: "map-layer" });
    root.appendChild(g);
    kids.forEach((b, i) => {
      const { x, y, r } = layout[i];
      const light = dark() ? 32 : 88;
      const item = svg("g", { class: `map-bubble${b.children || b.filters ? " tappable" : ""}`, tabindex: 0, role: "button" });
      item.appendChild(svg("circle", { cx: x, cy: y, r, fill: `hsl(${b.hue} 70% ${light}%)`, stroke: `hsl(${b.hue} 65% ${dark() ? 55 : 60}%)`, "stroke-width": 0.35 }));
      if (b.children) item.appendChild(svg("circle", { cx: x, cy: y, r: Math.max(0, r - 1.1), fill: "none", stroke: `hsl(${b.hue} 60% ${dark() ? 55 : 60}%)`, "stroke-width": 0.2, "stroke-dasharray": "0.8 0.8" }));
      const fs = Math.min(r / 2.6, 5.2);
      if (r > 3.2) {
        const lines = [b.zh, en() && r > 7 ? b.en : "", fmt(b.count)].filter(Boolean);
        lines.forEach((line, j) => {
          const isCount = j === lines.length - 1;
          const isEn = en() && j === 1 && lines.length === 3;
          const size = isCount ? fs * 0.7 : isEn ? fs * 0.55 : fs;
          const t = svg("text", { x, y: y + (j - (lines.length - 1) / 2) * fs * 1.05 + size * 0.35, "font-size": size, "text-anchor": "middle", class: isCount || isEn ? "map-sub" : "map-label" });
          const maxChars = Math.floor((1.55 * r) / (0.52 * size));
          t.textContent = isEn && line.length > maxChars ? line.slice(0, Math.max(1, maxChars - 1)).trimEnd() + "…" : line;
          item.appendChild(t);
        });
      }
      const title = svg("title", {});
      title.textContent = `${b.zh} ${b.en} · ${fmt(b.count)}`;
      item.appendChild(title);
      const go = () => {
        if (b.children) {
          stack.push(b);
          show(b);
        } else if (b.filters) showFilters(b.filters);
      };
      item.addEventListener("click", go);
      item.addEventListener("keydown", (e) => (e as KeyboardEvent).key === "Enter" && go());
      g.appendChild(item);
    });
    clear(stage, root);
    requestAnimationFrame(() => g.classList.add("in"));
    drawCrumbs();
    const leafy = kids.some((b) => !b.children);
    hint.textContent = leafy
      ? en() ? "Tap a bubble to see those entries in the List · dashed bubbles open further" : "点气泡查看列表；虚线气泡可继续展开"
      : en() ? "Tap a bubble to look inside" : "点气泡展开";
  }

  function drawCrumbs() {
    clear(
      crumbs,
      stack.map((b, i) => {
        const last = i === stack.length - 1;
        const label = `${b.zh}${en() ? ` ${b.en}` : ""} · ${fmt(b.count)}`;
        return [
          i ? h("span", { class: "muted" }, " › ") : null,
          last
            ? h("strong", null, label)
            : h("button", { class: "link-btn", onclick: () => { stack.splice(i + 1); show(b); } }, label),
        ];
      }),
      stack.length > 1 && stack[stack.length - 1].filters
        ? h("button", { class: "btn small map-open", onclick: () => showFilters(stack[stack.length - 1].filters!) }, en() ? "Open in List" : "在列表中查看")
        : null,
    );
  }

  const top = rootBubble();
  stack.push(top);
  show(top);
  return h("section", { class: "card map-card" }, h("h3", null, en() ? "Contents map 内容总览" : "内容总览"), crumbs, stage, hint);
}
