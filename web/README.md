# StreamPay web app

Vite + React + TypeScript + Tailwind. The employer dashboard (wallet connect, create
stream, live stream list) and the worker view live here. All chain calls go through the
single boundary `src/lib/contract.ts`; all wallet calls through `src/lib/wallet.ts`.
Network settings (RPC URL, contract id, token) live in `src/lib/config.ts`.

```
npm install
npm run dev            # http://localhost:5173
npm run build          # production bundle
npm test               # unit tests (Vitest)
npm run lint           # ESLint (type-checked)
npm run format:check   # Prettier
```
