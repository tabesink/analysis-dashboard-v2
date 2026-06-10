# Design Grill: Database Improvement Decisions

**Package:** `13_database_improvement`  
**Purpose:** Resolve the decision tree before implementation changes schema, upload behavior, or database activation semantics.  
**Created:** 2026-06-09

---

## How to Use This Document

This is the "grill-me" checklist for the database improvement roadmap. Do not treat every recommendation as already approved. Work down the questions, record decisions in `docs/decisions/log.md`, then start implementation slices from [implementation-plan.md](./implementation-plan.md).

Each section has:

- **Default recommendation:** The conservative path implied by the brainstorm.
- **Why it matters:** The risk if the decision stays vague.
- **Questions to answer:** The human/product decisions that code exploration cannot settle.

## 1. What Is the Durable Product Object?

**Default recommendation:** Treat the durable object as an engineering project/database, not only a DuckDB file.

**Why it matters:** Export/import, source retention, damage results, cases, and users all depend on whether the user thinks they are moving a "database", a "project", or a "load-data snapshot."

**Questions to answer:**

1. Should the UI call this a Database, Project, Dataset, or Analysis Project?
2. Can one project contain multiple programs, or is project equivalent to one program/customer study?
3. Are saved filters and analysis views part of a project, or local user preferences?
4. Are audit logs part of a transferred project, or local operational history only?
5. Should imported projects preserve uploader identity as text metadata when source users do not exist on the target system?

## 2. How Much Source Data Must Be Retained?

**Default recommendation:** Retain original uploaded bytes for every upload forever unless an admin explicitly purges a project. Also retain converted canonical CSV for RSP uploads.

**Why it matters:** Damage recalculation and auditability depend on exact source bytes. Retaining only processed rows is not enough when future channels or parser fixes are needed.

**Questions to answer:**

1. Is indefinite retention acceptable for expected file sizes and customer data policies?
2. Should there be a configurable retention policy, or only admin purge/archive?
3. Is retaining original RSP plus canonical CSV enough, or should parser logs and previews also be mandatory artifacts?
4. Should artifacts be encrypted at rest in production deployments?
5. How should duplicate source files be handled: reject, link existing source, or allow duplicate events?

## 3. Should Full Source Columns Be Persisted?

**Default recommendation:** Always retain original artifacts; persist canonical engineering channels in DuckDB; evaluate full source-column storage as Parquet if storage and query needs justify it.

**Why it matters:** The current raw transformer only stores mapped plot columns. If a later 21-channel damage workflow needs columns not present in the plot map, source artifacts are required for reprocessing.

**Questions to answer:**

1. Is reprocessing from source artifacts acceptable when new channels are needed, or must every original column be queryable immediately?
2. What is the expected max event count, row count, column count, and package size?
3. Should full raw source columns be normalized into DuckDB, stored as Parquet, or left only in original/canonical files?
4. Is timestamp always a real source column, or can sample index be the stable axis for some files?
5. Are there source files whose columns are not numeric but must still be preserved in metadata?

## 4. What Is the Case Model?

**Default recommendation:** Add `dim_case` as a first-class optional grouping now, with `dim_event.case_id` nullable during migration.

**Why it matters:** The brainstorm language is case-centric: one case has many events. The current schema is program/version/event-centric. If case is central to damage analysis, it should not be simulated through `program_id` and `version`.

**Questions to answer:**

1. What exactly defines a case: work order, job number, customer program, load-case scenario, or manual grouping?
2. Can one event belong to multiple cases?
3. Can a case span multiple program IDs or versions?
4. Who can create/edit cases: writers, admins only, or automatic ingestion?
5. Should damage runs be requested at case scope, event scope, or both?

## 5. What Are the Canonical 21 Channels?

**Default recommendation:** Define the 21-channel taxonomy in an ADR before coding. Do not keep deriving damage channels from plot keys.

**Why it matters:** The current code derives 12 damage channels from 8 dashboard plot definitions. That is useful for a first UI, but it makes engineering analysis depend on visualization configuration.

**Questions to answer:**

1. What are the exact 21 `channel_key` values?
2. What component, quantity, axis, unit, sign convention, and display order belongs to each channel?
3. Are these channels universal across all suspension components, or component-specific?
4. How should missing channels display in damage tables: unavailable, zero, not applicable, or blocked?
5. How should scale factors and unit conversion be handled: per source map, per channel definition, or per profile?

