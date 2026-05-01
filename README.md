# CV Editor Online (React + Vite)

## Run locally

```bash
npm install
npm run dev
```

Then open the URL shown in your terminal (usually `http://localhost:5173`).

## Run tests

```bash
npm test
```

If Playwright end-to-end tests fail with an error about a missing browser executable, install the browser binaries first:

```bash
npx playwright install chromium
```

If that download is blocked in your network (for example, 403 errors from `cdn.playwright.dev`), run only layout/unit tests locally and run E2E tests in an environment with browser-download access:

```bash
npm run test:layout
```

## Vercel deploy

This project is Vercel-ready and includes `vercel.json`.

## Fix for `@rollup/rollup-darwin-arm64` missing error (macOS Apple Silicon)

If you see an error like:

- `Cannot find module @rollup/rollup-darwin-arm64`

Run this clean reinstall sequence from the project root:

```bash
rm -rf node_modules package-lock.json
npm cache verify
npm install
npm run dev
```

Why this happens: npm can occasionally skip optional native dependencies during install.
This repo also pins Rollup and declares the platform package in `optionalDependencies`
to reduce the chance of this issue.
