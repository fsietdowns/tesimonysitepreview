import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const HOME_STORY_COUNT = 5;
const MCAE_HOME_PATH = "/testimonies";
const MCAE_CATALOGUE_PATH = "/testimonies/catalogue";

const template = await readFile(
  path.join(repositoryRoot, "src", "layout-template.html"),
  "utf8",
);
const sourceStories = JSON.parse(
  await readFile(path.join(repositoryRoot, "content", "testimonies.json"), "utf8"),
);

validateStories(sourceStories);

const newestFirst = [...sourceStories].sort((first, second) =>
  second.publishedAt.localeCompare(first.publishedAt),
);
const homeStories = newestFirst.slice(0, HOME_STORY_COUNT);
const catalogueStories = newestFirst.slice(HOME_STORY_COUNT);

const pageDefinitions = [
  {
    kind: "home",
    stories: homeStories,
    otherPageSlugs: catalogueStories.map(({ slug }) => slug),
    preview: true,
    output: path.join(repositoryRoot, "docs", "index.html"),
  },
  {
    kind: "catalogue",
    stories: catalogueStories,
    otherPageSlugs: homeStories.map(({ slug }) => slug),
    preview: true,
    output: path.join(repositoryRoot, "docs", "catalogue", "index.html"),
  },
  {
    kind: "home",
    stories: homeStories,
    otherPageSlugs: catalogueStories.map(({ slug }) => slug),
    preview: false,
    output: path.join(repositoryRoot, "mcae", "homepage-layout-template.html"),
  },
  {
    kind: "catalogue",
    stories: catalogueStories,
    otherPageSlugs: homeStories.map(({ slug }) => slug),
    preview: false,
    output: path.join(repositoryRoot, "mcae", "catalogue-layout-template.html"),
  },
];

for (const page of pageDefinitions) {
  await mkdir(path.dirname(page.output), { recursive: true });
  await writeFile(page.output, renderPage(page), "utf8");
}

console.log(
  `Built ${homeStories.length} homepage testimonies and ${catalogueStories.length} catalogue testimonies.`,
);

