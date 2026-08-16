#!/usr/bin/env bash
set -euo pipefail

SERVICE_NAME="${SERVICE_NAME:-web-first-craft}"
UNIT_PATH="/etc/systemd/system/${SERVICE_NAME}.service"

if systemctl list-unit-files "${SERVICE_NAME}.service" --no-legend 2>/dev/null | grep -q "${SERVICE_NAME}.service"; then
  sudo systemctl disable --now "${SERVICE_NAME}.service" || true
fi

if [[ -f "$UNIT_PATH" ]]; then
  sudo rm -f "$UNIT_PATH"
fi

sudo systemctl daemon-reload
sudo systemctl reset-failed "${SERVICE_NAME}.service" 2>/dev/null || true

echo "${SERVICE_NAME}.service を削除しました。プロジェクト本体は残っています。"
