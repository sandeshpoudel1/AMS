# React + Vite

This template provides a minimal setup to get React working in Vite with HMR and some Oxlint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Oxc](https://oxc.rs)
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/)

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the Oxlint configuration

If you are developing a production application, we recommend using TypeScript with type-aware lint rules enabled. Check out the [TS template](https://github.com/vitejs/vite/tree/main/packages/create-vite/template-react-ts) for information on how to integrate TypeScript and Oxlint's TypeScript related rules in your project.

## Electron

## Shared API Endpoint (Multi-device)

To make updates entered on one device appear on other devices, set the same API base URL everywhere:

```bash
VITE_API_BASE_URL=https://your-shared-backend-domain/api
```

`VITE_API_BASE_URL` is used by both web and Electron builds. If it is not set, web falls back to `/api` and Electron falls back to `http://localhost:8000/api`.

Run web dev server first:

```bash
npm run dev -- --host 0.0.0.0 --port 3000
```

Then launch desktop shell in another terminal:

```bash
npm run electron:dev
```

For a static desktop run based on built assets:

```bash
npm run build
npm run electron
```
