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

The production metadata currently uses `https://pothosltd.com/`. If the production domain changes, update the canonical URL and Open Graph URLs in `index.html`.

The `_headers` file configures security headers on hosts that support the
Netlify/Cloudflare Pages headers format. GitHub Pages ignores this file, so set
the equivalent headers at a CDN or reverse proxy when hosting there. The page
also includes a compatible Content Security Policy in a `<meta>` element as a
fallback.

Before publishing, confirm that every referenced file exists and test the page at mobile and desktop widths.

## Weekly maintenance agent

The repository includes an audit-only Codex agent in
`.github/workflows/weekly-maintenance.yml`. It runs every Monday at 8:17 a.m.
Jamaica time and can also be started manually from the GitHub Actions page. The
workflow runs deterministic checks, asks Codex to review the results, and opens
a dated GitHub issue. It does not edit or deploy the website.

Before enabling the workflow, create a repository Actions secret named
`OPENAI_API_KEY`. Use a dedicated OpenAI Platform key with an appropriate usage
budget; never add the key or a Codex `auth.json` file to this repository.

Run the deterministic portion locally with:

```sh
./scripts/weekly-maintenance.sh
```

The generated `maintenance-report.md` is intentionally ignored by Git.
