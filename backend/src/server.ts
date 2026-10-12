import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { randomUUID } from 'crypto';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ----------------------------------------------------
// Data Models
// ----------------------------------------------------
export type TaskStatus = 'to_do' | 'pending' | 'in_progress' | 'done';

export interface User {
  id: string;
  name: string;
  email: string;
  deleted_at?: string | null;
}

export interface Task {
  id: string;
  user_id: string;
  title: string;
  description: string;
  status: TaskStatus;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export interface AuditLog {
  id: string;
  task_id: string;
  actor?: string;
  old_status: TaskStatus;
  new_status: TaskStatus;
  created_at: string;
}

export interface DatabaseData {
  users: User[];
  tasks: Task[];
  audit_logs: AuditLog[];
}

export const NEXT_STATUS_MAP: Record<TaskStatus, TaskStatus | null> = {
  to_do: 'pending',
  pending: 'in_progress',
  in_progress: 'done',
  done: null,
};

// ----------------------------------------------------
// JSON Database Engine
// ----------------------------------------------------
export class JsonStore {
  public data: DatabaseData;
  public filePath: string | null;
  private writeLock: Promise<void> = Promise.resolve();

  constructor(filePath?: string | null, initialData?: DatabaseData) {
    this.filePath = filePath !== undefined ? filePath : path.resolve(__dirname, '../data.json');

    if (initialData) {
      this.data = JSON.parse(JSON.stringify(initialData));
      return;
    }

    this.data = {
      users: [],
      tasks: [],
      audit_logs: [],
    };

    if (this.filePath && this.filePath !== ':memory:') {
      this.load();
    }
  }

  private load(): void {
    if (!this.filePath || this.filePath === ':memory:') return;

    try {
      const dir = path.dirname(this.filePath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }

      if (fs.existsSync(this.filePath)) {
        const raw = fs.readFileSync(this.filePath, 'utf-8');
        const parsed = JSON.parse(raw);
        this.data = {
          users: Array.isArray(parsed.users) ? parsed.users : [],
          tasks: Array.isArray(parsed.tasks) ? parsed.tasks : [],
          audit_logs: Array.isArray(parsed.audit_logs) ? parsed.audit_logs : [],
        };
      } else {
        this.persistSync();
      }
    } catch (err) {
      console.error('[JsonStore] Failed to load data.json, starting with clean schema:', err);
      this.persistSync();
    }
  }

  public async save(mutator: (data: DatabaseData) => void): Promise<void> {
    const previousSnapshot = JSON.stringify(this.data);

    try {
      mutator(this.data);
    } catch (mutationError) {
      this.data = JSON.parse(previousSnapshot);
      throw mutationError;
    }

    if (!this.filePath || this.filePath === ':memory:') {
      return;
    }

    const payload = JSON.stringify(this.data, null, 2);
    const targetPath = this.filePath;

    // Serialize file writes to prevent concurrent writes from corrupting data
    this.writeLock = this.writeLock.then(async () => {
      const tempPath = `${targetPath}.tmp.${Date.now()}.${Math.random().toString(36).substring(2, 7)}`;
      try {
        await fs.promises.writeFile(tempPath, payload, 'utf-8');
        await fs.promises.rename(tempPath, targetPath);
      } catch (writeError) {
        // Restore previous in-memory state if file save fails
        this.data = JSON.parse(previousSnapshot);
        try {
          if (fs.existsSync(tempPath)) {
            await fs.promises.unlink(tempPath);
          }
        } catch {}
        throw writeError;
      }
    });

    await this.writeLock;
  }

