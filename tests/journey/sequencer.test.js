import { describe, it, expect } from 'vitest';
import { assembleJourney } from '../../src/journey/sequencer.js';
import { MAX_FUEL } from '../../src/journey/legs.js';

describe('sequencer', () => {
  it('assembles the requested number of legs', () => {
    const legs = assembleJourney({ seed: 1, count: 3 });
    expect(legs).toHaveLength(3);
    legs.forEach(l => expect(typeof l.id).toBe('string'));
  });

  it('is deterministic for a given seed', () => {
    const a = assembleJourney({ seed: 7, count: 3 }).map(l => l.id);
    const b = assembleJourney({ seed: 7, count: 3 }).map(l => l.id);
    expect(a).toEqual(b);
  });

  it('guarantees a mandatory fuel stop: cumulative fuelCost exceeds MAX_FUEL before the last leg', () => {
    const legs = assembleJourney({ seed: 3, count: 3 });
    const firstTwo = legs[0].fuelCost + legs[1].fuelCost;
    expect(firstTwo).toBeGreaterThan(MAX_FUEL);
  });

  it('the final leg has no fork exits (ends in extraction)', () => {
    const legs = assembleJourney({ seed: 9, count: 3 });
    expect(legs[legs.length - 1].exits).toEqual([]);
  });
});
