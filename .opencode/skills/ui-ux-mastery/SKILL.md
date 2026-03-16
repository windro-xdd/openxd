# UI/UX Mastery — Stunning Modern Interface Design

## Description
Elite UI/UX design and implementation skill covering visual design principles (gestalt, color theory, typography, spacing systems), interaction design (micro-interactions, state transitions, gesture design), modern design patterns (glassmorphism, neubrutalism, bento grids, aurora gradients, mesh gradients, grain textures), motion design (spring physics, choreography, scroll-driven animations), responsive and adaptive design, design systems (tokens, component architecture), information architecture, user psychology (Fitts's law, Hick's law, Miller's law, Jakob's law), dark mode, accessibility-first design, and implementation with CSS/Tailwind/Framer Motion/GSAP. This skill produces interfaces that look like they were designed by a top-tier design agency — not generic AI slop. Use when: designing UI, building components, creating layouts, implementing animations, building design systems, theming, dark mode, responsive design, landing pages, dashboards, creative interfaces, data visualization UI.

## Trigger Keywords
UI, UX, design, interface, layout, component, animation, micro-interaction, responsive, mobile-first, dark mode, theme, color palette, typography, spacing, grid, card, modal, navigation, sidebar, dashboard, landing page, hero, CTA, glassmorphism, neumorphism, gradient, shadow, border-radius, design system, tokens, Figma, Tailwind, styled-components, CSS-in-JS, Framer Motion, GSAP

---

## 🎯 DESIGN PRINCIPLES — The Invisible Rules

### Gestalt Principles (how humans perceive visual groups)

**Proximity** — Things close together are perceived as related.
```
✅ Form labels directly above/beside their input (4-8px gap)
❌ Labels far from inputs with equal spacing everywhere
```

**Similarity** — Things that look alike are perceived as related.
```
✅ All primary actions share the same color/weight
✅ All destructive actions are red
❌ Random colors for buttons of equal importance
```

**Continuity** — The eye follows smooth paths.
```
✅ Aligned elements along a clear axis
✅ Cards in a grid follow consistent alignment
❌ Elements scattered without alignment reference
```

**Closure** — The brain completes incomplete shapes.
```
✅ Icons that suggest shapes without complete outlines
✅ Progress indicators that imply completion
```

**Figure-Ground** — Distinguish foreground from background.
```
✅ Cards elevated with shadow on a recessed background
✅ Modals with overlay dimming the background
✅ Active tab visually connected to content, inactive tabs recessed
```

**Common Region** — Elements in a bounded area are grouped.
```
✅ Card containers with consistent padding
✅ Sections with background color changes
✅ Grouped form fields in fieldsets
```

### Fitts's Law — Target Size & Distance
```
Time to reach a target = f(distance / size)

Rules:
1. Primary actions → Large, prominent, close to current focus
2. Destructive actions → Small, far from primary, require precision (intentional friction)
3. Touch targets → Minimum 44×44px (Apple HIG), 48×48dp (Material)
4. Corner/edge targets → Effectively infinite size (Fitts's Law in action — menus at screen edges)

/* Implementation */
.btn-primary {
  padding: 12px 24px;        /* Generous hit area */
  min-height: 44px;
  min-width: 44px;
  font-size: 1rem;
}

.btn-destructive {
  padding: 8px 16px;         /* Smaller — intentional friction */
  font-size: 0.875rem;
}

/* Touch-friendly spacing */
.action-group {
  gap: 8px;                  /* Minimum between interactive elements */
}
```

### Hick's Law — Decision Time
```
Decision time increases with number of choices.

Rules:
1. Limit primary actions to 1-2 per context
2. Use progressive disclosure (show more on demand)
3. Group options into categories (navigation → max 7±2 top-level items)
4. Highlight recommended option in pricing/plan comparisons
5. Use smart defaults to reduce decisions
```

