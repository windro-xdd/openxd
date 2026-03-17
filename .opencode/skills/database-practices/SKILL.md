---
name: database-practices
description: Design and evolve database layers safely. Use when editing schemas, queries, migrations, indexes, or integrity rules.
triggers:
  - database
  - schema
  - migration
  - index
  - sql
  - query plan
---

## Purpose

- Keep data correct and query paths fast while making schema changes safely.
- Reduce rollout risk with explicit migration and rollback strategy.

## When to Use

- Creating/modifying tables, constraints, indexes, or migrations.
- Debugging slow queries, lock contention, or integrity defects.
- Reviewing data model changes pre-release.

## Constraints

- Must enforce integrity at DB level first (constraints, keys, uniqueness).
- Must justify new indexes with query shape and write trade-off.
- Must avoid long blocking migrations without phased rollout/backfill.
- Must include rollback/mitigation notes for risky data changes.

## Workflow

1. Identify entities, access patterns, cardinality, and consistency requirements.
2. Propose schema/query/index changes and impact.
3. Implement safe migration sequence and backfills.
4. Validate with explain plans and realistic edge cases.
5. Verify application compatibility before and after migration boundaries.

## Output Format

- `Data Changes`: schema/query/index diffs with intent.
- `Risk Plan`: rollout/backfill/rollback.
- `Validation`: explain/test/integrity checks.
- `Ops Notes`: post-deploy signals to watch.
