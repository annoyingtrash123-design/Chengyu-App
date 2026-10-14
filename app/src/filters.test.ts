import { describe, expect, it } from "vitest";
import { activeFilterCount, emptyFilters } from "./filters";

describe("filters", () => {
  it("counts every active filter value", () => {
    const f = emptyFilters();
    expect(activeFilterCount(f)).toBe(0);
    f.kinds = ["chengyu", "suyu"];
    f.themes = ["animals"];
    f.favourites_only = true;
    expect(activeFilterCount(f)).toBe(4);
  });
});