### Miller's Law — Cognitive Load
```
Short-term memory holds 7±2 items.

Rules:
1. Chunk information (phone numbers: 555-867-5309, not 5558675309)
2. Step-by-step wizards for complex flows (max 5-7 steps)
3. Progress indicators showing position in sequence
4. Don't show more than 5-7 navigation items at top level
```

---

## 🎨 COLOR — Beyond "Pick a Blue"

### Building a Color System

#### Method 1: oklch-based palette (recommended)
```css
:root {
  /* Primary: Define ONE base color, derive everything */
  --hue: 260;
  --primary-50:  oklch(97% 0.01 var(--hue));
  --primary-100: oklch(94% 0.03 var(--hue));
  --primary-200: oklch(88% 0.07 var(--hue));
  --primary-300: oklch(78% 0.12 var(--hue));
  --primary-400: oklch(68% 0.18 var(--hue));
  --primary-500: oklch(58% 0.22 var(--hue)); /* Base */
  --primary-600: oklch(48% 0.22 var(--hue));
  --primary-700: oklch(38% 0.18 var(--hue));
  --primary-800: oklch(28% 0.14 var(--hue));
  --primary-900: oklch(18% 0.08 var(--hue));
  --primary-950: oklch(12% 0.05 var(--hue));

  /* Semantic colors */
  --success: oklch(65% 0.2 145);   /* Green */
  --warning: oklch(75% 0.18 85);   /* Amber */
  --error: oklch(55% 0.22 25);     /* Red */
  --info: oklch(60% 0.2 240);      /* Blue */

  /* Neutrals (with slight hue tint for warmth) */
  --neutral-50:  oklch(98% 0.005 var(--hue));
  --neutral-100: oklch(96% 0.005 var(--hue));
  --neutral-200: oklch(91% 0.005 var(--hue));
  --neutral-300: oklch(83% 0.005 var(--hue));
  --neutral-400: oklch(70% 0.01 var(--hue));
  --neutral-500: oklch(55% 0.01 var(--hue));
  --neutral-600: oklch(42% 0.01 var(--hue));
  --neutral-700: oklch(32% 0.01 var(--hue));
  --neutral-800: oklch(23% 0.01 var(--hue));
  --neutral-900: oklch(16% 0.01 var(--hue));
  --neutral-950: oklch(10% 0.01 var(--hue));

  /* Semantic surface tokens */
  --surface-primary: var(--neutral-50);
  --surface-secondary: var(--neutral-100);
  --surface-tertiary: var(--neutral-200);
  --text-primary: var(--neutral-900);
  --text-secondary: var(--neutral-600);
  --text-tertiary: var(--neutral-400);
  --border: var(--neutral-200);
  --border-hover: var(--neutral-300);
}

/* Dark mode — swap surfaces, keep brand consistent */
@media (prefers-color-scheme: dark) {
  :root {
    --surface-primary: var(--neutral-950);
    --surface-secondary: var(--neutral-900);
    --surface-tertiary: var(--neutral-800);
    --text-primary: var(--neutral-50);
    --text-secondary: var(--neutral-400);
    --text-tertiary: var(--neutral-500);
    --border: var(--neutral-800);
    --border-hover: var(--neutral-700);
  }
}
```

#### Color Harmony Rules
```
Monochromatic: One hue, vary lightness/chroma → safest, most cohesive
Complementary: Opposite hues (260° + 180° = 80°) → high contrast, use sparingly
Analogous: Adjacent hues (260°, 280°, 240°) → harmonious, natural
Triadic: 120° apart (260°, 20°, 140°) → vibrant, balanced
Split-complementary: Base + two adjacent to complement → versatile

Pro tip: 60-30-10 rule
60% → Dominant color (surfaces, backgrounds)
30% → Secondary color (cards, sections)
10% → Accent color (CTAs, highlights, interactive elements)
```

