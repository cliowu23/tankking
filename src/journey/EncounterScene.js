// src/journey/EncounterScene.js
// Lightweight DOM "scene" for a roadside exit. P0: town (trader → refuel for
// salvage) and field (ally rescue → recruit, ticks Bonds). Returns a Promise
// that resolves when the player leaves, so main.js can fade back to the arena.

import * as Journey from './journeyState.js';

const REFUEL_AMOUNT = 60;   // fuel restored per purchase
const REFUEL_COST   = 20;   // salvage per purchase
const ALLY_ID       = 'defected-pilot';
const ALLY_FUEL_GIFT = 25;  // the rescued pilot shares a fuel can

function el(id) { return document.getElementById(id); }

function button(label, onClick) {
  const b = document.createElement('button');
  b.textContent = label;
  b.className = 'editor-btn';
  b.addEventListener('click', onClick);
  return b;
}

function fuelLine() {
  const j = Journey.getJourney();
  return `Fuel ${Math.round(j.fuel)}/${j.maxFuel} · Salvage ${j.runSalvage}`;
}

// kind: 'town' | 'field'. Resolves with a summary the caller can log/tick.
export function openEncounter(kind) {
  return new Promise((resolve) => {
    const screen  = el('encounter-screen');
    const title   = el('encounter-title');
    const body    = el('encounter-body');
    const actions = el('encounter-actions');
    actions.innerHTML = '';
    screen.style.display = 'flex';

    const close = (summary) => { screen.style.display = 'none'; resolve(summary); };

    if (kind === 'town') {
      title.textContent = 'TOWN — ROADSIDE DEPOT';
      body.textContent = `A human holdout still trades here. ${fuelLine()}.`;
      actions.appendChild(button(`REFUEL (+${REFUEL_AMOUNT}) — ${REFUEL_COST} salvage`, () => {
        if (Journey.spendSalvage(REFUEL_COST)) {
          Journey.refuel(REFUEL_AMOUNT);
          body.textContent = `Topped up. ${fuelLine()}.`;
        } else {
          body.textContent = `Not enough salvage to refuel. ${fuelLine()}.`;
        }
      }));
      actions.appendChild(button('BACK TO THE ROAD', () => close({ kind, refueled: true })));
    } else {
      title.textContent = 'OPEN FIELD — DERELICT CONVOY';
      body.textContent = 'A defected pilot waves you down from a wrecked convoy. Off-grid, like you.';
      actions.appendChild(button('RESCUE THE PILOT (+BONDS)', () => {
        Journey.recruitAlly(ALLY_ID);
        Journey.refuel(ALLY_FUEL_GIFT);
        body.textContent = 'The pilot climbs aboard. The bunker will be one warmer tonight.';
        actions.innerHTML = '';
        actions.appendChild(button('BACK TO THE ROAD', () => close({ kind, recruited: true })));
      }));
      actions.appendChild(button('LEAVE THEM (RISK)', () => close({ kind, recruited: false })));
    }
  });
}
