/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useCallback } from 'react';
import { Task, User } from './types/task';
import { tasksApi, getCurrentUser, setCurrentUser } from './api/tasks';
import { Navbar } from './components/Navbar';
import { TaskListPage } from './components/TaskListPage';
import { TaskDetailPage } from './components/TaskDetailPage';
import { TaskForm } from './components/TaskForm';

type ViewState =
  | { type: 'list' }
  | { type: 'detail'; taskId: string }
  | { type: 'create' }
  | { type: 'edit'; task: Task };

export default function App() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [users, setUsers] = useState<User[]>([
    { id: 'alice', name: 'Alice' },
    { id: 'bob', name: 'Bob' },
    { id: 'charlie', name: 'Charlie' },
    { id: 'anonymous', name: 'Anonymous' },
  ]);
  const [currentUser, setActiveUser] = useState<string>(getCurrentUser());
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [view, setView] = useState<ViewState>({ type: 'list' });

  // Fetch users list from backend JSON database
  const fetchUsers = useCallback(async () => {
    try {
      const userList = await tasksApi.getUsers();
      setUsers(userList);
    } catch {
      // Keep defaults if network fails
    }
  }, []);

  // Fetch active tasks from backend JSON database
  const fetchTasks = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const activeTasks = await tasksApi.getTasks();
      setTasks(activeTasks.filter((t) => !t.is_deleted));
    } catch (err: any) {
      setError(err?.message || 'Failed to fetch tasks from the server.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchUsers();
    fetchTasks();
  }, [fetchUsers, fetchTasks]);

  const handleUserChange = (userId: string) => {
    setCurrentUser(userId);
    setActiveUser(userId);
  };

  const handleAddUser = async (name: string) => {
    try {
      const newUser = await tasksApi.createUser(name);
      setUsers((prev) => [...prev, newUser]);
      handleUserChange(newUser.id);
    } catch (err: any) {
      alert(err?.message || 'Failed to create new user.');
    }
  };

  const handleCreateSuccess = (_created: Task) => {
    fetchTasks();
    setView({ type: 'list' });
  };

  const handleEditSuccess = (updated: Task) => {
    setTasks((prev) => prev.map((t) => (t.id === updated.id ? updated : t)));
    setView({ type: 'detail', taskId: updated.id });
  };

  const handleTaskDeleted = (deletedId: string) => {
    setTasks((prev) => prev.filter((t) => t.id !== deletedId));
    setView({ type: 'list' });
  };

  const activeCount = tasks.filter((t) => !t.is_deleted).length;

  return (
    <div className="min-h-screen bg-white text-neutral-900 font-sans flex flex-col w-full antialiased">
      <Navbar
        onGoHome={() => setView({ type: 'list' })}
        onOpenCreate={() => setView({ type: 'create' })}
        activeCount={activeCount}
        users={users}
        currentUser={currentUser}
        onUserChange={handleUserChange}
        onAddUser={handleAddUser}
      />

      <main className="w-full max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 flex-1">
        {view.type === 'list' && (
          <TaskListPage
            tasks={tasks}
            users={users}
            currentUser={currentUser}
            isLoading={isLoading}
            error={error}
            onRefresh={fetchTasks}
            onViewDetails={(taskId) => setView({ type: 'detail', taskId })}
            onOpenCreate={() => setView({ type: 'create' })}
            onOpenEdit={(task) => setView({ type: 'edit', task })}
            onTaskDeleted={handleTaskDeleted}
          />
        )}

        {view.type === 'detail' && (
          <TaskDetailPage
            taskId={view.taskId}
            currentUser={currentUser}
            onBack={() => {
              setView({ type: 'list' });
              fetchTasks();
            }}
            onEdit={(task) => setView({ type: 'edit', task })}
            onTaskDeleted={handleTaskDeleted}
          />
        )}

        {view.type === 'create' && (
          <TaskForm
            mode="create"
            onCancel={() => setView({ type: 'list' })}
            onSuccess={handleCreateSuccess}
          />
        )}

        {view.type === 'edit' && (
          <TaskForm
            mode="edit"
            task={view.task}
            onCancel={() => setView({ type: 'detail', taskId: view.task.id })}
            onSuccess={handleEditSuccess}
          />
        )}
      </main>

      <footer className="w-full border-t border-neutral-200 py-4 px-4 sm:px-8 text-center text-xs text-neutral-400 mt-auto">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2">
          <span>Task Manager • Multi-User JSON Storage & Chronological Audit</span>
          <span className="font-mono text-neutral-500">to_do → pending → in_progress → done</span>
        </div>
      </footer>
    </div>
  );
}
