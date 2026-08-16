# じぶんページ工房

「技術で自分のページを作る」体験を、**こどもモード**と**カスタムモード**の2本で提供するWeb制作ワークショップです。ローカル/LAN利用と、Pythonサーバーごとの公開HTTPS運用に対応します。

共通Main画面からモードを選び、どちらも HTML → CSS → JavaScript の3ステップを体験します。

## モード

### こどもモード（3〜7歳程度）

最終成果物は **1枚の作品カードPNG** です。そのため完成物にはアニメーションを入れず、静止画として見たときの変化を大きくしています。

- HTML = 「なかみ」：なまえ → ひとこと → 写真・マーク → すきなもの
- CSS = 「みため」：4色テーマ、4レイアウト、ページ全体が変わる4つの飾りセット
- JavaScript = 「ボタンでしあげ」：4写真枠、4スタンプ、4背景模様
- 五十音表型のひらがなパッドとPCキーボードを切り替えて入力可能
- ひらがなパッドは「だす / かくす」を切り替え可能
- PCから写真を選択、またはスマホからQRで写真送信
- スマホ側は「写真フォルダから選ぶ」と「カメラで撮る」を選択可能
- 編集中プレビューと完成PNGは **同じSVG描画** を利用するため、構図・写真・文字・装飾が一致
- 完成PNGをQRでスマホへ送り、その端末に保存可能

静止画の組み合わせは 4テーマ × 4レイアウト × 4装飾 × 4写真枠 × 4スタンプ × 4模様です。

### カスタムモード（中学生くらい〜大人）

シンプルな自己紹介サイトを材料に、値を直接変更しながらWeb制作の基礎を体験します。採点は常時100点満点で表示します。

- HTML / 35点：名前、ひとこと、自己紹介、好きなもの、追加プロフィール、写真
- CSS / 45点：サイト幅、文字サイズ、写真サイズ、余白、角丸、枠線、影をpx単位で編集
- CSSの背景・アクセント・文字色をRGB（0〜255）で直接作成
- JavaScript / 20点：「もっと見る」「好きなものガチャ」「写真拡大」を複数選択可能
- 変更中のCSSコードをその場で表示
- 完成HTMLの保存とLAN内QR共有に対応

CSS点はデザインの美しさを機械判定するものではなく、「実際にどの設定を触って違いを確かめたか」を学習用スコアとして評価します。

## 起動

Python 3.10以上を利用します。追加インストールは不要です。

### 一時的に起動する

```bash
python3 server/app.py
```

Windowsは `scripts/launch/start-local.bat`、macOS / Linuxは `./scripts/launch/start-local.command` でも起動できます。この起動方法はターミナルを閉じると終了します。

```text
このパソコン: http://localhost:4173
同じLANから: http://192.168.x.x:4173
```

LAN運用ではスマートフォンをパソコンと同じWi-Fiへ接続してください。公開HTTPS運用では同じWi-Fiである必要はありません。QR機能はPythonの `/api/...` を使うため、GitHub PagesやHTMLファイル直開きだけでは利用できません。

### Ubuntuで常駐させる（おすすめ）

UbuntuのブースPCではsystemdサービスとして登録できます。**一度登録すれば、ターミナルを閉じても動作し、PC再起動後も自動起動します。**

リポジトリのディレクトリで次を1回実行してください。

```bash
bash scripts/systemd/install.sh
```

初回だけ `sudo` のパスワード入力があります。標準ポートは `4173` です。別ポートにする場合は次のようにします。

```bash
PORT=8080 bash scripts/systemd/install.sh
```

以降はターミナルを閉じて構いません。操作コマンドは次の通りです。

```bash
sudo systemctl status web-first-craft --no-pager
sudo systemctl restart web-first-craft
sudo systemctl stop web-first-craft
sudo systemctl start web-first-craft
journalctl -u web-first-craft -f
```

サービス登録自体を削除する場合だけ、次を実行します。

```bash
bash scripts/systemd/uninstall.sh
```

> systemdサービスは現在のリポジトリ位置を参照します。登録後にフォルダを移動・削除した場合は、もう一度インストールスクリプトを実行してください。

### 公開サイトとして動かす

公開URLをQRへ入れるには、静的ファイルだけではなく `server/app.py` も同じWebサービスとして公開します。

```bash
PUBLIC_BASE_URL=https://craft.example.com python3 server/app.py --host 0.0.0.0 --port 8080
```

Ubuntuのsystemdでは次のように登録できます。

```bash
PUBLIC_BASE_URL=https://craft.example.com bash scripts/systemd/install.sh
```

