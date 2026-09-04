# Demo source (local F5 fixture)

Vanilla HTML / CSS / JS snapshots for a **particle field that follows the cursor**. Open `index.html` with a simple static server (ES modules need `http://`, not `file://`).

Each snapshot’s `index.html` loads a single entry: `<script src="src/main.js" type="module"></script>`. `boot()` in `src/main.js` stays through every chapter and `import`s the rest.

| Dir          | Role                            | What changes                                            |
| ------------ | ------------------------------- | ------------------------------------------------------- |
| `start/`     | skeleton starts here            | `src/main.js` stub `boot()`, `css/styles.css`           |
| `skeleton/`  | skeleton goal / particles start | canvas + `src/scene/` loop; fill `boot()`               |
| `particles/` | particles goal / follow start   | add `src/particle/`; `boot()` calls `createParticles()` |
| `follow/`    | follow goal / glow start        | add `src/pointer/`; orbit ring + scatter on leave       |
| `glow/`      | glow goal                       | constant glow + trails in `particle.js` / `canvas.js`   |

Chapter 1 course `docs` is the website tutorial (`https://rjiazhen.github.io/learn-by-diff/zh/demo/skeleton.html`), not the snapshot `README.md`. `glow/docs.pdf` is the PDF docs sample. Rebuild it from `glow/docs.md` with pandoc (this repo does not assume LaTeX):

```bash
pandoc examples/demo-source/glow/docs.md -s -t html5 \
  --metadata title="Glow and trails" \
  -H examples/demo-source/pdf-header.html \
  -o /tmp/lbd-glow-docs.html
```

Then print that HTML to `examples/demo-source/glow/docs.pdf` (Chrome `--headless --print-to-pdf`, or any HTML-to-PDF tool).