### Modern Gradient Techniques
```css
/* Aurora gradient (the Apple/Linear vibe) */
.aurora {
  background:
    radial-gradient(ellipse at 20% 50%, oklch(75% 0.2 280 / 0.3), transparent 50%),
    radial-gradient(ellipse at 80% 20%, oklch(70% 0.15 200 / 0.25), transparent 50%),
    radial-gradient(ellipse at 60% 80%, oklch(65% 0.18 330 / 0.2), transparent 50%),
    var(--surface-primary);
}

/* Mesh gradient (organic, Stripe-like) */
.mesh {
  background-color: oklch(95% 0.02 260);
  background-image:
    radial-gradient(at 40% 20%, oklch(85% 0.12 280) 0px, transparent 50%),
    radial-gradient(at 80% 0%, oklch(90% 0.08 200) 0px, transparent 50%),
    radial-gradient(at 0% 50%, oklch(88% 0.10 330) 0px, transparent 50%),
    radial-gradient(at 80% 50%, oklch(85% 0.06 140) 0px, transparent 50%),
    radial-gradient(at 0% 100%, oklch(90% 0.15 60) 0px, transparent 50%);
}

/* Grain texture overlay (adds tactile quality) */
.grain::after {
  content: '';
  position: fixed;
  inset: 0;
  background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 400 400' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E");
  opacity: 0.03;
  pointer-events: none;
  z-index: 9999;
}

/* Iridescent / holographic */
.holographic {
  background: linear-gradient(
    135deg,
    oklch(80% 0.15 330),
    oklch(75% 0.18 260),
    oklch(80% 0.12 200),
    oklch(85% 0.15 140),
    oklch(80% 0.18 60)
  );
  background-size: 400% 400%;
  animation: shift 8s ease infinite;
}
@keyframes shift {
  0%, 100% { background-position: 0% 50%; }
  50% { background-position: 100% 50%; }
}

/* Animated gradient border */
.gradient-border {
  position: relative;
  background: var(--surface-primary);
  border-radius: 16px;
}
.gradient-border::before {
  content: '';
  position: absolute;
  inset: -2px;
  border-radius: inherit;
  background: conic-gradient(from var(--angle, 0deg),
    oklch(70% 0.2 0), oklch(70% 0.2 90), oklch(70% 0.2 180), oklch(70% 0.2 270), oklch(70% 0.2 360));
  z-index: -1;
  animation: rotate-border 4s linear infinite;
}
@keyframes rotate-border {
  to { --angle: 360deg; }
}
@property --angle {
  syntax: '<angle>';
  initial-value: 0deg;
  inherits: false;
}
```

---

## ✨ MODERN DESIGN STYLES

### Glassmorphism (frosted glass)
```css
.glass-card {
  background: oklch(100% 0 0 / 0.1);
  backdrop-filter: blur(20px) saturate(180%);
  -webkit-backdrop-filter: blur(20px) saturate(180%);
  border: 1px solid oklch(100% 0 0 / 0.15);
  border-radius: 16px;
  box-shadow:
    0 8px 32px oklch(0% 0 0 / 0.08),
    inset 0 1px 0 oklch(100% 0 0 / 0.1); /* Inner highlight */
}

/* Dark mode glass */
@media (prefers-color-scheme: dark) {
  .glass-card {
    background: oklch(20% 0.01 260 / 0.3);
    border-color: oklch(100% 0 0 / 0.08);
  }
}
```

### Neubrutalism (bold, raw, playful)
```css
.neubrutalist-card {
  background: oklch(97% 0.02 60); /* Warm off-white */
  border: 3px solid oklch(15% 0 0);
  border-radius: 0; /* Sharp corners */
  box-shadow: 6px 6px 0 oklch(15% 0 0); /* Hard shadow */
  padding: 1.5rem;
  transition: transform 0.15s ease, box-shadow 0.15s ease;
}
.neubrutalist-card:hover {
  transform: translate(-2px, -2px);
  box-shadow: 8px 8px 0 oklch(15% 0 0);
}
.neubrutalist-card:active {
  transform: translate(2px, 2px);
  box-shadow: 2px 2px 0 oklch(15% 0 0);
}

.neubrutalist-btn {
  background: oklch(75% 0.25 145); /* Bold green */
  color: oklch(15% 0 0);
  border: 3px solid oklch(15% 0 0);
  padding: 12px 24px;
  font-weight: 800;
  font-size: 1.1rem;
  text-transform: uppercase;
  cursor: pointer;
  box-shadow: 4px 4px 0 oklch(15% 0 0);
}
```

