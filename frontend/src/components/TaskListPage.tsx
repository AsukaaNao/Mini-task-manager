import React, { useState, useMemo } from 'react';
import { Task, TaskStatus, User } from '../types/task';
import { StatusBadge } from './StatusBadge';
import { tasksApi } from '../api/tasks';

interface TaskListPageProps {
  tasks: Task[];
  users: User[];
  currentUser: string;
  isLoading: boolean;
  error: string | null;
  onRefresh: () => void;
  onViewDetails: (taskId: string) => void;
  onOpenCreate: () => void;
  onOpenEdit: (task: Task) => void;
  onTaskDeleted: (taskId: string) => void;
}

const STATUS_FILTERS: Array<{ id: 'all' | TaskStatus; label: string }> = [
  { id: 'all', label: 'All' },
  { id: 'to_do', label: 'to_do' },
  { id: 'pending', label: 'pending' },
  { id: 'in_progress', label: 'in_progress' },
  { id: 'done', label: 'done' },
];

export const TaskListPage: React.FC<TaskListPageProps> = ({
  tasks,
  users,
  currentUser,
  isLoading,
  error,
  onRefresh,
  onViewDetails,
  onOpenCreate,
  onOpenEdit,
  onTaskDeleted,
}) => {
  const [selectedStatusFilter, setSelectedStatusFilter] = useState<'all' | TaskStatus>('all');
  const [selectedUserFilter, setSelectedUserFilter] = useState<string>('all');
  const [deletingTaskId, setDeletingTaskId] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState<boolean>(false);

  // Filter tasks by status and user
  const filteredTasks = useMemo(() => {
    return tasks.filter((task) => {
      const matchStatus = selectedStatusFilter === 'all' || task.status === selectedStatusFilter;
      const matchUser = selectedUserFilter === 'all' || (task.user_id || 'anonymous') === selectedUserFilter;
      return matchStatus && matchUser;
    });
  }, [tasks, selectedStatusFilter, selectedUserFilter]);

  // Counts for status filters
  const statusCounts = useMemo(() => {
    const counts: Record<string, number> = {
      all: tasks.length,
      to_do: 0,
      pending: 0,
      in_progress: 0,
      done: 0,
    };
    tasks.forEach((t) => {
      if (counts[t.status] !== undefined) {
        counts[t.status]++;
      }
    });
    return counts;
  }, [tasks]);

  const handleDelete = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    setIsDeleting(true);
    setDeleteError(null);
    try {
      await tasksApi.deleteTask(id);
      onTaskDeleted(id);
      setDeletingTaskId(null);
    } catch (err: any) {
      setDeleteError(err?.message || 'Failed to delete task.');
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="w-full space-y-5">
      {/* Top Filter and Controls Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        {/* Status Filter Chips */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
          {STATUS_FILTERS.map((filter) => {
            const count = statusCounts[filter.id] ?? 0;
            const isActive = selectedStatusFilter === filter.id;
            return (
              <button
                key={filter.id}
                type="button"
                onClick={() => setSelectedStatusFilter(filter.id)}
                className={`px-3 py-1.5 text-xs font-medium rounded transition-colors cursor-pointer select-none whitespace-nowrap flex items-center gap-1.5 ${
                  isActive
                    ? 'bg-neutral-900 text-white'
                    : 'bg-neutral-100 hover:bg-neutral-200 text-neutral-700'
                }`}
              >
                <span>{filter.label}</span>
                <span className={`text-[11px] font-mono opacity-80 ${isActive ? 'text-neutral-300' : 'text-neutral-500'}`}>
                  ({count})
                </span>
              </button>
            );
          })}
        </div>

        {/* User Filter Dropdown & Refresh */}
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 text-xs text-neutral-600 border border-neutral-300 rounded px-2.5 py-1 bg-white">
            <span className="text-neutral-400">Filter User:</span>
            <select
              value={selectedUserFilter}
              onChange={(e) => setSelectedUserFilter(e.target.value)}
              className="bg-transparent font-medium text-neutral-800 focus:outline-none cursor-pointer"
            >
              <option value="all">All Users ({tasks.length})</option>
              {users.map((u) => {
                const count = tasks.filter((t) => (t.user_id || 'anonymous') === u.id).length;
                return (
                  <option key={u.id} value={u.id}>
                    {u.name} ({count})
                  </option>
                );
              })}
            </select>
          </div>

          <button
            type="button"
            onClick={onRefresh}
            disabled={isLoading}
            className="px-3 py-1 text-xs text-neutral-600 hover:text-neutral-900 hover:bg-neutral-100 border border-neutral-300 rounded transition-colors cursor-pointer disabled:opacity-50"
            title="Refresh tasks"
          >
            Refresh
          </button>
        </div>
      </div>

      {/* Global Error Banner */}
      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded text-sm text-red-700 flex items-center justify-between">
          <span>Error loading tasks: {error}</span>
          <button
            type="button"
            onClick={onRefresh}
            className="underline font-medium text-xs cursor-pointer ml-4"
          >
            Retry
          </button>
        </div>
      )}

      {/* Delete Error Message */}
      {deleteError && (
        <div className="p-2.5 bg-red-50 border border-red-200 rounded text-xs text-red-700">
          Delete failed: {deleteError}
        </div>
      )}

      {/* Loading state */}
      {isLoading && (
        <p className="text-sm text-neutral-500 py-8">Loading tasks from JSON database...</p>
      )}

      {/* Empty State: 0 total tasks */}
      {!isLoading && !error && tasks.length === 0 && (
        <div className="py-12 text-center border border-dashed border-neutral-200 rounded-lg">
          <p className="text-sm text-neutral-500 mb-3">No tasks exist in the database.</p>
          <button
            type="button"
            onClick={onOpenCreate}
            className="px-4 py-2 text-xs font-medium text-white bg-neutral-900 hover:bg-neutral-800 rounded cursor-pointer"
          >
            Create your first task as {currentUser}
          </button>
        </div>
      )}

      {/* Filter returned 0 results */}
      {!isLoading && !error && tasks.length > 0 && filteredTasks.length === 0 && (
        <div className="py-8 text-center text-sm text-neutral-500">
          No tasks found matching current filters.{' '}
          <button
            type="button"
            onClick={() => {
              setSelectedStatusFilter('all');
              setSelectedUserFilter('all');
            }}
            className="text-neutral-900 underline font-medium cursor-pointer"
          >
            Clear filters
          </button>
        </div>
      )}

      {/* Tasks Table */}
      {!isLoading && filteredTasks.length > 0 && (
        <div className="w-full border border-neutral-200 rounded-lg overflow-hidden bg-white">
          {/* Table Header */}
          <div className="grid grid-cols-12 px-4 py-2.5 bg-neutral-50 border-b border-neutral-200 text-xs font-semibold text-neutral-600 uppercase tracking-wider select-none">
            <div className="col-span-6 sm:col-span-7">Task Title</div>
            <div className="col-span-2 sm:col-span-2">User / Actor</div>
            <div className="col-span-2 sm:col-span-1">Status</div>
            <div className="col-span-2 sm:col-span-2 text-right">Actions</div>
          </div>

          {/* Table Rows: Each row is completely clickable */}
          <div className="divide-y divide-neutral-200">
            {filteredTasks.map((task) => (
              <div
                key={task.id}
                role="button"
                tabIndex={0}
                onClick={() => onViewDetails(task.id)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    onViewDetails(task.id);
                  }
                }}
                className="grid grid-cols-12 px-4 py-3.5 items-center hover:bg-neutral-50/80 active:bg-neutral-100/60 transition-colors cursor-pointer group focus:outline-none focus:bg-neutral-50"
              >
                {/* Title */}
                <div className="col-span-6 sm:col-span-7 pr-3 min-w-0">
                  <span className="font-medium text-sm text-neutral-900 group-hover:text-blue-600 group-hover:underline block truncate transition-colors">
                    {task.title}
                  </span>
                  {task.description && (
                    <span className="text-xs text-neutral-500 block truncate mt-0.5">
                      {task.description}
                    </span>
                  )}
                </div>

                {/* User / Actor */}
                <div className="col-span-2 sm:col-span-2">
                  <span className="text-xs font-mono text-neutral-600 bg-neutral-100 px-2 py-0.5 rounded border border-neutral-200">
                    {task.user_id || 'anonymous'}
                  </span>
                </div>

                {/* Status */}
                <div className="col-span-2 sm:col-span-1">
                  <StatusBadge status={task.status} />
                </div>

                {/* Actions */}
                <div
                  className="col-span-2 sm:col-span-2 text-right text-xs"
                  onClick={(e) => e.stopPropagation()}
                >
                  {deletingTaskId === task.id ? (
                    <div className="inline-flex items-center gap-1.5">
                      <button
                        type="button"
                        disabled={isDeleting}
                        onClick={(e) => handleDelete(e, task.id)}
                        className="px-2 py-1 text-xs font-medium text-white bg-red-600 hover:bg-red-700 rounded transition-colors cursor-pointer"
                      >
                        {isDeleting ? 'Deleting...' : 'Confirm'}
                      </button>
                      <button
                        type="button"
                        disabled={isDeleting}
                        onClick={(e) => {
                          e.stopPropagation();
                          setDeletingTaskId(null);
                        }}
                        className="px-2 py-1 text-xs text-neutral-600 hover:text-neutral-900 border border-neutral-300 hover:bg-neutral-100 rounded transition-colors cursor-pointer"
                      >
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <div className="inline-flex items-center gap-1">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onViewDetails(task.id);
                        }}
                        className="px-2 py-1 text-neutral-600 hover:text-neutral-900 hover:bg-neutral-100 rounded transition-colors cursor-pointer"
                      >
                        View
                      </button>
                      <span className="text-neutral-300">|</span>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onOpenEdit(task);
                        }}
                        className="px-2 py-1 text-neutral-600 hover:text-neutral-900 hover:bg-neutral-100 rounded transition-colors cursor-pointer"
                      >
                        Edit
                      </button>
                      <span className="text-neutral-300">|</span>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setDeletingTaskId(task.id);
                        }}
                        className="px-2 py-1 text-red-600 hover:text-red-800 hover:bg-red-50 rounded transition-colors cursor-pointer"
                      >
                        Delete
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
