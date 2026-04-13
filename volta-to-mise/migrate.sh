#!/usr/bin/env zsh
#
# volta-to-mise migration script
#
# Migrates a repo from Volta to mise for Node/Yarn version management.
# Based on the pattern from movableink/ojos#1735.
#
# What it does:
#   1. Reads volta config from package.json (root + workspace packages)
#   2. Creates a mise.toml with [tools] section
#   3. Removes volta field from all package.json files
#   4. Deletes .node-version / .ruby-version if present
#
# Dependencies: none (uses python3 for JSON — ships with macOS)
#
# Usage:
#   ./volta-to-mise/migrate.sh <target-dir>
#   ./volta-to-mise/migrate.sh <target-dir> --dry-run
#   ./volta-to-mise/migrate.sh <target-dir> --keep-volta     # don't remove volta from package.json
#   ./volta-to-mise/migrate.sh <target-dir> --include-env

set -euo pipefail

DRY_RUN=false
INCLUDE_ENV=false
KEEP_VOLTA=false
TARGET_DIR=""

for arg in "$@"; do
  case "$arg" in
    --dry-run)     DRY_RUN=true ;;
    --include-env) INCLUDE_ENV=true ;;
    --keep-volta)  KEEP_VOLTA=true ;;
    -*) echo "Unknown flag: $arg" >&2; exit 1 ;;
    *)  TARGET_DIR="$arg" ;;
  esac
done

TARGET_DIR="${TARGET_DIR:-.}"
TARGET_DIR="$(cd "$TARGET_DIR" && pwd)"

if [[ ! -f "$TARGET_DIR/package.json" ]]; then
  echo "Error: No package.json found in $TARGET_DIR" >&2
  exit 1
fi

# --- JSON helpers (python3 ships with macOS, no deps needed) ---
json_get() {
  python3 -c "
import json, sys
data = json.load(open('$1'))
keys = '$2'.split('.')
for k in keys:
    if isinstance(data, dict) and k in data:
        data = data[k]
    else:
        sys.exit(0)
print(data if isinstance(data, str) else json.dumps(data))
"
}

json_has_key() {
  python3 -c "
import json, sys
data = json.load(open('$1'))
keys = '$2'.split('.')
for k in keys:
    if isinstance(data, dict) and k in data:
        data = data[k]
    else:
        sys.exit(1)
sys.exit(0)
" 2>/dev/null
}

json_remove_key() {
  python3 -c "
import json
with open('$1') as f:
    raw = f.read()
data = json.loads(raw)

# detect indent
indent = 2
for line in raw.splitlines()[1:]:
    stripped = line.lstrip()
    if stripped.startswith('\"'):
        indent = len(line) - len(stripped)
        break

if '$2' in data:
    del data['$2']

with open('$1', 'w') as f:
    json.dump(data, f, indent=indent)
    f.write('\n')
"
}

# --- Step 1: Extract volta config ---
if ! json_has_key "$TARGET_DIR/package.json" "volta"; then
  echo "Error: No volta config found in root package.json — nothing to migrate." >&2
  exit 1
fi

VOLTA_NODE="$(json_get "$TARGET_DIR/package.json" "volta.node")"
VOLTA_YARN="$(json_get "$TARGET_DIR/package.json" "volta.yarn")"
VOLTA_NPM="$(json_get "$TARGET_DIR/package.json" "volta.npm")"
VOLTA_PNPM="$(json_get "$TARGET_DIR/package.json" "volta.pnpm")"

echo ""
echo "Volta config found in root package.json:"
[[ -n "$VOLTA_NODE" ]] && echo "  node: $VOLTA_NODE"
[[ -n "$VOLTA_YARN" ]] && echo "  yarn: $VOLTA_YARN"
[[ -n "$VOLTA_NPM" ]]  && echo "  npm:  $VOLTA_NPM"
[[ -n "$VOLTA_PNPM" ]] && echo "  pnpm: $VOLTA_PNPM"

# --- Step 2: Check for version files to absorb ---
EXTRA_RUBY=""
EXTRA_PYTHON=""

for vfile in .node-version .ruby-version .python-version; do
  filepath="$TARGET_DIR/$vfile"
  if [[ -f "$filepath" ]]; then
    version="$(cat "$filepath" | tr -d '[:space:]')"
    echo "  Found $vfile: $version"
    case "$vfile" in
      .ruby-version)   EXTRA_RUBY="$version" ;;
      .python-version) EXTRA_PYTHON="$version" ;;
    esac
  fi
done

