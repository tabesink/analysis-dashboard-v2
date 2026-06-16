# Architecture Sketch

## Current architecture, simplified

```text
Inspect Damage Page
  ├─ selects event ids
  ├─ calls damage inspect API
  ├─ receives persisted damage rows + scope state
  ├─ detects missing/stale/repair state
  ├─ may trigger backfill
  ├─ tracks active task state
  ├─ polls while task active
  └─ renders table/plot/progress modal

Backend Damage API
  ├─ inspect: read persisted event_channel_damage rows
  ├─ backfill: decide whether Inspect Damage access should start calculation
  └─ calculate: explicitly start calculation

Backend Services
  ├─ inspect response builder
  ├─ post-upload/precompute decision logic
  ├─ scope repair/stale assessment
  ├─ schedule prerequisite checking
  ├─ schedule rescale optimization
  └─ damage calculation task
```

## Target architecture

```text
Schedule Upload / Save
  ├─ validate schedule
  ├─ check prerequisites
  ├─ clear previous damage for scope
  ├─ start damage calculation task
  └─ return task id/status

Damage Calculation Task
  ├─ load scheduled event rows
  ├─ load channel series
  ├─ calculate base damage
  ├─ apply schedule repeats/weight/multiplier
  ├─ upsert current/error event_channel_damage rows
  └─ update task progress/failure state

Inspect Damage Page
  ├─ selects event ids
  ├─ calls inspect read API
  ├─ renders selected rows immediately
  ├─ displays persisted values/error/unavailable states
  └─ shows schedule/task status banner if relevant
```

## Deep-module opportunity

The deep module should be the damage pipeline service.

It should expose a small public interface and hide:

- schedule validation
- prerequisite checking
- prior damage cleanup
- task creation/reuse
- calculation execution
- progress state
- persistence details
- failure report creation

## Command/query separation

Commands:

```text
upload/save schedule
start explicit recalculation, if retained
```

Queries:

```text
get calculation status
inspect persisted damage results
```

Inspect Damage is a query and must not mutate.

## Data state simplification

Target schedule/task states:

```text
validating
calculating
completed
failed
```

Target cell states:

```text
current
error
unavailable
```

Avoid normalizing old stale/backfill states into the new product flow. Since data can be reuploaded, reset instead.
