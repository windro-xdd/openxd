# Frontend Mastery — Core-Level Web Development

## Description
Elite frontend engineering skill covering HTML semantics, CSS mastery (Grid, Flexbox, Container Queries, Cascade Layers, View Transitions, Scroll-Driven Animations), JavaScript internals (event loop, closures, prototypes, generators, proxies, WeakRefs), TypeScript advanced patterns, React architecture (RSC, Suspense, concurrent features, compiler), Next.js (App Router, PPR, caching), performance optimization (Core Web Vitals, bundle splitting, lazy loading, streaming SSR), browser internals (rendering pipeline, compositing, paint, layout), accessibility (WCAG 2.2 AA), progressive enhancement, and modern web APIs. Not surface-level — this is how browsers actually work and how to exploit that knowledge. Use when: building web applications, optimizing performance, debugging layout issues, writing semantic HTML, CSS architecture, JavaScript debugging, TypeScript types, React patterns, Next.js development, web performance, accessibility, PWA, Web Components.

## Trigger Keywords
frontend, web development, HTML, CSS, JavaScript, TypeScript, React, Next.js, Vue, Svelte, Angular, Tailwind, performance, Core Web Vitals, accessibility, responsive design, animation, layout, grid, flexbox, component, SSR, SSG, ISR, hydration, bundle, webpack, vite, esbuild, browser, DOM, PWA, service worker, web component

---

## 🏗️ HTML — The Foundation

### Semantic HTML (not just divs)
```html
<!-- BAD: div soup -->
<div class="header">
  <div class="nav">
    <div class="link">Home</div>
  </div>
</div>
<div class="main">
  <div class="article">
    <div class="title">My Post</div>
  </div>
  <div class="sidebar"></div>
</div>

<!-- GOOD: semantic structure -->
<header>
  <nav aria-label="Main">
    <a href="/">Home</a>
  </nav>
</header>
<main>
  <article>
    <h1>My Post</h1>
    <time datetime="2026-03-12">March 12, 2026</time>
    <p>Content...</p>
  </article>
  <aside aria-label="Related">
    <!-- Sidebar content -->
  </aside>
</main>
<footer>
  <small>&copy; 2026</small>
</footer>
```

### Elements Most Developers Don't Use (But Should)
```html
<!-- Dialog (native modal — no JS library needed) -->
<dialog id="modal">
  <form method="dialog">
    <h2>Confirm</h2>
    <p>Are you sure?</p>
    <button value="cancel">Cancel</button>
    <button value="confirm">Confirm</button>
  </form>
</dialog>
<script>document.getElementById('modal').showModal()</script>

<!-- Details/Summary (native accordion) -->
<details>
  <summary>Click to expand</summary>
  <p>Hidden content revealed on click. No JavaScript needed.</p>
</details>

<!-- Output (for calculation results) -->
<form oninput="result.value = parseInt(a.value) + parseInt(b.value)">
  <input type="range" id="a" value="50"> +
  <input type="number" id="b" value="25"> =
  <output name="result" for="a b">75</output>
</form>

<!-- Meter (gauge — NOT progress) -->
<meter value="0.7" min="0" max="1" low="0.3" high="0.7" optimum="0.8">70%</meter>

<!-- Picture (art direction + format selection) -->
<picture>
  <source media="(min-width: 1200px)" srcset="hero-wide.avif" type="image/avif">
  <source media="(min-width: 1200px)" srcset="hero-wide.webp" type="image/webp">
  <source media="(min-width: 768px)" srcset="hero-medium.avif" type="image/avif">
  <source srcset="hero-small.avif" type="image/avif">
  <img src="hero-fallback.jpg" alt="Hero image" loading="lazy" decoding="async"
       width="1200" height="600" fetchpriority="high">
</picture>

<!-- Datalist (native autocomplete) -->
<input list="browsers" name="browser">
<datalist id="browsers">
  <option value="Chrome">
  <option value="Firefox">
  <option value="Safari">
</datalist>

<!-- Template (inert HTML template for JS cloning) -->
<template id="card-template">
  <article class="card">
    <h3></h3>
    <p></p>
  </article>
</template>

<!-- Mark (highlight text) -->
<p>Search results for "css": Learn <mark>CSS</mark> Grid today</p>

<!-- Abbr (abbreviation with tooltip) -->
<p>Use <abbr title="Cascading Style Sheets">CSS</abbr> for styling.</p>

<!-- Loading attribute on iframes too -->
<iframe src="embed.html" loading="lazy" title="Embedded content"></iframe>
```

