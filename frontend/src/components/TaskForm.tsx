import React, { useState, useEffect } from 'react';
import { Task, CreateTaskPayload, UpdateTaskPayload } from '../types/task';
import { tasksApi } from '../api/tasks';

interface TaskFormProps {
  mode: 'create' | 'edit';
  task?: Task | null;
  onCancel: () => void;
  onSuccess: (savedTask: Task) => void;
}

export const TaskForm: React.FC<TaskFormProps> = ({
  mode,
  task,
  onCancel,
  onSuccess,
}) => {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [validationError, setValidationError] = useState<string | null>(null);
  const [apiError, setApiError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (mode === 'edit' && task) {
      setTitle(task.title || '');
      setDescription(task.description || '');
    } else {
      setTitle('');
      setDescription('');
    }
    setValidationError(null);
    setApiError(null);
  }, [mode, task]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const trimmedTitle = title.trim();
    if (!trimmedTitle) {
      setValidationError('Title is required and cannot be empty.');
      return;
    }

    setValidationError(null);
    setApiError(null);
    setIsSubmitting(true);

    try {
      if (mode === 'create') {
        const payload: CreateTaskPayload = {
          title: trimmedTitle,
          description: description.trim(),
        };
        const created = await tasksApi.createTask(payload);
        onSuccess(created);
      } else if (mode === 'edit' && task) {
        const payload: UpdateTaskPayload = {
          title: trimmedTitle,
          description: description.trim(),
        };
        const updated = await tasksApi.updateTask(task.id, payload);
        onSuccess(updated);
      }
    } catch (err: any) {
      setApiError(err?.message || 'Request failed. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="w-full max-w-2xl space-y-5">
      <div className="flex items-center justify-between pb-3 border-b border-neutral-200">
        <h2 className="text-xl font-bold text-neutral-900">
          {mode === 'create' ? 'Create Task' : 'Edit Task'}
        </h2>
        <button
          type="button"
          onClick={onCancel}
          disabled={isSubmitting}
          className="text-xs sm:text-sm text-neutral-600 hover:text-neutral-900 underline cursor-pointer"
        >
          Cancel
        </button>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Title */}
        <div>
          <label htmlFor="task-title" className="block text-sm font-semibold text-neutral-800 mb-1.5">
            Title <span className="text-red-500">*</span>
          </label>
          <input
            id="task-title"
            type="text"
            required
            value={title}
            onChange={(e) => {
              setTitle(e.target.value);
              if (validationError) setValidationError(null);
            }}
            placeholder="e.g. Implement user profile workflow"
            className="w-full px-3.5 py-2 text-sm border border-neutral-300 rounded focus:outline-none focus:ring-1 focus:ring-neutral-900 focus:border-neutral-900"
            disabled={isSubmitting}
            autoFocus
          />
          {validationError && (
            <p className="text-xs text-red-600 mt-1">{validationError}</p>
          )}
        </div>

        {/* Description */}
        <div>
          <label htmlFor="task-description" className="block text-sm font-semibold text-neutral-800 mb-1.5">
            Description <span className="text-neutral-400 font-normal text-xs">(optional)</span>
          </label>
          <textarea
            id="task-description"
            rows={5}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Detailed description of the task..."
            className="w-full px-3.5 py-2 text-sm border border-neutral-300 rounded focus:outline-none focus:ring-1 focus:ring-neutral-900 focus:border-neutral-900"
            disabled={isSubmitting}
          />
        </div>

        {/* API Error Message */}
        {apiError && (
          <div className="p-3 bg-red-50 border border-red-200 rounded text-xs text-red-700">
            {apiError}
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex items-center gap-3 pt-2">
          <button
            type="submit"
            disabled={isSubmitting}
            className="px-5 py-2 text-sm font-medium text-white bg-neutral-900 hover:bg-neutral-800 active:scale-[0.99] disabled:opacity-50 rounded transition-all cursor-pointer"
          >
            {isSubmitting ? 'Saving...' : mode === 'create' ? 'Create Task' : 'Save Changes'}
          </button>
          <button
            type="button"
            onClick={onCancel}
            disabled={isSubmitting}
            className="px-4 py-2 text-sm font-medium text-neutral-700 hover:text-neutral-900 border border-neutral-300 hover:bg-neutral-50 rounded transition-colors cursor-pointer"
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
};
