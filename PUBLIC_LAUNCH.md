# Public Launch Checklist

Use this checklist when the project is ready to move from local MVP to public proof.

## 1. Verify Local Release Gate

```sh
npm run build
npm run launch:preflight
```

`npm run build` must pass before deployment. `npm run launch:preflight` should only pass after a GitHub remote and Cloudflare authentication are configured.

## 2. Create Public GitHub Repository

If GitHub CLI is available:

```sh
gh repo create campus-evidence-lab --public --source=. --remote=origin --push
```

If GitHub CLI is not available, create a public repository named `campus-evidence-lab` in the GitHub web UI, then run:

```sh
git remote add origin <repository-url>
git push -u origin main
```

After pushing, confirm the repository shows:

- `README.md`
- `RELEASE_NOTES.md`
- `.github/workflows/check.yml`
- `.github/ISSUE_TEMPLATE/`
- `data/`
- `docs/`
- generated public pages

## 3. Configure Cloudflare Pages

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
