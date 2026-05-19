#!/usr/bin/env bash
set -euo pipefail

REPO="LightQv/noctra"
GITHUB_API="https://api.github.com/repos/${REPO}"
VERSION="latest"
METHOD="auto"

log() {
  printf "[noctra-install] %s\n" "$*"
}

warn() {
  printf "[noctra-install] warning: %s\n" "$*" >&2
}

die() {
  printf "[noctra-install] error: %s\n" "$*" >&2
  exit 1
}

need_cmd() {
  command -v "$1" >/dev/null 2>&1 || die "Missing required command: $1"
}

usage() {
  cat <<'EOF'
Noctra installer

Usage:
  install.sh [--version <tag-or-version>] [--method auto|appimage|deb|rpm]

Examples:
  curl -fsSL https://raw.githubusercontent.com/LightQv/noctra/main/scripts/install.sh | bash
  bash install.sh --version v0.0.3-alpha --method appimage
EOF
}

parse_args() {
  while [ "$#" -gt 0 ]; do
    case "$1" in
      --version)
        [ "$#" -ge 2 ] || die "--version expects a value"
        VERSION="$2"
        shift 2
        ;;
      --method)
        [ "$#" -ge 2 ] || die "--method expects a value"
        METHOD="$2"
        shift 2
        ;;
      -h|--help)
        usage
        exit 0
        ;;
      *)
        die "Unknown argument: $1"
        ;;
    esac
  done
}

os_name() {
  case "$(uname -s)" in
    Darwin) echo "darwin" ;;
    Linux) echo "linux" ;;
    *) die "Unsupported operating system: $(uname -s)" ;;
  esac
}

release_json() {
  if [ "$VERSION" = "latest" ]; then
    curl -fsSL "${GITHUB_API}/releases/latest"
  else
    case "$VERSION" in
      v*)
        curl -fsSL "${GITHUB_API}/releases/tags/${VERSION}"
        ;;
      *)
        curl -fsSL "${GITHUB_API}/releases/tags/v${VERSION}"
        ;;
    esac
  fi
}

release_tag_from_json() {
  printf "%s" "$1" | sed -n 's/.*"tag_name"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p' | head -n 1
}

asset_url_for() {
  json="$1"
  file_pattern="$2"
  printf "%s\n" "$json" | tr ',' '\n' | sed -n 's/.*"browser_download_url"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p' | grep -E "$file_pattern" | head -n 1
}

pick_asset() {
  json="$1"
  os="$2"

  case "$os" in
    darwin)
      asset="$(asset_url_for "$json" '\\.dmg$')"
      if [ -z "$asset" ]; then
        asset="$(asset_url_for "$json" '\\.zip$')"
      fi
      ;;
    linux)
      case "$METHOD" in
        auto)
          asset="$(asset_url_for "$json" '\\.deb$')"
          if [ -z "$asset" ]; then
            asset="$(asset_url_for "$json" '\\.rpm$')"
          fi
          if [ -z "$asset" ]; then
            asset="$(asset_url_for "$json" '\\.AppImage$')"
          fi
          ;;
        deb)
          asset="$(asset_url_for "$json" '\\.deb$')"
          ;;
        rpm)
          asset="$(asset_url_for "$json" '\\.rpm$')"
          ;;
        appimage)
          asset="$(asset_url_for "$json" '\\.AppImage$')"
          ;;
        *)
          die "Invalid method '$METHOD'. Use auto|appimage|deb|rpm"
          ;;
      esac
      ;;
  esac

  [ -n "${asset:-}" ] || die "Could not find matching release asset for ${os} (${METHOD})"
  printf "%s" "$asset"
}

sha256_file() {
  file="$1"
  if command -v sha256sum >/dev/null 2>&1; then
    sha256sum "$file" | awk '{print $1}'
  else
    shasum -a 256 "$file" | awk '{print $1}'
  fi
}

verify_checksum() {
  asset_path="$1"
  checksums_path="$2"
  asset_name="$(basename "$asset_path")"

  expected="$(awk -v n="$asset_name" '$2==n {print $1}' "$checksums_path" | head -n 1)"
  [ -n "$expected" ] || die "No checksum entry for ${asset_name}"

  actual="$(sha256_file "$asset_path")"
  [ "$expected" = "$actual" ] || die "Checksum mismatch for ${asset_name}"
}

