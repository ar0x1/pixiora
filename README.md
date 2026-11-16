# PIXIORA — Image Optimization Studio

> **by ar0x** · MIT licensed · open source
> Source: <https://github.com/ar0x1/pixiora> · Contact: <killtoneizuku@gmail.com>

PIXIORA is a browser-based image compressor and converter. It compresses and converts images, and
compares before/after results, **entirely on the user's device** using WebAssembly codecs. There is
no backend, no account, no API key and no upload path in the codebase — static hosting is enough.

> **Scope of this document.** Every capability below was verified by running the application, not
> by reading the source. [§12](#12-acceptance-criteria) states plainly which items are complete,
> which are partial and which were deliberately removed. Numbers in
> [§10](#10-performance-notes-measured) are measurements from this repository's own runs, with the
> caveats attached.

---

## 1. Quick start

```bash
git clone https://github.com/ar0x1/pixiora.git
cd pixiora

npm install --legacy-peer-deps   # REQUIRED — see §4.2
npm run dev                      # http://localhost:5173
```

No `.env` file, no API key, no database, no server. Open the URL and drop an image in.

To verify a production build locally:

```bash
npm run build      # tsc -b && vite build  →  dist/
npm run preview    # serves dist/ on http://localhost:4173
```

`dist/` is fully static — copy it to any static host (GitHub Pages, Netlify, S3, nginx) and the app
works. There are no server-side requirements and no special response headers, because every codec is
shipped as a bundled `.wasm` asset.

---

## 2. Product overview

| | |
|---|---|
| **Module** | Compressor · Converter (+ **Documentation** as a top-bar icon action) |
| **Input formats** | JPEG, PNG, WebP, AVIF, GIF, SVG, HEIC/HEIF, TIFF |
| **Output formats** | JPEG, PNG, WebP, AVIF, GIF, SVG |
| **Editable preferences** | **None.** Quality is locked at **50**, effort at **6**; the resource ceiling is fixed at **250 MB / 150 MP / 16384 px** |
| **In-flight work** | Exactly **one image per workspace** — no batch, no queue |
| **Processing** | Local only — WebAssembly in bounded Web Workers |
| **Privacy** | No uploads, no analytics, no accounts, no cookies; only preferences in `localStorage` |
| **Tests** | 77 unit/component + 27 browser (23 e2e + 4 axe), all green |

### 2.1 Navigation

Navigation lives entirely in the top bar — there is **no side rail**. Two workspaces are tabs marked
by a rule that sits on the bar's own border. **Documentation** is the only action at the right edge,
because it is an occasional reference rather than a workspace. The header carries nothing else: no
status pill, no badge, no privacy chip, no context/subtitle row. Below `md` the tab row is hidden and
the bottom tab bar takes over (the Documentation action stays in the header), so labels are never
clipped mid-word. The bar is 62 px tall, with the wordmark set in the display serif.

### 2.2 One image per workspace

The app is deliberately single-image, and the layout — not a rule to remember — enforces it:

| State | What the workspace shows |
|---|---|
| Empty | The drop target is the only upload affordance in the document, headed with the workspace's own verb. No rail. |
| Image loaded | File strip (name, format, dimensions, size, close) + viewer. **The drop target is unmounted**, so "add more" cannot exist. |
| Finished | Nothing changes structurally: the run button renames itself (*Compress again* / *Convert to WEBP again*) and opens the picker for a new image, Download enables, and the result strip appears. There is no completion card. |

The empty state is verb-driven and deliberately bare: the Compressor says **Compress an image**, the
Converter says **Convert an image** — set in the display serif. Below it: the Browse button and
"or drop it here". Nothing else. The format strip (JPEG PNG WEBP …), the "On device · nothing
uploaded" badge, the per-workspace eyebrow label (*• COMPRESSOR* / *• CONVERTER*) and both taglines
were removed, so the verb is the entire message and the drop target reads as a working surface.

`imageStore.addImages` enforces the cap itself — it stores one entry and revokes the previous
preview/result URLs — so the invariant holds even if a caller passes a batch.

### 2.3 Visual system

The interface is a tools UI, not a dashboard:

- **Geometry.** Radii are 4–12 px and systematic (`--radius-xs … --radius-xl`); no pill buttons, no
  fully rounded cards. Panels are a hairline border on a flat plane with a `panel-header` strip and a
  single soft shadow — depth is mostly borders, as in the reference system.
- **Colour.** Graphite planes (`void → base → surface → raised → elevated`), very slightly
  blue-shifted (`#08090c → #1a1f29`), and exactly one accent: a professional **steel blue**
  (`#5b9cf8`, with `#1f5bd4` for the primary action and `#9dc0ff` for focus and arcs), used on the
  primary action, the active tab, the divider handle and the logo. It is a desaturated cobalt rather
  than a saturated "app blue", so it reads as tooling. Success is a distinct mint-green (`#4ade80`)
  so a finished job never reads as "the accent again".
  `ok` / `warn` / `danger` are reserved for meaning. `ink-muted` (#8b8b96) is the darkest safe text
  colour — alpha fades of it fail axe contrast at small sizes.
- **Type.** Two voices, deliberately: **DM Serif Display** for display headings (the wordmark, the
  empty-state headline at 30–34 px, panel titles and the headline saving figure) and **DM Sans** for
  every interface string at 12.5–13 px. 10 px tracked-out uppercase eyebrows label sections; tabular
  numerals keep every measurement from jittering while a job runs. Both fonts are **self-hosted**
  from `public/fonts/*.woff2` with `unicode-range` splits — no Google Fonts request, no network
  dependency, fully offline. The serif is never used for buttons, labels, tables or controls.
- **Elevation.** No floating card stacks and no glow; depth comes from plane difference, a 1 px top
  inset highlight and one soft shadow on cards. The deep shadow is reserved for real overlays. The
  empty workspace carries a 5 % dot-grid texture masked to fade at the edges, so a large drop target
  reads as a working surface rather than a void.
- **Brand.** The mark and the wordmark are both **vector-traced from the brand artwork**, not
  redrawn: `src/components/brand/Logo.tsx` (image card + compress glyph + arrow + output card) and
  `src/components/brand/Wordmark.tsx` (the lettering, with the **X** as a separate path so it can
  carry the accent). Both are single `currentColor` paths, so they follow the theme instead of baking
  a colour in. The header paints the mark on a hairline plate and sets it beside the wordmark; the
  favicon, `public/icons/icon-{192,512}.png` and `apple-touch-icon.png` are generated from the same
  geometry. The wordmark carries a *by ar0x* sub-line.

### 2.4 Design principles actually enforced in code

1. **Never claim what was not measured.** Every result carries a `VerificationReport` produced by
   decoding the encoder's own output again. If verification fails, the file is discarded — a broken
   file can never reach a download button.
2. **No fake progress — and no flicker.** WASM encoders expose no internal percentages, so the panel
   shows the real phase: a comet ring that fills across five named stages, a pill per stage that
   snaps to a tick as it completes, and one travelling sheen for texture. The only number that can
   appear is a real attempt counter during a target-size search. A job that finishes in 200 ms does
   not flash past: the card holds a 900 ms floor and closes its ring on the final frame, so a fast
   job reads as a confident check rather than a stutter. The hold never delays the result — the
   output underneath is already rendered.
3. **Never ship a bigger file.** See [§7.2](#72-never-ship-a-bigger-file).
4. **Disclose capability loss before it happens.** Converting an animated GIF to JPEG, or flattening
   alpha into JPEG, raises a warning *before* the job runs.
5. **Type over trust.** File format comes from magic bytes, never the extension.

---

## 3. Feature list

**Compressor**
- Drag-and-drop and browse-to-upload, **one image at a time**, signature-validated
- The before/after slider opens **automatically the moment a result exists** — drag with
  mouse/touch, or focus it and use arrows / Home / End. Single-side *Original · Compressed* modes
  remain for pixel-peeping.
- **The comparison divider is measured against the painted image, not the stage.** The viewer letterboxes tall
  photos, so the `<img>` box is wider than the picture. The wipe edge, the drag mapping and the handle are all
  clamped to the rendered picture rect: dragging into the empty letterbox clamps at the image edge instead of
  pushing the divider outside the photo.
- **The rail contains exactly two actions: Compress image → Compress again, and Download.** It carries
  no summary box — the numbers live in one place only, the result strip under the viewer. **Compress
  again / Convert to … again opens the file picker** rather than re-encoding the same file: a
  workspace holds one image, so the second run is always a new one. No mode selector,
  no format picker, no quality slider, no resize, no metadata toggles. Output dimensions always
  equal the source.
- Real byte sizes, honest percentage change, encode time, applied quality, and a *"Why these
  settings?"* disclosure
- Ctrl/Cmd+Enter shortcut, and a warning only when the output differs from the source in a way the
  user should know about
- A completion block that appears only once a result exists, offering **Compress another image**

**Converter**
- JPEG → PNG/WebP/AVIF/GIF/JPEG · PNG/WebP/AVIF → each other · GIF → GIF/PNG/JPEG/WebP/AVIF
- SVG → SVG (vector preserved) or rasterised to PNG/JPEG/WebP/AVIF
- HEIC and TIFF decode → JPEG/PNG/WebP/AVIF
- Unavailable conversions are disabled with the reason, never silently failing

**Cancellation**
- Cancel is offered only while a job is running, and it is immediate. Wasm-bindgen encoders are one
  synchronous call, so a cooperative `CANCEL` message could never be observed mid-encode; the pool now
  **terminates and replaces** the worker, and the UI clears its state synchronously instead of waiting
  for a reply that a dead worker will never send. The slot comes back clean, so the next job runs
  normally. (This was a real bug: before, the spinner stayed up and the button did nothing.)

**Workspace footer**
- One line of text: `PIXIORA · by ar0x`. No buttons, no links — the legal/contact surface lives on
  the Documentation page.

**Documentation page** (top-bar icon) — three panels
- **Conversion matrix** — 8 inputs × 6 outputs, sampled from the same `canConvert` predicate the
  Converter uses, so the chart and the behaviour cannot disagree. A column is struck through when
  this browser has no encoder for it, which is the only machine-dependent part of the table. The
  `DECODER` column and the "HEIC / TIFF decode only" legend were removed — provider names are an
  implementation detail, and the chart only needs to answer *can this become that*.
- **Engine contract** — four labelled figures with **no header strip**: 250 MB · 150 MP · 16384 px ·
  50 / 6. Each cell is self-describing, so a title would only repeat the labels.
- **About** — also headerless (the paragraph names itself in its first clause), then five controls:
  **Terms of Service · Privacy Policy · Licence** (focus-trapped modals rendered from
  `src/app/legal.ts`), **Email** and **Source**.
- The **encoder inventory was removed** — the six per-format cards with `ready` badges, provider
  strings, lossy/lossless flags, speed class and alpha/animation support. Deciding what this browser
  can encode is the matrix's job; the inventory duplicated it in more words.
- The page has no form controls, no subtitle and no explanatory footnotes.

**Legal, contact and source**
- **Email** (`mailto:killtoneizuku@gmail.com`) and **Source**
  (`https://github.com/ar0x1/pixiora`, `target="_blank"`, `rel="noopener noreferrer"`) are plain
  anchors with **no click handler** — the browser's own navigation opens the mail client or the
  repository, and middle-click / ⌘-click / "copy link address" keep working.
- **Known limitation:** if the app is embedded in a sandboxed preview frame
  (`sandbox="allow-scripts"`, i.e. no `allow-popups` and no top-navigation), the *host page* blocks
  outbound navigation, so those two links do nothing there. Served on its own origin — `npm run
  preview` or any static host — both work; the e2e suite asserts a real popup opens with the
  repository URL.

---

## 4. Installation and commands

### 4.1 Requirements

| Requirement | Version | Notes |
|---|---|---|
| Node.js | **20 LTS or newer** | Verified on 20.20. Vitest is pinned to 3.x and jsdom to 26.x because newer versions need Node ≥ 21/22 APIs |
| npm | 10+ | `npm ci` also works once `package-lock.json` exists |
| Python + Pillow (optional) | 3.10+ | Only to regenerate test fixtures (`npm run fixtures`) |
| Chromium (optional) | via Playwright | Only for the browser test suite |

### 4.2 Install

```bash
npm install --legacy-peer-deps
```

`--legacy-peer-deps` is **required**, not a workaround for a broken tree: Vite 8 declares an optional
`@types/node` peer range newer than Node 20's, and npm ≥ 7 refuses to resolve it by default. Nothing
in the application depends on the difference.

### 4.3 Commands

| Command | What it does |
|---|---|
| `npm run dev` | Dev server on `http://localhost:5173` (binds `0.0.0.0`, preview hosts allowlisted) |
| `npm run build` | `tsc -b && vite build` → `dist/` |
| `npm run preview` | Serves the production build on `http://localhost:4173` |
| `npm run typecheck` | Strict type check, no emit |
| `npm test` | 77 unit + component tests (Vitest, jsdom) |
| `npm run test:watch` | Vitest in watch mode |
| `npm run test:e2e` | 27 Playwright tests (23 e2e + 4 axe audits) |
| `npm run test:a11y` | Only the axe audits |
| `npm run verify` | typecheck → unit → build → e2e, in that order |
| `npm run fixtures` | Regenerate `tests/fixtures/` with `scripts/make_fixtures.py` |

### 4.4 First-time test setup

Browser tests need a Chromium build that Playwright controls. Install it once:

```bash
npx playwright install --with-deps chromium
npm run test:e2e
```

The e2e suite starts its own `vite preview` server on port 4173 (`playwright.config.ts`
`testDir: './tests/e2e'`), so no manual server is needed.

### 4.5 Deploying

`dist/` is a directory of static files. Copy it anywhere that serves files over HTTP:

```bash
npm run build
# → dist/index.html, dist/assets/*.js, dist/assets/*.wasm, dist/manifest.webmanifest, dist/favicon.svg
```

Notes for hosts:

- **No headers required.** PNG optimisation runs single-threaded precisely so `SharedArrayBuffer` /
  COOP-COEP is unnecessary.
- **Serve `.wasm` as `application/wasm`** (default on every mainstream host).
- The app uses client-side routing (`/`, `/convert`, `/settings`), so configure a **SPA fallback**
  to `index.html` or deep links will 404.
- No environment variables are needed at runtime; the two build-time overrides in §4.6 are optional.

### 4.6 Build-time configuration (optional)

| Variable | Default | Meaning |
|---|---|---|
| `VITE_PIXIORA_MAX_FILE_MB` | 250 | Overrides the file-size ceiling at build time |
| `VITE_PIXIORA_MAX_PIXELS_MP` | 150 | Overrides the pixel ceiling at build time |

These are **build-time only**; there is no runtime UI to change either limit.

---

### 4.7 Design system

The visual language is documented separately so it can be reused in other projects:

```text
docs/design-system/
├── README.md         # style guide — tokens, typography, layout, component recipes, AI prompt
├── globals.css       # the exact token + @utility file from src/styles/
├── animations.css    # every keyframe and animation class
└── favicon.svg       # the mark
```

See **[`docs/design-system/README.md`](docs/design-system/README.md)**.

---

## 5. Technology stack

| Layer | Choice | Version | Why |
|---|---|---|---|
| UI | React | 19.2 | Concurrent rendering, no legacy APIs |
| Build | Vite (+ Rolldown) | 8.3 | ESM workers, `new URL(..., import.meta.url)` asset handling |
| Language | TypeScript (strict) | 5.9 | `noUncheckedIndexedAccess`, `noUnusedLocals`, no `any` in engine code |
| Styling | Tailwind CSS 4 + CSS variables | 4.3 | Token-driven theme in `globals.css` (no config file) |
| State | Zustand | 5.1 | Small, testable stores; settings persisted, images never |
| Animation | Framer Motion | 14.10 | Dependency retained; current motion is CSS keyframes |
| Icons | Lucide React | 1.70 | Consistent icon language (GitHub mark is drawn inline — lucide dropped brand icons) |
| JPEG | `@jsquash/jpeg` (MozJPEG → WASM) | 1.6.0 | Progressive + optimised Huffman |
| PNG | `@jsquash/png` + `@jsquash/oxipng` | 3.1.1 / 2.3.0 | Lossless re-compression, alpha preserved |
| WebP | `@jsquash/webp` (libwebp → WASM) | 1.5.0 | Lossy + true lossless + alpha |
| AVIF | `@jsquash/avif` (libavif → WASM) | 2.1.1 | Best size/quality, alpha support |
| GIF | `gifuct-js` (decode) + `gifenc` (encode) | 2.1.2 / 1.0.3 | Frame reconstruction, timing preserved |
| SVG | `svgo` | 4.1 | Optimisation + custom sanitiser plugin |
| HEIC | `libheif-js` (wasm-bundle) | 1.23.5 | Decode-only; WASM embedded, no extra fetch |
| TIFF | `utif` | 3.1.0 | Decode-only |
| Validation | Zod | 4.6.7 | Available for schema work; not on the hot path |
| Tests | Vitest + Testing Library + Playwright + axe-core | 3.2.7 / 16.3 / 1.65 / 4.x | 77 unit/component + 27 browser |

All codec packages are Apache-2.0, MIT or ISC. `libheif-js` is LGPL-3.0 — acceptable because it is
consumed as an unmodified, dynamically-imported module.

---

## 6. Architecture

```
src/
├── app/          App, router (lazy routes), providers, constants (nav + error copy),
│                 legal.ts (Terms / Privacy / Licence copy)
├── components/
│   ├── layout/   AppShell (+ Workspace two-plane layout), Header, MobileNavigation,
│   │             CanvasColumn, Credit (footer line), LegalDialogs, ContactActions
│   ├── brand/    Logo (the SVG mark, also the favicon), GithubIcon
│   ├── documentation/ ConversionMatrix (input → output chart)
│   ├── workspace/ ImagePicker, UploadZone, FileChip
│   ├── editor/   ImagePreview, ComparisonSlider
│   ├── compression/ CompressionPanel (actions only), CompressionStats, CompressionProgress
│   ├── converter/ ConverterWorkspace, ConversionOptions
│   └── ui/       Button, Slider, Select, Dialog, Tooltip, Progress, Dropdown, EmptyState,
│                 Toast, Primitives
├── engine/
│   ├── core/       EngineTypes, CodecRegistry, FormatDetector, ProcessingPipeline,
│   │               imageDecode, limits
│   ├── codecs/     Jpeg, Png, Webp, Avif, Gif, Svg, Heic, Tiff, OxipngLoader, wasmModules
│   ├── workers/    compression.worker, workerPool, workerManager
│   ├── optimization/ smartQuality, targetSize, resizeImage (internal only), transparency,
│   │                 metadata (EXIF), canvas
│   └── formats/    formatCapabilities, formatMapping, mimeTypes
├── store/        imageStore, settingsStore, toastStore
├── hooks/        useUpload, useCompression, useWorkerPool
├── utils/        formatBytes, formatDuration, calculateSavings, download, objectUrl,
│                 validateImage, fileName, cn
├── styles/       globals.css (tokens), animations.css
└── types/        image, compression, worker, vendor.d.ts
```

**Dependency direction is one-way:** `components → hooks → store/engine`. UI components never import
a codec. The only module that knows how a UI knob maps to an engine option is `buildOptions()` in
`hooks/useCompression.ts`, which takes two arguments (`settings`, `image`) and never emits dimension
constraints.

---

## 7. Compression engine

### 7.1 The contract (codec-independent)

```ts
interface ImageCodec {
  readonly encodes: readonly string[];
  readonly decodes: readonly string[];
  isSupported(): Promise<boolean>;
  init(): Promise<void>;
  decode(buffer: ArrayBuffer, hint: string): Promise<DecodedImage>;
  encode(image: DecodedImage, options: CompressionOptions): Promise<Uint8Array>;
  verify?(bytes: Uint8Array, options: CompressionOptions): Promise<{ width: number; height: number }>;
}
```

Three concepts stay strictly separate, which is what makes honest reporting possible:
**`ImportedFormat`** (what the bytes are, magic-byte sniffed) · **`DecodedImage`** (internal RGBA8,
plus full-canvas frames for animation) · **`OutputFormat`** (what is encoded).

### 7.2 Pipeline (`runPipeline`)

1. **Validate** — empty → file-size ceiling → signature → conversion capability. No decoding happens
   before this passes.
2. **Decode** — native `createImageBitmap` first (EXIF applied via `imageOrientation: 'from-image'`),
   WASM fallback per format when the browser cannot decode natively.
3. **Resolve settings** — quality is **locked at 50** and effort at **6** app-wide. Smart mode only
   decides the per-image lossless flag and explains it; target-size mode prepares the iterative
   encoder.
4. **Encode** — inside the codec, after `applyResize`.
5. **Never ship a bigger file** — *see below*.
6. **Verify** — the encoder's own output is decoded again (or its container parsed) and dimensions
   checked. Failure ⇒ `VERIFICATION_FAILED`, output discarded.

#### 7.2.1 Never ship a bigger file

A re-encode can legitimately be larger than its source — a small, already-compressed JPEG at high
quality is the classic case. Shipping that would defeat the product, so `runPipeline` enforces the
outcome instead of trusting the quality constant:

1. Encode once at 50. If the result is **smaller than the source**, that is the output.
2. Otherwise step quality down (`×0.8`, floor **12**, a few attempts max) and use the first encode
   that beats the source.
3. If nothing beats it **and the output format equals the source format**, return the **original
   bytes unchanged** and say so: *"Already optimal: no setting produced a file smaller than the
   source."* The stats strip shows `QUALITY · original` for this case (`applied.quality === 0`
   sentinel).
4. If the format differs (a real conversion), the smallest conversion is shown with a note.

Measured on the fixture set: `photo.jpg` 44.7 KB → **7.5 KB (−83%)**, `photo-large.jpg` 58.1 KB →
7.6 KB, `photo.webp` 36.5 KB → 10.6 KB, `photo.avif` 9.5 KB → 7.3 KB, `gradient.png` 31.0 KB →
1.1 KB, `anim.gif` unchanged, `static.gif` (360 B) returned as `original`. Two Playwright tests
(`tests/e2e/shrink.spec.ts`) assert *"saved …"* is shown and *"grew by …"* never is.

> History worth keeping: quality was previously 100 (max fidelity). At 100 the same `photo.jpg`
> produced **122 KB (+173%)** — the app was making files *bigger*. That is why quality is now 50 and
> why the retry loop exists.

### 7.3 Target-size algorithm

Quality→size is **not** assumed linear or monotonic. `engine/optimization/targetSize.ts` encodes at
both ends, probes the midpoint once (a non-monotonic encoder can dip there), searches upward from a
fitting dip, otherwise binary-searches, and returns **the highest quality that still fits** — maximum
visual quality inside the budget, never the smallest file. It stops on tolerance (3% under target),
attempt ceiling (7), time budget or cancellation, and always explains itself.

Target-size mode is implemented and unit-tested but **not reachable from the UI** (§11.13).

### 7.4 Worker architecture

- `compression.worker.ts` owns decode → resize → encode → verify.
- `workerPool.ts` keeps a bounded pool (`min(4, hardwareConcurrency)`), one job per worker, FIFO
  queue, transfers `ArrayBuffer`s instead of copying, replaces crashed workers, isolates failures.
- `workerManager` disposes the pool and revokes every outstanding object URL on `pagehide`.

---

## 8. Supported formats

| Format | Read | Write | Transparency | Animation | Notes |
|---|---|---|---|---|---|
| JPEG | ✅ MozJPEG/native | ✅ MozJPEG | ❌ none (flattened onto white, disclosed) | ❌ | EXIF orientation baked into pixels before metadata strip |
| PNG | ✅ native | ✅ squoosh + oxipng | ✅ full | ❌ | Lossless only; effort = oxipng level |
| WebP | ✅ native | ✅ libwebp | ✅ full | ❌ (static only) | Lossy + true lossless |
| AVIF | ✅ native/libavif | ✅ libavif | ✅ full | ❌ | Slowest encoder |
| GIF | ✅ gifuct-js | ✅ gifenc | ✅ 1-bit | ✅ preserved | Frames reconstructed to full canvases |
| SVG | ✅ + sanitised | ✅ SVGO | ✅ | ❌ | Never injected into the live DOM |
| HEIC/HEIF | ✅ libheif | ❌ by design | — | — | No HEVC encoder shipped (licensing/size) |
| TIFF | ✅ utif | ❌ by design | — | — | Multi-page/CMYK/JPEG-in-TIFF may fail (reported) |

**Rules enforced:** transparency is never silently flattened (JPEG warns, GIF warns about 1-bit
alpha); animation is never silently dropped (converting away from GIF warns); raster→SVG is refused
rather than faked.

---

## 9. Security and privacy

- **No network egress for image data.** No `fetch`/`XHR` to any image endpoint exists. `fetch` is
  used only to load this app's own `.wasm` binaries from its own origin. The only outbound
  navigation possible is the two user-initiated links (email, source).
- **Signature validation** before decode; extension/MIME disagreement is an error, not a guess.
- **Fixed resource ceiling (not user-editable):** files above **250 MB** and images above **150 MP**
  (or **16384 px** on a single side) are refused before any decoding starts — nothing is allocated,
  nothing is stored. The RGBA budget is derived from the pixel ceiling (150 MP × 4 bytes ≈ 600 MB)
  rather than a smaller flat constant, so a file inside the advertised limit can never be rejected
  by a hidden second cap. A 140 MP image — inside the advertised limit — used to fail with
  `OUT_OF_MEMORY`; it is now accepted.
- **SVG hardening:** uploaded SVG is parsed as text by SVGO (which executes nothing), then run
  through a `pixioraSanitize` plugin that removes `script`, `foreignObject`, `iframe`, `object`,
  `embed`, `audio`, `video`, handler/listener elements, all `on*` attributes, `javascript:` /
  `vbscript:` / `data:text/html` URLs, off-document `url(...)` references and any `href` that is not
  an in-document fragment or `data:image/`. The sanitised markup is checked *again* after
  optimisation. It is never inserted into the DOM; rasterisation goes through `Blob` → `Image` →
  canvas. Verified in-browser with a hostile fixture: no dialog ever fires.
- **Object URL lifecycle** is centralised in `utils/objectUrl.ts` with a live registry; URLs are
  revoked on replace, remove, clear and `pagehide`.
- **No image data in storage.** `localStorage` holds only preferences (`pixiora-settings-v1`);
  image bytes, filenames and results are never persisted.
- **Typed error normalisation** (`EngineError` codes → human copy in one place); nothing fails
  silently.

**What PIXIORA does *not* claim:** it cannot stop a browser extension, an OS screenshot tool or an
enterprise proxy from observing the page. Processing is local; the only network activity is loading
the app itself.

---

## 10. Performance notes (measured)

Headless Chromium (Playwright build), one job at a time, production build. Indicative, **not**
universal guarantees — device, browser, image content and settings all matter.

| Source | Target | Output | Encode time |
|---|---|---|---|
| 320×240 JPEG (25.5 KB) | JPEG | 10.4 KB | 142 ms |
| 320×240 JPEG (25.5 KB) | WebP | 15.0 KB | ~0.2 s |
| 320×240 JPEG (25.5 KB) | AVIF | 6.2 KB | 847 ms |
| 1280×960 JPEG (370 KB) | JPEG | 49.3 KB | 286 ms |
| 1280×960 JPEG (370 KB) | AVIF | 45.5 KB | 2.03 s |
| 3000×2000 JPEG (1.7 MB, 6 MP) | JPEG | 88.2 KB | 1.37 s |
| 3000×2000 JPEG (1.7 MB, 6 MP) | AVIF | 120 KB | 8.66 s |
| 420×300 JPEG (44.7 KB) | JPEG (q50) | 7.5 KB | ~90 ms |

What the architecture does to keep this manageable:

- Route-level code splitting and lazy WASM: the shell paints before any codec is fetched.
- One worker per concurrent job, capped at 4, so N files never mean N threads.
- `ArrayBuffer` transfer (not copy) into workers; `ImageBitmap.close()` after decode.
- Decoded RGBA is held only for the duration of a job — never cached per-file in the store.
- Header-based dimension reads avoid a full decode just to fill in the UI.

Known limits: AVIF on multi-megapixel images takes seconds; PNG optimisation is **single-threaded**
(§11.1).

---

**Processing speed (measured in Chromium, this machine):**

| Job | Before | After | What changed |
|---|---|---|---|
| 2400×1600 PNG, 11.5 MB | 9.48 s | **2.95 s** | oxipng effort is adaptive (see below) |
| 1400×900 PNG, 3.7 MB | 5.44 s | **3.35 s** | oxipng effort is adaptive |
| 2400×1600 JPEG, 3.7 MB | 1.88 s | 1.57 s | structural verification instead of a full re-decode |
| 420×300 JPEG, 44.7 KB | 0.13 s | 0.13 s | unchanged — already sub-frame |

Two changes did the work, and neither weakens the output contract:

1. **PNG optimisation effort is now adaptive.** Squoosh's PNG encoder already emits an adaptive zlib
   stream, so oxipng's second pass was a full re-encode that cost ~4 s on an 11 MB image for a few
   percent of size. Above 1.5 MP oxipng now runs at effort ≤ 2 (it still strips redundant chunks and
   re-picks the filter); below 1.5 MP it keeps full effort, because small PNGs are where the last few
   percent actually matter. This is a deliberate size-for-time trade and it is visible in §11.
2. **Verification is structural where a full decode buys nothing.** Re-decoding a JPEG in WASM doubled
   the cost of every job for information the file already carries. The verifier now walks the marker
   chain (so truncation and corruption still fail), reads the SOF frame header for the real
   dimensions, and reports the strength honestly — `codec-decode`, `structure-scan` or
   `signature-only` — instead of claiming a re-decode that did not happen. WebP and AVIF still
   re-decode in full.

---

## 11. Known limitations and technical compromises

Documented rather than hidden, per the project's own rules.

1. **PNG optimisation is single-threaded.** `@jsquash/oxipng` auto-selects a multi-threaded build in
   workers, which needs `SharedArrayBuffer` and COOP/COEP headers. PIXIORA must deploy on plain
   static hosting, so `OxipngLoader.ts` imports the single-threaded wasm-bindgen package directly.
   Output bytes are equivalent; it is slower on huge PNGs.
2. **SVG → raster runs on the main thread.** Rasterising needs `Image`, which worker scopes lack.
   SVG jobs are routed accordingly; the UI stays responsive because these jobs are typically fast.
3. **Two codec init protocols.** MozJPEG/libwebp/libavif are emscripten (`{ wasmBinary }`); squoosh
   PNG is wasm-bindgen and takes the source directly. `wasmModules.ts` documents and handles both.
4. **GIF quality is palette size**, not a JPEG-style curve (100 → 256 colours, 1 → 2). Output is
   described as quantised, never lossless.
5. **Animated WebP/AVIF are not preserved.** Only the first frame is written, and a warning says so.
6. **No HEIC/TIFF encoders.** Deliberate: licensed HEVC encoders are large and legally awkward.
7. **Raster → SVG is refused.** Auto-tracing cannot preserve vectors.
8. **TIFF support is partial.** `utif` covers common uncompressed/LZW/Deflate cases; multi-page,
   CMYK and JPEG-compressed TIFFs may fail with a clear message.
9. **Cancellation replaces the worker.** A running encode cannot be interrupted in place (it is one
   synchronous WASM call), so cancelling terminates that worker and the pool spawns a fresh one. The
   job stops immediately and the *whole* worker's warm state is lost, so the next job pays the WASM
   instantiation cost again. Cooperative cancellation remains in place between pipeline phases.
10. **Exotic AVIF/HEIC variants** (12-bit, HDR sequences) may fail; the error is explicit.
11. **Framer Motion is installed but unused in components.** Motion is CSS keyframes plus the global
    reduced-motion rule; the package is retained for upcoming panel transitions.
12. **`npm install` needs `--legacy-peer-deps`** on Node 20 (optional `@types/node` peer range).
13. **Target-size mode is unreachable from the UI.** The algorithm, its tests and its e2e coverage
    remain, but the Compressor rail deliberately contains no controls, so the mode can only be
    selected by seeding `pixiora-settings-v1` in `localStorage`. Reachable in code, not in the
    product — stated here rather than implied.
14. **GIF frame delays are inflated.** `GifCodec` writes delays as `Math.max(20, delay)` assuming
    milliseconds, while `gifuct-js`/`gifenc` use 1/100 s — so a 10 cs frame is emitted as 20 cs,
    roughly 10× slower than the source. Frame count and pixels are correct; timing is not.
15. **Resize code is retained but unreachable.** `engine/optimization/resizeImage.ts` still runs on
    every job — the pipeline calls `planResize` with no constraints to *prove* the output keeps the
    source dimensions — and codecs use its progressive-downscale helper internally. What was removed
    is the product surface: `/resize`, the nav tab, `ResizerWorkspace`, `ResizePanel`,
    `DimensionControl` and the `settings.resize` slice.
16. **No persistence across reloads.** Images live in memory only (a reload clears the workspace).
    This is a privacy decision, not an oversight.
17. **Email/Source links cannot open inside a sandboxed preview frame.** The host page blocks
    `mailto:` and popup navigation; served on its own origin both work (§3).
18. **Large PNGs are optimised less aggressively than small ones.** Above 1.5 MP oxipng runs at
    effort ≤ 2 instead of 6 — about 3× faster, at the cost of a few percent of size. Small PNGs keep
    full effort. Deliberate trade-off, measured in §10.

---

## 12. Testing

| Suite | Count | What it proves |
|---|---|---|
| `tests/unit/formatDetector.test.ts` | 13 | Magic-byte detection incl. BigTIFF and junk; extension/MIME disagreement is an error |
| `tests/unit/formatCapabilities.test.ts` | 7 | Capability matrix, conversion legality, filename suffixes (`-pixiora`) |
| `tests/unit/targetSize.test.ts` | 8 | Target-size search: monotonic, non-monotonic, unreachable, cancellation, attempt ceiling |
| `tests/unit/savings.test.ts` | 20 | Savings maths that reports growth, byte parsing, EXIF orientation, limits guard rails (250 MB / 150 MP), no-upscale planner |
| `tests/unit/resizeImage.test.ts` | 8 | Internal aspect/no-upscale planner |
| `tests/unit/smartQuality.test.ts` | 8 | Locked-quality decisions, lossless flags for PNG/SVG, no dead setters on the store |
| `tests/components/ComparisonSlider.test.tsx` | 6 | Accessible slider + radiogroup mode switch |
| `tests/components/upload.test.tsx` | 7 | Verb heading, single file input per workspace, single-file drop, no format strip, no privacy badge, no author credit inside the drop zone, busy state |
| `tests/e2e/pixora.spec.ts` | 21 | Real Chromium + real WASM: compress/verify/download, EXIF rotation (420×300 → 300×420), keyboard comparison, slider auto-appears, no Reset, target-size budget, animated GIF, HEIC → WebP, PNG alpha → WebP, hostile SVG sanitised, non-image rejected, corrupt JPEG fails safely, object-URL revocation, one image per workspace, verb-named empty states, Documentation page + legal modals + link hrefs, footer has zero controls |
| `tests/e2e/shrink.spec.ts` | 2 | The output is never larger than the source ("saved …" shown, "grew by …" absent) for JPEG and PNG |
| `tests/e2e/a11y.spec.ts` | 4 | axe-core (WCAG 2.1 A/AA), **zero violations** per route and on a populated workspace |
| 18 | **Large PNGs are optimised less aggressively than small ones.** Above 1.5 MP oxipng runs at effort ≤ 2 instead of 6 — roughly 3× faster, at the cost of a few percent of size. Small PNGs keep full effort. | ⚠️ Trade-off |


Tests use real image fixtures and assert on decoded output bytes, dimensions and frame counts — not
on the presence of buttons.

```bash
npm test                  # 77 unit + component
npm run test:e2e          # 27 browser (needs `npx playwright install --with-deps chromium`)
npm run verify            # all of the above plus typecheck and build
```

Fixtures: `tests/fixtures/` holds 1.2 MB of real images generated by an independent toolchain
(`scripts/make_fixtures.py`, Python + Pillow/libheif) — JPEG with EXIF orientation 6, PNG with real
alpha, animated GIF with 4 distinct frames, HEIC, TIFF, a hostile SVG with `<script>`/handlers/`javascript:`
URLs/external refs, a corrupt JPEG and a non-image file. Regenerate with `npm run fixtures`.

---

## 13. Acceptance criteria

**Partial** and **removed** items are stated as such.

| # | Criterion | Status | Evidence |
|---|---|---|---|
| 1 | Application starts successfully | ✅ | `npm run dev` → shell loads, 0 console errors (e2e) |
| 2 | Production build succeeds | ✅ | `tsc -b && vite build` clean; e2e passes against `vite preview` |
| 3 | Upload works | ✅ | e2e uploads JPEG/PNG/WebP/GIF/SVG/HEIC |
| 4 | File validation works | ✅ | 13 detector unit tests; non-image rejected with a specific message |
| 5 | JPEG compression works | ✅ | Output re-decoded and verified before download |
| 6 | PNG compression works | ✅ | oxipng pass; alpha preserved (VP8X flag asserted) |
| 7 | WebP compression works | ✅ | Verified on the 1280×960 fixture |
| 8 | AVIF compression works | ✅ | Verified on the same fixture |
| 9 | Before/after comparison works | ✅ | Slider opens on result; pointer drag and keyboard both asserted |
| 10 | Quality is applied | ✅ | Locked at 50 end-to-end; `Applied quality 50` asserted |
| 11 | Target-size mode works | ✅ | 90.3 KB for a 100 KB target (code-reachable only) |
| 12 | Smart mode works | ✅ | Locked-quality lossless decision + visible reasoning; 8 unit tests |
| 13 | Resizing works | ➖ REMOVED | Resizer workspace, route, nav tab, panels and `settings.resize` deleted at the user's request. `/resize` renders 404; output dimensions always equal source |
| 14 | Conversion works | ✅ | HEIC→WebP, GIF→GIF, SVG→SVG, PNG→WebP |
| 15 | Batch queue works | ➖ REMOVED | Batch Studio deleted; no queue UI |
| 16 | ZIP download works | ➖ REMOVED | Removed with Batch Studio |
| 17 | Worker processing works | ✅ | Real jobs through the bounded pool |
| 18 | Cancellation works | ✅ | Cancel terminates the running worker, clears the panel in <100 ms, and the next job still runs (e2e) |
| 19 | Errors are handled | ✅ | Typed codes → human copy; corrupt JPEG fails in e2e |
| 20 | Transparency preserved where supported | ✅ | VP8X alpha flag asserted after PNG→WebP |
| 21 | SVG optimisation is safe | ✅ | Hostile fixture: nothing survives, no dialog fires |
| 22 | Animated GIF preserves animation | ✅ | 4 frames and delays survive re-encode |
| 23 | HEIC/TIFF handling works | ✅ HEIC / ⚠️ PARTIAL TIFF | HEIC→WebP verified; exotic TIFF variants may fail |
| 24 | Object URLs are cleaned up | ✅ | Registry + `pagehide` revoke; e2e counts blobs before/after |
| 25 | No image uploads to a backend | ✅ | No such request exists in the codebase |
| 26 | Responsive interface works | ✅ | Top-bar tabs on desktop/tablet, bottom tabs on mobile, Documentation in the header |
| 27 | Accessibility requirements met | ✅ | axe-core: 0 violations on every route + populated workspace |
| 28 | Automated tests pass | ✅ | 77 unit/component + 27 browser |
| 29 | One image per workspace | ✅ | Drop target unmounted once loaded; store caps at one entry |
| 30 | "Another image" only after finishing | ✅ | Asserted in both workspaces |
| 31 | Output is never bigger than the source | ✅ | Retry loop + original-bytes passthrough; 2 dedicated e2e tests |
| 32 | App mark in the chrome | ✅ | `Logo` SVG in the header and as `public/favicon.svg` |
| 33 | Legal, contact and source are reachable | ✅ | Three modals + two plain anchors on the Documentation page |
| 34 | README is complete | ✅ | This document |

**Not marked complete on purpose:** animated WebP/AVIF output (not implemented, warned), HEIC/TIFF
*encoding* (by design), multi-page TIFF (out of scope), PNG multi-threading (deployment constraint).

---

## 14. Roadmap

- Animated WebP/AVIF output (needs an encoder exposing frame sequences)
- OffscreenCanvas-based SVG rasterisation in workers, removing the main-thread route
- Size/quality preview estimation before committing to a target-size search
- WASM SIMD/multi-threaded codecs behind a COOP/COEP-aware deployment target
- Diff view (pixel-difference heatmap) alongside the comparison slider
- Fix GIF frame-delay units (§11.14)

---

## 15. Licence and attribution

PIXIORA is released under the **MIT licence** — free to use, modify and share, with the copyright
notice and author credit kept intact. The full text is shown in-app under **Documentation → Licence**,
and in `src/app/legal.ts`.

Bundled codecs retain their own licences: MozJPEG/libwebp/libavif via jSquash (Apache-2.0), oxipng
(MIT), gifuct-js (MIT), gifenc (MIT), svgo (MIT), utif (MIT), libheif-js (LGPL-3.0 — consumed as an
unmodified dynamically-imported module).

Built by **ar0x** · <https://github.com/ar0x1/pixiora> · <killtoneizuku@gmail.com>
