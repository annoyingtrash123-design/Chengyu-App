import { describe, expect, it } from "vitest";
import { today } from "./api";

describe("today()", () => {
  it("counts days since 1970-01-01 in local time", () => {
    const d = new Date(1970, 0, 2, 12, 0);
    expect(today(d)).toBe(1);
  });

  it("changes at local midnight, not UTC midnight", () => {
    const lateEvening = new Date(2026, 9, 14, 23, 59);
    const nextMorning = new Date(2026, 9, 15, 0, 1);
    expect(today(nextMorning) - today(lateEvening)).toBe(1);
    expect(today(new Date(2026, 9, 14, 0, 1))).toBe(today(lateEvening));
  });
});
