# Handoff — Upload Pipeline Reliability Fixes (UPF-29)

Use this document when picking up any issue in `issues/UPF-29-*.md`.

## Mission

Implement the top-priority fixes from the upload/database end-to-end architecture review:

1. Inspect Damage must show persisted `error` damage states instead of blank cells.
2. Long-running derived-data task polling must be as resilient as folder upload polling.
3. Affected legacy program/versions with first-file title channel maps need visible recovery guidance.
4. Operators need a guarded way to normalize legacy maps and kick the existing reprocess/damage loop.

The target outcome is not a new job framework. Keep the existing derived-data task kinds (`channel_reprocess`, `damage_calculation`) and the existing latest-result damage cache semantics.

## Review Findings Covered

| Finding | Issue |
|---------|-------|
| H1 — Inspect Damage hides `error` cells | `UPF-29-01` |
| H2 — Derived-data poll retry window is too short | `UPF-29-02` |
| C1 — Legacy channel maps still break mixed-cohort damage | `UPF-29-03`, `UPF-29-04` |
| H4 — Upload completion gives weak next-step guidance | `UPF-29-03` |

## Slice Order

1. `UPF-29-01` — make persisted damage failures visible.
2. `UPF-29-02` — harden long-running derived-data polling.
3. `UPF-29-03` — surface recovery and upload next-step guidance.
4. `UPF-29-04` — add a guarded repair action for legacy maps.

`UPF-29-01` and `UPF-29-02` can start immediately. `UPF-29-03` should use the error visibility from `UPF-29-01`. `UPF-29-04` should wait until the diagnostics/guidance from `UPF-29-03` are in place.

## Non-goals

- No filename-based channel routing.
- No new public derived-data task kind.
- No global background task center.
- No silent mutation for read-only users.
- No broad queue/worker rewrite.
