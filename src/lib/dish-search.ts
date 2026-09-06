/**
 * Campus-wide dish search: the index shape, and the pure ranking on top of it.
 *
 * The interesting decision is that dishes are keyed by NAME, not by menu item
 * id. Eight restaurants on one campus each sell a "Chicken Biryani", and a
 * student typing "bir" is asking a question about the dish, not about any one
 * kitchen's row in the database. So the index folds identical names into one
 * suggestion carrying the restaurants that serve it — which is exactly what
 * tapping the suggestion then needs in order to answer "who has this?".
 *
 * Ranking lives here rather than in the component so it can be unit-tested
 * without a DOM, and shared by the suggestion dropdown and the feed filter.
 */

export interface DishSuggestion {
  kind: "dish";
  /** Display name, cased as the vendor typed it on the first restaurant seen. */
  name: string;
  isVeg: boolean;
  /** Cheapest price across the restaurants serving it. */
  fromPricePaise: number;
  imageUrl: string | null;
  /** Every restaurant on this campus/zone whose menu carries the dish. */
  restaurantIds: string[];
  /** Any vendor flagged it popular — a weak but useful ranking nudge. */
  isPopular: boolean;
}

export interface RestaurantSuggestion {
  kind: "restaurant";
  id: string;
  name: string;
  slug: string;
  cuisines: string[];
  imageUrl: string | null;
  isServingNow: boolean;
}

export interface CuisineSuggestion {
  kind: "cuisine";
  name: string;
  restaurantIds: string[];
}

export type Suggestion = DishSuggestion | RestaurantSuggestion | CuisineSuggestion;

export interface CampusSearchIndex {
  dishes: DishSuggestion[];
  restaurants: RestaurantSuggestion[];
  cuisines: CuisineSuggestion[];
}

export const EMPTY_SEARCH_INDEX: CampusSearchIndex = {
  dishes: [],
  restaurants: [],
  cuisines: [],
};

/** Lowercase, de-accent, collapse punctuation and runs of whitespace. */
export function normalize(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}

/**
 * How well `text` answers `query`, lower being better; null means no match.
 *
 * The tiers are what make the dropdown feel like Swiggy's rather than like a
 * `String.includes` filter: "bir" must put *Bir*yani above Kol*ka*ta, and
 * "chick bir" must still find "Chicken Biryani" even though nothing in that
 * string contains the literal query.
 */
export function matchScore(text: string, query: string): number | null {
  const haystack = normalize(text);
  const needle = normalize(query);
  if (needle.length === 0) return null;

  if (haystack === needle) return 0;
  if (haystack.startsWith(needle)) return 1;

  const words = haystack.split(" ");
  if (words.some((word) => word.startsWith(needle))) return 2;
  if (haystack.includes(needle)) return 3;

  // Multi-token: every token must prefix some word ("chick bir" → Chicken Biryani).
  const tokens = needle.split(" ").filter(Boolean);
  if (tokens.length > 1 && tokens.every((t) => words.some((w) => w.startsWith(t)))) {
    return 4;
  }

  return null;
}

export function matchesQuery(text: string, query: string): boolean {
  return matchScore(text, query) !== null;
}

/** The best score across several fields, so a restaurant can match on cuisine. */
function bestScore(texts: readonly string[], query: string): number | null {
  let best: number | null = null;
  for (const text of texts) {
    const score = matchScore(text, query);
    if (score !== null && (best === null || score < best)) best = score;
  }
  return best;
}

/** The better (lower) of two optional scores. */
function bestOf(a: number | null, b: number | null): number | null {
  if (a === null) return b;
  if (b === null) return a;
  return Math.min(a, b);
}

interface Scored {
  suggestion: Suggestion;
  score: number;
}

/**
 * The dropdown list for a partial query.
 *
 * Dishes outrank restaurants at an equal score because the search bar says
 * "Search for dishes" and a student typing three letters is nearly always
 * naming food. Restaurant-name matches still surface, just below.
 */
export function rankSuggestions(
  index: CampusSearchIndex,
  query: string,
  limit = 8,
): Suggestion[] {
  if (normalize(query).length === 0) return [];

  const scored: Scored[] = [];

  for (const dish of index.dishes) {
    const score = matchScore(dish.name, query);
    if (score !== null) scored.push({ suggestion: dish, score });
  }

  for (const restaurant of index.restaurants) {
    // A cuisine hit is weaker evidence than a name hit — every biryani place
    // lists "Biryani" as a cuisine, so without the penalty the word "biryani"
    // would return five restaurants before it returned the dish itself.
    const nameScore = matchScore(restaurant.name, query);
    const cuisineScore = bestScore(restaurant.cuisines, query);
    const score = bestOf(nameScore, cuisineScore === null ? null : cuisineScore + 2);
    if (score !== null) scored.push({ suggestion: restaurant, score });
  }

  for (const cuisine of index.cuisines) {
    const score = matchScore(cuisine.name, query);
    if (score !== null) scored.push({ suggestion: cuisine, score });
  }

  const kindRank: Record<Suggestion["kind"], number> = {
    dish: 0,
    restaurant: 1,
    cuisine: 2,
  };

  return scored
    .sort((a, b) => {
      if (a.score !== b.score) return a.score - b.score;
      const kindDelta = kindRank[a.suggestion.kind] - kindRank[b.suggestion.kind];
      if (kindDelta !== 0) return kindDelta;
      const reachDelta = reach(b.suggestion) - reach(a.suggestion);
      if (reachDelta !== 0) return reachDelta;
      return a.suggestion.name.localeCompare(b.suggestion.name);
    })
    .slice(0, limit)
    .map((s) => s.suggestion);
}

/** How many restaurants a suggestion covers — a proxy for campus relevance. */
function reach(suggestion: Suggestion): number {
  if (suggestion.kind === "dish") return suggestion.restaurantIds.length + (suggestion.isPopular ? 1 : 0);
  if (suggestion.kind === "cuisine") return suggestion.restaurantIds.length;
  return suggestion.isServingNow ? 1 : 0;
}

export function label(suggestion: Suggestion): string {
  return suggestion.name;
}

/**
 * Split `text` so the part the student has typed can be rendered bold, the way
 * Zomato bolds "Bir" inside "Biryani". Falls back to a single unmatched run
 * when the query matched by tokens rather than a contiguous substring.
 */
export function highlightParts(
  text: string,
  query: string,
): { text: string; match: boolean }[] {
  const needle = normalize(query);
  if (!needle) return [{ text, match: false }];

  // Normalising can change length (punctuation → space), so search the raw
  // lowercase text for the raw lowercase query first; that covers the common case.
  const lower = text.toLowerCase();
  const raw = query.toLowerCase().trim();
  const at = raw ? lower.indexOf(raw) : -1;
  if (at === -1) return [{ text, match: false }];

  return [
    { text: text.slice(0, at), match: false },
    { text: text.slice(at, at + raw.length), match: true },
    { text: text.slice(at + raw.length), match: false },
  ].filter((part) => part.text.length > 0);
}

/**
 * Restaurant ids whose menu matches a free-text query.
 *
 * This is what makes typing "biryani" and pressing nothing at all still work:
 * the feed can widen its own name/cuisine filter with dish hits instead of
 * telling a student that nobody sells biryani.
 */
export function restaurantIdsMatchingDish(
  index: CampusSearchIndex,
  query: string,
): Set<string> {
  const ids = new Set<string>();
  if (normalize(query).length === 0) return ids;
  for (const dish of index.dishes) {
    if (matchScore(dish.name, query) === null) continue;
    for (const id of dish.restaurantIds) ids.add(id);
  }
  return ids;
}