### Forms — Done Right
```html
<form novalidate>
  <!-- Accessible labels (ALWAYS use label) -->
  <div>
    <label for="email">Email</label>
    <input type="email" id="email" name="email" required
           autocomplete="email" inputmode="email"
           aria-describedby="email-help email-error">
    <small id="email-help">We'll never share your email.</small>
    <span id="email-error" role="alert" aria-live="polite"></span>
  </div>

  <!-- Fieldset + Legend for grouped inputs -->
  <fieldset>
    <legend>Payment Method</legend>
    <label><input type="radio" name="payment" value="card"> Credit Card</label>
    <label><input type="radio" name="payment" value="paypal"> PayPal</label>
  </fieldset>

  <!-- Accessible error summary -->
  <div role="alert" aria-live="assertive" id="error-summary"></div>

  <button type="submit">Submit</button>
</form>
```

### Performance-Critical HTML Patterns
```html
<head>
  <!-- Preconnect to critical origins -->
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://cdn.example.com" crossorigin>

  <!-- Preload critical resources -->
  <link rel="preload" href="/fonts/inter.woff2" as="font" type="font/woff2" crossorigin>
  <link rel="preload" href="/hero.avif" as="image" fetchpriority="high">

  <!-- DNS prefetch for non-critical origins -->
  <link rel="dns-prefetch" href="https://analytics.example.com">

  <!-- Speculative prerendering (Chrome) -->
  <script type="speculationrules">
  {
    "prerender": [{"source": "list", "urls": ["/about", "/pricing"]}],
    "prefetch": [{"source": "document", "where": {"href_matches": "/*"}, "eagerness": "moderate"}]
  }
  </script>

  <!-- Critical CSS inlined -->
  <style>/* critical above-the-fold CSS */</style>

  <!-- Non-critical CSS deferred -->
  <link rel="stylesheet" href="/styles.css" media="print" onload="this.media='all'">
</head>
```

---

## 🎨 CSS — Deep Mastery

### The Cascade — How It Actually Works
```
Specificity calculation: (inline, IDs, classes/attrs/pseudo-classes, elements/pseudo-elements)

div                    → (0, 0, 0, 1)
.card                  → (0, 0, 1, 0)
#header                → (0, 1, 0, 0)
style="..."            → (1, 0, 0, 0)
div.card               → (0, 0, 1, 1)
#header .nav a:hover   → (0, 1, 2, 1)
!important             → overrides everything (except another !important with higher specificity)

Cascade order (lowest to highest priority):
1. User agent styles
2. User styles
3. Author styles
4. Author !important
5. User !important
6. User agent !important
7. @layer (in layer order — first declared = lowest priority)
8. Inline styles
9. Animations (@keyframes — override everything while active)
10. Transitions (highest priority during transition)
```

### Cascade Layers (modern CSS architecture)
```css
/* Define layer order — first = lowest priority */
@layer reset, base, components, utilities, overrides;

@layer reset {
  *, *::before, *::after { box-sizing: border-box; margin: 0; }
  body { min-height: 100dvh; }
}

@layer base {
  :root {
    --color-primary: oklch(65% 0.25 260);
    --color-surface: oklch(98% 0.01 260);
    --radius: 0.5rem;
    --shadow-sm: 0 1px 2px oklch(0% 0 0 / 0.05);
    --shadow-md: 0 4px 6px oklch(0% 0 0 / 0.07), 0 2px 4px oklch(0% 0 0 / 0.06);
  }
}

@layer components {
  .card { /* component styles — can be overridden by utilities layer */ }
}

@layer utilities {
  .sr-only { /* screen reader only — always wins over components */ }
}

/* Styles without @layer have HIGHEST priority (above all layers) */
```

### Modern Layout — Grid + Flexbox

#### CSS Grid — The Complete Mental Model
```css
/* Grid is for 2D layout. Think rows AND columns. */

/* Auto-responsive grid (no media queries!) */
.grid-auto {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(min(300px, 100%), 1fr));
  gap: 1.5rem;
}

/* Named grid areas (the most readable layout) */
.layout {
  display: grid;
  grid-template-columns: 250px 1fr 300px;
  grid-template-rows: auto 1fr auto;
  grid-template-areas:
    "header  header  header"
    "sidebar content aside"
    "footer  footer  footer";
  min-height: 100dvh;
}
.layout > header  { grid-area: header; }
.layout > nav     { grid-area: sidebar; }
.layout > main    { grid-area: content; }
.layout > aside   { grid-area: aside; }
.layout > footer  { grid-area: footer; }

/* Responsive without media queries */
@media (max-width: 768px) {
  .layout {
    grid-template-columns: 1fr;
    grid-template-areas:
      "header"
      "content"
      "sidebar"
      "aside"
      "footer";
  }
}

/* Subgrid (child inherits parent's grid tracks) */
.card-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 2rem;
}
.card {
  display: grid;
  grid-template-rows: subgrid; /* Cards align their internal rows */
  grid-row: span 3; /* Header, body, footer — all aligned across cards */
}

/* Masonry layout (experimental but powerful) */
.masonry {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(250px, 1fr));
  grid-template-rows: masonry;
  gap: 1rem;
}
```

