import { api } from "../api";
import type { Summary } from "../types";
import { h, clear, en, pageHeader, meaningOf } from "../ui";
import { saveResult } from "../results";

let homophones = true;

export async function renderChain(root: HTMLElement) {
  const startId = await api.chainStart(homophones);
  if (!startId) {
    clear(root, pageHeader(en() ? "Idiom chain" : "成语接龙", { back: true }), h("div", { class: "empty" }, en() ? "Not enough entries yet." : "词条还不够。"));
    return;
  }
  const chain: Summary[] = await api.summaries([startId]);
  const used = () => chain.map((s) => s.id);
  const last = () => chain[chain.length - 1];
  let finished = false;

  const list = h("div", { class: "chain-list" });
  const hintBtn = h("button", { class: "btn" }, en() ? "Hint" : "提示");
  const giveUp = h("button", { class: "btn" }, en() ? "Give up" : "认输");
  const input = h("input", { class: "search-input", placeholder: "", autocomplete: "off", lang: "zh-CN" });
  const message = h("div", { class: "feedback" });
  const form = h("form", { class: "chain-form" }, input, h("button", { class: "btn primary", type: "submit" }, en() ? "Go" : "接"));

  const homoBtn = h("button", { class: `chip ${homophones ? "on" : ""}` }, en() ? "Same sound counts (同音)" : "同音字也算");
  homoBtn.addEventListener("click", () => {
    if (chain.length > 1 && !finished && !confirm(en() ? "Changing this rule starts a new game. Continue?" : "更改规则会重新开始游戏，继续吗？")) return;
    homophones = !homophones;
    renderChain(root);
  });

  function drawList() {
    clear(
      list,
      chain.map((s, i) =>
        h(
          "a",
          { class: `chain-item ${i % 2 ? "mine" : "theirs"}`, href: `#/entry/${s.id}` },
          h("div", { class: "chain-who muted small" }, i === 0 ? (en() ? "Start" : "开始") : i % 2 ? (en() ? "You" : "你") : en() ? "App" : "电脑"),
          h("div", { class: "hanzi" }, s.text),
          h("div", { class: "pinyin small" }, s.pinyin),
          h("div", { class: "meaning small" }, meaningOf(s)),
        ),
      ),
    );
    const lastChar = [...last().text].pop();
    input.placeholder = en() ? `Starts with ${lastChar}…` : `以"${lastChar}"开头…`;
  }

  function end(text: string, answer?: Summary) {
    finished = true;
    input.disabled = true;
    hintBtn.disabled = true;
    giveUp.disabled = true;
    api.gamePlayed();
    const item = (s: Summary) => ({ id: s.id, text: s.text });
    saveResult({ at: Date.now(), game: "chain", score: en() ? `chain of ${chain.length}` : `接龙 ${chain.length} 个`, right: chain.map(item), missed: answer ? [item(answer)] : [] });
    if (answer) {
      // The answer you could have given, shown as one more link in the chain.
      const card = h(
        "a",
        { class: "chain-item mine answer", href: `#/entry/${answer.id}` },
        h("div", { class: "chain-who muted small" }, en() ? "You could have said" : "可以接"),
        h("div", { class: "hanzi" }, answer.text),
        h("div", { class: "pinyin small" }, answer.pinyin),
        h("div", { class: "meaning small" }, meaningOf(answer)),
      );
      list.appendChild(card);
      requestAnimationFrame(() => card.scrollIntoView({ behavior: "smooth", block: "center" }));
    }
    clear(
      message,
      h("p", null, text),
      h("p", { class: "muted small" }, en() ? `Chain length: ${chain.length}` : `接龙长度：${chain.length}`),
      h("button", { class: "btn primary", onclick: () => renderChain(root) }, en() ? "New game" : "再来一局"),
    );
  }

  async function appMove() {
    const next = await api.chainAi(last().id, used(), homophones);
    if (!next) return end(en() ? "🏆 You win — the app can't continue!" : "🏆 你赢了，电脑接不下去了！");
    chain.push(...(await api.summaries([next])));
    drawList();
    if ((await api.chainHint(last().id, used(), homophones)) === 0) {
      end(en() ? "No expression in the dictionary can follow this one. Game over!" : "词典里已经没有能接的了，游戏结束！");
    }
  }

  let submitting = false;
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (finished || submitting) return;
    submitting = true;
    try {
      await handleMove();
    } finally {
      submitting = false;
    }
  });

  async function handleMove() {
    const r = await api.chainCheck(last().id, input.value, used(), homophones);
    switch (r.result) {
      case "ok":
        input.value = "";
        message.textContent = "";
        chain.push(...(await api.summaries([r.id])));
        drawList();
        await appMove();
        break;
      case "not_in_dictionary":
        message.textContent = en() ? "That's not in the dictionary yet." : "词典里没有这个词。";
        break;
      case "already_used":
        message.textContent = en() ? "Already used in this game." : "这个已经用过了。";
        break;
      case "does_not_connect":
        message.textContent = homophones
          ? en() ? `It must start with ${r.need} (or a character that sounds the same).` : `要以"${r.need}"或同音字开头。`
          : en() ? `It must start with ${r.need}.` : `要以"${r.need}"开头。`;
        break;
    }
  }

  hintBtn.addEventListener("click", async () => {
    const n = await api.chainHint(last().id, used(), homophones);
    message.textContent = en() ? `${n} possible answer${n === 1 ? "" : "s"} in the dictionary.` : `词典里有 ${n} 个可以接的。`;
  });
  giveUp.addEventListener("click", async () => {
    const answer = await api.chainAi(last().id, used(), homophones);
    const s = answer ? (await api.summaries([answer]))[0] : null;
    end(s ? (en() ? `You could have said ${s.text} (${s.pinyin}).` : `可以接"${s.text}"（${s.pinyin}）。`) : en() ? "Nothing could follow — well played!" : "其实没有能接的，打平！", s ?? undefined);
  });

  clear(
    root,
    pageHeader(en() ? "Idiom chain 成语接龙" : "成语接龙", { back: true }),
    h("div", { class: "chip-group center" }, homoBtn),
    list,
    form,
    h("div", { class: "row-gap" }, hintBtn, giveUp),
    message,
  );
  drawList();
  if ((await api.chainHint(last().id, used(), homophones)) === 0) end(en() ? "No follow-ups available yet." : "暂时没有可以接的。");
}