### Bento Grid (Apple-inspired dashboard layout)
```css
.bento-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  grid-template-rows: repeat(3, minmax(200px, auto));
  gap: 1rem;
  padding: 1rem;
}

/* Feature card (spans 2x2) */
.bento-feature {
  grid-column: span 2;
  grid-row: span 2;
  background: var(--surface-secondary);
  border-radius: 24px;
  padding: 2rem;
  display: flex;
  flex-direction: column;
  justify-content: flex-end;
  overflow: hidden;
  position: relative;
}

.bento-card {
  background: var(--surface-secondary);
  border-radius: 24px;
  padding: 1.5rem;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

/* Wide card */
.bento-wide { grid-column: span 2; }

/* Tall card */
.bento-tall { grid-row: span 2; }

@media (max-width: 768px) {
  .bento-grid {
    grid-template-columns: repeat(2, 1fr);
    grid-template-rows: auto;
  }
  .bento-feature { grid-column: span 2; grid-row: span 1; }
}
```

### Modern Card Styles
```css
/* Elevated card (subtle, professional) */
.card-elevated {
  background: var(--surface-primary);
  border-radius: 12px;
  border: 1px solid var(--border);
  box-shadow:
    0 1px 3px oklch(0% 0 0 / 0.04),
    0 4px 8px oklch(0% 0 0 / 0.04);
  transition: box-shadow 0.2s ease, transform 0.2s ease;
}
.card-elevated:hover {
  box-shadow:
    0 4px 12px oklch(0% 0 0 / 0.08),
    0 12px 24px oklch(0% 0 0 / 0.08);
  transform: translateY(-2px);
}

/* Outlined card */
.card-outlined {
  background: transparent;
  border: 1.5px solid var(--border);
  border-radius: 12px;
  transition: border-color 0.2s ease, background 0.2s ease;
}
.card-outlined:hover {
  border-color: var(--primary-400);
  background: oklch(from var(--primary-500) l c h / 0.03);
}

/* Gradient border card */
.card-gradient-border {
  background: var(--surface-primary);
  border-radius: 16px;
  padding: 1px; /* The border width */
  background-clip: padding-box;
  border: 1px solid transparent;
  background-image: linear-gradient(var(--surface-primary), var(--surface-primary)),
    linear-gradient(135deg, var(--primary-400), var(--primary-600));
  background-origin: border-box;
  background-clip: padding-box, border-box;
}
```

---

## 🎬 MOTION DESIGN — Making UI Feel Alive

### Timing & Easing Psychology
```
Ease-out (decelerate): Elements ARRIVING → "I'm here"
  Use for: Modals appearing, dropdowns opening, page transitions in
  CSS: cubic-bezier(0.16, 1, 0.3, 1)

Ease-in (accelerate): Elements LEAVING → "I'm going away"
  Use for: Modals closing, elements being dismissed
  CSS: cubic-bezier(0.7, 0, 0.84, 0)

Ease-in-out: Elements MOVING → "I'm transitioning between states"
  Use for: Toggles, switches, position changes
  CSS: cubic-bezier(0.65, 0, 0.35, 1)

Spring: Natural, organic motion → "I'm physical, real"
  Use for: Drag & drop, pull-to-refresh, bouncy UI
  CSS: linear() with spring curve
  JS: Framer Motion spring({ stiffness: 400, damping: 25 })

Duration guidelines:
  Micro-interactions (hover, press): 100-150ms
  Small transitions (toggles, tabs): 150-250ms
  Medium transitions (modals, drawers): 250-350ms
  Large transitions (page, route): 300-500ms
  Complex choreography: 500-800ms
```

