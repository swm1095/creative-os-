'use client'

import { BackgroundTask } from '@/lib/hooks/use-background-tasks'
import LoadingSpinner from './LoadingSpinner'

interface TaskBarProps {
  tasks: BackgroundTask[]
  onDismiss: (id: string) => void
  onViewResult?: (task: BackgroundTask) => void
}

export default function TaskBar({ tasks, onDismiss, onViewResult }: TaskBarProps) {
  const activeTasks = tasks.filter(t => Date.now() - (t.completedAt || t.startedAt) < 300000) // Show for 5 min after completion
  if (!activeTasks.length) return null

  return (
    <div className="fixed bottom-0 left-sidebar right-0 z-30 border-t border-border bg-surface/95 backdrop-blur-sm">
      <div className="px-6 py-2 flex items-center gap-3 overflow-x-auto">
        {activeTasks.map(task => (
          <div
            key={task.id}
            className={`flex items-center gap-2.5 px-3 py-1.5 rounded-lg text-xs font-semibold shrink-0 transition-all ${
              task.status === 'running' ? 'bg-blue-light text-blue' :
              task.status === 'complete' ? 'bg-green-light text-green cursor-pointer hover:bg-green/20' :
              'bg-red-light text-red'
            }`}
            onClick={() => {
              if (task.status === 'complete' && onViewResult) onViewResult(task)
            }}
          >
            {task.status === 'running' && <LoadingSpinner size={12} />}
            {task.status === 'complete' && <span>✓</span>}
            {task.status === 'error' && <span>✕</span>}
            <span>{task.brandName}: {task.message}</span>
            {task.status === 'running' && (
              <span className="text-2xs opacity-60">
                {Math.round((Date.now() - task.startedAt) / 1000)}s
              </span>
            )}
            {task.status !== 'running' && (
              <button
                onClick={(e) => { e.stopPropagation(); onDismiss(task.id) }}
                className="opacity-60 hover:opacity-100 ml-1"
              >
                ×
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