#### Flexbox — When to Use Instead of Grid
```css
/* Flexbox is for 1D layout. Think row OR column. */

/* Navigation with spacer */
.nav {
  display: flex;
  align-items: center;
  gap: 1rem;
}
.nav .spacer { margin-inline-start: auto; } /* Pushes rest to end */

/* Centering (the classic) */
.center {
  display: flex;
  place-items: center; /* shorthand: align-items + justify-items */
  /* or: align-items: center; justify-content: center; */
}

/* Equal height cards */
.card-row {
  display: flex;
  gap: 1rem;
}
.card-row > * { flex: 1; } /* Equal width */

/* Flex-wrap with minimum sizes */
.tags {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
}
.tag {
  flex: 0 1 auto; /* Don't grow, can shrink, natural width */
}
```

### Container Queries (component-level responsiveness)
```css
/* The game-changer: components respond to THEIR container, not the viewport */

.card-container {
  container-type: inline-size;
  container-name: card;
}

@container card (min-width: 400px) {
  .card { display: flex; gap: 1rem; }
  .card-image { flex: 0 0 150px; }
}

@container card (min-width: 600px) {
  .card { font-size: 1.125rem; }
  .card-image { flex: 0 0 250px; }
}

/* Container query units */
.card-title {
  font-size: clamp(1rem, 3cqi, 1.5rem); /* cqi = container query inline */
}

/* Style queries (check computed styles of container) */
@container style(--theme: dark) {
  .card { background: oklch(20% 0.02 260); }
}
```

### Modern CSS Features (2024-2026)

#### View Transitions
```css
/* Page transitions (MPA — multi-page apps) */
@view-transition {
  navigation: auto;
}

/* Name specific elements for custom transitions */
.hero-image {
  view-transition-name: hero;
}

::view-transition-old(hero) {
  animation: fade-out 0.3s ease;
}
::view-transition-new(hero) {
  animation: fade-in 0.3s ease;
}

/* SPA view transitions (JavaScript API) */
/* document.startViewTransition(() => updateDOM()) */
```

#### Scroll-Driven Animations
```css
/* Animate based on scroll position — no JavaScript! */

/* Progress bar that fills as you scroll */
.progress-bar {
  animation: fill-bar linear;
  animation-timeline: scroll(); /* Tied to scroll position */
}
@keyframes fill-bar {
  from { width: 0%; }
  to { width: 100%; }
}

/* Fade in elements as they enter viewport */
.fade-in-element {
  animation: fade-in linear both;
  animation-timeline: view(); /* Tied to element visibility */
  animation-range: entry 0% entry 100%;
}
@keyframes fade-in {
  from { opacity: 0; transform: translateY(30px); }
  to { opacity: 1; transform: translateY(0); }
}

/* Parallax without JavaScript */
.parallax-layer {
  animation: parallax linear;
  animation-timeline: scroll();
}
@keyframes parallax {
  to { transform: translateY(-50%); }
}
```

#### Anchor Positioning
```css
/* Position elements relative to OTHER elements — tooltips, popovers, dropdowns */
.anchor-button {
  anchor-name: --my-button;
}

.tooltip {
  position: fixed;
  position-anchor: --my-button;
  top: anchor(--my-button bottom);
  left: anchor(--my-button center);
  translate: -50% 0.5rem;

  /* Auto-flip if no space */
  position-try-fallbacks: flip-block, flip-inline;
}

/* Popover API (native, no JS) */
/* <button popovertarget="menu">Menu</button>
   <div popover id="menu">Dropdown content</div> */
[popover] {
  &:popover-open {
    animation: slide-in 0.2s ease;
  }
}
```

#### Color Functions (oklch — the future of CSS color)
```css
:root {
  /* oklch(Lightness Chroma Hue) — perceptually uniform */
  --blue-500: oklch(55% 0.25 260);
  --blue-400: oklch(65% 0.22 260); /* Lighter = higher L */
  --blue-600: oklch(45% 0.25 260); /* Darker = lower L */

  /* Generate palette from one hue */
  --primary-50:  oklch(97% 0.02 260);
  --primary-100: oklch(93% 0.05 260);
  --primary-200: oklch(85% 0.10 260);
  --primary-300: oklch(75% 0.15 260);
  --primary-400: oklch(65% 0.20 260);
  --primary-500: oklch(55% 0.25 260);
  --primary-600: oklch(45% 0.25 260);
  --primary-700: oklch(35% 0.22 260);
  --primary-800: oklch(25% 0.18 260);
  --primary-900: oklch(15% 0.12 260);

  /* Relative color syntax */
  --primary-hover: oklch(from var(--primary-500) calc(l + 0.1) c h);
  --primary-active: oklch(from var(--primary-500) calc(l - 0.1) c h);

  /* color-mix for quick variations */
  --primary-muted: color-mix(in oklch, var(--primary-500) 40%, transparent);
}

/* Dark mode with oklch — just adjust lightness */
@media (prefers-color-scheme: dark) {
  :root {
    --primary-50:  oklch(15% 0.02 260);
    --primary-100: oklch(20% 0.05 260);
    /* ... invert the scale */
    --primary-900: oklch(95% 0.08 260);
  }
}
```

