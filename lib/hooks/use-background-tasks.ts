'use client'

import { useState, useCallback, useRef } from 'react'

export interface BackgroundTask {
  id: string
  type: 'research' | 'competitor-analysis' | 'scan' | 'generate' | 'ugc-scripts'
  brandId: string
  brandName: string
  status: 'running' | 'complete' | 'error'
  message: string
  startedAt: number
  completedAt?: number
  result?: unknown
  error?: string
}

export function useBackgroundTasks() {
  const [tasks, setTasks] = useState<BackgroundTask[]>([])
  const taskRefs = useRef<Map<string, AbortController>>(new Map())

  const addTask = useCallback((
    type: BackgroundTask['type'],
    brandId: string,
    brandName: string,
    message: string,
    runFn: (signal: AbortSignal) => Promise<unknown>
  ): string => {
    const id = `${type}-${Date.now()}`
    const controller = new AbortController()
    taskRefs.current.set(id, controller)

    const task: BackgroundTask = {
      id, type, brandId, brandName,
      status: 'running', message,
      startedAt: Date.now(),
    }

    setTasks(prev => [task, ...prev])

    // Run in background - doesn't depend on component lifecycle
    runFn(controller.signal)
      .then(result => {
        setTasks(prev => prev.map(t =>
          t.id === id ? { ...t, status: 'complete' as const, result, completedAt: Date.now(), message: `${message} - done` } : t
        ))
        taskRefs.current.delete(id)
      })
      .catch(err => {
        if (controller.signal.aborted) return
        setTasks(prev => prev.map(t =>
          t.id === id ? { ...t, status: 'error' as const, error: err?.message || String(err), completedAt: Date.now(), message: `${message} - failed` } : t
        ))
        taskRefs.current.delete(id)
      })

    return id
  }, [])

  const dismissTask = useCallback((id: string) => {
    setTasks(prev => prev.filter(t => t.id !== id))
    const controller = taskRefs.current.get(id)
    if (controller) {
      controller.abort()
      taskRefs.current.delete(id)
    }
  }, [])

  const getTaskResult = useCallback((id: string) => {
    return tasks.find(t => t.id === id)
  }, [tasks])

  const getRunningTasks = useCallback(() => {
    return tasks.filter(t => t.status === 'running')
  }, [tasks])

  const getCompletedTasks = useCallback(() => {
    return tasks.filter(t => t.status === 'complete' || t.status === 'error')
  }, [tasks])

  return { tasks, addTask, dismissTask, getTaskResult, getRunningTasks, getCompletedTasks }
}
