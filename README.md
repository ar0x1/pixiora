<div align="center">

<img src="banner.png" width="100%" alt="PIXIORA — by ar0x"/>

<br/>

### A better way to handle images.

**Compress. Convert. Compare.**

A privacy-first image optimization studio that works entirely in your browser.

<br/>

<a href="https://pixiora.netlify.app">
  <img src="https://img.shields.io/badge/EXPLORE_PIXIORA-5B9CF8?style=for-the-badge&logo=googlechrome&logoColor=white" alt="Explore PIXIORA"/>
</a>
<a href="https://github.com/ar0x1/pixiora">
  <img src="https://img.shields.io/badge/VIEW_SOURCE-18181B?style=for-the-badge&logo=github&logoColor=white" alt="View source"/>
</a>

<br/><br/>

![GitHub stars](https://img.shields.io/github/stars/ar0x1/pixiora?style=flat-square&color=5B9CF8)
![GitHub forks](https://img.shields.io/github/forks/ar0x1/pixiora?style=flat-square&color=5B9CF8)
![GitHub issues](https://img.shields.io/github/issues/ar0x1/pixiora?style=flat-square&color=5B9CF8)
![GitHub last commit](https://img.shields.io/github/last-commit/ar0x1/pixiora?style=flat-square&color=5B9CF8)

<br/>

*Built with precision. Designed for simplicity.*

</div>

---

## The idea behind PIXIORA

Images should be easy to optimize. Privacy shouldn't be a trade-off.

**PIXIORA** is a browser-based image compressor and converter built around one principle: your files should never need to leave your device just to be optimized.

Powered by WebAssembly and Web Workers, PIXIORA brings image processing directly to your browser — without a processing backend, accounts, API keys, or image uploads.

No unnecessary complexity. Just your image and the tools to optimize it.

## What makes it different

<table>
<tr>
<td width="50%" valign="top">

### 01 — Compression

Reduce image file sizes while retaining useful visual quality.

- Smart compression
- Before / after comparison
- Real size and savings statistics
- Output verification

</td>
<td width="50%" valign="top">

### 02 — Conversion

Move between supported image formats with clear capability handling.

- Multiple input formats
- Format-aware conversion
- Conversion compatibility matrix
- Warnings for capability changes

</td>
</tr>
<tr>
<td width="50%" valign="top">

### 03 — Visual comparison

See exactly what changed after compression.

- Interactive comparison slider
- Original and compressed views
- Mouse and touch interaction
- Keyboard accessibility

</td>
<td width="50%" valign="top">

### 04 — Privacy by design

Your images stay in your browser throughout processing.

- Local WebAssembly processing
- Bounded background workers
- No image uploads
- No image storage or analytics

</td>
</tr>
</table>

## Supported formats

PIXIORA supports a range of image formats, with conversion availability depending on the source, destination and browser capabilities.

<img src="banner.png" width="100%" alt="PIXIORA — by ar0x"/>

**Conversion details**

- SVG can remain SVG or be rasterized to supported image formats.
- HEIC and TIFF can be converted to supported raster formats.
- Animated WebP and AVIF are not preserved as animations in exported files.
- Conversions that cannot be performed are disabled with an explanation.

The in-app Documentation page contains the conversion compatibility matrix.

## Built around privacy

PIXIORA does not need a server to process your images.

The image-processing pipeline runs locally using WebAssembly codecs inside bounded Web Workers.

| Privacy property | Implementation |
|:--|:--|
| Image processing | Browser-local |
| Image uploads | None |
| Processing backend | None |
| Accounts | Not required |
| API keys | Not required |
| Analytics | None |
| Cookies | None |
| Image persistence | None |
| Preferences | Local browser storage |

Image bytes, filenames and generated results are not persisted. Reloading the application clears the current workspace.

**Your images are processed on your device, not uploaded to a remote image-processing service.**

## Engine & performance

PIXIORA is built with a dedicated processing pipeline rather than relying entirely on browser-native image export.

The pipeline handles:

1. **Validation** — checks image signatures, size limits and conversion compatibility.
2. **Decoding** — reads the original image using available native or WebAssembly decoders.
3. **Processing** — runs the appropriate image codec inside a worker.
4. **Verification** — checks the generated output before making it available for download.
5. **Delivery** — provides the resulting file directly to your browser.

### Processing limits

| Resource | Limit |
|:--|--:|
| Maximum file size | 250 MB |
| Maximum image pixels | 150 MP |
| Maximum dimension | 16,384 px |
| Compression quality | 50 (fixed) |
| Encoder effort | 6 (fixed) |
| Concurrent worker pool | Up to 4 |

These are application limits, not performance guarantees. Actual processing speed depends on your browser, hardware, image and selected output format.

## Technology

<div align="center">

<img src="https://skillicons.dev/icons?i=react,ts,vite,tailwind,nodejs" alt="PIXIORA technology stack"/>

</div>

| Technology | Purpose |
|:--|:--|
| React 19 | Interface |
| TypeScript | Application logic |
| Vite | Development and production builds |
| Tailwind CSS 4 | Styling |
| Zustand | State management |
| WebAssembly | Image codecs |
| Web Workers | Background processing |
| Vitest | Unit and component testing |
| Playwright | Browser and end-to-end testing |
| axe-core | Accessibility testing |

### Image processing codecs

- MozJPEG
- Squoosh PNG / OxiPNG
- libwebp
- libavif
- gifenc
- gifuct-js
- SVGO
- libheif
- UTIF

## Run PIXIORA locally

Want to explore the code or run your own instance?

### Requirements

- Node.js 20 LTS or newer
- npm 10+

### Installation

```bash
# Clone PIXIORA
git clone https://github.com/ar0x1/pixiora.git

# Navigate into the project
cd pixiora

# Install dependencies
npm install --legacy-peer-deps

# Start development
npm run dev
```

Open your browser at:

```text
http://localhost:5173
```

No environment file, API key, database or backend server is required.

### Available commands

| Command | Description |
|:--|:--|
| `npm run dev` | Start development server |
| `npm run build` | Build production application |
| `npm run preview` | Preview production build |
| `npm run typecheck` | Run TypeScript checks |
| `npm test` | Run unit and component tests |
| `npm run test:watch` | Run tests in watch mode |
| `npm run test:e2e` | Run browser tests |
| `npm run test:a11y` | Run accessibility tests |
| `npm run verify` | Run complete verification pipeline |

### Production build

```bash
npm run build
```

The optimized application is generated inside:

```text
dist/
```

PIXIORA is designed for static hosting. It does not require a dedicated backend or database. Configure your host to serve the application routes through `index.html`.

## Project structure

```text
pixiora/
│
├── public/
│   ├── fonts/
│   ├── icons/
│   └── ...
│
├── src/
│   ├── app/              # Application and routing
│   ├── components/       # Interface components
│   ├── engine/           # Image processing engine
│   │   ├── codecs/
│   │   ├── core/
│   │   ├── workers/
│   │   └── optimization/
│   ├── hooks/            # Application hooks
│   ├── store/            # State management
│   ├── styles/           # Design tokens and animations
│   ├── utils/            # Shared utilities
│   └── types/            # TypeScript definitions
│
├── scripts/
├── tests/
│   ├── unit/
│   ├── components/
│   └── e2e/
│
├── docs/
│   └── design-system/
│
├── index.html
├── package.json
├── vite.config.ts
└── README.md
```

## Quality & testing

PIXIORA includes automated tests for its processing engine, interface, browser workflows and accessibility.

| Test suite | Coverage |
|:--|:--|
| Unit & component tests | 77 tests |
| Browser tests | 27 tests |
| Accessibility | axe-core / WCAG 2.1 A/AA |

Run the complete verification pipeline:

```bash
npm run verify
```

The verification pipeline runs type checking, unit tests, the production build and browser tests.

## Current limitations

PIXIORA is intentionally focused on compression and conversion rather than being a full image editor.

- One image per workspace; no batch queue.
- No image resizing interface or manual quality slider.
- HEIC and TIFF are decode-only.
- Animated WebP and AVIF are not preserved in exported animations.
- GIF output currently has a known frame-timing limitation.
- Some advanced TIFF and AVIF variants may not be supported.
- AVIF encoding can take longer on larger images.

These limitations are documented rather than hidden behind unsupported feature claims.

## Design philosophy

**Less interface. More intention.**

PIXIORA follows a deliberate design language:

- Minimal interface without dashboard clutter.
- Graphite and charcoal surfaces.
- Steel-blue accents.
- Carefully balanced typography.
- Clear visual hierarchy.
- Subtle motion and restrained interaction.
- Keyboard accessibility and reduced-motion support.

Explore the [PIXIORA Design System](docs/design-system/README.md).

---

## Connect

Found something interesting? Have an idea or spotted an issue?

- **Live application:** [pixiora.netlify.app](https://pixiora.netlify.app)
- **Source code:** [github.com/ar0x1/pixiora](https://github.com/ar0x1/pixiora)
- **Issues & feedback:** [GitHub Issues](https://github.com/ar0x1/pixiora/issues)

---

<div align="center">

<img src="banner.png" width="180" alt="PIXIORA"/>

### PIXIORA

*Explore. Create. Imagine.*

**Designed & developed by [ar0x](https://github.com/ar0x1)**

<sub>Made for the web. Built around privacy.</sub>

</div>
