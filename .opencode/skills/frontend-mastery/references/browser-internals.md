# Browser Rendering Pipeline — How Pixels Get to Screen

## The Critical Rendering Path

```
HTML bytes → Characters → Tokens → Nodes → DOM tree
CSS bytes  → Characters → Tokens → Nodes → CSSOM tree
                                              │
                        DOM + CSSOM → Render Tree
                                         │
                                      Layout (Reflow)
                                         │
                                      Paint (Rasterize)
                                         │
                                    Composite Layers
                                         │
                                      GPU → Screen
```

## Layout vs Paint vs Composite

### Layout (Reflow) — EXPENSIVE
Triggers: changing width, height, margin, padding, top, left, font-size, display, position
The browser must recalculate geometry of ALL affected elements.

### Paint — MEDIUM
Triggers: changing color, background, border-color, box-shadow, visibility
Pixels are rasterized into layers.

### Composite — CHEAP
Triggers: transform, opacity, will-change, filter
Only GPU work, no main thread involvement.

**RULE: Animate ONLY transform and opacity for 60fps animations.**

```css
/* BAD — triggers layout every frame */
.animate { transition: top 0.3s, left 0.3s, width 0.3s; }

/* GOOD — only composite */
.animate { transition: transform 0.3s, opacity 0.3s; }

/* Promote to own layer (use sparingly) */
.will-animate { will-change: transform; }
/* Or: transform: translateZ(0); — hack, prefer will-change */
```

## CSS Containment (performance boundaries)
```css
/* Tell browser what WON'T change — enables optimizations */

/* contain: layout — element's internals don't affect outside layout */
/* contain: paint — element's children won't paint outside bounds */
/* contain: size — element's size doesn't depend on children */
/* contain: style — counters/quotes don't escape element */

.card {
  contain: content; /* = layout + paint */
  /* Browser can skip re-layout/repaint of this subtree */
}

.virtual-list-item {
  contain: strict; /* = size + layout + paint + style */
  /* Most aggressive — element is a complete island */
  content-visibility: auto; /* Skip rendering off-screen content entirely */
}

/* content-visibility: auto — the biggest performance win for long pages */
.section {
  content-visibility: auto;
  contain-intrinsic-size: auto 500px; /* Estimated height when hidden */
}
```

## Web Workers (off-main-thread computation)
```javascript
// Main thread
const worker = new Worker(new URL('./heavy-work.ts', import.meta.url));

worker.postMessage({ data: largeDataset, operation: 'sort' });
worker.onmessage = (e) => {
  const sorted = e.data; // Runs in background, main thread stays responsive
};

// heavy-work.ts (worker)
self.onmessage = (e) => {
  const { data, operation } = e.data;
  if (operation === 'sort') {
    const result = data.sort((a, b) => a.value - b.value);
    self.postMessage(result);
  }
};

// SharedArrayBuffer (shared memory between threads)
// Atomics (thread-safe operations on shared memory)
// Transferable objects (zero-copy transfer)
worker.postMessage(arrayBuffer, [arrayBuffer]); // Transfer, not copy
```

## Resource Loading Priority
```
                    Highest ──────────────────── Lowest
Preload:            ████████████
fetch (eager):      ████████████
CSS (head):         ████████████
Script (async):     ██████████
Font (preload):     ██████████
Image (viewport):   ████████
Script (defer):     ██████
Image (lazy):       ████
Prefetch:           ██
Speculation:        █

fetchpriority attribute:
<img fetchpriority="high">    — LCP image
<img fetchpriority="low">     — below-fold carousel images
<link fetchpriority="high">   — critical stylesheet
<script fetchpriority="low">  — analytics
```

## Paint Holding & Back-Forward Cache (bfcache)
```javascript
// bfcache — instant back/forward navigation
// Pages are frozen in memory, restored instantly

// What PREVENTS bfcache:
// - unload event listeners (use pagehide instead)
// - Cache-Control: no-store
// - Open WebSocket/WebRTC connections
// - Pending IndexedDB transactions

// Detect bfcache restoration:
window.addEventListener('pageshow', (e) => {
  if (e.persisted) {
    // Page was restored from bfcache
    // Refresh stale data, reconnect WebSockets
  }
});

// Opt-in to bfcache:
window.addEventListener('pagehide', () => {
  // Clean up (instead of 'unload')
});
```
