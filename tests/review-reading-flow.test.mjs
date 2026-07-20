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

test("arXiv papers use an abstract-first reader and are excluded from body extraction", () => {
  assert.match(reader, /isArxivArticle/);
  assert.match(reader, /查看 PDF/);
  assert.match(reader, /查看英文摘要/);
  assert.match(ingest, /isArxivUrl/);
  assert.match(ingest, /filter\(\(item\) => !isArxivUrl\(item\.url\)\)/);
});

test("reader removes captured page controls, preserves rich formatting, and offers narration", () => {
  assert.match(reader, /sanitizeReaderBody/);
  assert.match(reader, /Share\|Voice\|Speed/);
  assert.match(reader, /renderInline/);
  assert.match(reader, /speechSynthesis/);
  assert.match(reader, /朗读文章/);
  assert.match(ingest, /refreshKnownPoorReaderContent/);
  assert.match(ingest, /r\.jina\.ai/);
});

test("reader renders remote Markdown images and audio instead of source labels", () => {
  assert.match(reader, /reader-figure/);
  assert.match(reader, /<img/);
  assert.match(reader, /<audio/);
  assert.match(reader, /Markdown Content:/);
  assert.match(reader, /sourceMetadataIndex/);
});
