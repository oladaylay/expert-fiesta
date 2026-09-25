# Spin the Wheel

A small, dependency-free spin-the-wheel web app. Type your options, spin, and let chance decide.

## Features

- Edit entries in a text box, one per line (saved automatically in your browser)
- Smooth, eased spin animation with tick sounds and a short fanfare
- Fair winner picks using `crypto.getRandomValues`
- Winner pop-up with confetti and an option to remove the winner from the wheel
- Optional "remove winner automatically" mode for elimination-style draws
- Shuffle / sort entries, adjustable spin time, and a spin history
- Light/dark theme, keyboard support (<kbd>Space</kbd> to spin), responsive layout

## Running

No build step. Open `index.html` in a browser, or serve the folder:

```sh
python3 -m http.server 8000
# then visit http://localhost:8000
```

Works with any static host (GitHub Pages, Netlify, etc.).

## Files

- `index.html` – markup
- `style.css` – styling and themes
- `app.js` – wheel rendering, spin logic, persistence
