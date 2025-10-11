# Portfolio Website

This repository contains a small static portfolio website built with plain HTML/CSS/JS (Tailwind via CDN). It's designed as a personal portfolio with sections for home, about, projects, and contact.

## What's included

- `index.html`, `about.html`, `projects.html`, `contact.html` — main pages
- `main.js` — site-wide JavaScript (animations, timeline, skills, mobile menu, smooth scroll)
- `resources/` — images and assets

## Libraries used (via CDN)

- Tailwind CSS (cdn)
- anime.js (animations)
- p5.js (network background)
- Typed.js (hero typewriter effect)
- echarts (included but optional)

These are included directly in the HTML files via CDN links — no package manager required.

## Run locally

Since this is a static site, you can serve it using any static server. Examples:

- Python 3 (recommended):

```bash
# From the project root (/home/salt/flabby/portfolioWebsite)
python3 -m http.server 8000
# Then open http://localhost:8000 in your browser
```

- Node.js (if available):

```bash
npx http-server -c-1 -p 8000
# or install serve: npm i -g serve
serve -p 8000
```

- Or open `index.html` directly in the browser (some features like modules or certain fetch requests may require a server).

## Editing content

- Edit the hero typed roles in `main.js` (search for `new Typed('#typed-text'...`) to change the rotating role strings.
- Edit the `about.html` content and skill cards in the `<!-- Skills Matrix -->` section.
- Timeline entries are in `about.html` under `<!-- Experience Timeline -->`.
- Projects are listed in `projects.html` — update card markup and `data-categories` for filtering.

## Notes & tips

- Accessibility: consider adding ARIA attributes and keyboard handlers for timeline and skill interactions.
- To tweak animations, edit durations/easings in `main.js` (functions `initializeTimeline()` and `initializeSkillsMatrix()`).
- If you want local package management or builds, consider adding a minimal `package.json` and bundler (Vite/Parcel) — I can help scaffold that if you want.

## Troubleshooting

- If animations behave oddly after edits, check for conflicting CSS transitions on elements that JS animates (height/opacity). The code uses anime.js for numeric height animations to avoid `height: auto` issues.
- If the network background (p5.js) causes performance issues, reduce `numNodes` in `initializeNetworkBackground()` in `main.js`.

## Next suggested improvements

- Improve mobile accessibility and keyboard navigation for interactive components.
- Convert inline styles for progress bars into data-driven attributes and animate them on scroll.

---

If you want, I can also add a deploy-ready `package.json` and a tiny GitHub Actions workflow to publish to GitHub Pages.
