# X Video Dock

Chrome extension for x.com. Click a video and it plays large in a panel on the right at full window height, with no fullscreen. The nav shrinks and the original video is hidden while it plays. Esc closes it. Single content script, no account, no telemetry.

## Setup

1. Open `chrome://extensions`, turn on Developer mode, click "Load unpacked", pick this folder.
2. Reload x.com. Run `node --test` for the unit tests.

## Limits

- The panel covers the right sidebar. It is as wide as the space right of the timeline column.
- Closing happens when X removes the post from the page (it does this far down the timeline).
- The seek bar drives the original player, because X streams from a `blob:` URL.
- Depends on X's `data-testid` names (`videoPlayer`, `primaryColumn`). If they change, edit `SEL` in `content.js`.
