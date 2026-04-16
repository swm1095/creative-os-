'use client'

import { useState, useRef, useEffect } from 'react'
import { ChatMessage } from '@/lib/types'
import Button from '@/components/ui/Button'
import LoadingSpinner from '@/components/ui/LoadingSpinner'

interface ChatViewProps {
  brandId?: string
  onToast: (msg: string, type: 'success' | 'error' | 'info') => void
}

const SUGGESTIONS = [
  'What ad angles work best for pain-point marketing?',
  'Write 3 hook variations for a comfort shoe brand',
  'Analyze why UGC-style ads outperform studio shots',
  'Suggest a testing framework for 4 persona variants',
]

export default function ChatView({ brandId, onToast }: ChatViewProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const send = async (text?: string) => {
    const msg = text || input.trim()
    if (!msg || sending) return
    setInput('')

    const userMsg: ChatMessage = { id: Date.now().toString(), role: 'user', content: msg, timestamp: Date.now() }
    setMessages(prev => [...prev, userMsg])
    setSending(true)

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [...messages, userMsg].map(m => ({ role: m.role, content: m.content })),
          brandId,
        }),
      })
      const data = await res.json()
      if (data.error) throw new Error(data.error)

      const assistantMsg: ChatMessage = { id: (Date.now() + 1).toString(), role: 'assistant', content: data.message, timestamp: Date.now() }
      setMessages(prev => [...prev, assistantMsg])
    } catch (err: unknown) {
      onToast(`Chat error: ${err instanceof Error ? err.message : String(err)}`, 'error')
    }
    setSending(false)
    inputRef.current?.focus()
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      send()
    }
  }

  return (
    <div className="animate-fadeIn flex flex-col h-[calc(100vh-120px)]">
      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-1 pb-4">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <div className="text-4xl mb-4">💬</div>
            <h3 className="text-xl font-black mb-2">HyperChat</h3>
            <p className="text-sm text-text-dim mb-6 max-w-md">Your AI creative strategist. Ask about ad strategy, copy angles, audience insights, or anything creative.</p>
            <div className="flex flex-wrap gap-2 justify-center max-w-lg">
              {SUGGESTIONS.map(s => (
                <button
                  key={s}
                  onClick={() => send(s)}
                  className="px-3 py-2 bg-surface border border-border rounded-lg text-xs text-text-muted hover:text-text-primary hover:border-fulton/40 transition-all text-left"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="space-y-4 pt-4">
            {messages.map(msg => (
              <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[70%] px-4 py-3 rounded-xl text-sm leading-relaxed ${
                  msg.role === 'user'
                    ? 'bg-fulton text-white rounded-br-sm'
                    : 'bg-surface border border-border text-text-secondary rounded-bl-sm'
                }`}>
                  <div className="whitespace-pre-wrap">{msg.content}</div>
                </div>
              </div>
            ))}
            {sending && (
              <div className="flex justify-start">
                <div className="bg-surface border border-border rounded-xl px-4 py-3 rounded-bl-sm">
                  <LoadingSpinner size={16} />
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      {/* Input */}
      <div className="border-t border-border pt-3 pb-1">
        <div className="flex gap-2 items-end">
          <textarea
            ref={inputRef}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask Claude anything about creative strategy..."
            className="flex-1 px-4 py-3 bg-surface border border-border rounded-xl text-sm text-text-primary placeholder:text-text-dim resize-none focus:border-fulton focus:outline-none min-h-[44px] max-h-[120px]"
            rows={1}
          />
          <Button onClick={() => send()} disabled={sending || !input.trim()} className="h-[44px]">
            Send
          </Button>
        </div>
        <div className="text-2xs text-text-dim mt-1.5 px-1">Shift+Enter for new line · Powered by Claude</div>
      </div>
    </div>
  )
}
