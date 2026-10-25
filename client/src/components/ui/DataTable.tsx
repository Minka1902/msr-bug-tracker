import { useVirtualizer } from '@tanstack/react-virtual';
import { ArrowDown, ArrowUp, ChevronsUpDown } from 'lucide-react';
import { useRef, type CSSProperties, type ReactNode } from 'react';
import { cn } from '../../lib/cn';
import { Checkbox } from './Checkbox';
import { Skeleton } from './Skeleton';

export interface DataColumn<T> {
  id: string;
  header: ReactNode;
  cell: (row: T) => ReactNode;
  width?: string;
  sortable?: boolean;
  align?: 'start' | 'center' | 'end';
  className?: string;
}

export interface SortState {
  id: string;
  desc: boolean;
}

interface DataTableProps<T> {
  rows: T[];
  columns: DataColumn<T>[];
  getRowId: (row: T) => string;
  getRowLabel?: (row: T) => string;
  sort?: SortState | null;
  onSortChange?: (sort: SortState | null) => void;
  selected?: Set<string>;
  onSelectedChange?: (selected: Set<string>) => void;
  onRowClick?: (row: T) => void;
  activeRowId?: string | null;
  loading?: boolean;
  empty?: ReactNode;
  rowHeight?: number;
  maxHeight?: string;
  renderMobile?: (row: T) => ReactNode;
  footer?: ReactNode;
  className?: string;
  label?: string;
}

const SELECT_TRACK = '44px';
const ALIGN = {
  start: 'justify-start text-left',
  center: 'justify-center text-center',
  end: 'justify-end text-right',
};

const nextSort = (current: SortState | null | undefined, id: string): SortState | null => {
  if (current?.id !== id) return { id, desc: false };
  return current.desc ? null : { id, desc: true };
};

export function DataTable<T>({
  rows,
  columns,
  getRowId,
  getRowLabel,
  sort,
  onSortChange,
  selected,
  onSelectedChange,
  onRowClick,
  activeRowId,
  loading,
  empty,
  rowHeight = 48,
  maxHeight = 'calc(100dvh - 260px)',
  renderMobile,
  footer,
  className,
  label,
}: DataTableProps<T>) {
  const selectable = !!onSelectedChange;
  const template = [
    selectable && SELECT_TRACK,
    ...columns.map((column) => column.width ?? 'minmax(120px, 1fr)'),
  ]
    .filter(Boolean)
    .join(' ');
  const gridStyle = { gridTemplateColumns: template } as CSSProperties;
  const allSelected = rows.length > 0 && rows.every((row) => selected?.has(getRowId(row)));
  const someSelected = !allSelected && rows.some((row) => selected?.has(getRowId(row)));

  const toggleAll = () => onSelectedChange?.(allSelected ? new Set() : new Set(rows.map(getRowId)));

  const toggleRow = (id: string) => {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    onSelectedChange?.(next);
  };

  const scrollRef = useRef<HTMLDivElement>(null);
  // eslint-disable-next-line react-hooks/incompatible-library
  const virtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => rowHeight,
    overscan: 12,
  });

  const table = (
    <div
      ref={scrollRef}
      role="table"
      aria-label={label}
      aria-rowcount={rows.length}
      style={{ maxHeight }}
      className={cn(
        'relative overflow-auto rounded-card border border-border bg-surface scrollbar-thin',
        renderMobile && 'max-md:hidden',
      )}
    >
      <div className="min-w-max">
        <div
          role="row"
          style={gridStyle}
          className="sticky top-0 z-10 grid h-10 items-center border-b border-border bg-surface-muted/95 text-xs font-semibold tracking-wide text-muted uppercase backdrop-blur"
        >
          {selectable && (
            <div role="columnheader" className="flex justify-center">
              <Checkbox
                checked={allSelected ? true : someSelected ? 'indeterminate' : false}
                onCheckedChange={toggleAll}
                aria-label="Select all"
              />
            </div>
          )}
          {columns.map((column) => (
            <div
              key={column.id}
              role="columnheader"
              aria-sort={sort?.id === column.id ? (sort.desc ? 'descending' : 'ascending') : undefined}
              className={cn('flex px-3', ALIGN[column.align ?? 'start'])}
            >
              {column.sortable && onSortChange ? (
                <button
                  type="button"
                  onClick={() => onSortChange(nextSort(sort, column.id))}
                  className="inline-flex cursor-pointer items-center gap-1 uppercase hover:text-text"
                >
                  {column.header}
                  {sort?.id === column.id ? (
                    sort.desc ? (
                      <ArrowDown className="size-3.5" />
                    ) : (
                      <ArrowUp className="size-3.5" />
                    )
                  ) : (
                    <ChevronsUpDown className="size-3.5 opacity-40" />
                  )}
                </button>
              ) : (
                column.header
              )}
            </div>
          ))}
        </div>
        {loading && (
          <div className="flex flex-col gap-2 p-3">
            <Skeleton className="h-9" count={6} />
          </div>
        )}
        {!loading && rows.length === 0 && empty}
        {!loading && rows.length > 0 && (
          <div className="relative" style={{ height: virtualizer.getTotalSize() }}>
            {virtualizer.getVirtualItems().map((item) => {
              const row = rows[item.index]!;
              const id = getRowId(row);
              return (
                <div
                  key={id}
                  role="row"
                  aria-selected={selected?.has(id) || undefined}
                  data-active={activeRowId === id || undefined}
                  onClick={() => onRowClick?.(row)}
                  style={{ ...gridStyle, height: item.size, transform: `translateY(${item.start}px)` }}
                  className={cn(
                    'group absolute inset-x-0 top-0 grid items-center border-b border-border/70 text-sm transition-colors hover:bg-surface-muted/60 aria-selected:bg-accent-soft/60 data-[active]:bg-accent-soft',
                    onRowClick && 'cursor-pointer',
                  )}
                >
                  {selectable && (
                    <div
                      role="cell"
                      className="flex justify-center"
                      onClick={(event) => event.stopPropagation()}
                    >
                      <Checkbox
                        checked={!!selected?.has(id)}
                        onCheckedChange={() => toggleRow(id)}
                        aria-label={`Select ${getRowLabel?.(row) ?? 'row'}`}
                      />
                    </div>
                  )}
                  {columns.map((column) => (
                    <div
                      key={column.id}
                      role="cell"
                      className={cn(
                        'flex min-w-0 items-center px-3',
                        ALIGN[column.align ?? 'start'],
                        column.className,
                      )}
                    >
                      {column.cell(row)}
                    </div>
                  ))}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );

  return (
    <div className={cn('flex flex-col gap-2', className)}>
      {table}
      {renderMobile && (
        <div className="flex flex-col gap-2 md:hidden">
          {loading && <Skeleton className="h-20" count={4} />}
          {!loading && rows.length === 0 && empty}
          {!loading && rows.map((row) => <div key={getRowId(row)}>{renderMobile(row)}</div>)}
        </div>
      )}
      {footer}
    </div>
  );
}
