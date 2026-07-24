import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const ingest = readFileSync(new URL("../.github/workflows/ingest.yml", import.meta.url), "utf8");
const pages = readFileSync(new URL("../.github/workflows/pages.yml", import.meta.url), "utf8");

test("GitHub workflows use Node 24 based action releases", () => {
  for (const workflow of [ingest, pages]) {
    assert.doesNotMatch(workflow, /actions\/checkout@v4/);
    assert.doesNotMatch(workflow, /actions\/setup-node@v4/);
    assert.match(workflow, /actions\/checkout@v5/);
    assert.match(workflow, /actions\/setup-node@v5/);
  }
});
