import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const page = fs.readFileSync(new URL("../app/page.tsx", import.meta.url), "utf8");
const feed = fs.readFileSync(new URL("../app/public-feed.tsx", import.meta.url), "utf8");
const styles = fs.readFileSync(new URL("../app/globals.css", import.meta.url), "utf8");

test("homepage uses a compact personal masthead and searchable content browser", () => {
  assert.match(page, /hero-terminal/);
  assert.match(page, /我的技术信息流/);
  assert.match(feed, /搜索标题、摘要或来源/);
  assert.match(feed, /feed-browser/);
});

test("content browser includes category tabs and a compact daily radar", () => {
  assert.match(feed, /今日技术雷达/);
  assert.match(feed, /radarItems/);
  assert.match(styles, /\.feed-browser \{ display: grid/);
  assert.match(styles, /\.radar-panel \{ position: sticky/);
});

test("technology directory only lists technology sources", () => {
  assert.match(feed, /source\.category === "tech_feed"/);
});
