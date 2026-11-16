# PIXIORA Design System

**Reusable UI style guide + exact CSS tokens + component recipes**

> **Shipped state.** This hybrid is now implemented in the app: ToolSort's typography (DM Serif
> Display headings + DM Sans interface text), ToolSort's spacing and card language (roomier padding,
> 9–10 px radii, one soft card shadow), on PIXIORA's graphite palette and top-bar layout. Fonts are
> **self-hosted** in `public/fonts/` so the app stays 100 % offline.

Yeh package PIXIORA ke current React/Vite/Tailwind-4 design se directly nikala gaya hai. Future project mein same calm, instrument-grade, dark graphite UI aur UX recreate karne ke liye isse reference aur starting point ki tarah use karo.

---

## 1. Package mein kya hai?

```text
pixiora-design-system/
├── README.md              # Design system, usage aur guidelines
├── globals.css            # PIXIORA ke exact design tokens + @utility definitions
├── animations.css         # Saare keyframes (sweep, ring, aurora, dots, shimmer)
└── favicon.svg            # Custom PIXIORA logo / mark
```

**Important:** `globals.css` existing app ki exact token file hai, ek isolated component library nahi. Isme `@theme` (Tailwind 4 tokens), global `body`, `:root` aur `:focus-visible` styles, `@utility panel`/`panel-header`/`well`/`eyebrow`/`tabular` aur scrollbar rules bhi hain. Agar kisi existing project mein conflict ho, tokens ko namespace karo ya apne project ki CSS ke saath carefully merge karo. Original file mein specified colors/design change mat karna agar exact same appearance chahiye.

---

## 2. Design ka overall feel

- **Visual personality:** precise, quiet, instrument-grade, professional. Ek tool, ek dashboard nahi.
- **Theme:** near-black graphite planes, ek hi cool steel-blue accent, hairline borders.
- **Layout:** fixed 44px top bar + full-width workspace; **koi side rail nahi** (mobile par bottom tabs).
- **Shape language:** tight, systematic radii (3–10px). No pill buttons, no bubble cards.
- **Depth:** plane difference + 1px top inset highlight. Shadow sirf real overlays ke liye.
- **Text hierarchy:** 10px tracked-out uppercase eyebrows, 12–13px body, tabular numerals har measurement par.
- **Icons:** Lucide React (24×24, 2px stroke, `currentColor`). GitHub mark inline path se (lucide me brand icon nahi hai).
- **Colors to avoid:** purple/violet, pink, rainbow gradients, glassmorphism, glow. Accent ek hi steel blue hai aur wahi ek saturated surface hona chahiye.
- **Motion:** short, mechanical, purposeful. Fade + 4px translate. Nothing bounces, nothing floats in.

---

## 3. Quick start: React + Vite + TypeScript

### Step 1: Files copy karo

```text
new-project/
├── public/
│   └── favicon.svg
└── src/
    └── styles/
        ├── globals.css
        └── animations.css
```

### Step 2: CSS import karo

```tsx
// src/main.tsx ya App.tsx
import './styles/globals.css'
import './styles/animations.css'
```

Tailwind v4 use ho raha hai, isliye **koi `tailwind.config.js` nahi hai** — saare tokens `@theme { … }` block me `globals.css` ke andar declare hote hain. Tokens Tailwind utilities ban jaate hain (`bg-surface`, `text-ink-muted`, `border-line`, `rounded-lg`).

Fonts: `--font-sans` system stack par girta hai (`Inter`, `Geist`, `ui-sans-serif`, system-ui). Koi network request nahi — fully offline exact typography ke liye apni licensed font files locally host karke `@font-face` add karo.

### Step 3: Icon use karo

```tsx
import { Gauge, Boxes, Info } from 'lucide-react'
import { GithubIcon } from './components/brand/GithubIcon'

function Example() {
  return (
    <button className="btn-primary">
      <Gauge className="size-4" aria-hidden />
      Compress an image
    </button>
  )
}
```

