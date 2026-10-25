import {
  closestCorners,
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  type Announcements,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
  type UniqueIdentifier,
} from '@dnd-kit/core';
import { arrayMove } from '@dnd-kit/sortable';
import { useQueryClient } from '@tanstack/react-query';
import { generateKeyBetween } from 'fractional-indexing';
import { ChevronDown, KanbanSquare } from 'lucide-react';
import { useMemo, useState, type CSSProperties } from 'react';
import { toast } from 'sonner';
import type { Workflow } from '@msr/shared/enums';
import type { BoardColumn, ProjectDetail, TaskCard } from '@msr/shared/types';
import { EmptyState } from '../../../components/ui/EmptyState';
import { ErrorState } from '../../../components/ui/ErrorState';
import { Skeleton } from '../../../components/ui/Skeleton';
import type { FilterValues } from '../../../hooks/useUrlFilters';
import { errorMessage } from '../../../lib/api';
import { cn } from '../../../lib/cn';
import { useProjectPermissions } from '../../projects/useProjectPermissions';
import { fetchBoardColumn, taskKeys, useBoard, useUpdateTask } from '../api';
import { TaskCardView } from '../components/TaskCardView';
import { BoardCell } from './BoardCell';
import { boardKeyboardCoordinates } from './boardKeyboardCoordinates';
import { groupTasks, laneKeyOf, type GroupBy, type Lane } from './groupTasks';

interface TaskBoardViewProps {
  project: ProjectDetail;
  workflow: Workflow;
  filters: FilterValues;
  groupBy: GroupBy;
  onOpen: (task: TaskCard) => void;
}

type Containers = Record<string, string[]>;

const KEYBOARD_CODES = { start: ['Space'], cancel: ['Escape'], end: ['Space', 'Enter'] };
const SCREEN_READER_INSTRUCTIONS = {
  draggable:
    'Press Enter to open this task. To move it, press Space, use the arrow keys to change column or position, then press Space or Enter to drop it, or Escape to cancel.',
};
const SEPARATOR = '|';
const containerId = (laneKey: string, statusId: string) => `${laneKey}${SEPARATOR}${statusId}`;
const parseContainer = (id: string) => {
  const [laneKey, statusId] = id.split(SEPARATOR);
  return { laneKey: laneKey!, statusId: statusId! };
};

const positionBetween = (previous: string | null, next: string | null) => {
  try {
    return generateKeyBetween(previous, next);
  } catch {
    return generateKeyBetween(previous, null);
  }
};

