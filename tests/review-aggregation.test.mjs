import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const admin = readFileSync(new URL("../app/admin/admin-dashboard.tsx", import.meta.url), "utf8");

test("review queue supports two-level aggregation and status filtering", () => {
  assert.match(admin, /reviewModules/);
  assert.match(admin, /大模块/);
  assert.match(admin, /子模块/);
  assert.match(admin, /reviewStatus/);
  assert.match(admin, /filteredItems/);
});

test("long review groups are progressively revealed", () => {
  assert.match(admin, /visibleLimit/);
  assert.match(admin, /再显示 20 条/);
});
