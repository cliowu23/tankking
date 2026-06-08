/* TanKING development timelapse — frame manifest.
   This file is the living record. To add a frame, run:
     tools/record-frame.sh   (it appends here automatically)
   or hand-edit the array below. Format is plain JSON so it stays easy to parse.
   Optional flags per frame:  "recreation": true   |   "section": "base"
*/
window.TIMELAPSE_FRAMES = [
  {
    "file": "frames/frame00-earlymay-proto.png",
    "date": "~May 8",
    "commit": "pre-git",
    "title": "The First Prototype · Phaser",
    "recreation": true,
    "desc": "The genuine genesis. Before GitHub, before Vercel, before this repo — just blue and red rectangles driving around a white screen in Phaser 3, with stick barrels, crude green health bars and the BOOST/HULL meters. No original survives; a reconstruction of how it actually looked."
  },
  {
    "file": "frames/frame0-0515-phaser2d.png",
    "date": "~May 15",
    "commit": "pre-git",
    "title": "The 2D Era · Stylized",
    "recreation": true,
    "desc": "A stylized reconstruction of the 2D vibe — not how it literally looked (that was the rectangles), but the dystopian arena-shooter feeling it reached for before the engine pivot. Then you jumped to Babylon for real 3D turrets, elevation and shell arcs."
  },
  {
    "file": "frames/frame1-0530-slice.png",
    "date": "May 30",
    "commit": "afcda36",
    "title": "First Vertical Slice",
    "desc": "The 2D-to-3D leap lands. Pure top-down arena, a primitive olive M26, red box-enemies with health bars, and the chunky BOOST/HULL HUD. The entire game in its rawest, most honest form — a flat lavender void and a tank."
  },
  {
    "file": "frames/frame2-0601-combat.png",
    "date": "Jun 1",
    "commit": "04b3638",
    "title": "Combat Feel",
    "desc": "37 commits in a single day. The camera tilts into an action 3/4 view, the M26 gets its cobalt-blue paint, flat-shot gunnery and zone crits arrive, and the grid arena replaces the void. It finally feels like a game."
  },
  {
    "file": "frames/frame4-0604-modular.png",
    "date": "Jun 4",
    "commit": "a721f30",
    "title": "Modular Tanks",
    "desc": "Tanks become LEGO. A blueprint-grid designer lets you swap hull, turret and cannon — M26, T-44, Pershing. Adaptive composition seats every part automatically. The fully-detailed GLB replaces the primitive forever."
  },
  {
    "file": "frames/frame5-0608-extraction.png",
    "date": "Jun 8",
    "commit": "0d219ab",
    "title": "Extraction Loop",
    "desc": "Yellow salvage crates litter the arena, a live SALVAGE counter sits in the HUD, and an extraction pad banks your loot — die and you lose the run, extract and you keep it. The roguelite core begins. Steam is the north star."
  },
  {
    "file": "frames/base1-0602.png",
    "date": "Jun 2",
    "commit": "d86e962",
    "title": "The Base · Empty Bunker",
    "section": "base",
    "desc": "BONUS — how the bunker itself grew. June 2: a bare concrete shell. Dark walls, a couple of empty workbenches, the tank parked up top, your driver alone in the room. Four walls and a floor — but the game finally had a home."
  },
  {
    "file": "frames/base3-0605.png",
    "date": "Jun 5",
    "commit": "84d3a60",
    "title": "The Base · Furnished",
    "section": "base",
    "desc": "June 5: built out. A deploy bay cradles the tank on its pad, ringed by oil drums and crates. A lounge corner, weapon racks and workbenches line the walls. The bunker starts to feel inhabited, not just constructed."
  },
  {
    "file": "frames/base4-0608.png",
    "date": "Jun 8",
    "commit": "0d219ab",
    "title": "The Base · Lived-In",
    "section": "base",
    "desc": "Today: it breathes. The lounge glows with warm lamplight (the Crew Quarters), and BANKED SALVAGE now reads in the corner — the extraction economy reaching all the way home. Same four walls as June 2; a completely different feeling."
  }
];
