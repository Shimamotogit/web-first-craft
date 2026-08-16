#!/usr/bin/env bash
set -euo pipefail

SERVICE_NAME="${SERVICE_NAME:-web-first-craft}"
PORT="${PORT:-4173}"
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PYTHON="$(command -v python3 || true)"
RUN_USER="${SUDO_USER:-$(id -un)}"
RUN_GROUP="$(id -gn "$RUN_USER")"
UNIT_PATH="/etc/systemd/system/${SERVICE_NAME}.service"

if [[ -z "$PYTHON" ]]; then
  echo "python3 が見つかりません。Python 3.10以上をインストールしてください。" >&2
  exit 1
fi

if [[ ! "$PORT" =~ ^[0-9]+$ ]] || (( PORT < 1 || PORT > 65535 )); then
  echo "PORT は 1〜65535 の数字で指定してください。" >&2
  exit 1
fi

if [[ ! -f "$ROOT/server.py" ]]; then
  echo "server.py が見つかりません: $ROOT/server.py" >&2
  exit 1
fi

escape_unit_value() {
  printf '%s' "$1" | sed 's/\\/\\\\/g; s/"/\\"/g'
}

ROOT_ESC="$(escape_unit_value "$ROOT")"
PYTHON_ESC="$(escape_unit_value "$PYTHON")"
SERVER_ESC="$(escape_unit_value "$ROOT/server.py")"
TMP_UNIT="$(mktemp)"
trap 'rm -f "$TMP_UNIT"' EXIT

cat >"$TMP_UNIT" <<EOF
[Unit]
Description=Web First Craft LAN workshop server
Wants=network-online.target
After=network-online.target

[Service]
Type=simple
User=$RUN_USER
Group=$RUN_GROUP
WorkingDirectory="$ROOT_ESC"
ExecStart="$PYTHON_ESC" "$SERVER_ESC" --host 0.0.0.0 --port $PORT
Restart=on-failure
RestartSec=2
Environment=PYTHONUNBUFFERED=1
NoNewPrivileges=true
PrivateTmp=true

[Install]
WantedBy=multi-user.target
EOF

echo "systemd サービスを設定します: $SERVICE_NAME"
sudo install -m 0644 "$TMP_UNIT" "$UNIT_PATH"
sudo systemctl daemon-reload
sudo systemctl enable --now "$SERVICE_NAME.service"

LAN_IP="$(hostname -I 2>/dev/null | awk '{print $1}')"
echo
echo "起動しました。ターミナルを閉じても動き続けます。"
echo "このPC: http://localhost:$PORT"
if [[ -n "$LAN_IP" ]]; then
  echo "同じLAN: http://$LAN_IP:$PORT"
fi
echo
echo "状態確認: sudo systemctl status $SERVICE_NAME --no-pager"
echo "ログ確認: journalctl -u $SERVICE_NAME -f"
echo "再起動:   sudo systemctl restart $SERVICE_NAME"
echo "停止:     sudo systemctl stop $SERVICE_NAME"
