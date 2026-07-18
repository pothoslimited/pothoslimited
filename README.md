# Pothos Limited website

A lightweight static website for Pothos Limited. It uses plain HTML, CSS, and JavaScript, so no build step is required.

## Preview locally

From the repository root, start a local web server:

```sh
python3 -m http.server 8000
```

Then open `http://localhost:8000` in a browser. Using a local server is recommended because it matches production URL behavior more closely than opening `index.html` directly.

## Deploy

Upload the repository contents to any static host, such as Netlify, Cloudflare Pages, GitHub Pages, or a conventional web server. Set the publish directory to the repository root and do not configure a build command.

The production metadata currently uses `https://pothoslimited.net/`. If the production domain changes, update the canonical URL and Open Graph URLs in `index.html`.

Before publishing, confirm that every referenced file exists and test the page at mobile and desktop widths.
