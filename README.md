# Will Suan — personal research site

Single-page static site, GitHub Pages-ready.

## File structure

```
.
├── index.html
├── styles.css
├── script.js
├── README.md
└── assets/
    └── Will_Suan_CV.pdf   (drop your CV here)
```

## Deploy to GitHub Pages

1. Create a repo named `willsuan.github.io` (or use an existing GitHub Pages repo).
2. Add the files in this folder to the repo root.
3. Put your CV PDF at `assets/Will_Suan_CV.pdf`.
4. In **Settings → Pages**, enable GitHub Pages from the `main` branch (`/` root).
5. Replace the placeholder links listed below.

## Placeholder links to replace

Search the project for `TODO:` — every placeholder is annotated. Quick list:

- `index.html` → CV path: `assets/Will_Suan_CV.pdf` (hero "View CV" button + contact list)
- `index.html` → email: `will.suan@example.com`
- `index.html` → GitHub: `https://github.com/willsuan`
- `index.html` → LinkedIn: `https://www.linkedin.com/in/willsuan`
- `index.html` → project tile repo links (`#`) inside the "Selected work" section

## Notes

- No build step. No backend.
- Fonts loaded from Google Fonts (IBM Plex Sans / Mono / Serif).
- Hero animation respects `prefers-reduced-motion` (renders one static frame).
- Quick nav: press `⌘K` / `Ctrl+K` to open the command palette.
