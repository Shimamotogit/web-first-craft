# 調査と設計判断

調査日: 2026-07-27

## 1. 参考にした既存サービス / 実装パターン

### Scratch

- 8〜16歳を主対象とし、「物語・ゲーム・アニメーションを自分で作る」ことを中心にしている。
- 低い入口（low floor）、広い壁（wide walls）、高い天井（high ceiling）という設計目標が知られている。
- 本実装では、最初の操作を文字入力と選択だけに絞り、テーマや自由色で個性を広げる構造にした。

Sources:
- https://scratch.mit.edu/help/about
- https://scratch.mit.edu/discuss/topic/245/

### Code.org Web Lab

- ブラウザ内でWeb制作とプレビューを行う学習環境。
- 編集と結果の距離が短いこと、学校環境向けの安全性が重視されている。
- 本実装では、編集画面の横に常時プレビューを置き、生成結果を1ファイルHTMLとして持ち出せるようにした。

Source:
- https://support.code.org/hc/en-us/articles/44971343420429-Web-Lab-FAQ

### Canva Education

- K-12では教師・学校経由の利用、テンプレートからの選択、視覚的な編集が中心。
- 本実装では、自由度を無制限にせず、完成度の高い少数テーマから選び、アクセント色だけ自由にした。

Source:
- https://www.canva.com/education/students/

### GitHub上のポートフォリオ / レジュメビルダー

- フォーム入力 → ライブプレビュー → 出力という構造が一般的。
- 多くは成人向けで入力項目が多く、AI風テンプレートや依存関係が重い。
- 本実装はVanilla HTML/CSS/JavaScriptだけにし、子ども向けの短い入力と個人情報チェックに置き換えた。

調査例:
- pradhyumnHQ29/portfolio-generator-tool
- Rahulfrr/Interactive-portfolio-builder
- tavishii/portfolio-builder

## 2. 子どものプライバシー

FTCのCOPPAガイダンスでは、氏名、住所、オンライン連絡先、電話番号、継続的識別子などが子どもの個人情報として挙げられ、必要以上の情報を求めないこと、保持期間を限定すること、公開可能にする場合の保護者同意などが重視されている。

日本の個人情報保護委員会の子ども向け資料でも、個人情報をむやみに知らない人へ教えたり、インターネットやSNSへ公開したりしないこと、困ったときは大人へ相談することが案内されている。

設計への反映:

- アカウント作成なし
- サーバー送信なし
- ニックネーム表記
- 学校名・連絡先などを入力させる専用欄を置かない
- localStorage以外の永続化なし
- 顔写真利用時の強い警告
- 保存前の簡易スキャンと大人確認チェック

Sources:
- https://www.ftc.gov/business-guidance/resources/complying-coppa-frequently-asked-questions
- https://www.ftc.gov/business-guidance/resources/childrens-online-privacy-protection-rule-six-step-compliance-plan-your-business
- https://www.ppc.go.jp/news/kids/movie/kodomomuke_accessible/

## 3. アクセシビリティ

WCAG 2.2では、ポインター操作対象の最小サイズや間隔、ドラッグ操作の代替、フォーカス可視性などが追加・強化されている。

設計への反映:

- 主要操作は44px程度以上
- ドラッグ操作なし
- キーボードでステップ移動可能
- ラベル、fieldset、legend、role=tab/tabpanelを使用
- 明確なフォーカスリング
- 色だけに依存しない選択状態
- `prefers-reduced-motion` に対応

Source:
- https://www.w3.org/TR/WCAG22/

## 4. 「AIっぽくない」見た目の判断

避けたもの:

- 紫〜青の大きなグラデーション
- ガラス・ぼかし・発光
- すべて同じ角丸カード
- 3カラムの均等な特徴カード
- 意味の薄い抽象コピー
- 絵文字を見出しごとに置く
- 過剰なアニメーション

採用したもの:

- 紙の地、罫線、付せん、判子、手描き線
- 少しだけ不均一な角と影
- 強い黒線と限られた色
- 作業机のような編集画面
- 子ども自身の文章を主役にする余白
- 出力ページにはブランドや販促を押しつけない

## 5. 実装方針

- 依存ライブラリなし
- CSPを阻害する外部リソースなし
- iframe `srcdoc` で完成HTMLと同一のプレビュー
- 画像はCanvasで最大900pxへ縮小しJPEG化
- JSON import時に型・文字数・テーマ値・画像Data URLを検証
- HTML出力時に全テキストをエスケープ
- 生成ページにJavaScriptを含めない
