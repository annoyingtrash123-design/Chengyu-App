import type { Filters } from "./types";

export function emptyFilters(): Filters {
  return {
    kinds: [],
    themes: [],
    themes_all: false,
    lengths: [],
    structures: [],
    frequencies: [],
    sentiments: [],
    registers: [],
    statuses: [],
    favourites_only: false,
    has_origin: false,
  };
}

export function activeFilterCount(f: Filters): number {
  return (
    f.kinds.length +
    f.themes.length +
    f.lengths.length +
    f.structures.length +
    f.frequencies.length +
    f.sentiments.length +
    f.registers.length +
    f.statuses.length +
    Number(f.favourites_only) +
    Number(f.has_origin)
  );
}
