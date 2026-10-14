// Daily reminders. Notifications are scheduled a week ahead, each carrying that
// day's chengyu, and re-scheduled every time the app opens.

import { api, isTauri, today } from "./api";
import { state } from "./ui";

const BASE_ID = 7000;
const DAYS_AHEAD = 7;

/** Returns true if reminders are active after the call. */
export async function scheduleReminders(): Promise<boolean> {
  if (!isTauri()) return false;
  const n = await import("@tauri-apps/plugin-notification");
  const ids = Array.from({ length: DAYS_AHEAD }, (_, i) => BASE_ID + i);
  await n.cancel(ids).catch(() => {});
  if (!state.settings.reminders) return false;

  let granted = await n.isPermissionGranted();
  if (!granted) granted = (await n.requestPermission()) === "granted";
  if (!granted) return false;

  const [hh, mm] = state.settings.reminder_time.split(":").map(Number);
  const now = new Date();
  for (let i = 0; i < DAYS_AHEAD; i++) {
    const at = new Date(now.getFullYear(), now.getMonth(), now.getDate() + i, hh || 20, mm || 0);
    if (at <= now) continue;
    const idiom = await api.daily(today(at));
    n.sendNotification({
      id: ids[i],
      title: idiom ? `每日一词：${idiom.text}` : "成语词典",
      body: idiom
        ? `${idiom.pinyin} — ${state.settings.show_english ? idiom.meaning.en : idiom.meaning.zh}`
        : "Time for today's review!",
      schedule: n.Schedule.at(at, false, true),
    });
  }
  return true;
}
