import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const publicFeed = fs.readFileSync(new URL("../app/public-feed.tsx", import.meta.url), "utf8");
const admin = fs.readFileSync(new URL("../app/admin/admin-dashboard.tsx", import.meta.url), "utf8");
const fetcher = fs.readFileSync(new URL("../scripts/fetch-feeds.mjs", import.meta.url), "utf8");

test("public project cards collapse releases by source and link to the project homepage", () => {
  assert.match(publicFeed, /seenProjects/);
  assert.match(publicFeed, /sourceRecord\?\.homepage_url \|\| item\.url/);
  assert.match(publicFeed, /访问项目 ↗/);
  assert.match(publicFeed, /opengraph\.githubassets\.com/);
});

test("admin review queue shows only the newest item for each project", () => {
  assert.match(admin, /return `project:\$\{item\.source \|\| item\.id\}`/);
  assert.match(admin, /itemTimestamp\(item\) > itemTimestamp\(current\)/);
  assert.match(admin, /访问项目主页 ↗/);
});

test("GitHub ingestion creates one project-level candidate from repository metadata", () => {
  assert.match(fetcher, /async function githubProjectEntry/);
  assert.match(fetcher, /entries = projectEntry \? \[projectEntry\] : \[\]/);
  assert.match(fetcher, /repositoryData\.description/);
  assert.match(fetcher, /swifter09\/devisland/);
});
