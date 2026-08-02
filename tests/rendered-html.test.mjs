import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("keeps the Vercel build path on standard Next.js", async () => {
  const [packageJson, vercelConfig] = await Promise.all([
    readFile(new URL("../package.json", import.meta.url), "utf8"),
    readFile(new URL("../vercel.json", import.meta.url), "utf8"),
  ]);

  const pkg = JSON.parse(packageJson);
  const vercel = JSON.parse(vercelConfig);

  assert.equal(pkg.name, "trader-cost-hub");
  assert.equal(pkg.scripts.dev, "next dev");
  assert.equal(pkg.scripts.build, "next build");
  assert.equal(pkg.scripts.start, "next start");
  assert.equal(vercel.framework, "nextjs");
});

test("keeps product source free of starter preview code", async () => {
  const [page, layout, styles] = await Promise.all([
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/layout.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
  ]);

  assert.match(page, /Trader Cost Hub/);
  assert.match(page, /trader-cost-hub/);
  assert.match(layout, /title:\s*"Trader Cost Hub"/);
  assert.match(styles, /hero-card/);
  assert.doesNotMatch(
    page + layout + styles,
    /_sites-preview|SkeletonPreview|codex-preview|Your site is taking shape/,
  );
});
