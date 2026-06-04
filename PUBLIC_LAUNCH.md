# Public Launch Checklist

Use this checklist when the project is ready to move from local MVP to public proof.

## 1. Verify Local Release Gate

```sh
npm run build
npm run audit:sources:live
npm run audit:sources:live:check
npm run launch:preflight
```

`npm run build` must pass before deployment. The live source audit should show all public sources reachable before launch. `npm run launch:preflight` should pass after a GitHub remote is configured. Cloudflare authentication is only required for direct Cloudflare CLI deployment.

## 2. Create Public GitHub Repository

If GitHub CLI is available:

```sh
gh repo create campus-evidence-lab --public --source=. --remote=origin --push
```

If GitHub CLI is not available, create a public repository named `campus-evidence-lab` in the GitHub web UI, then run:

```sh
npm run publish:github -- <repository-url>
```

The publish helper verifies the local build, adds `origin` if needed, pushes `main`, and reruns the launch preflight. If `origin` is already configured, run `npm run publish:github`.

After pushing, confirm the repository shows:

- `README.md`
- `RELEASE_NOTES.md`
- `.github/workflows/check.yml`
- `.github/ISSUE_TEMPLATE/`
- `data/`
- `docs/`
- generated public pages

## 3. Configure Cloudflare Pages

GitHub Pages is already configured through `.github/workflows/pages.yml`. After pushing to `main`, GitHub Actions can build and deploy `dist/` to GitHub Pages using the repository's Pages settings.
The workflow sets canonical feed, sitemap, and robots URLs to the GitHub Pages project URL for the first public launch.

If using GitHub Pages:

1. Push `main` to the public repository.
2. Open repository Settings -> Pages.
3. Set source to GitHub Actions.
4. Run or re-run the `Deploy GitHub Pages` workflow.
5. Record the published Pages URL.

Cloudflare Pages remains available as an alternate free-hosting path.

Use Cloudflare Pages with:

- Project name: `campus-evidence-lab`
- Build command: `npm run build`
- Build output directory: `dist`
- Node version: `22`

For direct CLI deployment:

```sh
npx wrangler login
npm run deploy:cloudflare
```

## 4. Verify Public Site

After deployment, verify:

- Dashboard loads publicly.
- `/events/` search and filters work.
- `/downloads/` exposes canonical and research exports.
- `/RELEASE_NOTES.md` is reachable.
- `/sitemap.xml` is reachable.
- `/submit/` can generate source, correction, duplicate, and school metadata packets.
- GitHub issue templates are visible in the public repository.

## 5. First Public Proof Artifacts

Record the public URLs for:

- Live site
- GitHub repository
- Current release notes
- Snapshot manifest
- Events dataset
- Research event export
- Source audit

These links are the first public proof package for Campus Evidence Lab.