#### Modern Selectors
```css
/* :has() — parent selector (THE most powerful CSS addition ever) */
/* Style parent based on child state */
.form-group:has(input:invalid) {
  border-color: red;
}
.form-group:has(input:invalid) .error-message {
  display: block;
}

/* Card with image vs without */
.card:has(img) { grid-template-rows: 200px 1fr; }
.card:not(:has(img)) { grid-template-rows: 1fr; }

/* Navigation with active item */
nav:has(.active) .link:not(.active) { opacity: 0.7; }

/* :is() and :where() — grouping with different specificity */
:is(h1, h2, h3, h4) { /* specificity of highest selector */ }
:where(h1, h2, h3, h4) { /* zero specificity — easy to override */ }

/* Nesting (native — no preprocessor needed!) */
.card {
  background: white;
  border-radius: var(--radius);

  & .title {
    font-size: 1.25rem;
  }

  &:hover {
    box-shadow: var(--shadow-md);
  }

  @media (max-width: 768px) {
    & { padding: 1rem; }
  }
}
```

### Typography System
```css
/* Fluid typography — scales with viewport, clamped */
:root {
  /* Base: 16px at 320px viewport → 20px at 1200px viewport */
  --step--2: clamp(0.694rem, 0.643rem + 0.254vw, 0.833rem);
  --step--1: clamp(0.833rem, 0.757rem + 0.381vw, 1.042rem);
  --step-0: clamp(1rem, 0.886rem + 0.568vw, 1.302rem);
  --step-1: clamp(1.2rem, 1.032rem + 0.839vw, 1.628rem);
  --step-2: clamp(1.44rem, 1.196rem + 1.22vw, 2.035rem);
  --step-3: clamp(1.728rem, 1.378rem + 1.75vw, 2.544rem);
  --step-4: clamp(2.074rem, 1.578rem + 2.478vw, 3.18rem);
  --step-5: clamp(2.488rem, 1.795rem + 3.466vw, 3.975rem);

  /* Spacing scale (consistent rhythm) */
  --space-3xs: clamp(0.25rem, 0.227rem + 0.114vw, 0.313rem);
  --space-2xs: clamp(0.5rem, 0.443rem + 0.284vw, 0.625rem);
  --space-xs: clamp(0.75rem, 0.67rem + 0.398vw, 0.938rem);
  --space-s: clamp(1rem, 0.886rem + 0.568vw, 1.302rem);
  --space-m: clamp(1.5rem, 1.33rem + 0.852vw, 1.953rem);
  --space-l: clamp(2rem, 1.773rem + 1.136vw, 2.604rem);
  --space-xl: clamp(3rem, 2.659rem + 1.705vw, 3.906rem);
  --space-2xl: clamp(4rem, 3.545rem + 2.273vw, 5.208rem);
}

body {
  font-family: system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif;
  font-size: var(--step-0);
  line-height: 1.6;
  letter-spacing: -0.011em;
  text-rendering: optimizeLegibility;
  -webkit-font-smoothing: antialiased;
}

h1 { font-size: var(--step-5); line-height: 1.1; letter-spacing: -0.025em; text-wrap: balance; }
h2 { font-size: var(--step-4); line-height: 1.15; letter-spacing: -0.02em; text-wrap: balance; }
h3 { font-size: var(--step-3); line-height: 1.2; letter-spacing: -0.015em; }

/* Prose (long-form content) */
.prose {
  max-inline-size: 65ch;
  text-wrap: pretty; /* Avoids orphans on last line */
}
.prose p + p { margin-block-start: 1.5em; }
```

### Animation — Production Patterns
```css
/* Respect user preferences */
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
  }
}

/* Spring-like easing (modern CSS) */
:root {
  --ease-spring: linear(
    0, 0.006, 0.025 2.8%, 0.101 6.1%, 0.539 18.9%, 0.721 25.3%, 0.849 31.5%,
    0.937 38.1%, 0.968 41.8%, 0.991 45.7%, 1.006 50%, 1.015 55%, 1.017 63.5%,
    1.001 85.5%, 1
  );
  --ease-out-expo: cubic-bezier(0.16, 1, 0.3, 1);
  --ease-in-out-expo: cubic-bezier(0.87, 0, 0.13, 1);
}

/* Performant animations (ONLY transform + opacity on GPU) */
.animate-in {
  animation: slide-up 0.5s var(--ease-spring);
}
@keyframes slide-up {
  from {
    opacity: 0;
    transform: translateY(20px);
  }
}

/* Staggered children */
.stagger > * {
  animation: fade-in 0.3s var(--ease-out-expo) both;
}
.stagger > *:nth-child(1) { animation-delay: 0ms; }
.stagger > *:nth-child(2) { animation-delay: 50ms; }
.stagger > *:nth-child(3) { animation-delay: 100ms; }
.stagger > *:nth-child(4) { animation-delay: 150ms; }
/* Or use custom property: animation-delay: calc(var(--i) * 50ms); */
```