### Micro-Interactions That Delight
```css
/* Button press feedback */
.btn {
  transition: transform 0.1s ease, box-shadow 0.1s ease;
}
.btn:active {
  transform: scale(0.97);
  box-shadow: inset 0 2px 4px oklch(0% 0 0 / 0.1);
}

/* Checkbox with satisfying animation */
.checkbox-custom {
  appearance: none;
  width: 20px;
  height: 20px;
  border: 2px solid var(--border);
  border-radius: 4px;
  position: relative;
  transition: background 0.15s ease, border-color 0.15s ease;
}
.checkbox-custom:checked {
  background: var(--primary-500);
  border-color: var(--primary-500);
}
.checkbox-custom:checked::after {
  content: '';
  position: absolute;
  left: 5px;
  top: 1px;
  width: 6px;
  height: 10px;
  border: 2px solid white;
  border-width: 0 2px 2px 0;
  transform: rotate(45deg) scale(1);
  animation: check-pop 0.2s cubic-bezier(0.65, 0, 0.35, 1);
}
@keyframes check-pop {
  0% { transform: rotate(45deg) scale(0); }
  50% { transform: rotate(45deg) scale(1.2); }
  100% { transform: rotate(45deg) scale(1); }
}

/* Input focus ring (accessible + beautiful) */
.input {
  outline: 2px solid transparent;
  outline-offset: 2px;
  transition: outline-color 0.15s ease, border-color 0.15s ease;
}
.input:focus-visible {
  outline-color: var(--primary-500);
  border-color: var(--primary-500);
}

/* Skeleton loading (shimmer effect) */
.skeleton {
  background: linear-gradient(
    90deg,
    var(--neutral-200) 25%,
    var(--neutral-100) 37%,
    var(--neutral-200) 63%
  );
  background-size: 400% 100%;
  animation: skeleton-shimmer 1.4s ease infinite;
  border-radius: 4px;
}
@keyframes skeleton-shimmer {
  0% { background-position: 100% 50%; }
  100% { background-position: 0% 50%; }
}

/* Tooltip with arrow */
.tooltip {
  position: absolute;
  background: var(--neutral-900);
  color: var(--neutral-50);
  padding: 6px 12px;
  border-radius: 6px;
  font-size: 0.8125rem;
  pointer-events: none;
  opacity: 0;
  transform: translateY(4px);
  transition: opacity 0.15s ease, transform 0.15s ease;
}
.trigger:hover + .tooltip,
.trigger:focus-visible + .tooltip {
  opacity: 1;
  transform: translateY(0);
}
```

### Page Transition Choreography (Framer Motion / React)
```tsx
// Staggered list animation
const container = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: {
      staggerChildren: 0.05,
      delayChildren: 0.1,
    },
  },
};

const item = {
  hidden: { opacity: 0, y: 20 },
  show: {
    opacity: 1,
    y: 0,
    transition: { type: 'spring', stiffness: 300, damping: 24 },
  },
};

<motion.ul variants={container} initial="hidden" animate="show">
  {items.map(i => (
    <motion.li key={i.id} variants={item}>{i.name}</motion.li>
  ))}
</motion.ul>

// Layout animations (smooth reordering)
<AnimatePresence>
  {items.map(item => (
    <motion.div
      key={item.id}
      layout // Automatically animates position/size changes
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.8 }}
      transition={{ type: 'spring', stiffness: 500, damping: 30 }}
    />
  ))}
</AnimatePresence>

// Shared layout animation (morphing between views)
<motion.div layoutId={`card-${id}`}>
  {/* This element morphs between positions when layoutId matches */}
</motion.div>
```

---

## 📐 LAYOUT PATTERNS — Production-Ready

