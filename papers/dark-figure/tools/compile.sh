#!/usr/bin/env bash
# Concurrency-safe compile: builds into build/<id>/ so parallel agents never share aux files.
# Usage: bash tools/compile.sh [id]   (run from papers/dark-figure/)
# Prints errors, undefined refs/citations, and overfull boxes. Exit 1 on LaTeX error.
set -u
cd "$(dirname "$0")/.."
for f in refs bib/sources bib/theory bib/linkage bib/bayes bib/lead; do [ -f "$f.bib" ] || : > "$f.bib"; done
id="${1:-$$-$RANDOM}"
out="build/$id"
mkdir -p "$out"
export BIBINPUTS="$(pwd):$(pwd)/bib:"
export TEXINPUTS="$(pwd):"
latexmk -pdf -interaction=nonstopmode -halt-on-error -file-line-error -outdir="$out" main.tex >"$out/latexmk.stdout" 2>&1
status=$?
log="$out/main.log"
echo "== build dir: $out  (exit $status)"
grep -E "^[^ ]*\.(tex|sty|cls|bbl):[0-9]+:|^! " "$log" 2>/dev/null | head -30
grep -E "LaTeX Warning: (Reference|Citation).*undefined" "$log" 2>/dev/null | sort -u | head -40
grep -E "Overfull \\\\hbox \(([1-9][0-9]+|[1-9][0-9]*\.[0-9]+)pt" "$log" 2>/dev/null | awk '{ if ($4+0 > 10 || $3 ~ /\(/) print }' | head -20
grep -c "Repeated entry" "$out/main.blg" 2>/dev/null | sed 's/^/bibtex repeated entries: /'
[ -f "$out/main.pdf" ] && pdfinfo "$out/main.pdf" 2>/dev/null | grep Pages
exit $status
