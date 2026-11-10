# Stone Paper Scissors (online, 2 players)

A static web game. Two players enter their names, one sets the target score, and the first to reach it wins.
Players connect browser-to-browser (WebRTC via PeerJS), so it runs on GitHub Pages with no server of your own.
Moves are committed with a SHA-256 hash and revealed together, so neither player can peek or change a choice.

## Files
- `index.html`, `style.css`, `game.js` – the game
- `vendor/peerjs.min.js` – PeerJS 1.5.4 (bundled so there is no CDN dependency)

## Run locally
Open `index.html` through any static server, e.g. `python3 -m http.server 8000` and visit http://localhost:8000
(WebRTC and crypto need `localhost` or HTTPS, so don't open it with `file://`).

## Host on GitHub Pages
1. Create a new public repository on GitHub (e.g. `stone-paper-scissors`).
2. Upload all files in this folder to the repository root (or `git push` them).
3. Go to **Settings → Pages**. Under **Build and deployment**, choose **Deploy from a branch**, branch `main`, folder `/ (root)`, then Save.
4. After a minute your game is live at `https://<your-username>.github.io/stone-paper-scissors/`.

## Notes
- Signalling uses the free public PeerJS cloud server; the game traffic itself is peer-to-peer.
- Players on very strict corporate networks may fail to connect, since no TURN relay is configured.
- To self-host signalling later, run `peerjs-server` and pass `{host, port, path}` to `new Peer(...)` in `game.js`.
