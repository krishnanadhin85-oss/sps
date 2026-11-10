# Stone Paper Scissors (online, 2 players)

Static web game for GitHub Pages. Players send their moves through a free Firebase Realtime Database,
so it works between any two networks (home Wi-Fi, mobile data, different countries).
Moves are committed with a SHA-256 hash and revealed together, so nobody can peek or change a choice.

## Files
index.html, style.css, game.js, config.js (your Firebase URL goes here)

## Step A – Create the free Firebase database (about 5 minutes)
1. Go to https://console.firebase.google.com and sign in with a Google account.
2. Click **Create a project**, give it a name, and finish (Google Analytics can be turned off).
3. In the left menu open **Build → Realtime Database**, click **Create Database**, pick a location,
   and choose **Start in locked mode**.
4. Open the **Rules** tab, replace everything with the text below, and click **Publish**:

       {
         "rules": {
           "rooms": {
             "$room": { ".read": true, ".write": true }
           }
         }
       }

5. Open the **Data** tab. Copy the database URL shown at the top
   (it looks like `https://your-project-default-rtdb.firebaseio.com`).
6. Open `config.js`, paste the URL between the quotes, and save.

## Step B – Put it on GitHub Pages
1. Upload all files to your repository (replace the old ones; delete the old `vendor` folder if it is still there).
2. Settings → Pages → Deploy from a branch → `main` / `(root)` → Save.
3. Your game is live at `https://<your-username>.github.io/<repo-name>/`.

## Play
Player 1: name + target score + **Create game**, then share the link or code.
Player 2: open the link, type a name, click **Join game**.

## Notes
- Rooms are only reachable by their 5-letter code (the rules do not allow listing rooms).
- The host's room is deleted when the host clicks Leave game.
- The Firebase free plan is more than enough for casual play.
