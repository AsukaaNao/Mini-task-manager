import React, { useEffect, useState, useCallback } from 'react';
import { AuditLog } from '../types/task';
import { tasksApi } from '../api/tasks';

interface AuditTimelineProps {
  taskId: string;
  refreshTrigger?: number;
}

export const AuditTimeline: React.FC<AuditTimelineProps> = ({ taskId, refreshTrigger = 0 }) => {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const fetchLogs = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await tasksApi.getAuditLogs(taskId);
      // Chronological order: oldest to newest
      const sorted = [...data].sort(
        (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
      );
      setLogs(sorted);
    } catch (err: any) {
      setError(err?.message || 'Failed to load audit history.');
    } finally {
      setIsLoading(false);
    }
  }, [taskId]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs, refreshTrigger]);

  const formatTimestamp = (dateStr: string) => {
    try {
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return dateStr;
      const pad = (n: number) => n.toString().padStart(2, '0');
      const year = d.getFullYear();
      const month = pad(d.getMonth() + 1);
      const day = pad(d.getDate());
      const hours = pad(d.getHours());
      const minutes = pad(d.getMinutes());
      const seconds = pad(d.getSeconds());
      return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
    } catch {
      return dateStr;
    }
  };

  if (isLoading) {
    return <p className="text-sm text-neutral-500">Loading audit history...</p>;
  }

  if (error) {
    return (
      <div className="text-sm text-red-600">
        <span>Error loading audit history: {error}</span>
        <button
          type="button"
          onClick={fetchLogs}
          className="ml-2 underline cursor-pointer text-xs"
        >
          Retry
        </button>
      </div>
    );
  }

  if (logs.length === 0) {
    return <p className="text-sm text-neutral-500">No audit history yet.</p>;
  }

  return (
    <ul className="list-disc list-inside space-y-1.5 text-sm text-neutral-700">
      {logs.map((log) => (
        <li key={log.id}>
          {log.actor} changed status from {log.old_status} to {log.new_status} at{' '}
          {formatTimestamp(log.created_at)}
        </li>
      ))}
    </ul>
  );
};