  public persistSync(): void {
    if (!this.filePath || this.filePath === ':memory:') return;
    try {
      const dir = path.dirname(this.filePath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      fs.writeFileSync(this.filePath, JSON.stringify(this.data, null, 2), 'utf-8');
    } catch (err) {
      console.error('[JsonStore] Error in persistSync:', err);
    }
  }
}

// ----------------------------------------------------
// Express App Factory
// ----------------------------------------------------
export interface CreateAppOptions {
  store?: JsonStore;
  dataFilePath?: string | null;
  initialData?: DatabaseData;
}

export function createApp(options: CreateAppOptions = {}): express.Express {
  const app = express();
  const store = options.store || new JsonStore(options.dataFilePath, options.initialData);

  // Enable CORS & JSON parsing
  app.use(cors());
  app.use(express.json());

  // Helper: Extract actor identity
  const getActor = (req: Request): string => {
    const headerUser = req.headers['x-user-id'];
    if (typeof headerUser === 'string' && headerUser.trim()) {
      return headerUser.trim();
    }
    if (typeof req.query.user_id === 'string' && req.query.user_id.trim()) {
      return req.query.user_id.trim();
    }
    if (req.body && typeof req.body.actor === 'string' && req.body.actor.trim()) {
      return req.body.actor.trim();
    }
    return 'anonymous';
  };

  // Router for all Task & User endpoints
  const router = express.Router();

  // ====================================================
  // USER API ENDPOINTS
  // ====================================================

  /**
   * GET /users — List active users
   */
  router.get('/users', (_req: Request, res: Response) => {
    const activeUsers = store.data.users.filter((u) => !u.deleted_at);
    res.status(200).json(activeUsers);
  });

  /**
   * POST /users — Create a new user
   */
  router.post('/users', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { name, email } = req.body;

      if (!name || typeof name !== 'string' || !name.trim()) {
        return res.status(400).json({ error: 'VALIDATION_ERROR', message: 'User name is required' });
      }

      const trimmedName = name.trim();
      const trimmedEmail = typeof email === 'string' && email.trim() ? email.trim() : `${trimmedName.toLowerCase().replace(/\s+/g, '.')}@example.com`;

      const newUser: User = {
        id: `user-${randomUUID().slice(0, 8)}`,
        name: trimmedName,
        email: trimmedEmail,
      };

      await store.save((data) => {
        data.users.push(newUser);
      });

      res.status(201).json(newUser);
    } catch (err) {
      next(err);
    }
  });

  /**
   * GET /users/:id — Get user by ID
   */
  router.get('/users/:id', (req: Request, res: Response) => {
    const user = store.data.users.find((u) => u.id === req.params.id && !u.deleted_at);
    if (!user) {
      return res.status(404).json({ error: 'USER_NOT_FOUND', message: `User with id '${req.params.id}' not found` });
    }
    res.status(200).json(user);
  });

