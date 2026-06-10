"""Derived measurement and LTTB lineage tracking with stale-state handling."""

from __future__ import annotations

import json
from typing import Any

MEASUREMENTS_DATA_KIND = "full_resolution_derived"
LTTB_DATA_KIND = "plot_only"
STATUS_CURRENT = "current"
STATUS_STALE = "stale"
STATUS_ABSENT = "absent"


class DerivedDataLineageService:
    """Record and query derived-data lineage for measurements and LTTB rows."""

    def __init__(self, db: Any) -> None:
        self.db = db

    def record_commit(
        self,
        *,
        event_id: str,
        ingestion_run_id: int,
        channel_map_snapshot_id: int | None,
        has_measurements: bool,
        has_lttb: bool,
        conn: Any | None = None,
    ) -> None:
        """Persist lineage for an event after measurements and/or LTTB rows are written."""
        run = self.db.get_ingestion_run(ingestion_run_id)
        if run is None:
            raise ValueError(f"Unknown ingestion run: {ingestion_run_id}")

        derived_artifact_id = int(run["derived_artifact_id"])
        self.db.upsert_event_derived_data(
            event_id=event_id,
            ingestion_run_id=ingestion_run_id,
            derived_artifact_id=derived_artifact_id,
            channel_map_snapshot_id=channel_map_snapshot_id,
            measurements_status=STATUS_CURRENT if has_measurements else STATUS_ABSENT,
            lttb_status=STATUS_CURRENT if has_lttb else STATUS_ABSENT,
            measurements_data_kind=MEASUREMENTS_DATA_KIND,
            lttb_data_kind=LTTB_DATA_KIND,
            conn=conn,
        )

    def mark_stale_pending_on_snapshot_change(
        self,
        *,
        program_id: str,
        version: str,
        active_snapshot_id: int,
        conn: Any | None = None,
    ) -> int:
        """Mark Pending events stale when their derived snapshot differs from active."""
        return self.db.mark_stale_pending_derived_data(
            program_id=program_id,
            version=version,
            active_snapshot_id=active_snapshot_id,
            conn=conn,
        )

    def get_lineage(self, event_id: str) -> dict[str, Any] | None:
        """Return derived-data lineage for an event, including canonical artifact URI."""
        row = self.db.get_event_derived_data(event_id)
        if row is None:
            return None

        run = self.db.get_ingestion_run(int(row["ingestion_run_id"]))
        canonical_artifact_uri = None
        if run is not None:
            metadata = json.loads(run.get("metadata_json") or "{}")
            canonical_artifact_uri = metadata.get("derived_artifact_uri")
            if canonical_artifact_uri is None:
                derived = self.db.read_connection.execute(
                    "SELECT artifact_uri FROM derived_artifacts WHERE artifact_id = ?",
                    [row["derived_artifact_id"]],
                ).fetchone()
                if derived is not None:
                    canonical_artifact_uri = derived[0]

        return {
            **row,
            "canonical_artifact_uri": canonical_artifact_uri,
        }
