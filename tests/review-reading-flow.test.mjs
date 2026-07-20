import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const reader = readFileSync(new URL("../app/article/article-reader.tsx", import.meta.url), "utf8");

test("article reader embeds the canonical original instead of a note placeholder", () => {
  assert.match(reader, /<iframe/);
  assert.match(reader, /title="原文内容"/);
  assert.doesNotMatch(reader, /等待补充学习笔记/);
});

test("article reader supports private review and in-page approval", () => {
  assert.doesNotMatch(reader, /\.eq\("status", "published"\)/);
  assert.match(reader, /批准发布/);
});
