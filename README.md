# OMNI — Vertical Mobility

立体機動装置で街を駆け抜ける、一人称視点のフリーフライトゲームです。建物にフックを掛けて飛び回り、街を歩く敵を狙って射撃します。Three.js と Vite で構築し、Cloudflare Workers に配信します。

## 遊び方

スタート画面で **FLIGHT START** を選ぶとゲームが始まります。`Esc` で一時停止し、再開画面の **RESUME FLIGHT** から戻れます。キーボードとマウスを使う PC 向けです。

| 操作                     | 入力                              |
| ------------------------ | --------------------------------- |
| 移動                     | `W` `A` `S` `D`                   |
| 視点操作                 | マウス                            |
| ジャンプ                 | `Space`（フック接続中は巻き取り） |
| 左右のフックを射出／解除 | `Q` / `E`（照準先の建物の壁）     |
| フックを巻き取る         | `Shift` + `Q` / `E`               |
| ブースト                 | `Shift`                           |
| 射撃                     | 左クリック                        |
| 照準                     | 右クリックを押している間          |
| 一時停止                 | `Esc`                             |

上下視点の感度は、スタート画面または一時停止画面のスライダーで調整できます。敵を倒すと、しばらくして補充されます。

## 開発

Node.js と pnpm を用意して、依存関係をインストールします。

```sh
pnpm install
pnpm dev
```

開発サーバーが表示する URL をブラウザで開いてください。テスト、lint、フォーマット、ビルドは次のコマンドで実行できます。

```sh
pnpm test
pnpm lint
pnpm fmt
pnpm build
```

## Cloudflare Workers へのデプロイ

Cloudflare CLI（`cf`）でログインしてからデプロイします。

```sh
cf auth login
pnpm deploy
```

`pnpm deploy` は `cf deploy` を実行します。Worker 名とカスタムドメイン `omni.isksss.dev` は `cloudflare.config.ts` で設定しています。カスタムドメインの利用には、Cloudflare アカウントで `isksss.dev` ゾーンを利用できる必要があります。
