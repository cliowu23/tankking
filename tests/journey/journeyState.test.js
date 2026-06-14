import { describe, it, expect, beforeEach, vi } from 'vitest';

// jsdom-free localStorage stub
beforeEach(() => {
  const store = new Map();
  vi.stubGlobal('localStorage', {
    getItem: (k) => (store.has(k) ? store.get(k) : null),
    setItem: (k, v) => store.set(k, String(v)),
    removeItem: (k) => store.delete(k),
  });
  vi.resetModules();
});

async function fresh() {
  const m = await import('../../src/journey/journeyState.js');
  return m;
}

describe('journeyState', () => {
  it('startJourney initializes fuel full, leg 0, empty threads', async () => {
    const J = await fresh();
    J.startJourney({ totalLegs: 3, maxFuel: 100 });
    const s = J.getJourney();
    expect(s.legIndex).toBe(0);
    expect(s.totalLegs).toBe(3);
    expect(s.fuel).toBe(100);
    expect(s.runSalvage).toBe(0);
    expect(s.allies).toEqual([]);
    expect(s.threads).toEqual({ power: 0, bonds: 0, truth: 0 });
    expect(s.hpCarry).toBe(null);
  });

  it('drainFuel clamps at 0 and reports stranded', async () => {
    const J = await fresh();
    J.startJourney({ totalLegs: 3, maxFuel: 100 });
    J.drainFuel(40);
    expect(J.getJourney().fuel).toBe(60);
    expect(J.isStranded()).toBe(false);
    J.drainFuel(999);
    expect(J.getJourney().fuel).toBe(0);
    expect(J.isStranded()).toBe(true);
  });

  it('refuel adds amount and clamps at maxFuel', async () => {
    const J = await fresh();
    J.startJourney({ totalLegs: 3, maxFuel: 100 });
    J.drainFuel(60);          // fuel = 40
    J.refuel(30);             // partial: 40 + 30 = 70
    expect(J.getJourney().fuel).toBe(70);
    J.refuel(50);             // 70 + 50 = 120 → clamps to 100
    expect(J.getJourney().fuel).toBe(100);
  });

  it('addSalvage accumulates; recruitAlly ticks bonds; tickThread caps at 100', async () => {
    const J = await fresh();
    J.startJourney({ totalLegs: 3, maxFuel: 100 });
    J.addSalvage(30);
    J.addSalvage(20);
    expect(J.getJourney().runSalvage).toBe(50);
    J.recruitAlly('defected-pilot');
    expect(J.getJourney().allies).toEqual(['defected-pilot']);
    expect(J.getJourney().threads.bonds).toBeGreaterThan(0);
    J.tickThread('truth', 999);
    expect(J.getJourney().threads.truth).toBe(100);
  });

  it('spendSalvage subtracts when affordable and refuses when not', async () => {
    const J = await fresh();
    J.startJourney({ totalLegs: 3, maxFuel: 100 });
    J.addSalvage(50);
    expect(J.spendSalvage(20)).toBe(true);
    expect(J.getJourney().runSalvage).toBe(30);
    expect(J.spendSalvage(999)).toBe(false);   // not enough → no-op
    expect(J.getJourney().runSalvage).toBe(30);
  });

  it('advanceLeg increments and isComplete fires after last leg', async () => {
    const J = await fresh();
    J.startJourney({ totalLegs: 2, maxFuel: 100 });
    expect(J.isComplete()).toBe(false);
    J.advanceLeg();
    expect(J.getJourney().legIndex).toBe(1);
    expect(J.isComplete()).toBe(false);
    J.advanceLeg();
    expect(J.isComplete()).toBe(true);
  });

  it('persists across reload and bankJourney clears + returns total', async () => {
    let J = await fresh();
    J.startJourney({ totalLegs: 3, maxFuel: 100 });
    J.addSalvage(42);
    J.drainFuel(10);
    vi.resetModules();
    J = await import('../../src/journey/journeyState.js');
    J.restoreJourney();
    expect(J.getJourney().runSalvage).toBe(42);
    expect(J.getJourney().fuel).toBe(90);
    const banked = J.bankJourney();
    expect(banked).toBeGreaterThanOrEqual(42);
    expect(J.hasActiveJourney()).toBe(false);
  });

  it('setHpCarry / hpCarry round-trips for cross-leg damage persistence', async () => {
    const J = await fresh();
    J.startJourney({ totalLegs: 3, maxFuel: 100 });
    J.setHpCarry(0.55);
    expect(J.getJourney().hpCarry).toBeCloseTo(0.55);
  });
});
