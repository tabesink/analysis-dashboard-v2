export interface CsvPreviewTableData {
  headers: string[];
  rows: string[][];
}

function parseCsvRow(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    if (char === '"') {
      if (inQuotes && line[index + 1] === '"') {
        current += '"';
        index += 1;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      result.push(current);
      current = '';
    } else {
      current += char;
    }
  }

  result.push(current);
  return result;
}

function findLineAfterMarker(lines: string[], marker: string): string | null {
  for (let index = 0; index < lines.length - 1; index += 1) {
    if (lines[index]?.trim() === marker) {
      return lines[index + 1] ?? null;
    }
  }
  return null;
}

function findDataStartIndex(lines: string[]): number {
  for (let index = 0; index < lines.length; index += 1) {
    if (lines[index]?.trim() === '#DATA') {
      return index + 1;
    }
  }
  return -1;
}

export function parseCsvPreviewLines(lines: string[]): CsvPreviewTableData | null {
  if (lines.length === 0) {
    return null;
  }

  const titlesLine = findLineAfterMarker(lines, '#TITLES');
  if (!titlesLine) {
    return null;
  }

  const headers = parseCsvRow(titlesLine);
  const dataStartIndex = findDataStartIndex(lines);
  if (dataStartIndex < 0) {
    return { headers, rows: [] };
  }

  const rows: string[][] = [];
  for (let index = dataStartIndex; index < lines.length; index += 1) {
    const stripped = lines[index]?.trim() ?? '';
    if (!stripped || stripped.startsWith('#')) {
      continue;
    }
    const row = parseCsvRow(stripped);
    if (row.length < headers.length) {
      rows.push([...row, ...Array(headers.length - row.length).fill('')]);
    } else if (row.length > headers.length) {
      rows.push(row.slice(0, headers.length));
    } else {
      rows.push(row);
    }
  }

  return { headers, rows };
}
