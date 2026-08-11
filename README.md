# じぶんページ工房

**技術で「自分のページ」を作る。形にする仕事を体感する。**

HTML・CSS・JavaScriptを、コード暗記ではなく「中身を作る → 見た目を作る → 動きを作る」の3ステップとして体験するLAN向けWebワークショップです。

## 2つのモード

### こどもモード（3〜7歳程度）

自己紹介サイトを3ステップで作ります。キーボード操作は不要です。

1. **HTML / なかみ** — マーク、名前、好きなもの、ひとことを決める
2. **CSS / みため** — 色、並べ方、飾りを決める
3. **JavaScript / うごき** — 登場アニメーションとクリック時の反応を決める

主な機能：

- 画面下部のひらがなパッド（名前・ひとこと入力）
- 大きな絵・ボタン中心のタップ操作
- 説明のブラウザ読み上げ（対応ブラウザのみ）
- 常時ライブプレビュー
- 完成した自己紹介ページのHTML保存
- 完成ページを簡易カードPNGへ変換
- カードPNGをLAN内QRコードからスマホへ渡して保存

### チャレンジモード（小学校高学年〜大人）

お題に合うサイトを3ステップで設計します。

1. **HTML / 情報設計** — タイトル、価値、説明、可変セクション、CTA
2. **CSS / 視覚設計** — テーマ、レイアウト、色、書体、余白、画像
3. **JavaScript / 体験設計** — 表示アニメーション、CTAの反応

お題：カフェ、週末イベント、文房具、ポートフォリオ。

難易度は EASY / NORMAL / HARD。HTML 40点、CSS 35点、JavaScript 25点の計100点で、次に直すポイントも表示します。採点は「見た目の好み」ではなく、入力内容・必要セクション数・カスタマイズ・操作設定など明示的な条件で行います。

## 起動

Python 3.10+ を推奨します。外部パッケージのインストールは不要です（QRコード生成ライブラリを同梱）。

### Windows

```bat
start-local.bat
```

### macOS / Linux

```sh
./start-local.command
```

または共通で：

```sh
python3 server.py
```

起動後：

- このPC: `http://localhost:4173`
- 同じLANの端末: 起動時に表示される `http://<LAN-IP>:4173`

## LAN / QR機能

サーバーはクラウドへアップロードしません。転送データはPythonプロセスのメモリ内だけに一時保持します。

- スマホ写真: 約20分
- 完成HTML: 約30分
- こども版作品カードPNG: 約30分

期限切れまたはサーバー終了で消えます。

QR機能は家庭・教室など**管理された同一LAN内だけ**で使ってください。ルーターのポート開放やインターネットへの直接公開は想定していません。

## ファイル構成

```text
index.html       共通Main / モード選択
main.css
child.html       こどもモード
child.css
child.js
adult.html       チャレンジモード
adult.css
adult.js
server.py        LANサーバー / QR / 一時転送
scripts/
  check_static.py
  test_server.py
vendor_py/qrcode/
```

`app.js` と `styles.css` は前バージョンの実装を移行参照用として残しています。新しいMain画面からは読み込まれません。

## チェック

```sh
python3 scripts/check_static.py
python3 scripts/test_server.py
node --check child.js
node --check adult.js
python3 -m py_compile server.py
```

`test_server.py` は、静的ページ配信、QR SVG、スマホ写真転送、HTML一時共有、PNGカード一時共有をローカルHTTPサーバーで統合テストします。

## オフライン動作

Main / こども / 大人の編集画面は外部CDNやWebフォントを読み込みません。QR転送以外は静的ファイルだけでも利用できます。QR転送には `server.py` が必要です。

## License

MIT
