#!/usr/bin/env bash
# Cleanup helper for workspace: preview and remove Rust `target` and JS `node_modules` directories
# Usage examples:
#   ./scripts/cleanup_workspace.sh --preview
#   ./scripts/cleanup_workspace.sh --targets --dry-run
#   ./scripts/cleanup_workspace.sh --node-modules --yes
#   ./scripts/cleanup_workspace.sh --all

set -u

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

DRY_RUN=0
REMOVE_TARGETS=0
REMOVE_NODE_MODULES=0
TARGETS_ONLY=0
APPS_ONLY=0
SERVICES_ONLY=0
YES=0
PREVIEW_ONLY=0
USE_CARGO_CLEAN=0

print_help() {
  cat <<EOF
Usage: $(basename "$0") [options]

Options:
  --preview            Show sizes and a preview of directories to be removed (default action)
  --dry-run            Show exactly what would be removed, do not delete
  --targets            Remove Rust 'target' directories
  --node-modules       Remove 'node_modules' directories
  --all                Equivalent to --targets --node-modules
  --services-only      Limit search to 'services' directory
  --apps-only          Limit search to 'apps' and 'packages' directories
  --cargo-clean        Use 'cargo clean' in each crate instead of rm -rf target (safer)
  --yes                Non-interactive, assume yes for confirmation
  --help               Show this help

Examples:
  # Preview only
  $(basename "$0") --preview

  # Dry run, show what would be removed for both targets and node_modules
  $(basename "$0") --all --dry-run

  # Delete targets inside services only, ask for confirmation
  $(basename "$0") --targets --services-only

  # Delete node_modules across workspace without prompting
  $(basename "$0") --node-modules --yes

Notes:
  - This script ONLY operates inside the repository root ($REPO_ROOT).
  - By default it will only preview (no deletion). Use flags to delete.
  - If you prefer an interactive visual tool, install ncdu (Homebrew: brew install ncdu).
EOF
}

err() { echo "Error: $*" >&2; }

parse_args() {
  while [[ $# -gt 0 ]]; do
    case "$1" in
      --dry-run) DRY_RUN=1; shift ;;
      --targets) REMOVE_TARGETS=1; shift ;;
      --node-modules) REMOVE_NODE_MODULES=1; shift ;;
      --all) REMOVE_TARGETS=1; REMOVE_NODE_MODULES=1; shift ;;
      --services-only) SERVICES_ONLY=1; shift ;;
      --apps-only) APPS_ONLY=1; shift ;;
      --yes) YES=1; shift ;;
      --preview) PREVIEW_ONLY=1; shift ;;
      --cargo-clean) USE_CARGO_CLEAN=1; shift ;;
      --help|-h) print_help; exit 0 ;;
      *) err "Unknown option: $1"; print_help; exit 2 ;;
    esac
  done

  # If nothing specified, default to preview
  if [[ $REMOVE_TARGETS -eq 0 && $REMOVE_NODE_MODULES -eq 0 && $PREVIEW_ONLY -eq 0 ]]; then
    PREVIEW_ONLY=1
  fi
}

find_targets() {
  (cd "$REPO_ROOT" && find . -type d -name target -prune -print0)
}

find_node_modules() {
  (cd "$REPO_ROOT" && find . -type d -name node_modules -prune -print0)
}

preview_and_count() {
  local find_cmd=$1
  # Print per-directory sizes and count
  echo "--- Preview (per-directory sizes) ---"
  if [[ "$find_cmd" == "targets" ]]; then
    eval "find_targets" | xargs -0 -I{} du -sh "{}" 2>/dev/null | sort -h || true
  else
    eval "find_node_modules" | xargs -0 -I{} du -sh "{}" 2>/dev/null | sort -h || true
  fi
  echo "-------------------------------------"
}

calculate_total_size() {
  local find_cmd=$1
  if [[ "$find_cmd" == "targets" ]]; then
    # Sum sizes in KB to avoid issues, then humanize
    eval "find_targets" | xargs -0 du -sk 2>/dev/null | awk '{sum += $1} END {print sum}'
  else
    eval "find_node_modules" | xargs -0 du -sk 2>/dev/null | awk '{sum += $1} END {print sum}'
  fi
}

human_kb_to_human() {
  local kb=$1
  if [[ -z "$kb" || "$kb" == "0" ]]; then
    echo "0B"
    return
  fi
  local bytes=$((kb * 1024))
  # Use du -h like formatting via numfmt if available
  if command -v numfmt >/dev/null 2>&1; then
    numfmt --to=iec --format="%.2f" "$bytes"
  else
    # fallback: print in MB
    awk -v b=$bytes 'BEGIN{printf "%.2fMB", b/1024/1024}'
  fi
}

