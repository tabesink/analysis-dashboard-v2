import { describe, expect, it } from 'vitest';
import { formatCsvPreviewCellValue, parseCsvPreviewLines } from './csv-preview-parse';

const SAMPLE_PREVIEW = [
  '#HEADER',
  '#TITLES',
  ',,001_1 LF LCA OtrBJ P_UG_X Force,002_2 LF LCA OtrBJ P_UG_Y Force',
  '#UNITS',
  ',,N,N',
  '#DATATYPES',
  'Huge,Double,Float,Float',
  '#DATA',
  '1,0.000000,119.3,135.5',
  '2,0.001000,118.5,133.5',
];

describe('formatCsvPreviewCellValue', () => {
  it('preserves values in columns before the drop threshold', () => {
    expect(formatCsvPreviewCellValue('0.001000', 1, 2)).toBe('0.001000');
    expect(formatCsvPreviewCellValue('119.3', 0, 2)).toBe('119.3');
  });

  it('drops decimals for columns at and after the drop threshold', () => {
    expect(formatCsvPreviewCellValue('119.3', 2, 2)).toBe('119');
    expect(formatCsvPreviewCellValue('135.5', 3, 2)).toBe('135');
    expect(formatCsvPreviewCellValue('-12.9', 2, 2)).toBe('-12');
  });

  it('leaves non-numeric values unchanged', () => {
    expect(formatCsvPreviewCellValue('N/A', 2, 2)).toBe('N/A');
    expect(formatCsvPreviewCellValue('', 2, 2)).toBe('');
  });

  it('returns the original value when no drop threshold is configured', () => {
    expect(formatCsvPreviewCellValue('119.3', 2)).toBe('119.3');
  });
});

describe('parseCsvPreviewLines', () => {
  it('extracts headers from the line after #TITLES and rows after #DATA', () => {
    const parsed = parseCsvPreviewLines(SAMPLE_PREVIEW);
    expect(parsed).toEqual({
      headers: ['', '', '001_1 LF LCA OtrBJ P_UG_X Force', '002_2 LF LCA OtrBJ P_UG_Y Force'],
      rows: [
        ['1', '0.000000', '119.3', '135.5'],
        ['2', '0.001000', '118.5', '133.5'],
      ],
    });
  });

  it('returns null when preview lines are empty', () => {
    expect(parseCsvPreviewLines([])).toBeNull();
  });

  it('returns null when #TITLES is missing', () => {
    expect(parseCsvPreviewLines(['#HEADER', '#DATA', '1,2,3'])).toBeNull();
  });

  it('returns headers with no rows when #DATA is missing', () => {
    expect(parseCsvPreviewLines(['#TITLES', 'A,B,C'])).toEqual({
      headers: ['A', 'B', 'C'],
      rows: [],
    });
  });
});