# --- Step 3: Generate mise.toml ---
MISE_CONTENT="[tools]"
[[ -n "$VOLTA_NODE" ]] && MISE_CONTENT="$MISE_CONTENT
node = \"$VOLTA_NODE\""
[[ -n "$EXTRA_RUBY" ]] && MISE_CONTENT="$MISE_CONTENT
ruby = \"$EXTRA_RUBY\""
[[ -n "$EXTRA_PYTHON" ]] && MISE_CONTENT="$MISE_CONTENT
python = \"$EXTRA_PYTHON\""
[[ -n "$VOLTA_YARN" ]] && MISE_CONTENT="$MISE_CONTENT
yarn = \"$VOLTA_YARN\""
[[ -n "$VOLTA_NPM" ]] && MISE_CONTENT="$MISE_CONTENT
npm = \"$VOLTA_NPM\""
[[ -n "$VOLTA_PNPM" ]] && MISE_CONTENT="$MISE_CONTENT
pnpm = \"$VOLTA_PNPM\""
MISE_CONTENT="$MISE_CONTENT
"

if [[ "$INCLUDE_ENV" == true ]]; then
  MISE_CONTENT="$MISE_CONTENT
# [env]
# MY_VAR = \"value\"
# DYNAMIC_VAR = \"{{exec(command='echo hello')}}\"
"
fi

echo ""
echo "Generated mise.toml:"
echo "---"
echo "$MISE_CONTENT"
echo "---"

# --- Step 4: Find all package.json files with volta ---
PKG_FILES=("$TARGET_DIR/package.json")

# read workspaces from package.json
WORKSPACES="$(python3 -c "
import json
pkg = json.load(open('$TARGET_DIR/package.json'))
ws = pkg.get('workspaces', [])
if isinstance(ws, dict):
    ws = ws.get('packages', [])
for w in ws:
    print(w)
" 2>/dev/null)"

while IFS= read -r pattern; do
  [[ -z "$pattern" ]] && continue
  base_dir="$TARGET_DIR/${pattern%%/\*}"
  [[ ! -d "$base_dir" ]] && continue

  # find package.json files with volta in workspace dirs (max 2 levels deep)
  while IFS= read -r pkg_file; do
    if json_has_key "$pkg_file" "volta"; then
      PKG_FILES+=("$pkg_file")
    fi
  done < <(find "$base_dir" -maxdepth 3 -name "package.json" -not -path "*/node_modules/*" 2>/dev/null)
done <<< "$WORKSPACES"

# dedupe
PKG_FILES=("${(@u)PKG_FILES}")

echo "Found ${#PKG_FILES[@]} package.json file(s) with volta config:"
for f in "${PKG_FILES[@]}"; do
  rel="${f#"$TARGET_DIR/"}"
  echo "  $rel"
done

# --- Step 5: Apply changes ---
if [[ "$DRY_RUN" == true ]]; then
  echo ""
  echo "[dry run] No files modified."
  echo ""
  echo "Would create: mise.toml"
  if [[ "$KEEP_VOLTA" == false ]]; then
    for f in "${PKG_FILES[@]}"; do
      echo "Would modify: ${f#"$TARGET_DIR/"} (remove volta field)"
    done
  else
    echo "Would keep volta in all package.json files (--keep-volta)"
  fi
  for vfile in .node-version .ruby-version .python-version; do
    [[ -f "$TARGET_DIR/$vfile" ]] && echo "Would delete: $vfile"
  done
  exit 0
fi

# Write mise.toml
if [[ -f "$TARGET_DIR/mise.toml" ]]; then
  echo ""
  echo "WARNING: mise.toml already exists — skipping creation. Review manually."
else
  echo "$MISE_CONTENT" > "$TARGET_DIR/mise.toml"
  echo ""
  echo "Created mise.toml"
fi

# Remove volta from all package.json files
if [[ "$KEEP_VOLTA" == false ]]; then
  for f in "${PKG_FILES[@]}"; do
    json_remove_key "$f" "volta"
    echo "Removed volta from ${f#"$TARGET_DIR/"}"
  done
else
  echo "Kept volta in all package.json files (--keep-volta)"
fi

# Delete version files
for vfile in .node-version .ruby-version .python-version; do
  filepath="$TARGET_DIR/$vfile"
  if [[ -f "$filepath" ]]; then
    rm "$filepath"
    echo "Deleted $vfile (version absorbed into mise.toml)"
  fi
done

echo "
---
Migration complete. Next steps:

1. Review the generated mise.toml
2. Update CI workflows:
   - Replace volta-cli/action@v4 with jdx/mise-action@v2
   - Remove ruby/setup-ruby / actions/setup-node if mise handles those tools
   - Update cache keys to include mise.toml hash
3. Update README / docs to reference mise instead of volta
4. Run: mise trust && mise install
5. Commit and push
"
