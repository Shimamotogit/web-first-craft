# 公開サイトとして動かす

QRの写真転送・作品カード・完成HTML共有は `/api/...` を使います。**最も簡単なのは `web/` と `server/app.py` を同じHTTPS Webサービスとして公開する構成**です。GitHub Pagesをフロントとして使う場合は、別途公開したQR APIサーバーへ接続する構成にも対応しています。

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


## GitHub Pages + 別QR API

1. `server/app.py` をHTTPSで公開し、`PUBLIC_BASE_URL=https://api.example.com` を設定します。
2. APIサーバーにはPagesのOriginを許可します。例: `ALLOWED_ORIGINS=https://shimamotogit.github.io`。Originには `/web-first-craft` のようなパスは含めません。
3. GitHubリポジトリの **Settings → Secrets and variables → Actions → Variables** で `PUBLIC_API_BASE_URL` を作り、値を `https://api.example.com` にします。
4. `Deploy static site to Pages` workflowを手動実行します。デプロイ時に `web/runtime-config.js` へAPI URLが書き込まれます。

この構成では、ブラウザの `/api/...` リクエスト、QR画像、写真転送、カード共有、完成HTML共有がすべて `PUBLIC_API_BASE_URL` のサーバーへ送られます。
