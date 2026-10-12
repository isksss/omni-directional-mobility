# OMNI — Vertical Mobility

ブラウザで遊べる、立体機動装置のフリーフライトゲームです。Three.js で描画し、Cloudflare Workers の静的アセットとして配信します。

## 開発

```sh
pnpm install
pnpm dev
```

一人称視点で、WASD で移動、マウスで視点操作、左クリックで射撃、右クリックでスコープをのぞきます。q/e で左／右フックを射出（再入力で解除）、Shift を押しながら Q/E で巻き取り、Space でジャンプ（接続中は巻き取り）、Shift でブーストします。敵は街の道路をランダムに歩き、倒すと補充されます。上下視点の感度は開始画面または一時停止画面のスライダーで調整できます。Esc で一時停止できます。

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
