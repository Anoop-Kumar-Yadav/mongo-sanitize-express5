# Publish checklist

## One-time setup
1. Create the GitHub repo, push this code.
2. `npm adduser` (or `npm login`) locally once, to confirm you own the npm account.
3. On npmjs.com the package name `mongo-sanitize-express5` must still be free — check:
   `npm view mongo-sanitize-express5` (a 404 means it's free).
4. In GitHub repo **Settings → Secrets and variables → Actions**, add secret `NPM_TOKEN`
   (npmjs.com → Access Tokens → Generate New Token → type "Automation").
5. Fill in the real `repository`/`bugs`/`homepage`/`author` fields in `package.json`
   (currently placeholder `<your-username>`).

## Every release
1. Update code, bump version: `npm version patch` (or `minor`/`major`) — this also
   creates a git commit + tag.
2. `git push && git push --tags`
3. Pushing the `vX.Y.Z` tag triggers `.github/workflows/publish.yml`, which runs tests
   and publishes to npm automatically. No manual `npm publish` needed once `NPM_TOKEN` is set.

## Manual publish (fallback, no CI)
```bash
npm test
npm login
npm publish
```

## Sanity checks before first publish
- `npm pack --dry-run` — confirm only `index.js`, `index.d.ts`, `lib/` are included
  (test/ and .github/ should NOT appear, per the `files` field in package.json).
- `npm test` passes locally.
- README examples actually match the current API (re-read after any option changes).
