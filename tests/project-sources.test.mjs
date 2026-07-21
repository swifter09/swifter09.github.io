import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const schema = readFileSync(new URL("../supabase/schema.sql", import.meta.url), "utf8");
const fetcher = readFileSync(new URL("../scripts/fetch-feeds.mjs", import.meta.url), "utf8");

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

test("curated podcast sources include High Energy with its public RSS feed", () => {
  assert.ok(schema.includes("('高能量', 'podcast', 'podcast', 'https://feed.xyzfm.space/jhfuba3dahq8'"));
  assert.ok(schema.includes("https://www.xiaoyuzhoufm.com/podcast/62c6ae08c4eaa82b112b9c84"));
  assert.ok(fetcher.includes('name: "高能量"'));
  assert.ok(fetcher.includes('sources?on_conflict=name,source_type'));
});