---

## ⚡ JavaScript — Internals & Advanced Patterns

### The Event Loop — How It Actually Works
```
┌─────────────────────────────┐
│         Call Stack           │ ← Synchronous code executes here
└─────────────┬───────────────┘
              │ (empty?)
              ▼
┌─────────────────────────────┐
│      Microtask Queue         │ ← Promise.then, queueMicrotask, MutationObserver
│  (ALL drained before next)   │   Microtasks can enqueue MORE microtasks
└─────────────┬───────────────┘
              │ (empty?)
              ▼
┌─────────────────────────────┐
│       Render Steps           │ ← requestAnimationFrame, style calc, layout, paint
│  (only when browser wants    │   (~60fps = every 16.6ms)
│   to repaint)                │
└─────────────┬───────────────┘
              │
              ▼
┌─────────────────────────────┐
│      Macrotask Queue         │ ← setTimeout, setInterval, I/O, UI events
│  (ONE task per iteration)    │   Then back to microtasks
└─────────────────────────────┘

Key insight: Microtasks STARVE macrotasks.
Promise.resolve().then(() => { /* runs BEFORE any setTimeout */ })
setTimeout(() => { /* runs AFTER all pending microtasks */ }, 0)

// Scheduling priorities (modern)
// scheduler.postTask(() => {}, { priority: 'user-blocking' }) // Highest
// scheduler.postTask(() => {}, { priority: 'user-visible' })  // Default
// scheduler.postTask(() => {}, { priority: 'background' })    // Lowest
// scheduler.yield() // Yield to browser, resume after render
```

### Closures — The Real Explanation
```javascript
// A closure is a function that remembers its lexical scope
// even when executed outside that scope.

function createCounter(initial = 0) {
  let count = initial; // This variable is "closed over"

  return {
    increment: () => ++count,
    decrement: () => --count,
    getCount: () => count,
  };
  // When createCounter returns, `count` is NOT garbage collected
  // because the returned functions still reference it
}

const counter = createCounter(10);
counter.increment(); // 11
counter.increment(); // 12

// Classic gotcha: loop closures
for (var i = 0; i < 5; i++) {
  setTimeout(() => console.log(i), 100); // Prints 5,5,5,5,5
}
// Fix 1: let (block scope)
for (let i = 0; i < 5; i++) {
  setTimeout(() => console.log(i), 100); // Prints 0,1,2,3,4
}
// Fix 2: IIFE (old pattern)
for (var i = 0; i < 5; i++) {
  ((j) => setTimeout(() => console.log(j), 100))(i);
}

// Practical: memoization via closure
function memoize(fn) {
  const cache = new Map();
  return function (...args) {
    const key = JSON.stringify(args);
    if (cache.has(key)) return cache.get(key);
    const result = fn.apply(this, args);
    cache.set(key, result);
    return result;
  };
}
```

### Prototypes — How Inheritance Actually Works
```javascript
// Every object has a [[Prototype]] (accessible via __proto__ or Object.getPrototypeOf)
// Property lookup walks the prototype chain

const animal = {
  speak() { return `${this.name} makes a sound`; }
};

const dog = Object.create(animal); // dog.__proto__ === animal
dog.name = 'Rex';
dog.speak(); // "Rex makes a sound" — found on prototype

// Class syntax is syntactic sugar over prototypes
class Animal {
  constructor(name) { this.name = name; }
  speak() { return `${this.name} makes a sound`; }
}

class Dog extends Animal {
  speak() { return `${this.name} barks`; }
}

// Under the hood:
// Dog.prototype.__proto__ === Animal.prototype
// new Dog().__proto__ === Dog.prototype
// new Dog().__proto__.__proto__ === Animal.prototype
// new Dog().__proto__.__proto__.__proto__ === Object.prototype
// new Dog().__proto__.__proto__.__proto__.__proto__ === null (end of chain)
```

