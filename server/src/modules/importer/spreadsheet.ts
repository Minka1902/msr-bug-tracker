import type { Writable } from 'node:stream';
import ExcelJS from 'exceljs';
import { badRequest } from '../../lib/httpError';
import { TEMPLATE_CHOICES, TEMPLATE_COLUMNS } from './columns';

export type SheetFormat = 'csv' | 'xlsx';

export interface SheetRows {
  headers: string[];
  rows: { row: number; values: Record<string, unknown> }[];
}

export interface ExportColumn {
  header: string;
  width: number;
}

export const MAX_IMPORT_ROWS = 5000;

const BOM = '\uFEFF';

const HEADER_FILL = { type: 'pattern' as const, pattern: 'solid' as const, fgColor: { argb: 'FFE8EAFD' } };
const TEMPLATE_ROWS = 1000;
const INSTRUCTIONS = [
  'How to fill in the import template',
  '',
  'Title is the only required column. Leave any other cell empty to use the default.',
  'Type: task, bug, feature, improvement, chore or errand (default task).',
  'Status: the name of a status in the project, for example To Do or Done. Unknown names go to the first matching column, guessed from the word (done, progress, backlog).',
  'Priority: urgent, high, medium or low (default medium). Severity is used for bugs only.',
  'Assignee email: must belong to a project member. Anyone else is left unassigned.',
  'Labels: separate several labels with commas. Missing labels are created if you can manage labels.',
  'Dates: YYYY-MM-DD, for example 2026-11-05.',
  'ID and Parent ID: give a row an ID, then put that ID in another row’s Parent ID to make it a subtask.',
  '',
  'You can also import CSV exports from ClickUp, Jira, Asana, Trello and Linear: their column names are recognised.',
];

const cellValue = (value: ExcelJS.CellValue): unknown => {
  if (value === null || value === undefined) return '';
  if (value instanceof Date) return value;
  if (typeof value === 'object') {
    if ('result' in value) return cellValue(value.result as ExcelJS.CellValue);
    if ('richText' in value) return value.richText.map((part) => part.text).join('');
    if ('text' in value) return value.text;
    return '';
  }
  return value;
};

const csvEscape = (value: unknown) => {
  const text = value === null || value === undefined ? '' : String(value);
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
};

export const csvLine = (values: unknown[]) => `${values.map(csvEscape).join(',')}\r\n`;

export const readSheet = async (path: string, format: SheetFormat): Promise<SheetRows> => {
  const workbook = new ExcelJS.Workbook();
  let sheet: ExcelJS.Worksheet | undefined;
  try {
    sheet =
      format === 'csv'
        ? await workbook.csv.readFile(path, { map: (value: unknown) => value })
        : (await workbook.xlsx.readFile(path), workbook.worksheets[0]);
  } catch {
    throw badRequest(`We couldn't read this ${format.toUpperCase()} file. Save it again and retry.`);
  }
  if (!sheet) throw badRequest('The file has no sheets');

  let headers: string[] | null = null;
  const rows: SheetRows['rows'] = [];
  sheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
    const cells = (row.values as ExcelJS.CellValue[]).slice(1).map(cellValue);
    if (!headers) {
      if (cells.some((cell) => String(cell).trim()))
        headers = cells.map((cell, index) => String(cell).replace(BOM, '').trim() || `Column ${index + 1}`);
      return;
    }
    if (!cells.some((cell) => String(cell).trim())) return;
    rows.push({
      row: rowNumber,
      values: Object.fromEntries(headers.map((header, index) => [header, cells[index] ?? ''])),
    });
  });
  if (!headers) throw badRequest('The file is empty');
  if (rows.length > MAX_IMPORT_ROWS)
    throw badRequest(`A file can have at most ${MAX_IMPORT_ROWS} rows. Split it into smaller files.`);
  return { headers, rows };
};

export const buildTemplate = async (format: SheetFormat): Promise<Buffer> => {
  if (format === 'csv')
    return Buffer.from(
      `${BOM}${csvLine(TEMPLATE_COLUMNS.map((column) => column.header))}${[0, 1]
        .map((index) => csvLine(TEMPLATE_COLUMNS.map((column) => column.example[index])))
        .join('')}`,
    );

  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('Tasks', { views: [{ state: 'frozen', ySplit: 1 }] });
  sheet.columns = TEMPLATE_COLUMNS.map((column) => ({
    header: column.header,
    key: column.field,
    width: column.width,
  }));
  sheet.getRow(1).eachCell((cell) => {
    cell.font = { bold: true };
    cell.fill = HEADER_FILL;
  });
  [0, 1].forEach((index) =>
    sheet.addRow(Object.fromEntries(TEMPLATE_COLUMNS.map((column) => [column.field, column.example[index]]))),
  );
  TEMPLATE_COLUMNS.forEach((column, index) => {
    const choices = TEMPLATE_CHOICES[column.field];
    if (!choices) return;
    for (let row = 2; row <= TEMPLATE_ROWS; row += 1)
      sheet.getCell(row, index + 1).dataValidation = {
        type: 'list',
        allowBlank: true,
        formulae: [`"${choices.join(',')}"`],
      };
  });
  const help = workbook.addWorksheet('Instructions');
  help.getColumn(1).width = 110;
  INSTRUCTIONS.forEach((line, index) => {
    help.addRow([line]).font = index === 0 ? { bold: true, size: 14 } : {};
  });
  return Buffer.from(await workbook.xlsx.writeBuffer());
};

export const streamSheet = async (
  out: Writable,
  format: SheetFormat,
  columns: ExportColumn[],
  batches: AsyncIterable<unknown[][]>,
) => {
  if (format === 'csv') {
    out.write(`${BOM}${csvLine(columns.map((column) => column.header))}`);
    for await (const batch of batches) out.write(batch.map(csvLine).join(''));
    out.end();
    return;
  }
  const workbook = new ExcelJS.stream.xlsx.WorkbookWriter({ stream: out, useStyles: true });
  const sheet = workbook.addWorksheet('Tasks', { views: [{ state: 'frozen', ySplit: 1 }] });
  sheet.columns = columns.map((column) => ({ header: column.header, width: column.width }));
  sheet.getRow(1).font = { bold: true };
  sheet.getRow(1).commit();
  for await (const batch of batches) batch.forEach((values) => sheet.addRow(values).commit());
  sheet.commit();
  await workbook.commit();
};