Icons decorative hain (`aria-hidden`), icon-only buttons ko `aria-label` zaroor do:

```tsx
<Link to="/settings" aria-label="Documentation">
  <Info className="size-4" aria-hidden />
</Link>
```

### Step 4: Logo / favicon

```html
<link rel="icon" type="image/svg+xml" href="/favicon.svg" />
```

```tsx
<img src="/favicon.svg" alt="" width="20" height="20" />
```

> Logo PIXIORA-specific hai (`viewBox` square; image card + compress glyph + arrow + output card, traced from the brand artwork) aur `currentColor` se paint hota hai — plate ke andar brand azure `#9DC0FF`. Kisi aur brand ke liye same visual language mein apna logo bana lo — mark ki geometry ko redesign mat karo.

---

## 4. Exact design tokens

Original `globals.css` ke `@theme` block se, jaisa hai waisa:

```css
@theme {
  /* Planes, darkest → lightest. Each step is a real elevation level. */
  --color-void: #08090c;
  --color-base: #0b0d12;
  --color-surface: #0f1218;
  --color-raised: #141820;
  --color-elevated: #1a1f29;
  --color-line: rgba(255, 255, 255, 0.07);
  --color-line-strong: rgba(255, 255, 255, 0.13);

  /* Accent: a single steel blue. Restraint is the point. */
  --color-accent: #5b9cf8;
  --color-accent-soft: #9dc0ff;
  --color-accent-strong: #1f5bd4;

  /* Text ramp — every value verified for WCAG AA on the darkest surface. */
  --color-ink: #ececf1;
  --color-ink-dim: #b3b3bd;
  --color-ink-muted: #8b8b96;

  --color-ok: #4ade80;
  --color-warn: #e0a13c;
  --color-danger: #f2576b;

  --font-sans: 'Inter', 'Geist', ui-sans-serif, system-ui, -apple-system,
    'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
  --font-mono: ui-monospace, 'SF Mono', 'JetBrains Mono', Menlo, monospace;

  /* Radii: slightly rounded, never harsh (ToolSort's 9px cards / 7px controls). */
  --radius-xs: 4px;
  --radius-sm: 6px;
  --radius-md: 8px;
  --radius-lg: 10px;
  --radius-xl: 12px;

  /* Shadows: pressed-in planes; soft lift only for cards/hover/overlays. */
  --shadow-inset: inset 0 1px 0 rgba(255, 255, 255, 0.045);
  --shadow-soft: 0 1px 2px rgba(0, 0, 0, 0.4), 0 8px 24px -16px rgba(0, 0, 0, 0.8);
  --shadow-hover: 0 2px 4px rgba(0, 0, 0, 0.45), 0 16px 36px -22px rgba(0, 0, 0, 0.9);
  --shadow-lift: 0 12px 32px -18px rgba(0, 0, 0, 0.9);
  --shadow-pop: 0 40px 90px -40px rgba(0, 0, 0, 1), 0 2px 8px rgba(0, 0, 0, 0.6);
}
```

Aur important exact colors jo individual components mein use hue hain:

| Use | Color |
|---|---|
| Page background | `#08090c` (`--color-void`) |
| Panel / card surface | `#0f1218` (`--color-surface`) |
| Raised control | `#141820` (`--color-raised`) |
| Hover plane | `#1a1f29` (`--color-elevated`) |
| Main text | `#ececf1` (`--color-ink`) |
| Secondary text | `#b3b3bd` (`--color-ink-dim`) |
| Muted text (darkest safe) | `#8b8b96` (`--color-ink-muted`) |
| Primary button | `#1f5bd4` (`--color-accent-strong`) |
| Primary button hover | `#1b4fba` (from `Button.tsx`) |
| Accent (active tab, ring, slider) | `#5b9cf8` (`--color-accent`) |
| Accent soft (focus ring, arcs) | `#9dc0ff` (`--color-accent-soft`) |
| Hairline border | `rgba(255,255,255,0.07)` (`--color-line`) |
| Strong border | `rgba(255,255,255,0.13)` (`--color-line-strong`) |
| Success | `#4ade80` (`--color-ok`) |
| Warning | `#e0a13c` (`--color-warn`) |
| Danger | `#f2576b` (`--color-danger`) |
| Primary button active | `#17449f` (from `Button.tsx`) |
| Primary button disabled | `#16233a` bg + muted text (from `Button.tsx`) |
| Logo gradient start / end | `#9DC0FF → #1F5BD4` (from `Logo.tsx`) |
| Background wash (body::before) | `rgba(91,156,248,0.075)` radial, top centre |
| Text selection | `rgba(91,156,248,0.32)` |
| Checkerboard base (alpha images) | `#0a0c11` |

