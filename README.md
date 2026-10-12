# OMNI — Vertical Mobility

ブラウザで遊べる、立体機動装置のフリーフライトゲームです。Three.js で描画し、Cloudflare Workers の静的アセットとして配信します。

## 開発

```sh
pnpm install
pnpm dev
```

一人称視点で、WASD で移動、マウスで視点操作、左クリックで照準中の建物の壁にワイヤー接続（再クリックで解除）、Space で巻き取り（地上ではジャンプ）、Shift でブーストします。上下視点の感度は開始画面または一時停止画面のスライダーで調整できます。Esc で一時停止できます。

```sh
pnpm test
pnpm lint
pnpm fmt
pnpm build
```

## Cloudflare へデプロイ

Cloudflare CLI (`cf`) を使用します。`cloudflare.config.ts` に Worker 名と `omni.isksss.dev` のカスタムドメインを設定しています。

```sh
cf auth login
pnpm deploy
```

`cf deploy` が Vite のビルドと Workers へのデプロイを行います。カスタムドメインを使うには、Cloudflare アカウントで `isksss.dev` ゾーンを利用できる必要があります。