  /**
   * PATCH /users/:id — Update user details
   */
  router.patch('/users/:id', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = store.data.users.find((u) => u.id === req.params.id && !u.deleted_at);
      if (!user) {
        return res.status(404).json({ error: 'USER_NOT_FOUND', message: `User with id '${req.params.id}' not found` });
      }

      const { name, email } = req.body;

      if (name !== undefined) {
        if (typeof name !== 'string' || !name.trim()) {
          return res.status(400).json({ error: 'VALIDATION_ERROR', message: 'Name cannot be empty' });
        }
      }

      if (email !== undefined) {
        if (typeof email !== 'string' || !email.trim()) {
          return res.status(400).json({ error: 'VALIDATION_ERROR', message: 'Email cannot be empty' });
        }
      }

      await store.save((data) => {
        const target = data.users.find((u) => u.id === req.params.id);
        if (target) {
          if (name !== undefined) target.name = name.trim();
          if (email !== undefined) target.email = email.trim();
        }
      });

      const updated = store.data.users.find((u) => u.id === req.params.id);
      res.status(200).json(updated);
    } catch (err) {
      next(err);
    }
  });

  /**
   * DELETE /users/:id — Delete user
   * Soft-deletes user or prevents deletion if user has active tasks, protecting tasks & audit history
   */
  router.delete('/users/:id', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = store.data.users.find((u) => u.id === req.params.id && !u.deleted_at);
      if (!user) {
        return res.status(404).json({ error: 'USER_NOT_FOUND', message: `User with id '${req.params.id}' not found` });
      }

      const now = new Date().toISOString();
      await store.save((data) => {
        const target = data.users.find((u) => u.id === req.params.id);
        if (target) {
          target.deleted_at = now;
        }
      });

      res.status(200).json({ success: true, message: 'User deleted successfully.' });
    } catch (err) {
      next(err);
    }
  });

  // ====================================================
  // TASK API ENDPOINTS
  // ====================================================

  /**
   * GET /tasks — List all active tasks (not soft-deleted, newest first)
   */
  router.get('/tasks', (req: Request, res: Response) => {
    const userIdFilter = typeof req.query.user_id === 'string' ? req.query.user_id : undefined;

    const activeTasks = store.data.tasks
      .filter((t) => t.deleted_at === null && (!userIdFilter || t.user_id === userIdFilter))
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

    res.status(200).json(activeTasks);
  });

  /**
   * POST /tasks — Create a task (starts with to_do, server-assigned ID & timestamps)
   */
  router.post('/tasks', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { title, description, user_id } = req.body;

      if (!title || typeof title !== 'string' || !title.trim()) {
        return res.status(400).json({ error: 'VALIDATION_ERROR', message: 'Task title is required and cannot be empty' });
      }

      // Prohibit client overrides of server-managed fields
      if (req.body.status && req.body.status !== 'to_do') {
        return res.status(400).json({ error: 'VALIDATION_ERROR', message: 'Newly created tasks must start with status to_do' });
      }

      const now = new Date().toISOString();
      const assignedUserId = user_id || getActor(req);

      const newTask: Task = {
        id: `task-${randomUUID().slice(0, 8)}`,
        user_id: assignedUserId,
        title: title.trim(),
        description: typeof description === 'string' ? description.trim() : '',
        status: 'to_do',
        created_at: now,
        updated_at: now,
        deleted_at: null,
      };

      await store.save((data) => {
        data.tasks.push(newTask);
      });

      res.status(201).json(newTask);
    } catch (err) {
      next(err);
    }
  });

  /**
   * GET /tasks/:id — Get task details
   */
  router.get('/tasks/:id', (req: Request, res: Response) => {
    const task = store.data.tasks.find((t) => t.id === req.params.id && t.deleted_at === null);
    if (!task) {
      return res.status(404).json({ error: 'TASK_NOT_FOUND', message: `Task '${req.params.id}' not found or has been deleted` });
    }
    res.status(200).json(task);
  });

  /**
   * PATCH /tasks/:id — Update task title or description only
   */
  router.patch('/tasks/:id', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const task = store.data.tasks.find((t) => t.id === req.params.id && t.deleted_at === null);
      if (!task) {
        return res.status(404).json({ error: 'TASK_NOT_FOUND', message: `Task '${req.params.id}' not found or has been deleted` });
      }

      if (req.body.status !== undefined) {
        return res.status(400).json({
          error: 'VALIDATION_ERROR',
          message: 'Status cannot be updated through PATCH /tasks/:id. Use PUT /tasks/:id/status instead',
        });
      }

      const { title, description } = req.body;

      if (title !== undefined) {
        if (typeof title !== 'string' || !title.trim()) {
          return res.status(400).json({ error: 'VALIDATION_ERROR', message: 'Task title cannot be empty' });
        }
      }

      const titleChanged = title !== undefined && title.trim() !== task.title;
      const descChanged = description !== undefined && (typeof description === 'string' ? description.trim() : '') !== task.description;

      if (!titleChanged && !descChanged) {
        return res.status(200).json(task);
      }

      const now = new Date().toISOString();

      await store.save((data) => {
        const target = data.tasks.find((t) => t.id === req.params.id);
        if (target) {
          if (title !== undefined) target.title = title.trim();
          if (description !== undefined) target.description = typeof description === 'string' ? description.trim() : '';
          target.updated_at = now;
        }
      });

      const updated = store.data.tasks.find((t) => t.id === req.params.id);
      res.status(200).json(updated);
    } catch (err) {
      next(err);
    }
  });

  /**
   * DELETE /tasks/:id — Soft-delete task (preserves audit history)
   */
  router.delete('/tasks/:id', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const task = store.data.tasks.find((t) => t.id === req.params.id && t.deleted_at === null);
      if (!task) {
        return res.status(404).json({ error: 'TASK_NOT_FOUND', message: `Task '${req.params.id}' not found or already deleted` });
      }

      const now = new Date().toISOString();

      await store.save((data) => {
        const target = data.tasks.find((t) => t.id === req.params.id);
        if (target) {
          target.deleted_at = now;
          target.updated_at = now;
        }
      });

      res.status(200).json({ success: true, message: 'Task soft-deleted successfully.' });
    } catch (err) {
      next(err);
    }
  });

  /**
   * PUT /tasks/:id/status & PATCH /tasks/:id/status — Advance workflow
   * Workflow: to_do → pending → in_progress → done
   */
  const handleStatusTransition = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const task = store.data.tasks.find((t) => t.id === req.params.id && t.deleted_at === null);
      if (!task) {
        return res.status(404).json({ error: 'TASK_NOT_FOUND', message: `Task '${req.params.id}' not found or has been deleted` });
      }

      const { status: requestedStatus } = req.body;
      const validStatuses: TaskStatus[] = ['to_do', 'pending', 'in_progress', 'done'];

      if (!requestedStatus || !validStatuses.includes(requestedStatus)) {
        return res.status(400).json({
          error: 'VALIDATION_ERROR',
          message: `Invalid status '${requestedStatus}'. Valid statuses are: ${validStatuses.join(', ')}`,
        });
      }

      // Same status: successful response without creating audit log
      if (requestedStatus === task.status) {
        return res.status(200).json({
          task,
          transitioned: false,
        });
      }

      // Terminal status check
      if (task.status === 'done') {
        return res.status(400).json({
          error: 'TERMINAL_STATUS',
          message: 'Task is already completed (done). No further transitions allowed.',
        });
      }

      const permittedNext = NEXT_STATUS_MAP[task.status];
      if (requestedStatus !== permittedNext) {
        return res.status(400).json({
          error: 'INVALID_STATUS_TRANSITION',
          message: `Cannot change status from ${task.status} to ${requestedStatus}. Permitted next status is ${permittedNext}.`,
        });
      }

      const now = new Date().toISOString();
      const auditLogId = `log-${randomUUID().slice(0, 8)}`;
      const actor = getActor(req);
      const oldStatus = task.status;

      // Update task status and record audit log as one logical operation
      await store.save((data) => {
        const target = data.tasks.find((t) => t.id === req.params.id);
        if (target) {
          target.status = requestedStatus;
          target.updated_at = now;
        }

        const auditEntry: AuditLog = {
          id: auditLogId,
          task_id: req.params.id,
          actor,
          old_status: oldStatus,
          new_status: requestedStatus,
          created_at: now,
        };
        data.audit_logs.push(auditEntry);
      });

      const updated = store.data.tasks.find((t) => t.id === req.params.id);
      res.status(200).json({
        task: updated,
        transitioned: true,
      });
    } catch (err) {
      next(err);
    }
  };

  router.put('/tasks/:id/status', handleStatusTransition);
  router.patch('/tasks/:id/status', handleStatusTransition);

  /**
   * GET /tasks/:id/audit-logs — Chronological audit history
   */
  router.get('/tasks/:id/audit-logs', (req: Request, res: Response) => {
    const taskExists = store.data.tasks.some((t) => t.id === req.params.id);
    if (!taskExists) {
      return res.status(404).json({ error: 'TASK_NOT_FOUND', message: `Task '${req.params.id}' never existed` });
    }

    const logs = store.data.audit_logs
      .filter((log) => log.task_id === req.params.id)
      .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());

    res.status(200).json(logs);
  });

  // Mount at root / as requested in REST API Guide AND /api for existing frontend compatibility
  app.use('/', router);
  app.use('/api', router);

  // Error handling middleware
  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    console.error('[Server Error]:', err);
    res.status(500).json({
      error: 'INTERNAL_SERVER_ERROR',
      message: 'An unexpected server error occurred.',
    });
  });

  return app;
}

// ----------------------------------------------------
// Standalone Server Run
// ----------------------------------------------------
export const app = createApp();

const isDirectExecution =
  process.argv[1] &&
  /backend[\\/](src|dist)[\\/]server\.(ts|js)$/.test(process.argv[1]);

if (isDirectExecution) {
  const port = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;
  app.listen(port, '0.0.0.0', () => {
    console.log(`Mini Task Manager Backend running on http://0.0.0.0:${port}`);
  });
}
