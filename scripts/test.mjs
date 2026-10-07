import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const sourceStories = JSON.parse(await read("content/testimonies.json"));
const expectedNewestFirst = [...sourceStories].sort((a, b) =>
  b.publishedAt.localeCompare(a.publishedAt),
);

const outputs = {
  previewHome: await read("index.html"),
  previewCatalogue: await read("catalogue/index.html"),
  mcaeHome: await read("mcae/homepage-layout-template.html"),
  mcaeCatalogue: await read("mcae/catalogue-layout-template.html"),
};

const homeStories = extractStories(outputs.previewHome);
const catalogueStories = extractStories(outputs.previewCatalogue);

assert.equal(homeStories.length, 5, "The homepage must contain exactly five testimonies.");
assert.deepEqual(
  homeStories.map(({ slug }) => slug),
  expectedNewestFirst.slice(0, 5).map(({ slug }) => slug),
  "The homepage must contain the five newest testimonies.",
);
assert.deepEqual(
  catalogueStories.map(({ slug }) => slug),
  expectedNewestFirst.map(({ slug }) => slug),
  "The catalogue must contain every testimony in newest-first order.",
);
assert.ok(
  homeStories.every(({ slug }) => catalogueStories.some((story) => story.slug === slug)),
  "Every homepage testimony must also appear in the complete catalogue.",
);

for (const [name, html] of Object.entries(outputs)) {
  assert.ok(!html.includes("__STORIES_JSON__"), `${name} contains an unresolved build marker.`);
  assert.ok(
    html.includes("https://forms.cloud.microsoft/Pages/ResponsePage.aspx?id=fS7_V_C7Lk2juuG7Eu0NR7F3217BD1lIuPI2IwH58bFUQkhXSzBETU1BTTg3QjZTVDhZWVRYWEg4NC4u"),
    `${name} does not contain the approved Refer now URL.`,
  );
  assert.ok(
    html.includes("https://freshstartineducation.co.uk/resources/quick-links/"),
    `${name} does not contain the ES and Client Portal URL.`,
  );
  assert.ok(
    html.includes("https://online.freshstartineducation.co.uk/"),
    `${name} does not contain the Online Tutoring Platform URL.`,
  );
  assertNavigationOrder(html, name);
  assertScriptsCompile(html, name);
}

for (const name of ["previewHome", "previewCatalogue"]) {
  assert.ok(outputs[name].includes('name="robots" content="noindex, nofollow, noarchive"'));
  assert.ok(!outputs[name].includes("<title>%%title%%</title>"));
}

for (const name of ["mcaeHome", "mcaeCatalogue"]) {
  assert.ok(outputs[name].includes("<title>%%title%%</title>"));
  assert.ok(outputs[name].includes('content="%%description%%"'));
  assert.ok(outputs[name].includes(">%%content%%</div>"));
}

assert.ok(outputs.previewHome.includes('href="catalogue/"'));
assert.ok(outputs.previewCatalogue.includes('href="../"'));
assert.ok(
  outputs.mcaeHome.includes(
    'href="https://go.freshstartineducation.co.uk/FSiE-Testimonies-Catalogue"',
  ),
);
assert.ok(
  outputs.mcaeCatalogue.includes(
    'href="https://go.freshstartineducation.co.uk/FSiE-Testimonies"',
  ),
);
assert.ok(outputs.previewHome.includes('var PAGE_KIND = "home";'));
assert.ok(outputs.previewCatalogue.includes('var PAGE_KIND = "catalogue";'));
assert.ok(
  outputs.previewCatalogue.includes(
    ".fs-story-grid.fs-catalogue-grid > .fs-story-card:last-child:nth-child(odd)",
  ),
  "The catalogue must keep an odd final card in the left column.",
);
assert.ok(
  outputs.previewCatalogue.includes(
    'storyGrid.classList.toggle("fs-catalogue-grid", PAGE_KIND === "catalogue")',
  ),
  "The catalogue grid class must be activated at runtime.",
);
assert.ok(outputs.previewHome.includes("window.location.replace(OTHER_PAGE_URL"));
assert.ok(outputs.previewCatalogue.includes("window.location.replace(OTHER_PAGE_URL"));

console.log(
  `Verified ${homeStories.length} homepage testimonies, ${catalogueStories.length} catalogue testimonies and four generated outputs.`,
);

async function read(relativePath) {
  return readFile(path.join(root, ...relativePath.split("/")), "utf8");
}

function extractStories(html) {
  const match = html.match(/    var STORIES = (\[[\s\S]*?\n\]);\n    var PAGE_KIND =/);
  assert.ok(match, "Could not extract the generated STORIES array.");
  return Function(`"use strict"; return (${match[1]});`)();
}

function assertNavigationOrder(html, name) {
  const labels = [
    "LAs &amp; Schools",
    "Parents &amp; Carers",
    "Training",
    "Students",
    "Blog",
  ];
  const positions = labels.map((label) => html.indexOf(`>${label}</a>`));
  assert.ok(positions.every((position) => position !== -1), `${name} is missing a standard navigation item.`);
  assert.deepEqual(positions, [...positions].sort((a, b) => a - b), `${name} has the wrong standard navigation order.`);

  const referPosition = html.indexOf(">Refer now</a>");
  const workPosition = html.indexOf(">Work for us</a>");
  assert.ok(referPosition > positions.at(-1), `${name} must place Refer now after the standard tabs.`);
  assert.ok(workPosition > referPosition, `${name} must place Work for us after Refer now.`);
}

function assertScriptsCompile(html, name) {
  const scripts = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)];
  assert.ok(scripts.length > 0, `${name} does not contain an inline script.`);
  for (const [, script] of scripts) {
    Function(script);
  }
}
