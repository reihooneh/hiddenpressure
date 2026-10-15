# Security policy

## Reporting a problem

If you find a security or privacy problem, please report it privately using GitHub's **Report a vulnerability** button on the Security tab of this repository, rather than opening a public issue. Please include the steps to reproduce it. I aim to reply within a week.

## Scope

This is a student project that runs entirely in the browser. In scope:

- Anything that makes a page run code or markup from the URL or other input (cross-site scripting)
- Anything that sends data off the device
- Weaknesses in the Content-Security-Policy
- Problems in the build or CI that could change what's published

Out of scope: problems in GitHub Pages itself.

## Design

- Every page has a strict Content-Security-Policy: scripts, styles and fonts load only from this site, there is no inline code, network requests are blocked (`connect-src 'none'`), and plug-ins, `<base>` tags and form posts are blocked. A test checks every built page.
- All third-party code (three.js, the fonts) is pinned to exact versions, copied into the site at build time and served from this site. `npm audit` runs in CI.
- The DOM is built with text and attributes only, never `innerHTML`, `eval` or `document.write`.
- Settings read from the URL are validated and range-checked; anything unexpected falls back to the defaults.
- CSV export quotes every cell and prefixes cells that start like a formula.
- Storage is used only for the light/dark choice, and the site works without it.
- CI runs with read-only permissions; only the deploy job can write to Pages.
- No software is 100% secure; these are the protections in place.
