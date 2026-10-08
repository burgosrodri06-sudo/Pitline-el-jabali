# PitLane · El Jabalí

Aplicación Next.js del equipo: catálogo KRE, reservas atómicas, comprobantes privados y operación de pista/pagos/reportes.

Estado actual, roles, orden de migraciones, validaciones y checklist de staging: [docs/FINAL_INTEGRATION_STATUS.md](docs/FINAL_INTEGRATION_STATUS.md).

Node 24. Desde `pitlane/`: `npm ci --ignore-scripts`, configurar únicamente las variables autorizadas del entorno y `npm run dev`. Las reservas/comprobantes permanecen bloqueados por defecto; no usar flags de staging para habilitar producción. No versionar secretos ni aplicar migraciones a un proyecto compartido sin revisar su historial.

Validación: `npm test`, `npm run lint`, `npx tsc --noEmit`, `npm run build`. Concurrencia local desechable: `npm run test:reservations:local` y `npm run test:operations:concurrency`. Visual de operations con fixtures: `npm run test:operations:visual` (Edge).

La guía genérica de Next siguiente se conserva como referencia; no sustituye el procedimiento de integración del equipo.

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
