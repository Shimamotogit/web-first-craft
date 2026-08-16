# 公開サイトとして動かす

このリポジトリは **別の「QR用サーバー」を必要としません**。`server/app.py` が、Web画面の配信とQR機能のバックエンドを1つのプロセスで担当します。

```text
公開URL
  └─ server/app.py
      ├─ /                 Web画面
      ├─ /child.html       こどもモード
      ├─ /adult.html       カスタムモード
      ├─ /api/config       QR機能の接続確認
      ├─ /api/qr           QRコード生成
      ├─ /api/photo-sessions  スマホ写真転送
      ├─ /api/cards        作品カード共有
      └─ /api/shares       完成HTML共有
```

そのため本番では、`web/` だけを静的公開するのではなく、**このリポジトリを `server/app.py` ごと1つのWebサービスとして公開**してください。

GitHub PagesはPythonを実行できないため、PagesのURLから開いた場合はWeb画面は表示できますがQR機能は動きません。Pagesは静的デモ用途です。QR付きの公開サイトではPythonまたはDockerを実行できるホスティングを使います。

## 公開URLの設定

公開URLが `https://craft.example.com` の場合は、Webサービスの環境変数へ次を設定します。

```text
PUBLIC_BASE_URL=https://craft.example.com
```

これにより、写真送信用QR・作品カードQR・完成サイトQRにはローカルIPではなく公開HTTPS URLが入ります。

`PUBLIC_BASE_URL` を省略しても、一般的なHTTPSリバースプロキシが `Host` と `X-Forwarded-Proto` を転送していればリクエストURLから自動判定しますが、本番では明示設定を推奨します。

## Docker

リポジトリに含まれている `Dockerfile` だけで、Web画面とQR機能をまとめて起動できます。

```bash
docker build -t web-first-craft .
docker run --rm -p 8080:8080 \
  -e PORT=8080 \
  -e PUBLIC_BASE_URL=https://craft.example.com \
  web-first-craft
```

ホスティングサービスではコンテナの `PORT` をサービス指定値へ合わせ、HTTPSはサービス側またはリバースプロキシで終端してください。ヘルスチェックは `/healthz` を利用できます。

## Ubuntu + systemd

Ubuntuで常駐させる場合も、起動するのは同じ `server/app.py` です。別のQRサービスを立ち上げる必要はありません。

```bash
PUBLIC_BASE_URL=https://craft.example.com bash scripts/systemd/install.sh
```

登録後はターミナルを閉じても動作し、Ubuntu再起動後も自動起動します。

```bash
sudo systemctl status web-first-craft --no-pager
sudo systemctl restart web-first-craft
journalctl -u web-first-craft -f
```

アプリ本体の4173番ポートを直接インターネットへ公開するのではなく、HTTPSのWebサーバー/リバースプロキシ経由で公開してください。

## 公開できているか確認する

公開後、次のURLをブラウザで開きます。

```text
https://craft.example.com/api/config
```

`enabled` が `true` で、`baseUrl` が公開URLになっていればQR機能も同じサイト上で利用できます。

トップ画面からアクセスした場合も、同じ `/api/config` を使ってQR機能の接続状態を確認します。

## 注意

- 写真・完成HTML・カードはディスクへ保存せず、1プロセスのメモリにだけ一時保持します。
- QRセッションを使う間は **1インスタンス構成** にしてください。複数インスタンスへ水平分散すると、作成したQRとアップロード先が別プロセスになり得ます。
- 再起動・再デプロイで一時QRセッションは消えます。
- 公開利用ではHTTPSを使用してください。
- このアプリにはログイン機能がありません。QR URLは有効期限付きの受け取り鍵として扱ってください。
