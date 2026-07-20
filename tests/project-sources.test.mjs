import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const schema = readFileSync(new URL("../supabase/schema.sql", import.meta.url), "utf8");

test("curated AI project sources use official GitHub release feeds", () => {
  for (const project of [
    "CC Switch",
    "Agent Island",
    "DevIsland",
    "OpenAI Codex",
    "Claude Code",
    "OpenHands",
    "Goose",
    "Aider",
    "Cline",
  ]) {
    assert.ok(schema.includes(`('${project}', 'github', 'project'`));
  }
  assert.equal((schema.match(/releases\.atom/g) || []).length, 9);
});