`https://zovira.jp/my-site/` のようなサブパス公開にも対応しています。その場合は `PUBLIC_BASE_URL=https://zovira.jp/my-site` を指定し、Nginxで `/my-site/` をプレフィックスを保持したまま4173番へ転送します。

Dockerにも対応しています。公開時はHTTPSを使用し、詳しい構成は [`docs/public-deployment.md`](./docs/public-deployment.md) を参照してください。GitHub Pagesは静的プレビュー用途で、QR転送バックエンドは動きません。

## 複数PC・複数人での同時利用

Webサーバーは `ThreadingHTTPServer` で複数リクエストを並行処理します。写真送信・完成HTML・完成カードは、作成ごとにランダムな一時トークンを発行して別々のセッションとして管理します。

各PCの編集内容は各ブラウザのローカルストレージに保存されるため、**別々のPCから同時に作業しても編集内容は共有されません。** QR写真転送についても、複数セッションを同時生成して他の利用者の写真と混ざらないことを統合テストしています。サーバーは一時セッション数と総メモリ使用量に上限を設けます。期限切れセッションだけを整理し、上限に達した場合は新規QR作成を拒否するため、利用中の参加者セッションを新規アクセスで追い出しません。新規セッション作成には1分あたりの上限もあります。

## こどもモード：スマホから写真を送る

1. 「じぶんの しゃしん・マーク」で「QRでスマホから」を押す
2. PCに表示されたQRをスマホで読む
3. 「写真フォルダから選ぶ」または「カメラで撮る」を選ぶ
4. 「パソコンへ送る」を押す
5. PCのプレビューへ自動反映

写真はWebサーバーのメモリに一時保持し、約20分で失効します。受信後はサーバー側の写真データを空にします。

## こどもモード：完成カードを受け取る

1. STEP 3で「QRで写真をもらう」を押す
2. 900×1200pxのPNGカードを生成
3. QRをスマホで読む
4. スマホでPNGを表示・保存

カードは約30分でサーバーのメモリから失効します。プレビューとPNGは同一の `buildKidSvg()` を描画元にしています。

## 運用上の注意

- LAN運用では家庭・教室など管理されたネットワークを利用してください。
- 公開運用ではHTTPSを使用し、`PUBLIC_BASE_URL` に公開URLを設定してください。アプリのHTTPポートをそのままインターネットへ露出させず、HTTPSのリバースプロキシまたはHTTPS対応ホスティングサービスを使用してください。
- QR URL自体が一時的な受け取り鍵です。第三者へ共有しないでください。
- 写真・HTML・カードはクラウドやDBへ保存せず、実行中プロセスのメモリだけに保持します。
- サービスの再起動・PC再起動時には一時QRセッションは消えます。編集内容そのものは各ブラウザ側に残ります。
- 子どもの写真を扱うため、保護者・先生の管理下で利用してください。

詳しくは [`SECURITY.md`](./SECURITY.md) を参照してください。

## テスト

```bash
node --check web/js/child.js
node --check web/js/adult.js
python3 -m py_compile server/app.py
python3 tests/check_static.py
python3 tests/test_server.py
bash -n scripts/launch/start-local.command scripts/systemd/install.sh scripts/systemd/uninstall.sh
CHECK_ONLY=1 bash scripts/systemd/install.sh
```

## ディレクトリ構成

役割ごとに分離しています。ルート直下にはプロジェクト情報だけを置きます。

```text
web-first-craft/
├── web/                  # ブラウザへ配信する現行フロントエンド
│   ├── index.html
│   ├── child.html
│   ├── adult.html
│   ├── css/
│   └── js/
├── server/               # LANサーバー / QR / 一時共有
│   └── app.py
├── tests/                # 静的構造・LAN転送の自動テスト
├── scripts/
│   ├── launch/           # 手動起動用ランチャー
│   └── systemd/          # Ubuntu常駐サービスの登録・削除
├── vendor/python/        # 同梱Python依存（qrcode）
├── docs/                 # 調査・設計資料
├── archive/legacy-web/   # 現在は使わない旧実装
├── .github/workflows/    # CI / GitHub Pages
├── README.md
├── SECURITY.md
└── LICENSE
```

`web/` だけが静的サイトの公開対象です。`archive/` は参考用で、LANサーバーやGitHub Pagesからは配信しません。GitHub Pagesのデプロイは自動実行せず、Pagesを有効化した場合だけActionsから手動実行します。Pages版は静的プレビューのためQR機能は利用できません。QRを含む公開版はPythonサーバーまたはDockerごとデプロイしてください。

## ライセンス

本体は MIT License です。QRコード生成には同梱の `qrcode` を使用し、ライセンス本文を `vendor/python/qrcode-LICENSE.txt` に収録しています。