### Modern JavaScript Patterns
```javascript
// Proxy (intercept object operations)
function createReactiveObject(target, onChange) {
  return new Proxy(target, {
    set(obj, prop, value) {
      const old = obj[prop];
      obj[prop] = value;
      if (old !== value) onChange(prop, value, old);
      return true;
    },
    get(obj, prop) {
      const value = obj[prop];
      if (typeof value === 'object' && value !== null) {
        return createReactiveObject(value, onChange); // Deep reactivity
      }
      return value;
    }
  });
}

// WeakRef + FinalizationRegistry (memory-aware caching)
const cache = new Map();
const registry = new FinalizationRegistry(key => cache.delete(key));

function getCached(key, factory) {
  const ref = cache.get(key);
  if (ref) {
    const value = ref.deref();
    if (value !== undefined) return value;
  }
  const value = factory();
  cache.set(key, new WeakRef(value));
  registry.register(value, key);
  return value;
}

// Generators (lazy evaluation)
function* fibonacci() {
  let a = 0, b = 1;
  while (true) {
    yield a;
    [a, b] = [b, a + b];
  }
}

function* take(n, iterable) {
  let i = 0;
  for (const value of iterable) {
    if (i++ >= n) return;
    yield value;
  }
}

[...take(10, fibonacci())]; // [0, 1, 1, 2, 3, 5, 8, 13, 21, 34]

// AsyncIterator (streaming data)
async function* fetchPages(url) {
  let page = 1;
  while (true) {
    const response = await fetch(`${url}?page=${page}`);
    const data = await response.json();
    if (data.length === 0) return;
    yield* data;
    page++;
  }
}

for await (const item of fetchPages('/api/items')) {
  console.log(item);
}

// Structured Clone (deep copy — replaces JSON.parse(JSON.stringify()))
const deepCopy = structuredClone(complexObject);
// Handles: Date, RegExp, Map, Set, ArrayBuffer, circular refs
// Does NOT handle: Functions, DOM nodes, Error objects

// AbortController (cancellation pattern)
const controller = new AbortController();
const { signal } = controller;

fetch('/api/data', { signal })
  .then(r => r.json())
  .catch(e => { if (e.name !== 'AbortError') throw e; });

// Cancel after 5 seconds or on user action
setTimeout(() => controller.abort(), 5000);
button.onclick = () => controller.abort();

// AbortSignal.any (combine multiple signals)
const timeout = AbortSignal.timeout(5000);
const manual = new AbortController();
const combined = AbortSignal.any([timeout, manual.signal]);
fetch('/api', { signal: combined });
```

### TypeScript — Advanced Patterns
```typescript
// Discriminated Unions (the most important TS pattern)
type Result<T, E = Error> =
  | { success: true; data: T }
  | { success: false; error: E };

function divide(a: number, b: number): Result<number, string> {
  if (b === 0) return { success: false, error: "Division by zero" };
  return { success: true, data: a / b };
}

const result = divide(10, 3);
if (result.success) {
  result.data; // TypeScript knows this is number
} else {
  result.error; // TypeScript knows this is string
}

// Template Literal Types
type EventName = `on${Capitalize<string>}`;
type CSSProperty = `--${string}`;
type Route = `/${string}`;

// Mapped Types with Key Remapping
type Getters<T> = {
  [K in keyof T as `get${Capitalize<string & K>}`]: () => T[K];
};
type PersonGetters = Getters<{ name: string; age: number }>;
// { getName: () => string; getAge: () => number }

// Conditional Types (type-level if/else)
type IsArray<T> = T extends any[] ? true : false;
type UnwrapPromise<T> = T extends Promise<infer U> ? UnwrapPromise<U> : T;

// Const assertions + satisfies (best combo)
const ROUTES = {
  home: '/',
  about: '/about',
  blog: '/blog',
} as const satisfies Record<string, `/${string}`>;
// Type: { readonly home: '/'; readonly about: '/about'; readonly blog: '/blog' }

// Branded Types (type-safe IDs)
type Brand<T, B> = T & { __brand: B };
type UserId = Brand<string, 'UserId'>;
type PostId = Brand<string, 'PostId'>;

function getUser(id: UserId) { /* ... */ }
function getPost(id: PostId) { /* ... */ }

const userId = 'abc' as UserId;
const postId = 'xyz' as PostId;
getUser(userId); // ✅
getUser(postId); // ❌ Type error!

// Variadic Tuple Types
type Head<T extends any[]> = T extends [infer H, ...any[]] ? H : never;
type Tail<T extends any[]> = T extends [any, ...infer R] ? R : never;
type Last<T extends any[]> = T extends [...any[], infer L] ? L : never;

// infer in conditional types (type-level pattern matching)
type ExtractParams<T extends string> =
  T extends `${string}:${infer Param}/${infer Rest}`
    ? Param | ExtractParams<Rest>
    : T extends `${string}:${infer Param}`
    ? Param
    : never;

type Params = ExtractParams<'/users/:userId/posts/:postId'>; // "userId" | "postId"
```

---

## ⚛️ React — Architecture & Patterns

### React Server Components (RSC) Mental Model
```
┌──────────────────────────────────────────┐
│                 SERVER                     │
│  ┌──────────────────────────────────┐    │
│  │  Server Components (default)      │    │
│  │  - async/await                    │    │
│  │  - Direct DB/API access           │    │
│  │  - No state, no effects           │    │
│  │  - Zero client JS bundle impact   │    │
│  │  - Can import Client Components   │    │
│  └──────────────┬───────────────────┘    │
│                  │ renders to             │
│                  ▼                        │
│  ┌──────────────────────────────────┐    │
│  │  RSC Payload (serialized React)   │    │  ← Streamed to client
│  └──────────────────────────────────┘    │
└──────────────────────────────────────────┘
                   │
                   ▼
┌──────────────────────────────────────────┐
│                 CLIENT                    │
│  ┌──────────────────────────────────┐    │
│  │  Client Components ("use client") │    │
│  │  - useState, useEffect           │    │
│  │  - Event handlers (onClick)       │    │
│  │  - Browser APIs                   │    │
│  │  - Cannot import Server Comps     │    │
│  │  - CAN receive Server Comps as    │    │
│  │    children (composition pattern) │    │
│  └──────────────────────────────────┘    │
└──────────────────────────────────────────┘

Rule: "use client" creates a BOUNDARY. Everything imported
by a client component is also client. Push "use client" as
far down the tree as possible.
```

