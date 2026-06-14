// src/journey/ForkScreen.js
// Between-leg fork (abstracted, per the plan's "prototype abstracted, ship toward
// seamless"). Presents the upcoming leg's exit kinds; resolves with the choice.

import * as Journey from './journeyState.js';

const LABELS = {
  town:  ['TOWN ▸ refuel & trade', 'Safer. Tops up fuel, costs salvage.'],
  field: ['OPEN FIELD ▸ scavenge & allies', 'Risky. A chance to recruit a pilot.'],
};

export function openFork(exitKinds) {
  return new Promise((resolve) => {
    const screen  = document.getElementById('fork-screen');
    const sub     = document.getElementById('fork-sub');
    const actions = document.getElementById('fork-actions');
    const j = Journey.getJourney();
    sub.textContent = j ? `Fuel ${Math.round(j.fuel)}/${j.maxFuel} · Salvage ${j.runSalvage}` : '';
    actions.innerHTML = '';
    screen.style.display = 'flex';

    for (const kind of exitKinds) {
      const [label, desc] = LABELS[kind] ?? [kind, ''];
      const b = document.createElement('button');
      b.className = 'editor-btn';
      b.style.cssText = 'display:flex;flex-direction:column;padding:16px 20px;min-width:200px;';
      b.innerHTML = `<span style="font-size:15px;letter-spacing:2px;">${label}</span>
        <span style="font-size:11px;opacity:0.7;margin-top:6px;">${desc}</span>`;
      b.addEventListener('click', () => { screen.style.display = 'none'; resolve(kind); });
      actions.appendChild(b);
    }
  });
}
