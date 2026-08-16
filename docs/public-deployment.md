# 公開サイトとして動かす

QRの写真転送・作品カード・完成HTML共有は `/api/...` を使うため、**GitHub Pagesのような静的ホスティングだけでは動きません**。`web/` と `server/app.py` を同じWebサービスとして公開してください。

## 必須設定

公開URLが `https://craft.example.com` の場合は、Webサービスの環境変数へ次を設定します。

```text
PUBLIC_BASE_URL=https://craft.example.com
```

これにより、QRコードにはローカルIPではなく公開HTTPS URLが入ります。`PUBLIC_BASE_URL` を省略しても、一般的なHTTPSリバースプロキシが `Host` と `X-Forwarded-Proto` を転送していればリクエストURLから自動判定しますが、本番では明示設定を推奨します。

## Docker

```bash
docker build -t web-first-craft .
docker run --rm -p 8080:8080 \
  -e PORT=8080 \
  -e PUBLIC_BASE_URL=https://craft.example.com \
  web-first-craft
```

ホスティングサービスではコンテナの `PORT` をサービス指定値へ合わせ、HTTPSはサービス側またはリバースプロキシで終端してください。ヘルスチェックは `/healthz` を利用できます。

## Ubuntu + systemd

既存のUbuntuサーバーを公開する場合は、HTTPSを提供するリバースプロキシの後ろでこのアプリを動かし、次のように再登録します。

```bash
PUBLIC_BASE_URL=https://craft.example.com bash scripts/systemd/install.sh
```

アプリ本体の4173番ポートを直接インターネットへ公開するのではなく、HTTPSのWebサーバー/リバースプロキシ経由で公開してください。

## 注意

- 写真・完成HTML・カードはディスクへ保存せず、1プロセスのメモリにだけ一時保持します。
- QRセッションを使う間は **1インスタンス構成** にしてください。複数インスタンスへ水平分散すると、作成したQRとアップロード先が別プロセスになり得ます。
- 再起動・再デプロイで一時QRセッションは消えます。
- 公開利用では必ずHTTPSを使用してください。
- このアプリにはログイン機能がありません。QR URLは有効期限付きの受け取り鍵として扱ってください。
