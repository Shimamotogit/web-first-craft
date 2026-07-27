# じぶんページ工房

小学生くらいの子どもが、個人情報に気をつけながら自己紹介ページを作れる、登録不要・通信不要の静的Webアプリです。

![Static site](https://img.shields.io/badge/app-static_site-2f7d52)
![No tracking](https://img.shields.io/badge/privacy-no_tracking-2878b5)
![License](https://img.shields.io/badge/license-MIT-e15b3d)

## 特徴

- 4ステップの編集と常時ライブプレビュー
- ニックネーム前提の入力設計
- イラストアバター / 端末内で圧縮する写真アップロード
- 好きなもの、得意なこと、夢中なこと、今後やりたいこと
- 4テーマ、アクセントカラー、2レイアウト
- localStorageへの自動保存
- 下書きJSONの保存・再読み込み
- 1ファイルで動く完成HTMLのダウンロード
- メール、電話、学校名、住所、SNS、年齢、顔写真の簡易チェック
- 外部フォント、解析、広告、バックエンド、Cookieなし
- キーボード操作、フォーカス表示、十分なボタンサイズ、`prefers-reduced-motion` 対応

## 使い方

`index.html` をブラウザで開くだけで動きます。ローカルサーバーを使う場合は、プロジェクト直下で次を実行してください。

```bash
python3 -m http.server 8000
```

ブラウザで `http://localhost:8000` を開きます。

## 公開

`.github/workflows/pages.yml` を同梱しています。GitHub Pagesの公開元を **GitHub Actions** に設定すると、`main` へのpushで公開されます。

## プライバシー設計

このアプリは入力データをサーバーへ送信しません。下書きは利用中のブラウザ内に保存され、完成HTMLと下書きJSONは端末へ直接ダウンロードされます。

ただし、生成したHTMLをインターネットへ公開する行為は別です。公開前に必ず保護者・先生が内容を確認してください。簡易チェックは見落としを防げないため、法的・安全上の保証ではありません。

## デザイン方針

「AIが作ったようなサイト」に見えやすい、紫系グラデーション、ガラス風カード、過剰な丸角、均一なカード反復、意味の薄い装飾文句を避けました。代わりに、紙、鉛筆、付せん、判子のような不均一さを使い、子どもの工作物に近い見た目にしています。

詳しい調査メモは [`RESEARCH.md`](./RESEARCH.md) を参照してください。

## ファイル構成

```text
.
├── index.html
├── styles.css
├── app.js
├── RESEARCH.md
├── SECURITY.md
├── LICENSE
└── .github/workflows/pages.yml
```

## ライセンス

MIT License
