import type { Rarity } from '../../shared/types.ts';

/*
 * All token rules live here, so they're easy to tweak.
 *
 * Idea: whoever listens to lesser-known albums earns more, and lesser-known
 * albums are cheaper to buy. That makes discovery worth it.
 */

export const REWARD_FIRST_LISTEN = 200;
export const REWARD_REPEAT_LISTEN = 50;
export const BASE_PRICE = 400;
/** At least this share of the album must actually be heard to earn anything. */
export const MIN_COVERAGE = 0.5;

interface RarityTier {
  rarity: Rarity;
  /** Lower bound of the average views per track. */
  minViews: number;
  multiplier: number;
}

// Popularity = average YouTube views per track.
const TIERS: RarityTier[] = [
  { rarity: 'classic', minViews: 50_000_000, multiplier: 0.75 },
  { rarity: 'well-known', minViews: 10_000_000, multiplier: 1 },
  { rarity: 'acclaimed', minViews: 1_000_000, multiplier: 1.25 },
  { rarity: 'discovery', minViews: 100_000, multiplier: 1.5 },
  { rarity: 'hidden gem', minViews: 0, multiplier: 2 },
];

export function rarityFor(avgViews: number): Rarity {
  return (TIERS.find((t) => avgViews >= t.minViews) ?? TIERS.at(-1)!).rarity;
}

const multiplier = (rarity: Rarity) => TIERS.find((t) => t.rarity === rarity)?.multiplier ?? 1;

export function rewardFor(rarity: Rarity) {
  const m = multiplier(rarity);
  return {
    first: Math.round((REWARD_FIRST_LISTEN * m) / 5) * 5,
    repeat: Math.round((REWARD_REPEAT_LISTEN * m) / 5) * 5,
  };
}

/** Classics cost more, hidden gems less. */
export function priceFor(rarity: Rarity) {
  return Math.round(BASE_PRICE / multiplier(rarity) / 10) * 10;
}

/**
 * Payout after a listen: the full reward scaled by how much was actually
 * heard. Whoever lifts the needle and skips hears less, so earns less.
 */
export function payout(potential: number, coverage: number) {
  if (coverage < MIN_COVERAGE) return 0;
  return Math.round(potential * Math.min(1, coverage));
}
