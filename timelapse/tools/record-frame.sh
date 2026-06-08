#!/usr/bin/env bash
# Capture a TanKING build at a given commit and append it to the timelapse manifest.
#
# Usage:
#   tools/record-frame.sh <commit> <mode> <outName> <date> "<title>" "<desc>" [section]
#
#   commit   git commit-ish to capture (e.g. HEAD, a hash, a tag)
#   mode     arena | hangar | designer | raw     (how to pose the game before the shot)
#   outName  png filename, saved under frames/   (e.g. frame6-0620-bosses.png)
#   date     short label shown on the timeline   (e.g. "Jun 20")
#   title    badge title                          (e.g. "First Boss")
#   desc     one-paragraph description
#   section  optional: "base" to tag it into the Base Evolution sub-series
#
# Example:
#   tools/record-frame.sh HEAD arena frame6-0620-boss.png "Jun 20" "First Boss" "The Iron Keep boss fight lands."
set -euo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TL="$(cd "$HERE/.." && pwd)"                 # timelapse/
REPO="$(git -C "$TL" rev-parse --show-toplevel)"
WT="/tmp/tanking-tl-rec"
PORT=8097

commit="${1:?need commit}"; mode="${2:?need mode}"; out="${3:?need outName}"
date="${4:?need date}"; title="${5:?need title}"; desc="${6:?need desc}"; section="${7:-}"

# mode -> capture recipe (matches current build start-flow conventions)
case "$mode" in
  raw)      keys='[]';                 settle=3500; eval='';                                                        post=0 ;;
  hangar)   keys='[["Enter",4500]]';   settle=2800; eval='';                                                        post=0 ;;
  designer) keys='[["t",5000]]';       settle=2500; eval='';                                                        post=0 ;;
  arena)    keys='[["Enter",4000]]';   settle=2500; eval="document.getElementById('hangar-panel-deploy').click()"; post=4500 ;;
  *) echo "unknown mode: $mode (use arena|hangar|designer|raw)"; exit 1 ;;
esac

echo "▶ recording $commit ($mode) -> frames/$out"
rm -rf "$WT"; git -C "$REPO" worktree add --detach "$WT" "$commit" >/dev/null 2>&1
ln -sfn "$REPO/node_modules" "$WT/node_modules"
( cd "$WT" && npx vite build >/tmp/tl-rec-build.log 2>&1 ) || { echo "build failed:"; tail -8 /tmp/tl-rec-build.log; exit 1; }

lsof -ti tcp:$PORT 2>/dev/null | xargs kill -9 2>/dev/null || true
( cd "$WT/dist" && python3 -m http.server $PORT >/tmp/tl-rec-serve.log 2>&1 & )
sleep 1.2

node "$HERE/capture.js" "http://localhost:$PORT/" "$TL/frames/$out" "$keys" "$settle" "$eval" "$post"

lsof -ti tcp:$PORT 2>/dev/null | xargs kill -9 2>/dev/null || true
git -C "$REPO" worktree remove "$WT" --force >/dev/null 2>&1 || true
git -C "$REPO" worktree prune >/dev/null 2>&1 || true

# append to frames.js (parse the embedded JSON array, push, rewrite)
node -e '
  const fs=require("fs");
  const f=process.argv[1];
  const t=fs.readFileSync(f,"utf8");
  const a=t.indexOf("["), b=t.lastIndexOf("]");
  const arr=JSON.parse(t.slice(a,b+1));
  const e={file:"frames/"+process.argv[2],date:process.argv[3],commit:process.argv[4],title:process.argv[5],desc:process.argv[6]};
  if(process.argv[7]) e.section=process.argv[7];
  arr.push(e);
  const head=t.slice(0,t.indexOf("window.TIMELAPSE_FRAMES"));
  fs.writeFileSync(f, head+"window.TIMELAPSE_FRAMES = "+JSON.stringify(arr,null,2)+";\n");
  console.log("appended frame "+arr.length+" -> "+process.argv[2]);
' "$TL/frames.js" "$out" "$date" "$commit" "$title" "$desc" "$section"

echo "✔ done. Refresh the viewer to see it."
