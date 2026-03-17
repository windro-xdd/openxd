---
name: next-cache-components
description: Next.js 16 Cache Components - PPR, use cache directive, cacheLife, cacheTag, updateTag
triggers:
  - cache components
  - use cache
  - ppr
  - cachelife
  - cachetag
---

## Purpose

- Apply Next.js 16 Cache Components to combine static, cached, and dynamic UI safely.
- Use `use cache` primitives to control lifetime, tagging, and invalidation without stale-data bugs.

## When to Use

- Route mixes stable sections and request-time sections (PPR/streaming).
- Migrating from `experimental.ppr`, `dynamic` flags, or `unstable_cache`.
- You need explicit cache lifetime/tag invalidation (`cacheLife`, `cacheTag`, `updateTag`, `revalidateTag`).
- Debugging incorrect freshness, over-caching, or runtime API usage inside cached code.

## Constraints

- Must enable `cacheComponents: true` before applying this skill.
- Must keep request-time APIs (`cookies`, `headers`, `searchParams`) outside `use cache` unless using `use cache: private` intentionally.
- Must tag cached data that needs selective invalidation.
- Must pick invalidation mode intentionally: `updateTag` (immediate) vs `revalidateTag` (background).
- Must preserve runtime compatibility: Node runtime required; avoid unsupported Edge/static-export assumptions.

## Workflow

1. Confirm capability: `cacheComponents` enabled and target route supports App Router cache model.
2. Partition content into static shell, cached blocks (`use cache`), and dynamic blocks (`Suspense` + runtime APIs).
3. Set cache policy with `cacheLife` and tag important resources via `cacheTag`.
4. Wire mutation paths with correct invalidation (`updateTag` for same-request freshness, `revalidateTag` for stale-while-revalidate).
5. Migrate legacy patterns (`unstable_cache`, old dynamic/revalidate flags) to directive-based equivalents.
6. Verify behavior: cache hit/miss expectations, invalidation timing, and no forbidden runtime API usage in cached scopes.

## Output Format

- Scope: list routes/functions moved to Cache Components model.
- Policy: list `use cache` mode, `cacheLife`, and tags per data source.
- Invalidation: list mutation points and chosen strategy (`updateTag` or `revalidateTag`).
- Verification: report freshness checks and migration compatibility notes.