confirm_and_delete() {
  local what=$1
  local find_expr
  if [[ "$what" == "targets" ]]; then
    find_expr="find_targets"
  else
    find_expr="find_node_modules"
  fi

  local kb_total
  kb_total=$(calculate_total_size "$what")
  local human_total
  human_total=$(human_kb_to_human "$kb_total")

  # Count directories
  local count
  count=$(eval "$find_expr" | tr -d '\0' | wc -l || true)

  echo "About to remove: $count directories of type '$what' totaling ~$human_total"

  if [[ $DRY_RUN -eq 1 ]]; then
    echo "DRY RUN: no deletion performed. To delete, re-run without --dry-run and confirm."
    return 0
  fi

  if [[ $YES -ne 1 ]]; then
    read -r -p "Proceed with deletion of $count directories (~$human_total)? [y/N] " ans
    case "$ans" in
      [Yy]*) ;;
      *) echo "Aborted by user."; return 1 ;;
    esac
  fi

  if [[ "$what" == "targets" && $USE_CARGO_CLEAN -eq 1 ]]; then
    echo "Running 'cargo clean' in each crate (safer alternative to rm -rf target)"
    # Find Cargo.toml and run cargo clean in each directory
    (cd "$REPO_ROOT" && find . -name Cargo.toml -print0) | xargs -0 -I{} sh -c '
      crate_dir=$(dirname "{}")
      echo "cargo clean in $crate_dir"
      (cd "$REPO_ROOT"/"$crate_dir" && cargo clean)
    '
    return 0
  fi

  echo "Deleting..."
  # Do the deletion constrained to REPO_ROOT
  if [[ "$what" == "targets" ]]; then
    (cd "$REPO_ROOT" && find . -type d -name target -prune -print0 | xargs -0 -I{} sh -c 'echo Deleting: "{}"; rm -rf "{}"')
  else
    (cd "$REPO_ROOT" && find . -type d -name node_modules -prune -print0 | xargs -0 -I{} sh -c 'echo Deleting: "{}"; rm -rf "{}"')
  fi

  echo "Deletion finished. Recalculating repository size..."
  du -sh "$REPO_ROOT" || true
}

main() {
  parse_args "$@"

  echo "Repository root: $REPO_ROOT"

  if [[ $SERVICES_ONLY -eq 1 ]]; then
    # redefine find functions with services limitation
    find_targets() { (cd "$REPO_ROOT" && find services -type d -name target -prune -print0); }
    find_node_modules() { (cd "$REPO_ROOT" && find services -type d -name node_modules -prune -print0); }
  elif [[ $APPS_ONLY -eq 1 ]]; then
    find_targets() { (cd "$REPO_ROOT" && find apps packages -type d -name target -prune -print0); }
    find_node_modules() { (cd "$REPO_ROOT" && find apps packages -type d -name node_modules -prune -print0); }
  else
    # default functions defined earlier operate on full repo
    :
  fi

  if [[ $REMOVE_TARGETS -eq 1 || $PREVIEW_ONLY -eq 1 ]]; then
    echo "\n[Targets]"
    preview_and_count targets
    kb=$(calculate_total_size targets)
    echo "Total (targets) ~ $(human_kb_to_human "$kb") (~${kb} KB)"
    if [[ $PREVIEW_ONLY -eq 1 && $REMOVE_NODE_MODULES -eq 0 ]]; then
      echo "Preview-only mode: exiting."
      exit 0
    fi
  fi

  if [[ $REMOVE_NODE_MODULES -eq 1 || $PREVIEW_ONLY -eq 1 ]]; then
    echo "\n[Node modules]"
    preview_and_count node_modules
    kb_nm=$(calculate_total_size node_modules)
    echo "Total (node_modules) ~ $(human_kb_to_human "$kb_nm") (~${kb_nm} KB)"
    if [[ $PREVIEW_ONLY -eq 1 && $REMOVE_TARGETS -eq 0 ]]; then
      echo "Preview-only mode: exiting."
      exit 0
    fi
  fi

  # If preview-only, stop here
  if [[ $PREVIEW_ONLY -eq 1 && $REMOVE_TARGETS -eq 0 && $REMOVE_NODE_MODULES -eq 0 ]]; then
    echo "Preview complete. No deletions performed. Use flags to remove files."
    exit 0
  fi

  # Proceed with deletion as requested
  if [[ $REMOVE_TARGETS -eq 1 ]]; then
    confirm_and_delete targets || exit 1
  fi

  if [[ $REMOVE_NODE_MODULES -eq 1 ]]; then
    confirm_and_delete node_modules || exit 1
  fi

  echo "All requested operations completed."
}

main "$@"
