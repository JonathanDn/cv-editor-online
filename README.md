# CV Editor Online (React + Vite)

## Run locally

```bash
npm install
npm run dev
```

Then open the URL shown in your terminal (usually `http://localhost:5173`).

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
