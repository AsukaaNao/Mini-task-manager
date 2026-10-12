import {
  Task,
  AuditLog,
  User,
  CreateTaskPayload,
  UpdateTaskPayload,
  StatusTransitionPayload,
} from '../types/task';

// Configurable base URL via environment variable with fallback to '' (root endpoints /tasks) or '/api'
const RAW_BASE_URL = import.meta.env.VITE_API_BASE_URL !== undefined ? import.meta.env.VITE_API_BASE_URL : '/api';
export const API_BASE_URL = RAW_BASE_URL.replace(/\/+$/, '');

// Active user session state
let currentUserId =
  typeof window !== 'undefined'
    ? localStorage.getItem('task_manager_user') || 'alice'
    : 'alice';

export function setCurrentUser(userId: string): void {
  currentUserId = userId;
  if (typeof window !== 'undefined') {
    localStorage.setItem('task_manager_user', userId);
  }
}

export function getCurrentUser(): string {
  return currentUserId;
}

export class ApiError extends Error {
  status: number;
  data?: unknown;

  constructor(status: number, message: string, data?: unknown) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.data = data;
  }
}

/**
 * Helper to handle fetch responses and parse errors accurately
 */
async function handleResponse<T>(response: Response): Promise<T> {
  let responseData: any = null;
  const contentType = response.headers.get('content-type');

  if (contentType && contentType.includes('application/json')) {
    try {
      responseData = await response.json();
    } catch {
      responseData = null;
    }
  } else {
    try {
      responseData = await response.text();
    } catch {
      responseData = null;
    }
  }

  if (!response.ok) {
    let errorMessage = `HTTP error ${response.status}: ${response.statusText}`;

    if (responseData) {
      if (typeof responseData === 'object') {
        errorMessage =
          responseData.message ||
          responseData.error ||
          JSON.stringify(responseData);
      } else if (typeof responseData === 'string' && responseData.trim()) {
        errorMessage = responseData;
      }
    }

    if (response.status === 400 && !errorMessage) {
      errorMessage = 'Invalid request payload or forbidden status transition.';
    } else if (response.status === 404 && !errorMessage) {
      errorMessage = 'The requested task was not found.';
    } else if (response.status === 500 && !errorMessage) {
      errorMessage = 'Internal server error occurred on the backend.';
    }

    throw new ApiError(response.status, errorMessage, responseData);
  }

  return responseData as T;
}

/**
 * Standard fetch wrapper with multi-user attribution header
 */
async function request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const url = `${API_BASE_URL}${endpoint.startsWith('/') ? endpoint : `/${endpoint}`}`;

  const headers: Record<string, string> = {
    Accept: 'application/json',
    'X-User-Id': currentUserId,
    ...(options.headers as Record<string, string>),
  };

  if (options.body && !(options.body instanceof FormData)) {
    headers['Content-Type'] = 'application/json';
  }

  try {
    const response = await fetch(url, {
      ...options,
      headers,
    });
    return await handleResponse<T>(response);
  } catch (error) {
    if (error instanceof ApiError) {
      throw error;
    }
    const message =
      error instanceof Error
        ? `Network error: ${error.message}`
        : 'Failed to communicate with the server. Please check your connection or backend URL.';
    throw new ApiError(0, message, error);
  }
}

/**
 * Centralized API service for Tasks and Users
 */
export const tasksApi = {
  /**
   * GET /users — Retrieve all available users
   */
  async getUsers(): Promise<User[]> {
    try {
      const data = await request<any>('/users', { method: 'GET' });
      if (Array.isArray(data)) return data;
      return [
        { id: 'alice', name: 'Alice' },
        { id: 'bob', name: 'Bob' },
        { id: 'charlie', name: 'Charlie' },
        { id: 'anonymous', name: 'Anonymous' },
      ];
    } catch {
      return [
        { id: 'alice', name: 'Alice' },
        { id: 'bob', name: 'Bob' },
        { id: 'charlie', name: 'Charlie' },
        { id: 'anonymous', name: 'Anonymous' },
      ];
    }
  },

  /**
   * POST /users — Create a new user
   */
  async createUser(name: string): Promise<User> {
    return await request<User>('/users', {
      method: 'POST',
      body: JSON.stringify({ name }),
    });
  },

  /**
   * GET /tasks — Retrieve all active tasks (optional user filter)
   */
  async getTasks(userId?: string): Promise<Task[]> {
    const query = userId ? `?user_id=${encodeURIComponent(userId)}` : '';
    const data = await request<any>(`/tasks${query}`, { method: 'GET' });
    if (Array.isArray(data)) {
      return data;
    }
    if (data && Array.isArray(data.tasks)) {
      return data.tasks;
    }
    if (data && Array.isArray(data.data)) {
      return data.data;
    }
    return [];
  },

  /**
   * GET /tasks/:id — Retrieve task details
   */
  async getTaskById(id: string): Promise<Task> {
    const data = await request<any>(`/tasks/${encodeURIComponent(id)}`, { method: 'GET' });
    if (data && data.task) {
      return data.task;
    }
    if (data && data.data && typeof data.data === 'object' && !Array.isArray(data.data)) {
      return data.data;
    }
    return data as Task;
  },

  /**
   * POST /tasks — Create a new task
   */
  async createTask(payload: CreateTaskPayload): Promise<Task> {
    const data = await request<any>('/tasks', {
      method: 'POST',
      body: JSON.stringify({
        ...payload,
        actor: payload.actor || currentUserId,
      }),
    });
    if (data && data.task) {
      return data.task;
    }
    return data as Task;
  },

  /**
   * PATCH /tasks/:id — Update title or description
   */
  async updateTask(id: string, payload: UpdateTaskPayload): Promise<Task> {
    const data = await request<any>(`/tasks/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    });
    if (data && data.task) {
      return data.task;
    }
    return data as Task;
  },

  /**
   * PUT /tasks/:id/status — Request a status transition
   */
  async transitionTaskStatus(id: string, payload: StatusTransitionPayload): Promise<Task> {
    const data = await request<any>(`/tasks/${encodeURIComponent(id)}/status`, {
      method: 'PUT',
      body: JSON.stringify({
        status: payload.status,
        actor: payload.actor || currentUserId,
      }),
    });
    if (data && data.task) {
      return data.task;
    }
    return data as Task;
  },

  /**
   * DELETE /tasks/:id — Soft-delete a task
   */
  async deleteTask(id: string): Promise<void> {
    await request<any>(`/tasks/${encodeURIComponent(id)}`, {
      method: 'DELETE',
    });
  },

  /**
   * GET /tasks/:id/audit-logs — Retrieve chronological audit history
   */
  async getAuditLogs(id: string): Promise<AuditLog[]> {
    const data = await request<any>(`/tasks/${encodeURIComponent(id)}/audit-logs`, {
      method: 'GET',
    });
    let logs: AuditLog[] = [];
    if (Array.isArray(data)) {
      logs = data;
    } else if (data && Array.isArray(data.audit_logs)) {
      logs = data.audit_logs;
    } else if (data && Array.isArray(data.data)) {
      logs = data.data;
    }

    return logs.sort(
      (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
    );
  },
};