### The "Every Layout" Patterns
```css
/* Stack — vertical rhythm */
.stack > * + * {
  margin-block-start: var(--space, 1.5rem);
}

/* Cluster — horizontal wrapping group */
.cluster {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space, 1rem);
  align-items: center;
}

/* Sidebar — main content + sidebar */
.with-sidebar {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space, 1.5rem);
}
.with-sidebar > :first-child {
  flex-basis: 300px;
  flex-grow: 1;
}
.with-sidebar > :last-child {
  flex-basis: 0;
  flex-grow: 999;
  min-inline-size: 60%;
}

/* Center — constrained width, centered */
.center {
  max-inline-size: var(--measure, 65ch);
  margin-inline: auto;
  padding-inline: var(--gutter, 1rem);
}

/* Cover — full viewport height with centered content */
.cover {
  display: flex;
  flex-direction: column;
  min-block-size: 100dvh;
  padding: 1rem;
}
.cover > * { margin-block: 1rem; }
.cover > .centered {
  margin-block: auto; /* Centers vertically */
}

/* Switcher — horizontal until it gets too narrow, then vertical */
.switcher {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space, 1rem);
}
.switcher > * {
  flex-grow: 1;
  flex-basis: calc((var(--threshold, 30rem) - 100%) * 999);
}
```

### Navigation Patterns
```css
/* Responsive navigation — no JavaScript needed */
.nav {
  display: flex;
  flex-wrap: wrap;
  gap: 0;
}
.nav-links {
  display: flex;
  gap: 0.5rem;
  flex: 1;
}
/* On small screens: nav-links wrap below logo */
@media (max-width: 768px) {
  .nav { flex-direction: column; }
  .nav-links { flex-direction: column; }
}

/* Bottom tab navigation (mobile) */
.tab-bar {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  display: flex;
  justify-content: space-around;
  padding: 8px 0;
  padding-bottom: env(safe-area-inset-bottom); /* iPhone notch */
  background: var(--surface-primary);
  border-top: 1px solid var(--border);
}
.tab-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  font-size: 0.625rem;
  color: var(--text-tertiary);
  text-decoration: none;
  padding: 4px 12px;
  min-width: 44px;
  min-height: 44px;
  justify-content: center;
}
.tab-item[aria-current="page"] {
  color: var(--primary-500);
}
```

### Dashboard Layout
```css
.dashboard {
  display: grid;
  grid-template-columns: auto 1fr;
  grid-template-rows: auto 1fr;
  min-height: 100dvh;
}

/* Collapsible sidebar */
.sidebar {
  grid-row: 1 / -1;
  width: 260px;
  background: var(--surface-secondary);
  border-right: 1px solid var(--border);
  padding: 1rem;
  overflow-y: auto;
  transition: width 0.2s ease;
}
.sidebar.collapsed {
  width: 64px;
}

/* Top header */
.dashboard-header {
  padding: 0.75rem 1.5rem;
  border-bottom: 1px solid var(--border);
  display: flex;
  align-items: center;
  justify-content: space-between;
}

/* Main content area with its own scroll */
.dashboard-content {
  overflow-y: auto;
  padding: 1.5rem;
}

/* Stats grid */
.stats-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
  gap: 1rem;
  margin-bottom: 1.5rem;
}

/* Responsive: sidebar becomes bottom sheet or overlay on mobile */
@media (max-width: 768px) {
  .dashboard {
    grid-template-columns: 1fr;
  }
  .sidebar {
    position: fixed;
    inset: 0;
    width: 280px;
    z-index: 50;
    transform: translateX(-100%);
    transition: transform 0.3s cubic-bezier(0.16, 1, 0.3, 1);
  }
  .sidebar.open { transform: translateX(0); }
}
```

---

## 📱 RESPONSIVE DESIGN — Beyond Media Queries

### Mobile-First Strategy
```css
/* Base styles = mobile */
.container { padding: 1rem; }
.heading { font-size: var(--step-3); }
.grid { display: grid; gap: 1rem; }

/* Tablet enhancement */
@media (min-width: 768px) {
  .container { padding: 2rem; }
  .grid { grid-template-columns: repeat(2, 1fr); }
}

/* Desktop enhancement */
@media (min-width: 1024px) {
  .container { padding: 3rem; max-width: 1200px; margin-inline: auto; }
  .grid { grid-template-columns: repeat(3, 1fr); }
}

/* Modern alternative: Container Queries (preferred for components) */
.card-container { container-type: inline-size; }
@container (min-width: 400px) { .card { flex-direction: row; } }
@container (min-width: 600px) { .card { font-size: 1.125rem; } }
```