function renderPage({ kind, stories, otherPageSlugs, preview }) {
  const isHome = kind === "home";
  const pageTitle = isHome
    ? "Real stories | Fresh Start in Education"
    : "Testimony catalogue | Fresh Start in Education";
  const pageDescription = isHome
    ? "Read the five most recent Fresh Start in Education testimonies."
    : "Browse the Fresh Start in Education testimony catalogue.";
  const otherPageUrl = preview
    ? isHome
      ? "catalogue/"
      : "../"
    : isHome
      ? MCAE_CATALOGUE_PATH
      : MCAE_HOME_PATH;
  const otherPageLabel = isHome
    ? "Testimony catalogue"
    : "Latest testimonies";
  const otherPageLongLabel = isHome
    ? "Browse the testimony catalogue"
    : "Return to the latest testimonies";
  const defaultFilter = isHome ? "LATEST_STORIES" : "ALL_TESTIMONIES";

  let html = template;

  html = replaceOnce(
    html,
    "    var STORIES = __STORIES_JSON__;",
    [
      `    var STORIES = ${inlineJson(stories)};`,
      `    var PAGE_KIND = ${JSON.stringify(kind)};`,
      `    var OTHER_PAGE_URL = ${JSON.stringify(otherPageUrl)};`,
      `    var OTHER_PAGE_SLUGS = ${inlineJson(otherPageSlugs)};`,
    ].join("\n"),
    "story data marker",
  );

  if (preview) {
    html = replaceOnce(html, "<title>%%title%%</title>", `<title>${escapeHtml(pageTitle)}</title>`, "preview title");
    html = replaceOnce(
      html,
      '<meta name="description" content="%%description%%">',
      `<meta name="description" content="${escapeAttribute(pageDescription)}">\n  <meta name="robots" content="noindex, nofollow, noarchive">`,
      "preview description",
    );
    html = replaceOnce(
      html,
      '<div class="fs-mcae-content-slot" aria-hidden="true">%%content%%</div>',
      '<div class="fs-mcae-content-slot" aria-hidden="true"></div>',
      "preview content slot",
    );
  }

  html = replaceOnce(
    html,
    "  </style>",
    `${pageSwitchStyles()}\n  </style>`,
    "page-switch styles",
  );

  html = replaceOnce(
    html,
    '        <a href="https://freshstartineducation.co.uk/blog/">Blog</a>\n        <a class="fs-nav-cta"',
    `        <a href="https://freshstartineducation.co.uk/blog/">Blog</a>\n        <a class="fs-page-nav" href="${escapeAttribute(otherPageUrl)}">${escapeHtml(otherPageLabel)}</a>\n        <a class="fs-nav-cta"`,
    "cross-page navigation",
  );

  html = replacePattern(
    html,
    /        <div class="fs-hero-copy">[\s\S]*?        <\/div>\r?\n        <div class="fs-hero-image"/,
    `${heroMarkup(kind)}\n        <div class="fs-hero-image"`,
    "hero copy",
  );

  html = replacePattern(
    html,
    /        <div class="fs-section-heading">[\s\S]*?        <\/div>\r?\n\r?\n        <div class="fs-filter-bar"/,
    `${sectionHeadingMarkup(kind, otherPageUrl, otherPageLongLabel)}\n\n        <div class="fs-filter-bar"`,
    "section heading",
  );

  html = replaceOnce(
    html,
    "      var activeTag = LATEST_STORIES;",
    `      var activeTag = ${defaultFilter};`,
    "default filter",
  );
  html = replaceOnce(
    html,
    "        var tags = [LATEST_STORIES, ALL_TESTIMONIES];",
    '        var tags = PAGE_KIND === "home" ? [LATEST_STORIES] : [ALL_TESTIMONIES];',
    "page filter set",
  );
  html = replaceOnce(
    html,
    "        clearFilter.hidden = activeTag === LATEST_STORIES;",
    `        clearFilter.hidden = activeTag === ${defaultFilter};`,
    "clear-filter visibility",
  );
  html = replaceOnce(
    html,
    "        document.title = \"Real stories | Fresh Start in Education\";",
    `        document.title = ${JSON.stringify(pageTitle)};`,
    "library document title",
  );
  html = replaceOnce(
    html,
    "        } else {\n          showLibrary();\n        }\n      }\n\n      filterBar.addEventListener",
    [
      "        } else if (OTHER_PAGE_SLUGS.indexOf(decodeURIComponent(match[1])) !== -1) {",
      '          window.location.replace(OTHER_PAGE_URL + "#story/" + encodeURIComponent(decodeURIComponent(match[1])));',
      "        } else {",
      "          showLibrary();",
      "        }",
      "      }",
      "",
      "      filterBar.addEventListener",
    ].join("\n"),
    "cross-page story handoff",
  );
  html = replaceOnce(
    html,
    "        activeTag = LATEST_STORIES;\n        renderFilters();",
    `        activeTag = ${defaultFilter};\n        renderFilters();`,
    "clear-filter default",
  );

  html = html.replace(
    "FRESH START IN EDUCATION: MCAE TESTIMONY LIBRARY",
    preview
      ? "FRESH START IN EDUCATION: GITHUB REVIEW PREVIEW"
      : `FRESH START IN EDUCATION: MCAE ${isHome ? "HOMEPAGE" : "CATALOGUE"}`,
  );

  if (html.includes("__STORIES_JSON__")) {
    throw new Error(`Unresolved build marker in ${kind} ${preview ? "preview" : "MCAE"} output.`);
  }

  return html;
}

function heroMarkup(kind) {
  if (kind === "home") {
    return `        <div class="fs-hero-copy">
          <h1>Every fresh start <span>begins with a story.</span></h1>
          <p class="fs-hero-intro">
            Discover how personalised education creates the space for young people
            to reconnect, rebuild confidence and imagine what comes next.
          </p>
          <a class="fs-hero-scroll" href="#stories">Explore their stories ↓</a>
        </div>`;
  }

  return `        <div class="fs-hero-copy">
          <p class="fs-eyebrow">Testimony catalogue</p>
          <h1>Every story <span>deserves to be remembered.</span></h1>
          <p class="fs-hero-intro">
            Explore earlier testimonies from young people and families supported
            by Fresh Start in Education.
          </p>
          <a class="fs-hero-scroll" href="#stories">Browse the catalogue ↓</a>
        </div>`;
}

