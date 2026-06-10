// Tank Tuner helper server — saves canon params + reruns Blender headlessly.
// Run:  node scripts/modelgen/tuner-server.mjs   (then open http://localhost:5173/tuner.html)
// Endpoints (CORS open for the Vite dev origin):
//   GET  /params            → current params/player_tank.json
//   POST /save   {params}   → write the canon JSON (no regen) — used by DUMP/autosave
//   POST /regen  {params, parts:['hull'|'turret'|'gun']} → save, then re-export those GLBs
import { createServer } from 'node:http';
import { readFileSync, writeFileSync } from 'node:fs';
import { execFile } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const DIR = dirname(fileURLToPath(import.meta.url));
const PARAMS = join(DIR, 'params', 'player_tank.json');
const PORT = 7077;

const SCRIPTS = {
  hull:   'player_hull_base.py',
  turret: 'player_turret_base.py',
  gun:    'player_gun_90mm.py',
};

function runBlender(script) {
  return new Promise((resolve, reject) => {
    execFile('blender', ['--background', '--python', join(DIR, script)],
      { env: { ...process.env, TANK_TUNER: '1' }, timeout: 60_000 },
      (err, stdout, stderr) => {
        if (err) return reject(new Error(`${script}: ${err.message}\n${stderr}`));
        if (!stdout.includes('[modelgen] exported')) {
          return reject(new Error(`${script}: no export line\n${stdout.slice(-800)}`));
        }
        resolve();
      });
  });
}

function send(res, code, body) {
  res.writeHead(code, {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  });
  res.end(JSON.stringify(body));
}

createServer(async (req, res) => {
  if (req.method === 'OPTIONS') return send(res, 204, {});
  try {
    if (req.method === 'GET' && req.url === '/params') {
      return send(res, 200, JSON.parse(readFileSync(PARAMS, 'utf8')));
    }
    if (req.method === 'POST') {
      let raw = '';
      for await (const chunk of req) raw += chunk;
      const body = JSON.parse(raw || '{}');
      if (body.params) writeFileSync(PARAMS, JSON.stringify(body.params, null, 2) + '\n');
      if (req.url === '/save') return send(res, 200, { ok: true });
      if (req.url === '/regen') {
        const parts = (body.parts ?? []).filter(p => SCRIPTS[p]);
        const t0 = Date.now();
        for (const p of parts) await runBlender(SCRIPTS[p]);   // sequential — Blender is heavy
        return send(res, 200, { ok: true, parts, ms: Date.now() - t0 });
      }
    }
    send(res, 404, { error: 'not found' });
  } catch (e) {
    console.error(e.message);
    send(res, 500, { error: e.message });
  }
}).listen(PORT, () => console.log(`[tuner] helper on http://localhost:${PORT} — open http://localhost:5173/tuner.html`));
