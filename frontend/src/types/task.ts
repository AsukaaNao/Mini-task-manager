export type TaskStatus = 'to_do' | 'pending' | 'in_progress' | 'done';

export const TASK_STATUSES: TaskStatus[] = ['to_do', 'pending', 'in_progress', 'done'];

export const STATUS_LABELS: Record<TaskStatus, string> = {
  to_do: 'To Do',
  pending: 'Pending',
  in_progress: 'In Progress',
  done: 'Done',
};

export const NEXT_STATUS_MAP: Record<TaskStatus, TaskStatus | null> = {
  to_do: 'pending',
  pending: 'in_progress',
  in_progress: 'done',
  done: null,
};

export interface User {
  id: string;
  name: string;
  email?: string;
}

export interface Task {
  id: string;
  user_name: string;
  user_id?: string;
  title: string;
  description: string;
  status: TaskStatus;
  created_at: string;
  updated_at: string;
  deleted_at?: string | null;
  is_deleted?: boolean;
}

export interface AuditLog {
  id: string;
  task_id: string;
  actor: string;
  old_status: TaskStatus;
  new_status: TaskStatus;
  created_at: string;
}

export interface CreateTaskPayload {
  title: string;
  description?: string;
  user_name?: string;
  actor?: string;
}

export interface UpdateTaskPayload {
  title: string;
  description?: string;
}

export interface StatusTransitionPayload {
  status: TaskStatus;
  actor?: string;
}

export interface ApiErrorResponse {
  error: string;
  message?: string;
  details?: unknown;
}
