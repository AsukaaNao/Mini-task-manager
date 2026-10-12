import React from 'react';
import { TaskStatus } from '../types/task';

interface StatusBadgeProps {
  status: TaskStatus;
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({ status }) => {
  return (
    <span className="inline-block text-xs text-neutral-700 font-mono bg-neutral-100 border border-neutral-200 px-2 py-0.5 rounded select-none">
      {status}
    </span>
  );
};