function sectionHeadingMarkup(kind, otherPageUrl, otherPageLongLabel) {
  const heading = kind === "home"
    ? `Discover our impact, and how together we can
              <span class="fs-tagline-accent">inspire hope for a future.</span>`
    : `More stories of progress, possibility and
              <span class="fs-tagline-accent">fresh starts.</span>`;
  const supportingCopy = kind === "home"
    ? "Filter the five most recent testimonies by theme, or explore earlier stories in the catalogue."
    : "Filter the catalogue by theme to discover more results from our person-centred approach.";

  return `        <div class="fs-section-heading">
          <div>
            <p class="fs-eyebrow">${kind === "home" ? "Latest testimonies" : "The testimony catalogue"}</p>
            <h2>
              ${heading}
            </h2>
          </div>
          <div class="fs-section-aside">
            <p>${supportingCopy}</p>
            <a class="fs-page-switch" href="${escapeAttribute(otherPageUrl)}">${escapeHtml(otherPageLongLabel)} →</a>
          </div>
        </div>`;
}

function pageSwitchStyles() {
  return `
    .fs-section-aside {
      align-items: flex-start;
      display: flex;
      flex-direction: column;
      gap: 20px;
      margin-bottom: 7px;
      max-width: 380px;
    }

    .fs-section-aside > p {
      color: var(--ink-soft);
      font-size: 15px;
      line-height: 1.65;
      margin: 0;
    }

    .fs-page-switch {
      align-items: center;
      background: var(--blue);
      border: 1px solid var(--blue);
      border-radius: 999px;
      color: white;
      display: inline-flex;
      font-size: 12px;
      font-weight: 700;
      padding: 12px 18px;
      text-decoration: none;
      transition: background 160ms ease, color 160ms ease, transform 160ms ease;
    }

    .fs-page-switch:hover {
      background: transparent;
      color: var(--blue);
      transform: translateY(-2px);
    }
`;
}

function validateStories(stories) {
  if (!Array.isArray(stories)) {
    throw new Error("content/testimonies.json must contain an array.");
  }
  if (stories.length < HOME_STORY_COUNT) {
    throw new Error(`At least ${HOME_STORY_COUNT} testimonies are required for the homepage.`);
  }

  const slugs = new Set();
  for (const [index, story] of stories.entries()) {
    const requiredTextFields = [
      "slug",
      "name",
      "role",
      "headline",
      "summary",
      "quote",
      "publishedAt",
    ];
    for (const field of requiredTextFields) {
      if (typeof story[field] !== "string" || story[field].trim() === "") {
        throw new Error(`Testimony ${index + 1} has an invalid ${field}.`);
      }
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(story.publishedAt)) {
      throw new Error(`${story.slug} must use a YYYY-MM-DD publishedAt date.`);
    }
    if (slugs.has(story.slug)) {
      throw new Error(`Duplicate testimony slug: ${story.slug}`);
    }
    slugs.add(story.slug);
    if (!Array.isArray(story.tags) || story.tags.length === 0) {
      throw new Error(`${story.slug} must have at least one tag.`);
    }
    if (!Array.isArray(story.paragraphs) || story.paragraphs.length === 0) {
      throw new Error(`${story.slug} must have at least one paragraph.`);
    }
  }
}

function inlineJson(value) {
  return JSON.stringify(value, null, 2)
    .replace(/<\/script/gi, "<\\/script")
    .replace(/\u2028/g, "\\u2028")
    .replace(/\u2029/g, "\\u2029");
}

function replaceOnce(input, search, replacement, label) {
  const firstIndex = input.indexOf(search);
  if (firstIndex === -1) {
    throw new Error(`Could not find ${label} in the layout template.`);
  }
  if (input.indexOf(search, firstIndex + search.length) !== -1) {
    throw new Error(`Found ${label} more than once in the layout template.`);
  }
  return `${input.slice(0, firstIndex)}${replacement}${input.slice(firstIndex + search.length)}`;
}

function replacePattern(input, pattern, replacement, label) {
  const matches = input.match(new RegExp(pattern.source, pattern.flags.includes("g") ? pattern.flags : `${pattern.flags}g`));
  if (!matches || matches.length !== 1) {
    throw new Error(`Expected one ${label} in the layout template; found ${matches?.length ?? 0}.`);
  }
  return input.replace(pattern, replacement);
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function escapeAttribute(value) {
  return escapeHtml(value);
}
