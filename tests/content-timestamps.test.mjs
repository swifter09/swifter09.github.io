import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const ingest = readFileSync(new URL("../scripts/fetch-feeds.mjs", import.meta.url), "utf8");
const admin = readFileSync(new URL("../app/admin/admin-dashboard.tsx", import.meta.url), "utf8");
const feed = readFileSync(new URL("../app/public-feed.tsx", import.meta.url), "utf8");
const reader = readFileSync(new URL("../app/article/article-reader.tsx", import.meta.url), "utf8");

test("source publication time is preserved separately from site publication time", () => {
  assert.match(ingest, /source_published_at/);
  assert.match(admin, /来源发布/);
  assert.match(admin, /本站上线/);
  assert.match(feed, /原始发布/);
  assert.match(feed, /本站上线/);
  assert.match(reader, /原始发布/);
  assert.match(reader, /本站上线/);
});
