'use client'

import { useState, useRef, useCallback } from 'react'

interface DropZoneProps {
  accept?: string
  multiple?: boolean
  onFiles: (files: File[]) => void
  children: React.ReactNode
  className?: string
  activeClassName?: string
}

export default function DropZone({ accept, multiple, onFiles, children, className = '', activeClassName = '' }: DropZoneProps) {
  const [dragging, setDragging] = useState(false)
  const dragCounter = useRef(0)

  const handleDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    dragCounter.current++
    if (e.dataTransfer.items?.length) setDragging(true)
  }, [])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    dragCounter.current--
    if (dragCounter.current === 0) setDragging(false)
  }, [])

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
  }, [])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setDragging(false)
    dragCounter.current = 0

    const files = Array.from(e.dataTransfer.files)
    if (!files.length) return

    const filtered = accept
      ? files.filter(f => {
          const types = accept.split(',').map(t => t.trim())
          return types.some(t => {
            if (t.startsWith('.')) return f.name.toLowerCase().endsWith(t)
            if (t.endsWith('/*')) return f.type.startsWith(t.replace('/*', '/'))
            return f.type === t
          })
        })
      : files

    const result = multiple ? filtered : filtered.slice(0, 1)
    if (result.length) onFiles(result)
  }, [accept, multiple, onFiles])

  return (
    <div
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
      className={`${className} ${dragging ? activeClassName || 'ring-2 ring-fulton ring-offset-2 ring-offset-page' : ''}`}
    >
      {children}
      {dragging && (
        <div className="absolute inset-0 bg-fulton/10 border-2 border-dashed border-fulton rounded-lg flex items-center justify-center z-10 pointer-events-none">
          <div className="bg-surface px-4 py-2 rounded-lg shadow-lg text-sm font-bold text-fulton">
            Drop files here
          </div>
        </div>
      )}
    </div>
  )
}
