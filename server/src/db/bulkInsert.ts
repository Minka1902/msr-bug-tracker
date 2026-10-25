import type { Db } from './pool';

export interface BulkColumn {
  name: string;
  type: string;
  cast?: string;
}

const CHUNK = 5000;

export const bulkInsert = async (
  db: Db,
  table: string,
  columns: BulkColumn[],
  rows: Record<string, unknown>[],
) => {
  const names = columns.map((column) => column.name).join(', ');
  const select = columns
    .map((column) => (column.cast ? `x.${column.name}::${column.cast}` : `x.${column.name}`))
    .join(', ');
  const arrays = columns.map((column, index) => `$${index + 1}::${column.type}[]`).join(', ');
  const sql = `INSERT INTO ${table} (${names}) SELECT ${select} FROM unnest(${arrays}) AS x(${names})`;
  for (let start = 0; start < rows.length; start += CHUNK) {
    const chunk = rows.slice(start, start + CHUNK);
    await db.query(
      sql,
      columns.map((column) => chunk.map((row) => row[column.name] ?? null)),
    );
  }
};
