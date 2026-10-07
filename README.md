# Fresh Start testimony preview

This repository generates the Fresh Start in Education testimony homepage, testimony catalogue and their matching MCAE/Pardot layout templates from one testimony source.

## Published structure

- `index.html` — GitHub Pages preview of the five most recent testimonies.
- `catalogue/index.html` — GitHub Pages preview of every older testimony.
- `mcae/homepage-layout-template.html` — complete Classic MCAE layout-template code for the homepage.
- `mcae/catalogue-layout-template.html` — complete Classic MCAE layout-template code for the catalogue.

GitHub Pages publishes from the root of the `main` branch. The previews include
`noindex` metadata and a restrictive `robots.txt`. They are still accessible to
anyone who has the Pages URL.

## Adding a testimony

1. Add the testimony once to `content/testimonies.json`.
2. Give it a unique `slug` and a `publishedAt` value in `YYYY-MM-DD` format.
3. Run `npm run check`.
4. Commit and push the source and generated files.
5. Review the GitHub Pages homepage and catalogue.
6. After approval, paste the two files from `mcae/` into their matching Classic Account Engagement layout templates.

The build sorts stories by `publishedAt`. The newest five are written to the homepage; everything older is written to the catalogue. No manual moving or copying between pages is required.

## MCAE landing-page paths

The generated MCAE files assume these vanity paths:

- Homepage: `/testimonies`
- Catalogue: `/testimonies/catalogue`

If those paths change, update `MCAE_HOME_PATH` and `MCAE_CATALOGUE_PATH` at the top of `scripts/build.mjs`, then rebuild.

Both MCAE outputs retain `%%title%%`, `%%description%%` and `%%content%%`.

## Commands

```text
npm run build
npm test
npm run check
npm run preview
```

This project deliberately has no runtime dependencies or package installation step.
