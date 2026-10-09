# Security policy

## Reporting a problem

If you find a security or privacy problem, please report it privately using GitHub's **Report a vulnerability** button on the Security tab of this repository, rather than opening a public issue. Please include the steps to reproduce it. I aim to reply within a week.

## Scope

This is a student prototype that runs entirely in the browser. In scope:

- Anything that makes the page run code or markup from user input (cross-site scripting)
- Anything that sends data off the device
- Weaknesses in the Content-Security-Policy

Out of scope: problems in third-party services (GitHub Pages, Google Fonts) themselves.

## Design

- All processing happens on the device; nothing is uploaded or stored.
- User input is inserted as text, never as HTML.
- A Content-Security-Policy restricts what the page can load and blocks plug-ins, `<base>` tags and form submissions.
- No software is 100% secure; these are the protections in place.
