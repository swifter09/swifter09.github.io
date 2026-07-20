import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const ingest = readFileSync(new URL("../scripts/fetch-feeds.mjs", import.meta.url), "utf8");
const feed = readFileSync(new URL("../app/public-feed.tsx", import.meta.url), "utf8");
const admin = readFileSync(new URL("../app/admin/admin-dashboard.tsx", import.meta.url), "utf8");
const schema = readFileSync(new URL("../supabase/schema.sql", import.meta.url), "utf8");

test("podcast feeds capture playable enclosures and durations", () => {
  assert.match(ingest, /enclosure/);
  assert.match(ingest, /itunes:duration/);
  assert.match(ingest, /source\.source_type !== "podcast" \|\| entry\.audio_url/);
  assert.match(ingest, /item\.category !== "podcast"/);
});

test("approved podcast episodes play in public and review views", () => {
  assert.match(feed, /audio_url,duration/);
  assert.match(feed, /<audio controls preload="none"/);
  assert.match(admin, /<audio controls preload="none"/);
  assert.match(feed, /持续收听的播客/);
});

test("the starter podcast directory includes Chinese and international AI shows", () => {
  assert.match(schema, /罗永浩的十字路口/);
  assert.match(schema, /硅谷101/);
  assert.match(schema, /Lex Fridman Podcast/);
  assert.match(schema, /Latent Space/);
});