### Component Patterns That Scale
```tsx
// 1. Compound Components (flexible API)
function Select({ children, value, onChange }: SelectProps) {
  return (
    <SelectContext.Provider value={{ value, onChange }}>
      <div role="listbox">{children}</div>
    </SelectContext.Provider>
  );
}

function Option({ value, children }: OptionProps) {
  const ctx = useContext(SelectContext);
  return (
    <div
      role="option"
      aria-selected={ctx.value === value}
      onClick={() => ctx.onChange(value)}
    >
      {children}
    </div>
  );
}

Select.Option = Option;

// Usage: <Select value={v} onChange={setV}>
//          <Select.Option value="a">Apple</Select.Option>
//          <Select.Option value="b">Banana</Select.Option>
//        </Select>

// 2. Render Props (extracting behavior)
function useMousePosition() {
  const [position, setPosition] = useState({ x: 0, y: 0 });
  useEffect(() => {
    const handler = (e: MouseEvent) => setPosition({ x: e.clientX, y: e.clientY });
    window.addEventListener('mousemove', handler);
    return () => window.removeEventListener('mousemove', handler);
  }, []);
  return position;
}

// 3. Slots Pattern (composition over configuration)
function Card({ header, footer, children }: {
  header?: ReactNode;
  footer?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="card">
      {header && <div className="card-header">{header}</div>}
      <div className="card-body">{children}</div>
      {footer && <div className="card-footer">{footer}</div>}
    </div>
  );
}

// 4. Polymorphic Components (flexible element types)
type AsProp<C extends ElementType> = { as?: C };
type PropsWithAs<C extends ElementType, P = {}> = P &
  AsProp<C> &
  Omit<ComponentPropsWithoutRef<C>, keyof P | 'as'>;

function Button<C extends ElementType = 'button'>({
  as, children, ...props
}: PropsWithAs<C, { variant?: 'primary' | 'secondary' }>) {
  const Component = as || 'button';
  return <Component {...props}>{children}</Component>;
}

// <Button>Click</Button>                     → renders <button>
// <Button as="a" href="/about">Link</Button> → renders <a>
// <Button as={Link} to="/about">Nav</Button> → renders <Link>
```

### Performance Patterns
```tsx
// 1. useMemo / useCallback — ONLY when needed
// Don't: wrap everything in useMemo
// Do: profile first, optimize bottlenecks

// 2. React.lazy + Suspense (code splitting)
const HeavyChart = lazy(() => import('./HeavyChart'));

function Dashboard() {
  return (
    <Suspense fallback={<Skeleton />}>
      <HeavyChart data={data} />
    </Suspense>
  );
}

// 3. Virtualization (large lists)
// Use @tanstack/react-virtual, not rendering 10,000 DOM nodes
function VirtualList({ items }: { items: Item[] }) {
  const parentRef = useRef<HTMLDivElement>(null);
  const virtualizer = useVirtualizer({
    count: items.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 50,
  });

  return (
    <div ref={parentRef} style={{ height: '400px', overflow: 'auto' }}>
      <div style={{ height: `${virtualizer.getTotalSize()}px`, position: 'relative' }}>
        {virtualizer.getVirtualItems().map(virtual => (
          <div
            key={virtual.key}
            style={{
              position: 'absolute',
              top: 0,
              transform: `translateY(${virtual.start}px)`,
              height: `${virtual.size}px`,
            }}
          >
            {items[virtual.index].name}
          </div>
        ))}
      </div>
    </div>
  );
}

// 4. useTransition (keep UI responsive during heavy updates)
function Search() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [isPending, startTransition] = useTransition();

  function handleChange(e: ChangeEvent<HTMLInputElement>) {
    setQuery(e.target.value); // Urgent: update input immediately
    startTransition(() => {
      setResults(filterLargeDataset(e.target.value)); // Deferred: can be interrupted
    });
  }

  return (
    <>
      <input value={query} onChange={handleChange} />
      {isPending ? <Spinner /> : <ResultList results={results} />}
    </>
  );
}

// 5. useDeferredValue (defer expensive renders)
function SearchResults({ query }: { query: string }) {
  const deferredQuery = useDeferredValue(query);
  const isStale = query !== deferredQuery;

  return (
    <div style={{ opacity: isStale ? 0.5 : 1 }}>
      <ExpensiveList filter={deferredQuery} />
    </div>
  );
}
```

---

## 🌐 Web Performance — Core Web Vitals

