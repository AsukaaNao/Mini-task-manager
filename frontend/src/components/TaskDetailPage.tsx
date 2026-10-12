import React, { useEffect, useState, useCallback } from 'react';
import { Task, NEXT_STATUS_MAP } from '../types/task';
import { tasksApi } from '../api/tasks';
import { StatusBadge } from './StatusBadge';
import { AuditTimeline } from './AuditTimeline';

interface TaskDetailPageProps {
  taskId: string;
  currentUser: string;
  onBack: () => void;
  onEdit: (task: Task) => void;
  onTaskDeleted: (taskId: string) => void;
}

export const TaskDetailPage: React.FC<TaskDetailPageProps> = ({
  taskId,
  currentUser,
  onBack,
  onEdit,
  onTaskDeleted,
}) => {
  const [task, setTask] = useState<Task | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [transitionError, setTransitionError] = useState<string | null>(null);
  const [isTransitioning, setIsTransitioning] = useState<boolean>(false);
  const [isDeleting, setIsDeleting] = useState<boolean>(false);
  const [confirmDelete, setConfirmDelete] = useState<boolean>(false);
  const [copiedId, setCopiedId] = useState<boolean>(false);
  const [auditTrigger, setAuditTrigger] = useState<number>(0);

  const fetchTask = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await tasksApi.getTaskById(taskId);
      setTask(data);
    } catch (err: any) {
      setError(err?.message || 'Failed to fetch task details.');
    } finally {
      setIsLoading(false);
    }
  }, [taskId]);

  useEffect(() => {
    fetchTask();
  }, [fetchTask]);

  const handleCopyId = () => {
    if (task) {
      navigator.clipboard.writeText(task.id);
      setCopiedId(true);
      setTimeout(() => setCopiedId(false), 2000);
    }
  };

  const handleTransition = async () => {
    if (!task) return;
    const nextStatus = NEXT_STATUS_MAP[task.status];
    if (!nextStatus) return;

    setIsTransitioning(true);
    setTransitionError(null);
    try {
      const updated = await tasksApi.transitionTaskStatus(task.id, {
        status: nextStatus,
        actor: currentUser,
      });
      setTask(updated);
      setAuditTrigger((prev) => prev + 1);
    } catch (err: any) {
      setTransitionError(err?.message || 'Failed to transition status.');
    } finally {
      setIsTransitioning(false);
    }
  };

  const handleDelete = async () => {
    if (!task) return;
    setIsDeleting(true);
    try {
      await tasksApi.deleteTask(task.id);
      onTaskDeleted(task.id);
    } catch (err: any) {
      alert(err?.message || 'Failed to delete task.');
      setIsDeleting(false);
    }
  };

  if (isLoading) {
    return <p className="text-sm text-neutral-500 py-8">Loading task details from database...</p>;
  }

  if (error || !task) {
    return (
      <div className="space-y-4 py-4">
        <p className="text-sm text-red-600">Error: {error || 'Task not found.'}</p>
        <button
          type="button"
          onClick={onBack}
          className="px-3 py-1.5 text-xs font-medium text-neutral-700 hover:text-neutral-900 border border-neutral-300 rounded hover:bg-neutral-50 transition-colors cursor-pointer"
        >
          ← Back to tasks
        </button>
      </div>
    );
  }

  const nextStatus = NEXT_STATUS_MAP[task.status];

  return (
    <div className="w-full space-y-6">
      {/* Top Navigation & Action Controls Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-neutral-200">
        <button
          type="button"
          onClick={onBack}
          className="px-3 py-1.5 text-xs sm:text-sm font-medium text-neutral-700 hover:text-neutral-900 border border-neutral-300 hover:bg-neutral-50 rounded transition-colors cursor-pointer flex items-center gap-1.5"
        >
          <span>← Back to tasks</span>
        </button>

        <div className="flex items-center gap-2">
          {confirmDelete ? (
            <div className="flex items-center gap-2 bg-red-50 border border-red-200 px-3 py-1 rounded text-xs">
              <span className="text-red-800 font-medium">Delete task?</span>
              <button
                type="button"
                disabled={isDeleting}
                onClick={handleDelete}
                className="px-2.5 py-1 text-xs font-semibold text-white bg-red-600 hover:bg-red-700 rounded transition-colors cursor-pointer"
              >
                {isDeleting ? 'Deleting...' : 'Confirm'}
              </button>
              <button
                type="button"
                disabled={isDeleting}
                onClick={() => setConfirmDelete(false)}
                className="px-2 py-1 text-xs text-neutral-600 hover:text-neutral-900 border border-neutral-300 bg-white hover:bg-neutral-100 rounded transition-colors cursor-pointer"
              >
                Cancel
              </button>
            </div>
          ) : (
            <>
              <button
                type="button"
                onClick={() => onEdit(task)}
                className="px-3 py-1.5 text-xs sm:text-sm font-medium text-neutral-700 hover:text-neutral-900 border border-neutral-300 hover:bg-neutral-50 rounded transition-colors cursor-pointer"
              >
                Edit
              </button>
              <button
                type="button"
                onClick={() => setConfirmDelete(true)}
                className="px-3 py-1.5 text-xs sm:text-sm font-medium text-red-600 hover:text-red-700 hover:bg-red-50 border border-red-200 rounded transition-colors cursor-pointer"
              >
                Delete
              </button>
            </>
          )}
        </div>
      </div>

      {/* Task ID, Owner & Status Row */}
      <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-neutral-500">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5">
            <span>Task ID:</span>
            <button
              type="button"
              onClick={handleCopyId}
              className="font-mono bg-neutral-100 hover:bg-neutral-200 text-neutral-800 px-2 py-0.5 rounded border border-neutral-200 transition-colors cursor-pointer"
              title="Click to copy task ID"
            >
              {task.id} {copiedId && <span className="text-emerald-600 font-sans font-semibold ml-1">Copied!</span>}
            </button>
          </div>

          <div className="flex items-center gap-1.5">
            <span>Created by:</span>
            <span className="font-mono bg-neutral-100 text-neutral-800 px-2 py-0.5 rounded border border-neutral-200">
              {task.user_id || 'anonymous'}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2 text-sm">
          <span className="text-neutral-500 text-xs">Current status:</span>
          <StatusBadge status={task.status} />
        </div>
      </div>

      {/* Task Title */}
      <div>
        <h1 className="text-2xl font-bold text-neutral-900 leading-tight">
          {task.title}
        </h1>
      </div>

      {/* Task Description */}
      <div>
        <h3 className="text-xs font-semibold text-neutral-500 uppercase tracking-wider mb-1.5">
          Description
        </h3>
        {task.description ? (
          <div className="text-sm text-neutral-800 whitespace-pre-wrap leading-relaxed bg-neutral-50 p-4 rounded-lg border border-neutral-200">
            {task.description}
          </div>
        ) : (
          <p className="text-sm text-neutral-400 italic">No description provided.</p>
        )}
      </div>

      {/* Status Workflow Action */}
      <div className="pt-4 border-t border-neutral-200">
        <h3 className="text-xs font-semibold text-neutral-500 uppercase tracking-wider mb-2">
          Status Progression
        </h3>
        <div className="flex items-center gap-3">
          {nextStatus ? (
            <button
              type="button"
              onClick={handleTransition}
              disabled={isTransitioning}
              className="px-4 py-2 text-sm font-medium text-white bg-neutral-900 hover:bg-neutral-800 active:scale-[0.99] rounded transition-all cursor-pointer disabled:opacity-50 flex items-center gap-2"
            >
              <span>{isTransitioning ? 'Advancing status...' : `Advance to ${nextStatus} as ${currentUser}`}</span>
              <span aria-hidden="true">→</span>
            </button>
          ) : (
            <p className="text-sm text-neutral-500">
              Terminal status reached (<span className="font-mono text-neutral-700">done</span>). No further transitions permitted.
            </p>
          )}
        </div>

        {transitionError && (
          <p className="text-xs text-red-600 mt-2">{transitionError}</p>
        )}
      </div>

      {/* Audit Log Section */}
      <div className="pt-6 border-t border-neutral-200">
        <h3 className="text-xs font-semibold text-neutral-500 uppercase tracking-wider mb-3">
          Audit History
        </h3>
        <AuditTimeline taskId={task.id} refreshTrigger={auditTrigger} />
      </div>
    </div>
  );
};
