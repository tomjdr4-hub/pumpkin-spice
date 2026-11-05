#!/bin/bash
# Publie une version : vérifie l'arbre et la version, compile les compendiums, pousse, construit le zip
# et crée la release GitHub sur le commit courant.
# Usage : tools/release.sh vX.Y.Z "Titre" "Notes"
set -e
cd "$(dirname "$0")/.."
REPO=tomjdr4-hub/pumpkin-spice
test -z "$(git status --porcelain)" || { echo "Arbre non propre, abandon"; exit 1; }
grep -q "\"version\": \"${1#v}\"" system.json || { echo "La version de system.json ne correspond pas à $1"; exit 1; }
npm run -s gen:packs >/dev/null
npm run -s build:packs >/dev/null
git push -q origin main
rm -rf dist && mkdir dist
python - "$1" <<'PY'
import sys, zipfile, os, json
tag = sys.argv[1]
# Manifeste de la release : lien de téléchargement figé sur cette version.
manifest = json.load(open("system.json", encoding="utf-8"))
manifest["download"] = f"https://github.com/tomjdr4-hub/pumpkin-spice/releases/download/{tag}/pumpkin-spice.zip"
data = json.dumps(manifest, indent=2, ensure_ascii=False) + "\n"
open("dist/system.json", "w", encoding="utf-8").write(data)
with zipfile.ZipFile("dist/pumpkin-spice.zip", "w", zipfile.ZIP_DEFLATED) as z:
    z.writestr("system.json", data)
    for root in ["pumpkin-spice.mjs", "README.md", "LICENSE", "module", "templates", "styles", "lang", "assets", "packs"]:
        if os.path.isfile(root):
            z.write(root)
            continue
        for dp, _, fs in os.walk(root):
            for f in fs:
                if f != "LOCK":
                    z.write(os.path.join(dp, f).replace("\\", "/"))
    print(len(z.namelist()), "fichiers dans le zip")
PY
gh release create "$1" dist/pumpkin-spice.zip dist/system.json --repo "$REPO" --target "$(git rev-parse HEAD)" --title "$2" --notes "$3"
rm -rf dist
echo "Tag distant : $(git ls-remote --tags origin "$1" | cut -c1-7) / HEAD : $(git rev-parse --short HEAD)"
curl -sL "https://github.com/$REPO/releases/latest/download/system.json" | grep '"version"'
