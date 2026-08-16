#!/usr/bin/env bash
set -euo pipefail

SERVICE_NAME="${SERVICE_NAME:-web-first-craft}"
PORT="${PORT:-4173}"
CHECK_ONLY="${CHECK_ONLY:-0}"
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
PYTHON="$(command -v python3 || true)"
RUN_USER="${SUDO_USER:-$(id -un)}"
RUN_GROUP="$(id -gn "$RUN_USER")"
UNIT_PATH="/etc/systemd/system/${SERVICE_NAME}.service"

if [[ -z "$PYTHON" ]]; then
  echo "python3 が見つかりません。Python 3.10以上をインストールしてください。" >&2
  exit 1
fi

if [[ ! "$SERVICE_NAME" =~ ^[A-Za-z0-9_.@-]+$ ]]; then
  echo "SERVICE_NAME に使用できない文字が含まれています: $SERVICE_NAME" >&2
  exit 1
fi

if [[ ! "$PORT" =~ ^[0-9]+$ ]] || (( PORT < 1 || PORT > 65535 )); then
  echo "PORT は 1〜65535 の数字で指定してください。" >&2
  exit 1
fi

if [[ ! -f "$ROOT/server/app.py" ]]; then
  echo "server/app.py が見つかりません: $ROOT/server/app.py" >&2
  exit 1
fi

if ! id "$RUN_USER" >/dev/null 2>&1; then
  echo "実行ユーザーが見つかりません: $RUN_USER" >&2
  exit 1
fi

# systemd-analyze verify は、検証対象のファイル名自体が正しい unit 名である必要がある。
TMP_DIR="$(mktemp -d)"
TMP_UNIT="$TMP_DIR/${SERVICE_NAME}.service"
trap 'rm -rf "$TMP_DIR"' EXIT

cat >"$TMP_UNIT" <<EOF
[Unit]
Description=Web First Craft LAN workshop server
Wants=network-online.target
After=network-online.target

[Service]
Type=simple
User=$RUN_USER
Group=$RUN_GROUP
WorkingDirectory=$ROOT
ExecStart="$PYTHON" "$ROOT/server/app.py" --host 0.0.0.0 --port $PORT
Restart=on-failure
RestartSec=2
TimeoutStopSec=10
Environment=PYTHONUNBUFFERED=1
Environment=PYTHONDONTWRITEBYTECODE=1
NoNewPrivileges=true
PrivateTmp=true

[Install]
WantedBy=multi-user.target
EOF

if command -v systemd-analyze >/dev/null 2>&1; then
  echo "systemd unit を検証しています..."
  systemd-analyze verify "$TMP_UNIT"
else
  echo "注意: systemd-analyze が見つからないためunit検証を省略します。" >&2
fi

if [[ "$CHECK_ONLY" == "1" ]]; then
  echo "OK: ${SERVICE_NAME}.service の生成・検証に成功しました。"
  exit 0
fi

echo "systemd サービスを設定します: $SERVICE_NAME"
sudo install -m 0644 "$TMP_UNIT" "$UNIT_PATH"
sudo systemctl daemon-reload
sudo systemctl reset-failed "$SERVICE_NAME.service" 2>/dev/null || true
sudo systemctl enable "$SERVICE_NAME.service"

if ! sudo systemctl restart "$SERVICE_NAME.service"; then
  echo >&2
  echo "サービスの起動に失敗しました。状態とログを表示します。" >&2
  sudo systemctl status "$SERVICE_NAME.service" --no-pager -l || true
  sudo journalctl -u "$SERVICE_NAME.service" -n 60 --no-pager || true
  exit 1
fi

if ! sudo systemctl is-active --quiet "$SERVICE_NAME.service"; then
  echo "サービスが active になりませんでした。" >&2
  sudo systemctl status "$SERVICE_NAME.service" --no-pager -l || true
  sudo journalctl -u "$SERVICE_NAME.service" -n 60 --no-pager || true
  exit 1
fi

LAN_URL="$(
  "$PYTHON" - "$PORT" <<'PYURL' 2>/dev/null || true
import json
import sys
import time
from urllib.request import urlopen
port = sys.argv[1]
for _ in range(20):
    try:
        with urlopen(f"http://127.0.0.1:{port}/api/config", timeout=0.5) as response:
            data = json.load(response)
        base_url = str(data.get("baseUrl", ""))
        if base_url:
            print(base_url)
            break
    except Exception:
        time.sleep(0.15)
PYURL
)"
echo
echo "起動しました。ターミナルを閉じても動き続けます。"
echo "このPC: http://localhost:$PORT"
if [[ -n "$LAN_URL" ]]; then
  echo "同じLAN: $LAN_URL"
else
  echo "同じLANのURLを取得できませんでした。http://localhost:$PORT/api/config の baseUrl を確認してください。" >&2
fi
echo
echo "状態確認: sudo systemctl status $SERVICE_NAME --no-pager"
echo "ログ確認: journalctl -u $SERVICE_NAME -f"
echo "再起動:   sudo systemctl restart $SERVICE_NAME"
echo "停止:     sudo systemctl stop $SERVICE_NAME"