### The Three Metrics That Matter
```
LCP (Largest Contentful Paint) — Loading speed
Target: < 2.5 seconds
What: Largest image/text block in viewport
Fix:
  - Preload LCP image: <link rel="preload" as="image" fetchpriority="high">
  - Inline critical CSS
  - Reduce server response time (TTFB)
  - Avoid lazy-loading above-the-fold images
  - Use CDN for static assets
  - Use modern image formats (AVIF > WebP > JPEG)

INP (Interaction to Next Paint) — Responsiveness
Target: < 200 milliseconds
What: Worst interaction delay across page lifetime
Fix:
  - Break long tasks (> 50ms) with scheduler.yield()
  - Use requestIdleCallback for non-urgent work
  - Debounce/throttle event handlers
  - Move heavy computation to Web Workers
  - Minimize main thread blocking
  - Use CSS containment: contain: content

CLS (Cumulative Layout Shift) — Visual stability
Target: < 0.1
What: Sum of unexpected layout shifts
Fix:
  - Always set width/height on images/video: <img width="800" height="600">
  - Use aspect-ratio CSS: aspect-ratio: 16 / 9
  - Reserve space for dynamic content (min-height)
  - Use transform animations (not top/left/width/height)
  - Preload fonts with font-display: optional or swap
  - Don't inject content above existing content
```

### Bundle Optimization
```javascript
// Dynamic imports (route-level splitting)
const AdminPanel = lazy(() => import(/* webpackChunkName: "admin" */ './AdminPanel'));

// Named exports enable tree shaking
// BAD: import _ from 'lodash'           (imports ALL of lodash)
// GOOD: import { debounce } from 'lodash-es'  (tree-shakeable)

// Analyze bundle
// npx vite-bundle-visualizer
// npx @next/bundle-analyzer

// Image optimization
// Next.js: <Image> component with automatic optimization
// Vite: vite-imagetools
// Manual: srcset + sizes for responsive images
<img
  srcset="hero-400.avif 400w, hero-800.avif 800w, hero-1200.avif 1200w"
  sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
  src="hero-800.jpg"
  alt="Hero"
  loading="lazy"
  decoding="async"
  fetchpriority="low"
>
```

---

## ♿ Accessibility — Not Optional

### ARIA Patterns (when native HTML isn't enough)
```html
<!-- Live regions (dynamic content announcements) -->
<div aria-live="polite" aria-atomic="true">
  <!-- Content changes here are announced by screen readers -->
  3 results found
</div>

<!-- Tabs (ARIA roles + keyboard navigation required) -->
<div role="tablist" aria-label="Settings">
  <button role="tab" aria-selected="true" aria-controls="panel-1" id="tab-1">General</button>
  <button role="tab" aria-selected="false" aria-controls="panel-2" id="tab-2">Security</button>
</div>
<div role="tabpanel" id="panel-1" aria-labelledby="tab-1">General settings</div>
<div role="tabpanel" id="panel-2" aria-labelledby="tab-2" hidden>Security settings</div>

<!-- Keyboard navigation for tabs: Arrow keys to switch, Tab to enter panel -->

<!-- Combobox (autocomplete) -->
<div role="combobox" aria-expanded="true" aria-haspopup="listbox" aria-owns="suggestions">
  <input type="text" aria-autocomplete="list" aria-controls="suggestions" aria-activedescendant="option-2">
</div>
<ul role="listbox" id="suggestions">
  <li role="option" id="option-1">Apple</li>
  <li role="option" id="option-2" aria-selected="true">Banana</li>
  <li role="option" id="option-3">Cherry</li>
</ul>

<!-- Skip navigation link -->
<a href="#main-content" class="sr-only focus:not-sr-only">Skip to main content</a>
```

### Focus Management
```javascript
// Focus trap (modals, dialogs)
function trapFocus(element: HTMLElement) {
  const focusables = element.querySelectorAll(
    'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
  );
  const first = focusables[0] as HTMLElement;
  const last = focusables[focusables.length - 1] as HTMLElement;

  element.addEventListener('keydown', (e) => {
    if (e.key !== 'Tab') return;
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  });

  first.focus();
}

// Roving tabindex (toolbar, menu)
// Only one item in group has tabindex="0", rest have tabindex="-1"
// Arrow keys move focus, Tab exits group
```

### Color Contrast
```
WCAG 2.2 AA requirements:
- Normal text (< 24px / < 18.66px bold): 4.5:1 ratio
- Large text (≥ 24px / ≥ 18.66px bold): 3:1 ratio
- UI components & graphics: 3:1 ratio
- Focus indicators: 3:1 ratio against adjacent colors

Tools: Chrome DevTools (inspect → color picker shows ratio)
       axe DevTools, Lighthouse, WAVE
```

---

## References
- Load `references/browser-internals.md` for rendering pipeline, compositing, and paint
- Load `references/next-patterns.md` for Next.js App Router deep patterns
- Load `references/web-apis.md` for modern Web APIs reference
