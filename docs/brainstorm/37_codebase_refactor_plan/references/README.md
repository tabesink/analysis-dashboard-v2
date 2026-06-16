# Analysis Dashboard v2 — Upload Architecture Recommendations

This package contains senior architecture recommendations for refactoring the upload-related areas of `analysis-dashboard-v2` with a lean, TDD-first sequence.

The recommendations focus on separating the current upload surface into four clear lanes plus DB portability:

1. Folder upload / canonicalization
2. Channel map upload / channel reprocess
3. Schedule upload / damage calculation
4. DB import
5. DB export as the portability mirror

## Files

| File | Purpose |
|---|---|
| `01_executive_summary.md` | High-level architecture diagnosis and target direction |
| `02_current_architecture_findings.md` | Problems found in the current upload/data-flow architecture |
| `03_target_folder_structure.md` | Proposed backend and frontend folder structure |
| `04_clean_architecture_breakdown.md` | Lean policy, orchestration, service, API, and UI boundaries |
| `05_upload_lane_design.md` | Detailed design for the four upload lanes and DB portability |
| `06_server_refactor_plan.md` | Backend refactor plan using TDD tracer bullets and existing services |
| `07_client_refactor_plan.md` | Frontend component, hook, and API refactor plan |
| `08_migration_plan.md` | Incremental migration sequence that preserves behavior |
| `09_testing_observability_security.md` | Testing, observability, reliability, and security recommendations |
| `10_architectural_decisions.md` | ADRs that should be documented before/while refactoring |

## Guiding rule

Refactor behind existing endpoints first, one behavior test at a time. The only intentional behavior changes in the first wave are the agreed hardening items: folder upload requires write/admin permission, and DB import must not leave stale runtime query cache entries.