install_macos() {
  asset_path="$1"
  asset_name="$(basename "$asset_path")"

  if [[ "$asset_name" == *.dmg ]]; then
    mount_point="$(mktemp -d)"
    log "Mounting DMG"
    hdiutil attach "$asset_path" -mountpoint "$mount_point" -nobrowse -quiet
    app_source="$(find "$mount_point" -maxdepth 2 -name 'Noctra.app' | head -n 1 || true)"
    [ -n "$app_source" ] || die "Noctra.app not found in DMG"

    if cp -R "$app_source" /Applications/Noctra.app 2>/dev/null; then
      log "Installed Noctra.app to /Applications"
    elif command -v sudo >/dev/null 2>&1; then
      log "Copying Noctra.app to /Applications with sudo"
      sudo cp -R "$app_source" /Applications/Noctra.app
    else
      die "Could not copy Noctra.app to /Applications"
    fi

    hdiutil detach "$mount_point" -quiet || true
    rmdir "$mount_point" || true
  else
    warn "ZIP downloaded. Extract and move Noctra.app to /Applications manually."
    log "Archive path: $asset_path"
  fi

  if [ -d /Applications/Noctra.app ]; then
    if xattr -d com.apple.quarantine /Applications/Noctra.app 2>/dev/null; then
      log "Removed macOS quarantine attribute from /Applications/Noctra.app"
    elif command -v sudo >/dev/null 2>&1 && sudo -n true 2>/dev/null; then
      sudo xattr -d com.apple.quarantine /Applications/Noctra.app || true
    else
      warn "Could not remove quarantine automatically. Run:"
      warn "xattr -d com.apple.quarantine /Applications/Noctra.app"
    fi
  fi
}

install_linux() {
  asset_path="$1"
  asset_name="$(basename "$asset_path")"

  case "$asset_name" in
    *.deb)
      if [ "$(id -u)" -eq 0 ]; then
        dpkg -i "$asset_path"
      elif command -v sudo >/dev/null 2>&1; then
        sudo dpkg -i "$asset_path"
      else
        die "Need root privileges (or sudo) to install .deb"
      fi
      ;;
    *.rpm)
      if [ "$(id -u)" -eq 0 ]; then
        rpm -i "$asset_path"
      elif command -v sudo >/dev/null 2>&1; then
        sudo rpm -i "$asset_path"
      else
        die "Need root privileges (or sudo) to install .rpm"
      fi
      ;;
    *.AppImage)
      mkdir -p "$HOME/.local/bin"
      install_path="$HOME/.local/bin/noctra"
      cp "$asset_path" "$install_path"
      chmod +x "$install_path"
      log "Installed AppImage to $install_path"
      log "Optional desktop integration: $install_path --integrate"
      ;;
    *)
      die "Unsupported Linux asset: $asset_name"
      ;;
  esac
}

main() {
  parse_args "$@"
  need_cmd curl
  need_cmd awk
  need_cmd sed
  need_cmd grep
  need_cmd mktemp

  os="$(os_name)"
  tmp_dir="$(mktemp -d)"
  trap 'rm -rf "$tmp_dir"' EXIT

  log "Resolving release metadata (${VERSION})"
  json="$(release_json)"
  tag="$(release_tag_from_json "$json")"
  [ -n "$tag" ] || die "Could not parse release tag"
  log "Using release $tag"

  asset_url="$(pick_asset "$json" "$os")"
  asset_name="$(basename "$asset_url")"
  asset_path="$tmp_dir/$asset_name"
  checksums_path="$tmp_dir/checksums.txt"

  log "Downloading $asset_name"
  curl -fsSL "$asset_url" -o "$asset_path"

  checksums_url="$(asset_url_for "$json" 'checksums\\.txt$')"
  [ -n "$checksums_url" ] || die "checksums.txt not found in release"
  curl -fsSL "$checksums_url" -o "$checksums_path"

  log "Verifying checksum"
  verify_checksum "$asset_path" "$checksums_path"

  if [ "$os" = "darwin" ]; then
    need_cmd hdiutil
    need_cmd xattr
    install_macos "$asset_path"
  else
    install_linux "$asset_path"
  fi

  log "Done"
}

main "$@"
