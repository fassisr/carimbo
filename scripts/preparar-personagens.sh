#!/usr/bin/env bash
# Descompacta os pacotes, converte cada .gltf para .glb com texturas de no máximo 1024 px e lista tudo.
set -e
npm i -g @gltf-transform/cli@4 >/dev/null 2>&1
mkdir -p saida bruto
for z in itch/*/*.zip; do unzip -q -o "$z" -d "bruto/$(basename "$(dirname "$z")")" || true; done
find bruto -type f | sed 's|^bruto/||' | sort > saida/LISTA.txt
du -sh bruto/* >> saida/LISTA.txt || true
find bruto \( -iname '*.gltf' -o -iname '*.glb' \) | while read -r f; do
  rel="${f#bruto/}"; out="saida/glb/${rel%.*}.glb"; mkdir -p "$(dirname "$out")"
  gltf-transform resize "$f" /tmp/r.glb --width 1024 --height 1024 >/dev/null 2>&1 && gltf-transform copy /tmp/r.glb "$out" >/dev/null 2>&1 || echo "falhou $rel" >> saida/LISTA.txt
done
find saida/glb -name '*.glb' -size +40M -delete
( cd saida && find glb -name '*.glb' -exec ls -la {} \; | awk '{print $5, $9}' | sort -k2 ) > saida/GLB.txt
cp itch/*/*.txt saida/ 2>/dev/null || true
echo "Pacotes CC0 da Quaternius (quaternius.itch.io). Licença: Creative Commons Zero v1.0." > saida/LICENCA.txt
