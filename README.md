# TwitchYoutube_MultiView

TwitchとYouTubeの配信を最大8画面で並べ、選択中の配信チャットだけを右側に表示するローカルWebアプリです。

## 起動

Node.js 20以降で次を実行します。

```powershell
npm start
```

ブラウザで `http://localhost:4173` を開いてください。`index.html`の直接起動（`file://`）では、Twitchの`parent`指定とYouTubeチャットの`embed_domain`が一致しないため、埋め込みが失敗することがあります。

## 使い方

1. Twitchチャンネル名または配信URL、YouTube動画URLを入力します。
2. 「配信を追加」を押します（最大8件）。
3. 各画面上部の配信名を押すと、右側のチャットが切り替わります。
4. 「チャットを隠す」で映像領域を広げられます。

入力例: `shroud` / `https://twitch.tv/shroud` / `https://youtube.com/watch?v=VIDEO_ID`

YouTube動画IDだけを指定する場合は `yt:VIDEO_ID`、Twitchを明示する場合は `twitch:CHANNEL` を使えます。

## 検証

```powershell
npm run check
npm run build
```

## 制約

- 配信者側で埋め込みが禁止されている配信は表示できません。
- YouTubeチャットはライブ配信でのみ利用できます。
- Twitch / YouTubeのログイン、広告、Cookie制限は各サービスとブラウザの設定に従います。