**Color rule:** near-black planes (halka green-shifted), ek cool steel-blue accent, aur teen semantic colors. Steel blue is deliberately far from `ok` (mint) aur `warn` (amber), isliye "accent" aur "success" kabhi confuse nahi hote. `ok` / `warn` / `danger` sirf meaning ke liye — decoration ke liye kabhi nahi. `--color-ink-muted` (#8b8b96) **sabse dark safe text color hai**; iske alpha fades (`text-ink-muted/60`) 10px par axe contrast fail karte hain — small credits ke liye solid `text-ink-muted` hi use karo.

---

## 5. Typography

```css
/* Font stack declared in the theme — no network request */
--font-sans: 'Inter', 'Geist', ui-sans-serif, system-ui, -apple-system,
  'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
--font-mono: ui-monospace, 'SF Mono', 'JetBrains Mono', Menlo, monospace;
```

| Element | Style |
|---|---|
| UI/body font | `DM Sans` ki jagah **Inter / system sans**; `letter-spacing: -0.005em`, antialiased |
| Section eyebrow | **10px**, weight 600, uppercase, `letter-spacing: 0.11em`, `--color-ink-muted` |
| Page heading | 15px, weight 500, `tracking-tight`, `--color-ink` |
| Panel heading | 13px, weight 500, tracking-tight |
| Body / descriptions | 11–11.5px, `line-height: 1.6`, `--color-ink-dim` / `--color-ink-muted` |
| Small labels & credits | 10–10.5px, `letter-spacing: 0.04–0.08em`, `--color-ink-muted` |
| Numeric readouts | `font-variant-numeric: tabular-nums` (`tabular` utility) so figures never jitter |
| Keyboard hints | 9.5px mono, `kbd` utility chip |
| Headline numbers (result) | 19px, weight 600, leading-none, tracking-tight |

Example:

```tsx
<div className="eyebrow">Conversions</div>
<h1 className="text-[15px] font-medium tracking-tight text-ink">Documentation</h1>
<p className="mt-0.5 text-[11.5px] text-ink-muted">What this browser can decode.</p>
```

**Two voices, deliberately** — this is the ToolSort contribution:

| Voice | Font | Where |
|---|---|---|
| Display | `DM Serif Display` (400) | wordmark, empty-state headline (30–34 px), panel titles (15.5 px), Documentation `h1` (27 px), the headline saving figure (26 px) |
| Interface | `DM Sans` (400–700) | every button, label, table cell, chip, toast, credit, form control |

Never set a button, a label, a table cell or a control in the serif. Never set a heading in DM Sans.

```css
--font-serif: 'DM Serif Display', Georgia, 'Times New Roman', serif;
--font-sans: 'DM Sans', ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif;
```

Both are self-hosted (`public/fonts/*.woff2`, six files, ~120 KB, SIL OFL 1.1) with `unicode-range`
splits for latin / latin-ext — **no Google Fonts request**, which is why the app works offline.

---

## 6. Layout and spacing

- App shell: `div` + `display: flex` column, `height: 100vh`.
- Top bar: `.header`, **62px** (`h-[62px]`), sticky, hairline bottom border.
- Workspace: `max-w-[1400px]` centred, padding `12–32px` (`px-3 … lg:px-8`).
- Two-plane layout: editor `flex-1` + rail **320px** (`lg:w-[320px]`), gap `14px`.
- Empty state: drop target fills the viewport height (`clamp(420px, calc(100dvh - 15rem), 820px)`), no rail, faint dot-grid texture masked at the edges.
- Panel: `radius-lg` (10px), 1px hairline, `--color-surface`, `--shadow-soft`.
- Panel header: `min-height: 40px`, `padding: 0 14px`, bottom hairline, serif title.
- Rail padding: `12px`; control gap `12px`.
- Toast: `max-w-[320px]`, 4500ms.
- Card grid (diagnostics): 3 columns ≥1024px, 2 columns ≥640px, 1 column mobile, `gap: 1px` with `bg-line` (hairline grid trick).
- Layout airy hona chahiye par cramped nahi: panels ke beech 10px, panel ke andar 12px.

### Responsive breakpoints

| Width | Original behavior |
|---|---|
| `≥1280px` (`lg`) | Editor + 300px rail side-by-side; rail sticky (`top-2.5`) |
| `<1280px` | Rail editor ke neeche stack hota hai (single column) |
| `≥768px` (`md`) | Top-bar tabs visible; bottom tab bar hidden |
| `<768px` | Tab row hidden, **bottom tab bar** take-over; Documentation action header me hi rehta hai; workspace `pb-20` bottom bar ke liye |
| `<640px` (`sm`) | Footer credit + nav vertically stack; diagnostics grid 1 column |

Mobile navigation ke liye JavaScript state chahiye (route-based active state + bottom bar). CSS akela open/close control nahi karta.

---

## 7. Component recipes

Examples neeche wahi class names aur structure use kiya hai jo original stylesheet mein hain. Events aur state apne project mein wire karo; CSS sirf appearance control karta hai.

### A. App shell, top bar aur navigation

```tsx
<div className="relative z-10 flex h-full flex-col">
  <header className="flex h-11 shrink-0 items-center gap-3 border-b border-line px-3">
    <a href="/" className="flex items-center gap-2" aria-label="PIXIORA home">
      <img src="/favicon.svg" alt="" width="20" height="20" />
      <span className="flex flex-col leading-none">
        <strong className="text-[13px] font-semibold tracking-[0.1em] text-ink">PIXIORA</strong>
        <span className="mt-[3px] text-[9px] font-medium tracking-[0.14em] text-ink-muted">by ar0x</span>
      </span>
    </a>

    <nav aria-label="Main navigation" className="flex items-center gap-1">
      <a href="/" aria-current="page" className="relative flex h-11 items-center gap-1.5 px-2.5 text-[12.5px] text-ink">
        <Gauge className="size-3.5 text-accent-soft" aria-hidden />
        Compressor
        <span className="absolute inset-x-2 bottom-0 h-[1.5px] rounded-full bg-accent-soft" />
      </a>
      <a href="/convert" className="flex h-11 items-center gap-1.5 px-2.5 text-[12.5px] text-ink-dim hover:text-ink">
        <Boxes className="size-3.5 text-ink-muted" aria-hidden />
        Converter
      </a>
    </nav>

    <a href="/settings" aria-label="Documentation" className="ml-auto grid size-7 place-items-center rounded-sm text-ink-muted hover:bg-white/[0.05] hover:text-ink">
      <Info className="size-4" aria-hidden />
    </a>
  </header>

  <main id="workspace" className="flex-1 overflow-y-auto px-2.5 pb-20 pt-2.5 md:pb-3" aria-label="Workspace">
    {/* workspace content */}
  </main>

  <MobileNavigation />
  <ToastStack />
</div>
```

### B. Empty state (drop zone)

```tsx
<div className="panel flex min-h-[380px] flex-col items-center justify-center border-dashed px-6 text-center">
  <div className="grid size-12 place-items-center rounded-md border border-line bg-raised">
    <FolderOpen className="size-5 text-ink-muted" aria-hidden />
  </div>
  <h2 className="mt-4 text-[14px] font-medium tracking-tight text-ink">Compress an image</h2>
  <p className="mt-1.5 max-w-[380px] text-[11.5px] leading-relaxed text-ink-muted">
    Every pixel, processed by PIXIORA. 100% local. 0 uploads. Your files never leave this tab.
  </p>
  <button className="btn-primary mt-5" type="button">
    <ImagePlus className="size-4" aria-hidden />
    Browse files
  </button>
</div>
```

Empty state **verb-driven** hona chahiye (“Compress an image”, “Convert an image”), generic “Open a file” nahi. Format list ya privacy badge drop zone ke andar mat daalo — wo chrome hai, content nahi.

### C. Panel + panel header

> **Panel headers are optional.** A panel whose content labels itself — a grid of figures, a single
> paragraph — omits the header strip entirely. See the Documentation page, where both panels are
> headerless and the content carries the meaning.

```tsx
<section className="panel overflow-hidden">
  <div className="panel-header">
    <h2 className="eyebrow flex items-center gap-1.5">
      <Cpu className="size-3 text-ink-muted" aria-hidden />
      Conversions
    </h2>
    <span className="tabular text-[10.5px] text-ink-muted">6 targets</span>
  </div>
  <div className="p-3">{/* content */}</div>
</section>
```

### D. Primary + secondary button

```tsx
<button className="btn-primary" type="button">
  <Zap className="size-3.5" aria-hidden />
  Compress image
  <kbd className="kbd ml-auto">⌘↵</kbd>
</button>

<button className="btn-secondary" type="button">
  <Download className="size-3.5" aria-hidden />
  Download
</button>
```

Exact recipe classes (add these to your own stylesheet — they are component-level, not global utilities):

```css
.btn-primary {
  display: inline-flex; align-items: center; gap: 6px;
  height: 34px; padding: 0 12px;
  border-radius: var(--radius-sm);
  background: var(--color-accent-strong); color: #fff;
  font-size: 12.5px; font-weight: 500;
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.16);
  transition: background 120ms ease;
}
.btn-primary:hover  { background: #1b4fba; }
.btn-primary:active { background: #17449f; }
.btn-primary:disabled { background: #16233a; color: var(--color-ink-muted); box-shadow: none; }

.btn-secondary {
  display: inline-flex; align-items: center; gap: 6px;
  height: 32px; padding: 0 10px;
  border-radius: var(--radius-sm);
  background: var(--color-raised);
  border: 1px solid var(--color-line-strong);
  color: var(--color-ink); font-size: 12.5px;
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.05);
}
.btn-secondary:hover { background: var(--color-elevated); border-color: rgba(255,255,255,0.20); }
```

### E. Stat strip (result readout)

```tsx
<div className="panel flex flex-wrap items-stretch overflow-hidden">
  <div className="flex min-w-[190px] flex-col justify-center px-3 py-2">
    <p className="eyebrow">Size change</p>
    <p className="tabular mt-0.5 flex items-baseline gap-1 text-[19px] font-semibold leading-none tracking-tight text-ok">
      <ArrowDownRight className="size-4 self-center" aria-hidden />
      83.2<span className="text-[12px] font-medium text-ink-muted">%</span>
    </p>
    <p className="tabular mt-1 text-[11px] text-ink-muted">saved 36.2 KB</p>
  </div>
  <dl className="flex flex-1 items-center border-l border-line">
    {[['Output', '300 × 420'], ['Format', 'JPEG'], ['Encode', '92 ms'], ['Quality', '50']].map(([label, value]) => (
      <div key={label} className="min-w-0 flex-1 border-line px-3 py-2 [&+&]:border-l">
        <dt className="eyebrow">{label}</dt>
        <dd className="tabular mt-0.5 truncate text-[12px] text-ink-dim">{value}</dd>
      </div>
    ))}
  </dl>
</div>
```

### F. Processing indicator (animated, still honest)

```tsx
<div role="status" aria-live="polite" className="panel panel-in relative isolate overflow-hidden">
  {/* one travelling sheen on the top hairline — texture, not decoration */}
  <span aria-hidden className="absolute inset-x-0 top-0 h-px overflow-hidden">
    <span className="sheen block h-px w-1/3 bg-gradient-to-r from-transparent via-accent-soft/80 to-transparent" />
  </span>

  <div className="flex items-center gap-3 px-3.5 py-3">
    {/* comet ring: determinate across the real phase index, closed on completion */}
    <div className="relative grid size-10 place-items-center" aria-hidden>
      <span className="absolute inset-0 rounded-full border border-line-strong" />
      <span className="absolute inset-0 rounded-full arc-close" style={{ background: 'conic-gradient(from -90deg, var(--color-ok) 100%, transparent 0)' }} />
      <Check className="relative size-3.5 text-ok" strokeWidth={3} />
    </div>
    <div className="min-w-0 flex-1">
      <p className="text-[12.5px] font-medium text-ink">Done</p>
      <p className="mt-0.5 text-[11px] text-ink-muted">Output verified.</p>
    </div>
  </div>

  {/* five real stages: each pill snaps to a tick as it lands */}
  <ol className="grid grid-cols-5 gap-1 px-3.5 pb-3" aria-hidden>
    {['Decode', 'Resize', 'Encode', 'Verify', 'Finish'].map((stage) => (
      <li key={stage} className="flex items-center justify-center gap-1 rounded-xs border border-transparent bg-accent-soft/[0.16] py-1.5 text-accent-soft">
        <Check className="size-2.5" strokeWidth={3} />
        <span className="text-[9.5px] uppercase tracking-[0.07em]">{stage}</span>
      </li>
    ))}
  </ol>
</div>
```

States, in order of emphasis: **pending** (`border-line`, dim text) → **active** (`border-accent-soft/60`,
`pill-in`) → **done** (`bg-accent-soft/16`, tick glyph). The ring carries the current phase glyph and
switches to a check on completion.

**Rules:** percentage sirf tab dikhao jab wo asli ho (attempt counter). Phase ka naam otherwise. A job
that finishes in under 900 ms is *held* to that floor with an already-rendered result underneath, so
fast work reads as a confident check instead of a flash. Panel height is fixed by its content — it
never reflows when the copy changes.

### G. Modal / dialog

```tsx
<div className="fixed inset-0 z-50 flex items-end justify-center p-3 sm:items-center sm:p-6">
  <div className="absolute inset-0 animate-[fadeIn_120ms_ease-out] bg-black/75" aria-hidden />
  <div role="dialog" aria-modal="true" aria-labelledby="dialog-title"
       className="relative z-10 w-full max-w-lg overflow-hidden rounded-lg border border-line-strong bg-surface shadow-pop animate-[dialogIn_150ms_ease-out]">
    <div className="panel-header py-2.5">
      <div className="min-w-0">
        <h2 id="dialog-title" className="text-[13px] font-medium tracking-tight text-ink">Terms of Service</h2>
        <p className="mt-0.5 text-[11.5px] leading-relaxed text-ink-muted">Last updated 7 November 2026</p>
      </div>
      <button type="button" aria-label="Close dialog" className="shrink-0 rounded-xs p-1.5 text-ink-muted hover:bg-white/[0.08] hover:text-ink">
        <X className="size-3.5" aria-hidden />
      </button>
    </div>
    <div className="max-h-[65vh] overflow-y-auto px-4 py-3.5">{/* body */}</div>
    <div className="flex justify-end gap-2 border-t border-line bg-base/60 px-4 py-2.5">
      <button className="btn-secondary" type="button">Close</button>
    </div>
  </div>
</div>
```

Focus trap, Escape, scroll lock aur focus restoration apne app mein implement karo — CSS ye nahi karta.

---

## 8. Interaction and UX rules

1. **Ek hi saturated surface** — primary action (steel blue `#1f5bd4`). Baaki sab text/plane ramp hai.
2. Secondary actions understated: hairline outline ya text buttons.
3. Hover feedback gentle: border `0.07 → 0.13` opacity, background ek plane up. **Card 3px lift nahi** — ye instrument UI hai.
4. Keyboard focus kabhi mat hatao: global `:focus-visible { outline: 2px solid var(--color-accent-soft); outline-offset: 1px; }`.
5. Percentage sirf real data se. Phase text otherwise.
6. **Never claim what was not measured** — verification ke bina success state mat dikhao.
7. Colour alone se state communicate mat karo (ready/failed = dot + text + colour).
8. Motion har jagah `prefers-reduced-motion` respect kare — global rule `globals.css` me hai, isliye har animation automatic static ho jaati hai.
9. Tabular numerals har measurement par, warna job chalte waqt figures jitter karte hain.
10. External links `target="_blank" rel="noopener noreferrer"` ke saath.
11. Chhota secondary text ke liye solid `--color-ink-muted` use karo; alpha fade axe contrast fail karta hai.
12. **Privacy claims copy me hi rakho, chrome mein nahi** — header me status pill/badge/chip mat daalo.

---

## 9. Custom icon system

Icons `lucide-react` se aate hain — 24×24 viewBox, 2px stroke, `currentColor`, rounded caps. Default classes `size-3` (12px, inline labels) se `size-4` (16px, header actions) tak.

```tsx
<Gauge className="size-3.5 text-accent-soft" aria-hidden />   // Compressor tab
<Boxes className="size-3.5 text-ink-muted" aria-hidden />     // Converter tab
<Info className="size-4" aria-hidden />                       // Documentation action
<Cpu className="size-3.5" />                                  // Encoding / codecs
<ScanLine className="size-3.5" />                             // Decoding phase
<ShieldCheck className="size-3.5" />                          // Verification / privacy
<ArrowDownRight className="size-4" />                         // savings direction
<Zap className="size-3.5" />                                  // primary action
```

Ek brand icon jo lucide me nahi hai — **GitHub mark** — `src/components/brand/GithubIcon.tsx` me inline path hai (16×16 viewBox, `fill="currentColor"`, `aria-hidden`). Emoji, multicolor icon packs ya external brand assets use mat karo.

---

## 10. Prompt for future AI projects

Copy this prompt and attach **this README + `globals.css` + `animations.css`**:

> Build this project using the attached PIXIORA design system. Match the existing exact CSS tokens and class structure where appropriate. Use a near-black `#08090c` background, `#0f1218` panel surfaces, hairline `rgba(255,255,255,0.07)` borders, a single steel-blue accent (`#5b9cf8` / `#1f5bd4`), tight 3–10px radii, 10px tracked-out uppercase eyebrows, 12–13px body text, tabular numerals on every measurement, and a 44px top bar with no side rail. Use Lucide outline icons only; never use emojis, gradients, glassmorphism, glow, or more than one accent colour. Keep the two-plane editor/rail layout, the verb-driven empty state, the animated (but honest) phase progress card, and responsive mobile bottom tabs. Preserve accessibility: visible focus rings, AA contrast, colour never alone, reduced-motion honoured. The attached CSS is the source of truth for exact colors, sizes, spacing and breakpoints; adapt content and implement interactions for the new app rather than copying PIXIORA-specific text blindly.

---

## 11. What the package does and doesn't include

- **Includes:** exact `@theme` tokens, global base styles, `@utility` definitions (panel, panel-header, well, eyebrow, tabular, kbd, checkerboard), all animation keyframes, the logo SVG, and the inline GitHub mark.
- **Does not include:** complete app, codec workers, router, stores, upload logic, search/filter handlers or hosting.
- This is a design and UI starting point, not a substitute for implementing app functionality.
- Fonts are a system stack — no network request, no licensing questions. Drop in self-hosted font files if you want a specific typeface.
- For a new visual brand, keep the style but replace the PIXIORA name/logo and relevant content.
- **Deliberately excluded from this system:** violet/purple accents, light backgrounds, sidebar navigation and emoji icons — those belong to a different (ToolSort-style) design language and were rejected here on purpose.
