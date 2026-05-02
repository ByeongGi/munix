import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const checklistPath = resolve(here, "../../docs/manual-test-checklist.md");
const failOnDebt = process.argv.includes("--fail-on-debt");

const markdown = readFileSync(checklistPath, "utf8");
const lines = markdown.split(/\r?\n/);
const sections = new Map();
let currentSection = "문서 상단";

for (const line of lines) {
  const heading = line.match(/^##\s+(.+)$/);
  if (heading) {
    currentSection = heading[1].trim();
    if (!sections.has(currentSection)) sections.set(currentSection, []);
    continue;
  }

  const unchecked = line.match(/^\s*-\s+\[\s\]\s+(.+)$/);
  if (!unchecked) continue;

  if (!sections.has(currentSection)) sections.set(currentSection, []);
  sections.get(currentSection).push(unchecked[1].trim());
}

const entries = Array.from(sections.entries()).filter(
  ([, items]) => items.length > 0,
);
const total = entries.reduce((sum, [, items]) => sum + items.length, 0);

console.log(`Manual test debt: ${total} unchecked item(s)`);
console.log(`Source: ${checklistPath}`);

if (entries.length > 0) {
  console.log("");
  for (const [section, items] of entries) {
    console.log(`- ${section}: ${items.length}`);
  }
}

console.log("");
console.log(
  "Target: migrate these items to automated tests described in docs/test-automation-strategy.md.",
);

if (failOnDebt && total > 0) {
  process.exitCode = 1;
}
