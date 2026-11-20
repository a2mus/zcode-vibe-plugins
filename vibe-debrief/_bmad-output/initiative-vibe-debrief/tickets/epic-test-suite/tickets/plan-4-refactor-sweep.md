---
ticket: 4
status: done
---

# Plan: Story 1.4 — Refactor sweep

Consolidated shared workspace/home fixture helpers across `tests/`, removed duplicated helper code, and isolated `hook-runner` tests from ambient AI keys.

## Verification
- `node --check scripts/*.mjs && node --test tests/` exited `0` (108/108 tests passing, 20 suites).