### Safe Area Insets (notches, home indicators)
```css
body {
  padding:
    env(safe-area-inset-top)
    env(safe-area-inset-right)
    env(safe-area-inset-bottom)
    env(safe-area-inset-left);
}

/* Fixed bottom bar on iPhone */
.bottom-bar {
  padding-bottom: calc(16px + env(safe-area-inset-bottom));
}
```

---

## 🌙 DARK MODE — Done Properly

### Rules
```
1. Don't invert colors — redesign with lower lightness backgrounds
2. Reduce contrast slightly (pure white on pure black = eye strain)
3. Use desaturated colors (high chroma on dark = vibrating/neon look)
4. Increase surface depth differentiation (lighter = more elevated)
5. Reduce shadow intensity (shadows barely visible on dark backgrounds)
6. Use outline/border for elevation instead of shadow
7. Test with both OLED (true black) and LCD (dark gray) in mind
```

```css
/* Light theme surfaces: darker = more recessed */
/* Dark theme surfaces: lighter = more elevated (opposite!) */

@media (prefers-color-scheme: dark) {
  :root {
    /* Surfaces (lighter = higher elevation) */
    --surface-base: oklch(13% 0.01 260);      /* Lowest */
    --surface-raised: oklch(17% 0.01 260);    /* Cards */
    --surface-overlay: oklch(21% 0.01 260);   /* Modals, dropdowns */

    /* Reduce shadow, add border instead */
    --card-shadow: none;
    --card-border: 1px solid oklch(100% 0 0 / 0.06);

    /* Desaturate brand colors */
    --primary-500: oklch(70% 0.15 260); /* Lower chroma than light mode */

    /* Text — NOT pure white */
    --text-primary: oklch(93% 0.005 260);
    --text-secondary: oklch(65% 0.01 260);
  }
}

/* System preference + manual toggle */
:root { color-scheme: light dark; }
[data-theme="light"] { color-scheme: light; }
[data-theme="dark"] { color-scheme: dark; }
```

---

## 🧩 DESIGN SYSTEM — Tokens & Architecture

### Token Hierarchy
```
Global Tokens (primitive values)
  → --blue-500: oklch(55% 0.25 260)
  → --space-4: 1rem
  → --radius-md: 8px
  → --font-sans: system-ui, sans-serif

Semantic Tokens (intent-based aliases)
  → --color-primary: var(--blue-500)
  → --color-surface: var(--neutral-50)
  → --spacing-component: var(--space-4)

Component Tokens (component-specific)
  → --btn-padding: var(--space-3) var(--space-5)
  → --btn-radius: var(--radius-md)
  → --btn-bg: var(--color-primary)

WHY: Change --blue-500 → all primaries update
     Change --color-primary → only semantic usage updates
     Change --btn-bg → only buttons update
```

### Component API Design (props that make sense)
```tsx
// Size: xs | sm | md | lg | xl (consistent across ALL components)
// Variant: solid | outline | ghost | soft | link
// Color: primary | secondary | success | warning | error | neutral
// Radius: none | sm | md | lg | full

// Consistent prop naming:
<Button size="md" variant="solid" color="primary">Save</Button>
<Badge size="sm" variant="soft" color="success">Active</Badge>
<Input size="md" variant="outline" />
<Avatar size="lg" />

// NOT:
<Button big primary filled>  ← Inconsistent, boolean props don't scale
```

---

## References
- Load `references/landing-page-patterns.md` for high-converting landing page blueprints
- Load `references/component-gallery.md` for production-ready component implementations
- Load `references/accessibility-patterns.md` for ARIA patterns and keyboard navigation
