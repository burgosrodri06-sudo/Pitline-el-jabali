import { registerHooks } from "node:module";
import { readFileSync, existsSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import { resolve, dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import ts from "typescript";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import assert from "node:assert/strict";
import { chromium } from "playwright-core";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const output = join(root, ".next", "operations-visual");
await mkdir(output, { recursive: true });
const fixture = pathToFileURL(
  join(root, "tests/operations/visual-fixtures.mjs"),
).href;
registerHooks({
  resolve(specifier, context, next) {
    if (specifier === '@/components/layout/UserMenu') return { url: 'ops-test:user-menu', shortCircuit: true };
    if (specifier === "@/lib/operations/service")
      return { url: fixture, shortCircuit: true };
    if (specifier === "@/lib/auth")
      return { url: "ops-test:auth", shortCircuit: true };
    if (specifier === "@/app/operations-actions")
      return { url: "ops-test:actions", shortCircuit: true };
    if (specifier === "next/link")
      return { url: "ops-test:link", shortCircuit: true };
    let base;
    if (specifier.startsWith("@/")) base = join(root, specifier.slice(2));
    else if (
      specifier.startsWith(".") &&
      context.parentURL?.startsWith("file:") &&
      !context.parentURL.includes("/node_modules/")
    )
      base = resolve(dirname(fileURLToPath(context.parentURL)), specifier);
    if (base)
      for (const suffix of ["", ".tsx", ".ts", ".mjs", "/index.ts"])
        if (existsSync(base + suffix))
          return { url: pathToFileURL(base + suffix).href, shortCircuit: true };
    return next(specifier, context);
  },
  load(url, context, next) {
    if (url === 'ops-test:user-menu') return { format: 'module', source: 'export default function UserMenu(){return null}', shortCircuit: true };
    if (url === "ops-test:auth")
      return {
        format: "module",
        source: `export async function requireRole(){return {profile:{role:'system_admin'},user:{id:'visual-user'}}}`,
        shortCircuit: true,
      };
    if (url === "ops-test:actions")
      return {
        format: "module",
        source: `const action=async()=>({ok:false,message:'Solo vista de pruebas'});export {action as paymentAction,action as checkInAction,action as closeSlotAction,action as completeRideAction,action as creditAction,action as trackSaleAction};`,
        shortCircuit: true,
      };
    if (url === "ops-test:link")
      return {
        format: "module",
        source: `import React from '${pathToFileURL(join(root, "node_modules/react/index.js")).href}';export default function Link({href,children,...props}){return React.createElement('a',{href,...props},children)}`,
        shortCircuit: true,
      };
    if (url.endsWith(".css"))
      return {
        format: "module",
        source: "export default new Proxy({}, {get:(_,name)=>name});",
        shortCircuit: true,
      };
    if (/\.[cm]?tsx?$/.test(url) && !url.includes("/node_modules/"))
      return {
        format: "module",
        source: ts.transpileModule(readFileSync(fileURLToPath(url), "utf8"), {
          compilerOptions: {
            module: ts.ModuleKind.ESNext,
            jsx: ts.JsxEmit.ReactJSX,
            target: ts.ScriptTarget.ES2022,
          },
        }).outputText,
        shortCircuit: true,
      };
    return next(url, context);
  },
});
async function resolveAsync(node) {
  if (Array.isArray(node))
    return Promise.all(React.Children.toArray(node).map(resolveAsync));
  if (!React.isValidElement(node)) return node;
  if (
    typeof node.type === "function" &&
    node.type.constructor.name === "AsyncFunction"
  ) {
    const result = await resolveAsync(await node.type(node.props));
    return React.isValidElement(result)
      ? React.cloneElement(result, { key: node.key })
      : result;
  }
  return React.cloneElement(node, {}, await resolveAsync(node.props.children));
}
const css = readFileSync(
  join(root, "components/operations/operations.module.css"),
  "utf8",
);
const routes = [
  "mis-reservas",
  "cobros/verificacion",
  "staff/check-in",
  "staff/venta",
  "admin/reportes",
];
for (const route of routes) {
  const { default: Page } = await import(
    pathToFileURL(join(root, "app", route, "page.tsx")).href
  );
  const tree = await resolveAsync(
    await Page({ searchParams: Promise.resolve({}) }),
  );
  const html = `<!doctype html><html lang="es"><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><style>*{box-sizing:border-box}body{margin:0}a{color:inherit}button,input,select,textarea{font:inherit}h1,h2,p{margin-top:0}${css}</style><title>Vista de prueba · ${route}</title><body><div style="background:#ffe48c;color:#222;padding:8px;text-align:center">DATOS FICTICIOS · REVISIÓN VISUAL</div>${renderToStaticMarkup(tree)}</body></html>`;
  await writeFile(join(output, route.replaceAll("/", "-") + ".html"), html);
}
// Isolated headless browser profile. No credentials, production site or mutations.
const browser = await chromium.launch({ channel: "msedge", headless: true });
try {
  for (const width of [360, 1440]) {
    const page = await browser.newPage({ viewport: { width, height: 1000 } });
    for (const route of routes) {
      const name = route.replaceAll("/", "-");
      await page.goto(pathToFileURL(join(output, name + ".html")).href);
      assert.equal(await page.locator("h1").count(), 1);
      assert.ok(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
        `${route} overflows at ${width}px`,
      );
      await page.screenshot({
        path: join(output, `${name}-${width}.png`),
        fullPage: true,
      });
      console.log(`PASS: ${route}, ${width}px, no horizontal overflow`);
    }
    await page.close();
  }
} finally {
  await browser.close();
}