## 6. What Counts as Reproducible Damage?

**Default recommendation:** A damage result is valid only for a profile settings hash, source checksum set, channel-map snapshot hash, event selection hash, parser/calculator version, and app/schema version.

**Why it matters:** Persisted damage values are valuable only if the app can tell whether they are still valid after source, mapping, or profile changes.

**Questions to answer:**

1. Should damage results be immutable records, or can a rerun overwrite the latest result for a profile/event/channel?
2. How should users compare old and new damage runs?
3. Which fatigue parameters must be exposed as named profiles in the UI?
4. Is the current notebook-equivalent `py_fatigue` profile the default production profile or only a prototype baseline?
5. Should damage runs be cancellable and resumable like upload/export tasks?

## 7. What Should Transfer Include?

**Default recommendation:** Support two modes: project export for engineering data and full backup for disaster recovery.

**Why it matters:** Current export/import preserves local users/sessions/admin state and moves load data. Source artifacts and damage results change the product meaning of transfer.

**Questions to answer:**

1. Should project export include users as plain metadata, mapped owner IDs, or no user identity?
2. Should saved filters travel with project packages?
3. Should audit logs travel, or should exports only log transfer metadata on each host?
4. Should derived data such as LTTB and damage results be required or optional/rebuildable?
5. Should an import from an older app version auto-migrate, block, or require explicit admin confirmation?

## 8. How Should Admins Manage Databases?

**Default recommendation:** Import packages as new named projects/databases first. Activation should be explicit and reversible. Do not support arbitrary direct `.db` switching as the main workflow.

**Why it matters:** Runtime store switching touches connection lifecycle, cache invalidation, background tasks, active users, and destructive data replacement.

**Questions to answer:**

1. Does the first version need runtime switching, or is restart-based switching acceptable?
2. What happens to active users when an admin activates a different project?
3. Should writes be paused during activation?
4. Can multiple projects be open at once, or only one active project per server?
5. Should the UI expose clone/archive/delete in the first release?

## 9. How Should Historical Data Be Backfilled?

**Default recommendation:** Backfill lineage only as partial records when original source artifacts are unavailable. Do not claim historical events have source truth if the bytes are not retained.

**Why it matters:** Audit metadata must distinguish fully reproducible new events from older events that only have processed rows.

**Questions to answer:**

1. Are original files still available outside the app for historical imports?
2. Should there be an admin workflow to attach/reconcile historical source files to existing events?
3. How should the UI label events with partial lineage?
4. Should damage runs be blocked for partial-lineage events, or allowed with a warning?
5. Is a one-time migration package needed for existing customer datasets?

## 10. What Is the Minimum Valuable First Release?

**Default recommendation:** Ship in this order:

1. Source artifact ledger for all new uploads.
2. Project export/import with source artifacts and checksums.
3. Canonical channel model.
4. Persisted damage runs/results.
5. Admin project/database manager.

**Why it matters:** Trying to build database manager, canonical channels, and damage persistence in one pass will make review and rollback too risky.

**Questions to answer:**

1. Is source artifact retention alone valuable enough for the next release?
2. Must transfer support source artifacts before damage persistence ships?
3. Is the 21-channel damage workflow blocked on canonical channels, or can a bridge support a temporary release?
4. Which phase has the strongest customer/user deadline?
5. Which phase needs a prototype before production implementation?

## Decisions Already Implied by the Brainstorm

These are not final until logged, but they are the current working assumptions:

- DuckDB remains the active tabular store.
- Large source files should live outside DuckDB.
- Artifact references should be portable URIs, not absolute paths.
- Project/package import is safer than arbitrary `.db` upload and switch.
- Damage should become persisted and reproducible before expanding deeply into the UI.
- Canonical engineering channels should be independent from dashboard plot definitions.
- Current legacy load-data export/import should remain until the project-package mode is proven.

## Stop Conditions for Coding Agents

Stop and ask a human before coding if:

- A task requires deciding the 21-channel taxonomy.
- A task would remove or change legacy load-data export/import behavior.
- A task would support direct arbitrary `.db` uploads.
- A task would hard-delete source artifacts.
- A task would claim historical events have full source lineage without original bytes.
- A task would change runtime active database switching semantics.
