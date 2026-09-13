# Dither / Form

A Next.js playground for blue dither particles that disperse and reform into procedural 3D shapes and flat 2D illustrations. A regular screen-space grid turns the shapes into ordered dithering or halftone dots. Everything is generated locally with Canvas 2D, with no external assets or services.

## Run locally

```bash
npm install
npm run dev -- --port 3001
```

Open [localhost:3001](http://localhost:3001). Port 3001 is used because port 3000 is already occupied locally.

## Explore

Choose between six scenes: **Train**, **Railroad**, **Train on a railroad**, **Factory**, **Human**, and **AI**. Switching scenes morphs the same particle field into the next shape.

The **3D / 2D** tabs switch between spatial forms and flat illustrations of all six subjects. **Ordered** uses a 4×4 Bayer threshold pattern; **Halftone** uses regularly spaced dots whose size follows the shading. Grain size controls the grid scale, and density adjusts the fill. Dragging rotates 3D forms; pointer disturbance, scatter/reform, and PNG export work in both views.

Use the on-screen controls to pause motion and reform the current shape. Keyboard shortcuts:

| Key                | Action                   |
| ------------------ | ------------------------ |
| Left / Right arrow | Previous / next scene    |
| Space              | Pause / resume           |
| R                  | Reform the current shape |

The primary color is **`oklch(67.5% 0.141 261.3)`**.

## Files

| File                                 | Purpose                                                                  |
| ------------------------------------ | ------------------------------------------------------------------------ |
| `src/lib/particle-shapes.ts`         | Seeded surface sampling and geometry for all six scenes.                 |
| `src/components/particle-canvas.tsx` | Particle simulation, projection, ordered dither, and halftone rendering. |
| `src/lib/particle-shapes-2d.ts`      | Flat grayscale illustrations sampled into 2D particle targets.           |
| `src/app/page.tsx`                   | Playground interface, scene selection, and controls.                     |
| `src/app/globals.css`                | Layout, typography, color tokens, and responsive styles.                 |

To add a shape, extend `SceneId` and `generateShape` in the geometry module, then add it to the scene selector. Every scene returns the requested number of particles so the renderer can morph between them.

## Checks

```bash
npm run lint
npm run build
```

## Visual references

- [Dither Cards on Inspora](https://www.inspora.design/posts/dither-cards)
- [Dagny homepage](https://dagny-website.vercel.app/homepage): regular halftone fields and tonal shading.
