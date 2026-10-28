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
  consentSnippet: await read("docs/fresh-start-consent-banner-snippet.html"),
};
const contractorCode = await read("Fresh-Start-Cookie-Consent-Contractor-Code.html");

assert.equal(
  contractorCode,
  outputs.consentSnippet,
  "The contractor handoff must exactly match the generated consent snippet.",
);

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

for (const [name, html] of Object.entries(outputs).filter(([name]) => name !== "consentSnippet")) {
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
  assert.ok(outputs[name].includes('id="fs-consent-layer"'));
  assert.ok(outputs[name].includes('id="fs-consent-settings"'));
  assert.ok(outputs[name].includes('class="fs-consent-manage-scroll"'));
  assert.ok(outputs[name].includes("Cookies on our website"));
  assert.ok(outputs[name].includes('<h2 id="fs-consent-manage-title">Manage Cookies</h2>'));
  assert.ok(!outputs[name].includes("Make your choices"));
  assert.ok(outputs[name].includes('new CustomEvent("fs:consent-changed"'));
  assert.ok(outputs[name].includes('"default-denied"'));
  assert.ok(outputs[name].includes("getEffective: function"));
  assert.ok(outputs[name].includes("subscribe: function"));
  assert.ok(outputs[name].includes('applyPreferences(emptyPreferences(false), "reset")'));
  assert.ok(outputs[name].includes("Marketing &amp; Communications"));
  assert.ok(outputs[name].includes("Helps us understand how people find and use our website, measure the effectiveness of our campaigns and improve the online experience."));
  assert.ok(outputs[name].includes("Helps us understand how people find and use our website through Facebook and Instagram, and improve the relevance of our communications."));
  assert.ok(outputs[name].includes("Live chat will still be available"));
  assert.ok(!outputs[name].includes("contractor-configured"));
  assert.ok(!outputs[name].includes("fs-consent-prototype-label"));
}

for (const name of ["mcaeHome", "mcaeCatalogue"]) {
  assert.ok(outputs[name].includes("<title>%%title%%</title>"));
  assert.ok(outputs[name].includes('content="%%description%%"'));
  assert.ok(outputs[name].includes(">%%content%%</div>"));
  assert.ok(!outputs[name].includes('id="fs-consent-layer"'));
}

assert.ok(outputs.consentSnippet.includes("FRESH START COOKIE CONSENT — CONTRACTOR INTEGRATION CODE"));
assert.ok(outputs.consentSnippet.includes('id="fs-consent-mcae"'));
assert.ok(outputs.consentSnippet.includes('id="fs-consent-google"'));
assert.ok(outputs.consentSnippet.includes('id="fs-consent-meta"'));
assert.ok(outputs.consentSnippet.includes('id="fs-consent-hubspot"'));
assertScriptsCompile(outputs.consentSnippet, "consentSnippet");
assertNoDuplicateIds(outputs.consentSnippet, "consentSnippet");
assertAriaReferencesResolve(outputs.consentSnippet, "consentSnippet");
assert.ok(
  outputs.consentSnippet.indexOf("<script>") <
    outputs.consentSnippet.indexOf('id="fs-consent-layer"'),
  "The synchronous consent controller must appear before the banner markup.",
);
assert.ok(outputs.consentSnippet.includes("100dvh"));
assert.ok(outputs.consentSnippet.includes("94dvh"));

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

function assertNoDuplicateIds(html, name) {
  const ids = [...html.matchAll(/\sid="([^"]+)"/g)].map((match) => match[1]);
  const duplicates = ids.filter((id, index) => ids.indexOf(id) !== index);
  assert.deepEqual([...new Set(duplicates)], [], `${name} contains duplicate element IDs.`);
}

function assertAriaReferencesResolve(html, name) {
  const ids = new Set(
    [...html.matchAll(/\sid="([^"]+)"/g)].map((match) => match[1]),
  );
  const references = [
    ...html.matchAll(/\saria-(?:labelledby|describedby)="([^"]+)"/g),
  ].flatMap((match) => match[1].split(/\s+/));
  assert.ok(
    references.every((reference) => ids.has(reference)),
    `${name} contains an unresolved ARIA reference.`,
  );
}
