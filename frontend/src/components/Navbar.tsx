import React, { useState } from 'react';
import { User } from '../types/task';

interface NavbarProps {
  onGoHome: () => void;
  onOpenCreate: () => void;
  activeCount: number;
  users: User[];
  currentUser: string;
  onUserChange: (userName: string) => void;
  onAddUser: (name: string) => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  onGoHome,
  onOpenCreate,
  activeCount,
  users,
  currentUser,
  onUserChange,
  onAddUser,
}) => {
  const [isAddingUser, setIsAddingUser] = useState(false);
  const [newUserName, setNewUserName] = useState('');

  const handleCreateUser = (e: React.FormEvent) => {
    e.preventDefault();
    if (newUserName.trim()) {
      onAddUser(newUserName.trim());
      setNewUserName('');
      setIsAddingUser(false);
    }
  };

  return (
    <header className="w-full border-b border-neutral-200 bg-white sticky top-0 z-20">
      <div className="w-full max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
        {/* Brand */}
        <button
          type="button"
          onClick={onGoHome}
          className="text-base font-semibold text-neutral-900 hover:text-neutral-600 transition-colors cursor-pointer flex items-center gap-2.5 shrink-0"
        >
          <span>Task Manager</span>
          <span className="text-xs font-normal text-neutral-500 bg-neutral-100 px-2 py-0.5 rounded-full">
            {activeCount} {activeCount === 1 ? 'task' : 'tasks'}
          </span>
        </button>

        {/* User Switcher & Create Action */}
        <div className="flex items-center gap-3">
          {/* Multi-user Actor Switcher */}
          <div className="flex items-center gap-1.5 text-xs bg-neutral-50 border border-neutral-200 rounded px-2.5 py-1">
            <span className="text-neutral-500 font-medium hidden sm:inline">Active User:</span>
            {!isAddingUser ? (
              <div className="flex items-center gap-1.5">
                <select
                  value={currentUser}
                  onChange={(e) => {
                    if (e.target.value === '__new__') {
                      setIsAddingUser(true);
                    } else {
                      onUserChange(e.target.value);
                    }
                  }}
                  className="bg-transparent font-medium text-neutral-900 focus:outline-none cursor-pointer"
                  title="Switch active user"
                >
                  {users.map((user) => (
                    <option key={user.id} value={user.name}>
                      {user.name}
                    </option>
                  ))}
                  <option value="__new__">+ Add user...</option>
                </select>
              </div>
            ) : (
              <form onSubmit={handleCreateUser} className="flex items-center gap-1">
                <input
                  type="text"
                  placeholder="New user name"
                  value={newUserName}
                  onChange={(e) => setNewUserName(e.target.value)}
                  className="px-1.5 py-0.5 text-xs border border-neutral-300 rounded focus:outline-none w-24"
                  autoFocus
                />
                <button
                  type="submit"
                  className="px-1.5 py-0.5 text-[11px] bg-neutral-900 text-white rounded font-medium cursor-pointer"
                >
                  Add
                </button>
                <button
                  type="button"
                  onClick={() => setIsAddingUser(false)}
                  className="text-neutral-400 hover:text-neutral-600 text-xs px-1 cursor-pointer"
                >
                  ✕
                </button>
              </form>
            )}
          </div>

          <button
            type="button"
            onClick={onOpenCreate}
            className="px-3.5 py-1.5 text-xs sm:text-sm font-medium text-white bg-neutral-900 hover:bg-neutral-800 active:bg-neutral-950 rounded transition-colors cursor-pointer shrink-0"
          >
            + Create Task
          </button>
        </div>
      </div>
    </header>
  );
};
