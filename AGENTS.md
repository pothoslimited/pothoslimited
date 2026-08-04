# Pothos Limited website guidance

This repository contains a build-free static website written in HTML, CSS, and
JavaScript. Treat the repository root as the publish directory.

## Maintenance priorities

- Preserve Pothos Limited's existing branding, business claims, contact details,
  and project descriptions unless a person explicitly requests a content change.
- Keep the site usable at mobile and desktop widths.
- Preserve keyboard access, meaningful alternative text, visible focus states,
  and reduced-motion behavior.
- Prefer genuine WebP assets for website photography. File extensions must match
  the file's actual encoded format.
- Do not remove source media, change canonical URLs, or change security policy
  without explaining the impact.
- Never commit credentials, API keys, Codex authentication files, or generated
  maintenance reports.

## Required verification

Run the deterministic maintenance audit after changing website files:

```sh
./scripts/weekly-maintenance.sh
```

For visual changes, also preview the repository through a local HTTP server and
inspect both mobile and desktop layouts:

```sh
python3 -m http.server 8000
```

## Scheduled-agent boundaries

The weekly maintenance workflow is audit-only. It may inspect the repository,
run checks, and report findings, but it must not edit files, push commits, merge
branches, deploy the website, or expose secrets. Any future auto-fix workflow
must use a separate branch and require human pull-request review.
