"""Data transformation from wide to long format."""

import logging
from typing import Any

import pandas as pd

logger = logging.getLogger(__name__)


class DataTransformer:
    """Transform wide-format CSV data to long format for storage."""

    def transform_to_long(
        self,
        df: pd.DataFrame,
        channel_map: dict[str, Any] | None = None,
        timestamp_col: int = 1,
    ) -> pd.DataFrame:
        """
        Transform wide-format DataFrame to long format.

        Wide format: One row per timestamp, columns are channels
        Long format: One row per measurement (timestamp, channel_name, value)

        Args:
            df: Wide-format DataFrame
            channel_map: Deprecated; raw storage is independent of plot mappings.
            timestamp_col: Column index for timestamp (default 1)

        Returns:
            Long-format DataFrame with columns: timestamp, channel_name, value
        """
        if df.empty:
            return pd.DataFrame(
                columns=[
                    "timestamp",
                    "channel_name",
                    "value",
                ]
            )

        # Get timestamp column
        if timestamp_col < len(df.columns):
            timestamps = df.iloc[:, timestamp_col].values
        else:
            # Use row index as timestamp
            timestamps = df.index.values

        # Store canonical full-resolution signal columns. The first two columns
        # in parsed RSP CSVs are the row/index and timestamp columns.
        columns_to_extract = range(timestamp_col + 1, len(df.columns))

        # Build long-format records
        records: list[dict[str, Any]] = []

        for col_idx in columns_to_extract:
            col_name = df.columns[col_idx] if hasattr(df.columns[col_idx], "__str__") else f"col_{col_idx}"
            values = pd.to_numeric(df.iloc[:, col_idx], errors="coerce")
            if values.isna().all():
                continue

            for ts, val in zip(timestamps, values):
                records.append({
                    "timestamp": float(ts) if pd.notna(ts) else 0.0,
                    "channel_name": str(col_name),
                    "value": float(val) if pd.notna(val) else None,
                })

        result = pd.DataFrame(records)
        logger.debug(f"Transformed {len(df)} rows to {len(result)} long-format records")
        return result

    def extract_plot_data(
        self,
        df: pd.DataFrame,
        x_col: int,
        y_col: int,
    ) -> pd.DataFrame:
        """
        Extract X/Y data for a specific plot.

        Args:
            df: Wide-format DataFrame
            x_col: Column index for X axis
            y_col: Column index for Y axis

        Returns:
            DataFrame with columns: x, y
        """
        if df.empty:
            return pd.DataFrame(columns=["x", "y"])

        if x_col >= len(df.columns) or y_col >= len(df.columns):
            logger.warning(
                f"Column index out of bounds: x_col={x_col}, y_col={y_col}, "
                f"num_cols={len(df.columns)}"
            )
            return pd.DataFrame(columns=["x", "y"])

        x_data = df.iloc[:, x_col].values
        y_data = df.iloc[:, y_col].values

        result = pd.DataFrame({
            "x": x_data,
            "y": y_data,
        })

        # Remove rows with NaN values
        result = result.dropna()

        return result

