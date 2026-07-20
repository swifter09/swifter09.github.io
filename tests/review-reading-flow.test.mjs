import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const reader = readFileSync(new URL("../app/article/article-reader.tsx", import.meta.url), "utf8");
const ingest = readFileSync(new URL("../scripts/fetch-feeds.mjs", import.meta.url), "utf8");

test("ingestion creates and reader renders a full reading copy", () => {
  assert.match(ingest, /extractArticleBody/);
  assert.match(ingest, /reader_content/);
  assert.match(reader, /reader_content/);
  assert.doesNotMatch(reader, /<iframe/);
  assert.doesNotMatch(reader, /等待补充学习笔记/);
});

test("article reader supports private review and in-page approval", () => {
  assert.doesNotMatch(reader, /\.eq\("status", "published"\)/);
  assert.match(reader, /批准发布/);
});
