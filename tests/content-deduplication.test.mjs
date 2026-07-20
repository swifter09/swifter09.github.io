import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const ingest = readFileSync(new URL("../scripts/fetch-feeds.mjs", import.meta.url), "utf8");
const admin = readFileSync(new URL("../app/admin/admin-dashboard.tsx", import.meta.url), "utf8");
const schema = readFileSync(new URL("../supabase/schema.sql", import.meta.url), "utf8");

test("feed ingestion rejects duplicate source titles with a stable key", () => {
  assert.match(ingest, /createDedupeKey/);
  assert.match(ingest, /dedupe_key/);
  assert.match(schema, /content_items_dedupe_key_unique/);
});

test("review queue hides legacy duplicates without deleting records", () => {
  assert.match(admin, /deduplicatedItems/);
  assert.match(admin, /reviewItemKey/);
  assert.match(admin, /statusPriority/);
});
