import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const sourcePath = process.argv[2];

if (!sourcePath) {
  throw new Error("Usage: node scripts/import-current.mjs <current-layout-template.html>");
}

const source = await readFile(path.resolve(sourcePath), "utf8");
const storyBlock = source.match(
  /    var STORIES = (\[[\s\S]*?\r?\n    \]);\r?\n\r?\n    \(function \(\) \{/,
);

if (!storyBlock) {
  throw new Error("Could not find the STORIES array in the current layout template.");
}

const stories = Function(`"use strict"; return (${storyBlock[1]});`)();

if (!Array.isArray(stories) || stories.length === 0) {
  throw new Error("The imported STORIES value is not a populated array.");
}

const template = source.replace(
  storyBlock[0],
  "    var STORIES = __STORIES_JSON__;\n\n    (function () {",
);

await writeFile(
  new URL("../content/testimonies.json", import.meta.url),
  `${JSON.stringify(stories, null, 2)}\n`,
  "utf8",
);
await writeFile(
  new URL("../src/layout-template.html", import.meta.url),
  template,
  "utf8",
);

console.log(`Imported ${stories.length} testimonies into the preview repository.`);
