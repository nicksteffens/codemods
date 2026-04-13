# volta-to-mise

Shell script to migrate repos from [Volta](https://volta.sh/) to [mise](https://mise.jdx.dev/) for tool version management.

Based on the pattern established in [movableink/ojos#1735](https://github.com/movableink/ojos/pull/1735).

## What it does

1. Reads `volta` config from root `package.json` (node, yarn, npm, pnpm)
2. Absorbs `.node-version`, `.ruby-version`, `.python-version` files if present
3. Generates a `mise.toml` with a `[tools]` section
4. Removes the `volta` field from all `package.json` files (root + workspaces)
5. Deletes absorbed version files

## Quick start (no clone needed)

```bash
# dry-run in current directory
curl -fsSL https://raw.githubusercontent.com/nicksteffens/codemods/main/volta-to-mise/migrate.sh | zsh -s -- . --dry-run

# run the migration
curl -fsSL https://raw.githubusercontent.com/nicksteffens/codemods/main/volta-to-mise/migrate.sh | zsh -s -- .

# run but keep volta in package.json (support both during transition)
curl -fsSL https://raw.githubusercontent.com/nicksteffens/codemods/main/volta-to-mise/migrate.sh | zsh -s -- . --keep-volta
```

## Usage (from repo clone)

```bash
# preview changes without modifying anything
./volta-to-mise/migrate.sh /path/to/repo --dry-run

# run the migration
./volta-to-mise/migrate.sh /path/to/repo

# keep volta in package.json (both tools work side by side)
./volta-to-mise/migrate.sh /path/to/repo --keep-volta

# include an [env] section template in mise.toml
./volta-to-mise/migrate.sh /path/to/repo --include-env
```

## What it does NOT do

These vary per-repo and need manual attention:

- **CI workflow updates** — swap `volta-cli/action@v4` for `jdx/mise-action@v2`, remove `ruby/setup-ruby` or `actions/setup-node` if mise handles those tools, update cache keys to hash `mise.toml`
- **Docker image changes** — repos using `node-with-chrome:volta` containers need a rebuilt image
- **README/docs updates** — replace volta install instructions with `mise trust && mise install`
- **Workspace-specific overrides** — if a workspace package pins a different Node version than root (e.g. Studio uses Node 20 while root uses 24), you'll need a nested `.mise.toml` in that package

## Dependencies

None. Uses `zsh` and `python3`, both ship with macOS.

## Related

- [sc-192830](https://app.shortcut.com/movableink-epd/story/192830) — Investigate mise as Volta replacement
- [mise docs](https://mise.jdx.dev/)
- [jdx/mise-action](https://github.com/jdx/mise-action)
