# Workspace cleanup helper

This file documents safe commands and usage for cleaning build artifacts and dependencies in this repository.

File: `scripts/cleanup_workspace.sh` — an interactive helper script is included. Use it to preview and safely remove Rust `target` folders and JS `node_modules` folders.

Quick preview commands (no deletion):

```bash
# go to repo
cd /Users/babar/projects/gymcoach-ai

# total size
du -sh .

# list sizes of top-level folders
du -sh * | sort -h

# find and show sizes of all Rust `target` dirs
find . -type d -name target -prune -print0 | xargs -0 du -sh | sort -h

# find and show sizes of all `node_modules` dirs
find . -type d -name node_modules -prune -print0 | xargs -0 du -sh | sort -h
```

Interactive exploration:

```bash
# Install ncdu (Homebrew on macOS)
brew install ncdu

# Run interactive disk usage viewer on the repo
ncdu /Users/babar/projects/gymcoach-ai
```

Use the script (preview, dry-run, and deletion)

```bash
# Preview only (default safe action)
./scripts/cleanup_workspace.sh --preview

# Dry-run showing what would be removed for both targets and node_modules
./scripts/cleanup_workspace.sh --all --dry-run

# Delete Rust target directories inside `services/` only (interactive confirmation)
./scripts/cleanup_workspace.sh --targets --services-only

# Delete all node_modules across the repo without prompt (non-interactive)
./scripts/cleanup_workspace.sh --node-modules --yes

# Use cargo clean instead of rm -rf target (safer)
./scripts/cleanup_workspace.sh --targets --cargo-clean
```

Reinstall after cleanup

```bash
# Reinstall JS deps (pnpm workspace)
pnpm -w install

# Optionally prune pnpm store
pnpm store prune

# To rebuild Rust crates (will recreate target folders)
cargo build --workspace
```

Safer targeted deletions

```bash
# Delete only debug targets (keep release artifacts)
find . -path "*/target/debug" -type d -prune -exec rm -rf {} +

# Delete node_modules for workspace packages only
find apps packages -type d -name node_modules -prune -exec rm -rf {} +
```

Safety notes

- The commands remove build and dependency artifacts only, not source files. Still, take a quick backup of any local artifacts you want to preserve.
- Use `--dry-run` / `--preview` first and inspect the output before deleting.
- After removing `node_modules`, reinstall dependencies with `pnpm -w install` before running the app.
- `cargo clean` is a safe alternative to removing `target` manually.

If you want, I can also:

- Add a short note/link to the repo root `README.md` referencing this cleanup guide.
- Change the script to log deleted paths to a file before removing them.

---

Generated on: 2025-11-16