export function TaskBoardView({ project, workflow, filters, groupBy, onOpen }: TaskBoardViewProps) {
  const findContainer = (containers: Containers, id: string) =>
    id in containers ? id : Object.keys(containers).find((key) => containers[key]!.includes(id));

  const taskName = (id: UniqueIdentifier) => {
    const task = taskById.get(String(id));
    return task ? `${task.identifier}: ${task.title}` : 'Task';
  };

  const placeName = (id: UniqueIdentifier) => {
    const container = findContainer(containers, String(id));
    if (!container) return 'the board';
    const { laneKey, statusId } = parseContainer(container);
    const status = statuses.find((item) => item.id === statusId)?.name ?? 'a column';
    const lane = groupBy === 'none' ? null : lanes.find((item) => item.key === laneKey)?.label;
    return lane ? `${status}, ${lane}` : status;
  };

  const announcements: Announcements = {
    onDragStart: ({ active }) => `Picked up ${taskName(active.id)}.`,
    onDragOver: ({ active, over }) =>
      over
        ? `${taskName(active.id)} is over ${placeName(over.id)}.`
        : `${taskName(active.id)} is not over a column.`,
    onDragEnd: ({ active, over }) =>
      over
        ? `${taskName(active.id)} dropped in ${placeName(over.id)}.`
        : `${taskName(active.id)} was not moved.`,
    onDragCancel: ({ active }) => `Moving ${taskName(active.id)} was cancelled.`,
  };

  const handleDragStart = ({ active }: DragStartEvent) => {
    setActiveId(String(active.id));
    setDragContainers(baseContainers);
  };

  const handleDragOver = ({ active, over }: DragOverEvent) => {
    if (!over || !dragContainers) return;
    const from = findContainer(dragContainers, String(active.id));
    const to = findContainer(dragContainers, String(over.id));
    if (!from || !to || from === to) return;
    if (groupBy === 'label' && parseContainer(from).laneKey !== parseContainer(to).laneKey) return;
    const target = dragContainers[to]!;
    const overIndex = target.indexOf(String(over.id));
    const index = overIndex >= 0 ? overIndex : target.length;
    setDragContainers({
      ...dragContainers,
      [from]: dragContainers[from]!.filter((id) => id !== active.id),
      [to]: [...target.slice(0, index), String(active.id), ...target.slice(index)],
    });
  };

  const handleDragEnd = ({ active, over }: DragEndEvent) => {
    const containers = dragContainers;
    setActiveId(null);
    setDragContainers(null);
    if (!over || !containers) return;
    const id = String(active.id);
    const to = findContainer(containers, String(over.id));
    if (!to) return;
    let list = containers[to]!;
    const overIndex = list.indexOf(String(over.id));
    if (list.includes(id) && overIndex >= 0) list = arrayMove(list, list.indexOf(id), overIndex);
    const index = list.indexOf(id);
    const previous = taskById.get(list[index - 1] ?? '') ?? null;
    const next = taskById.get(list[index + 1] ?? '') ?? null;
    const task = taskById.get(id)!;
    const { laneKey, statusId } = parseContainer(to);
    const lane = lanes.find((item) => item.key === laneKey);
    const status = project.statuses.find((item) => item.id === statusId)!;
    const laneChanged = laneKey !== laneKeyOf(task, groupBy);
    const unchanged =
      statusId === task.statusId &&
      !laneChanged &&
      previous?.id === neighbors(task).previous &&
      next?.id === neighbors(task).next;
    if (unchanged) return;
    const position = positionBetween(previous?.position ?? null, next?.position ?? null);
    update.mutate(
      {
        id,
        patch: {
          ...(statusId !== task.statusId && { statusId }),
          position,
          ...(laneChanged && lane?.patch?.input),
        },
        optimistic: {
          statusId,
          statusCategory: status.category,
          position,
          ...(laneChanged && lane?.patch?.optimistic),
        },
      },
      { onError: (error) => toast.error(errorMessage(error)) },
    );
  };

  const loadMore = async (column: BoardColumn) => {
    setLoadingColumn(column.statusId);
    try {
      const more = await fetchBoardColumn(
        project.key,
        workflow,
        filters,
        column.statusId,
        column.tasks.length,
      );
      client.setQueryData<BoardColumn[]>(taskKeys.board(project.key, workflow, filters), (columns) =>
        columns?.map((item) =>
          item.statusId === column.statusId ? { ...item, tasks: [...item.tasks, ...more.tasks] } : item,
        ),
      );
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setLoadingColumn(null);
    }
  };

  const toggleLane = (key: string) => setCollapsed((current) => ({ ...current, [key]: !current[key] }));

  const neighbors = (task: TaskCard) => {
    const list = baseContainers[containerId(laneKeyOf(task, groupBy), task.statusId)] ?? [];
    const index = list.indexOf(task.id);
    return { previous: list[index - 1], next: list[index + 1] };
  };

  const renderLane = (lane: Lane) =>
    statuses.map((status) => {
      const column = columns.find((item) => item.statusId === status.id);
      const id = containerId(lane.key, status.id);
      return (
        <BoardCell
          key={id}
          id={id}
          label={groupBy === 'none' ? status.name : `${status.name}, ${lane.label}`}
          projectKey={project.key}
          tasks={(containers[id] ?? []).map((taskId) => taskById.get(taskId)!).filter(Boolean)}
          hiddenCount={groupBy === 'none' && column ? column.total - column.tasks.length : 0}
          loadingMore={loadingColumn === status.id}
          onLoadMore={column ? () => loadMore(column) : undefined}
          dragDisabled={!canDrag}
          onOpen={onOpen}
          composer={
            canCreate
              ? { statusId: status.id, type: workflow === 'bug' ? 'bug' : 'task', ...lane.patch?.input }
              : null
          }
        />
      );
    });

  const client = useQueryClient();
  const permissions = useProjectPermissions(project);
  const update = useUpdateTask();
  const board = useBoard(project.key, workflow, filters);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [dragContainers, setDragContainers] = useState<Containers | null>(null);
  const [loadingColumn, setLoadingColumn] = useState<string | null>(null);
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 250, tolerance: 8 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: boardKeyboardCoordinates,
      keyboardCodes: KEYBOARD_CODES,
    }),
  );
  const statuses = useMemo(
    () => project.statuses.filter((status) => status.workflow === workflow),
    [project.statuses, workflow],
  );
  const columns = useMemo(() => board.data ?? [], [board.data]);
  const allTasks = useMemo(() => columns.flatMap((column) => column.tasks), [columns]);
  const taskById = useMemo(() => new Map(allTasks.map((task) => [task.id, task])), [allTasks]);
  const lanes = useMemo(() => groupTasks(allTasks, groupBy, project), [allTasks, groupBy, project]);
  const baseContainers = useMemo(() => {
    const result: Containers = {};
    for (const lane of lanes)
      for (const status of statuses)
        result[containerId(lane.key, status.id)] = lane.tasks
          .filter((task) => task.statusId === status.id)
          .map((task) => task.id);
    return result;
  }, [lanes, statuses]);
  const containers = dragContainers ?? baseContainers;
  const canDrag = permissions.can('task.transition');
  const canCreate = permissions.can('task.create');

  if (board.error) return <ErrorState error={board.error} onRetry={board.refetch} />;
  if (board.isPending)
    return (
      <div className="flex gap-4 overflow-hidden">
        {statuses.map((status) => (
          <div key={status.id} className="flex w-72 shrink-0 flex-col gap-3">
            <Skeleton className="h-8" />
            <Skeleton className="h-28" count={3} />
          </div>
        ))}
      </div>
    );

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      accessibility={{ announcements, screenReaderInstructions: SCREEN_READER_INSTRUCTIONS }}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
      onDragCancel={() => setDragContainers(null)}
    >
      <div className="-mx-4 overflow-x-auto px-4 pb-4 scrollbar-thin max-md:snap-x max-md:snap-mandatory md:-mx-6 md:px-6">
        <div className="flex w-max flex-col gap-3">
          <div className="sticky top-0 z-10 flex gap-4 bg-app/90 py-1 backdrop-blur">
            {statuses.map((status) => {
              const column = columns.find((item) => item.statusId === status.id);
              return (
                <div
                  key={status.id}
                  style={{ '--c': status.color } as CSSProperties}
                  className="flex w-72 shrink-0 items-center gap-2 border-b-[3px] border-(--c) px-1 pb-2 max-md:w-[82vw]"
                >
                  <span className="truncate text-xs font-bold tracking-wide uppercase tint">
                    {status.name}
                  </span>
                  <span className="text-xs text-subtle tabular-nums">{column?.total ?? 0}</span>
                </div>
              );
            })}
          </div>
          {allTasks.length === 0 && !canCreate && (
            <EmptyState icon={<KanbanSquare />} title="Nothing on this board yet" />
          )}
          {lanes.map((lane) =>
            groupBy === 'none' ? (
              <div key={lane.key} className="flex gap-4">
                {renderLane(lane)}
              </div>
            ) : (
              <section key={lane.key} className="flex flex-col gap-2">
                <button
                  type="button"
                  onClick={() => toggleLane(lane.key)}
                  className="sticky left-0 flex w-fit cursor-pointer items-center gap-2 text-sm font-semibold tracking-wide uppercase"
                >
                  <ChevronDown
                    className={cn(
                      'size-4 text-accent-text transition-transform',
                      collapsed[lane.key] && '-rotate-90',
                    )}
                  />
                  {lane.icon}
                  {lane.label}
                  <span className="text-xs font-normal text-subtle">{lane.tasks.length}</span>
                </button>
                {!collapsed[lane.key] && <div className="flex gap-4">{renderLane(lane)}</div>}
              </section>
            ),
          )}
        </div>
      </div>
      <DragOverlay>
        {activeId && taskById.get(activeId) ? (
          <TaskCardView task={taskById.get(activeId)!} dragging className="w-72 cursor-grabbing" />
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}
