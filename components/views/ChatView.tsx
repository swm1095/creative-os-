'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { ChatMessage, Brand } from '@/lib/types'
import Button from '@/components/ui/Button'
import LoadingSpinner from '@/components/ui/LoadingSpinner'

interface ChatViewProps {
  brandId?: string
  brand?: Brand | null
  onToast: (msg: string, type: 'success' | 'error' | 'info') => void
}

interface SavedChat {
  id: string
  title: string
  messages: ChatMessage[]
  createdAt: string
  updatedAt: string
}

const FALLBACK_SUGGESTIONS = [
  'What ad angles work best for pain-point marketing?',
  'Write 3 hook variations for a DTC comfort brand',
  'Analyze why UGC-style ads outperform studio shots',
  'Suggest a testing framework for 4 persona variants',
]

function buildBrandSuggestions(brand: Brand | null | undefined): string[] {
  if (!brand?.research) return FALLBACK_SUGGESTIONS
  const r = brand.research
  const brandName = brand.name
  return [
    `Write 3 hook variations for ${brandName} targeting "${r.personas?.[0]?.name || 'our audience'}"`,
    `What's the best ad angle for "${r.painPoints?.[0] || 'the main pain point'}" for ${brandName}?`,
    `How should we differentiate ${brandName} from ${r.competitors?.[0] || 'competitors'}?`,
    `Suggest a creative testing framework for all ${r.personas?.length || 4} ${brandName} personas`,
  ]
}

// Store chats in localStorage per brand
function getChatKey(brandId: string) { return `hc-chats-${brandId}` }

function loadChats(brandId: string): SavedChat[] {
  try { return JSON.parse(localStorage.getItem(getChatKey(brandId)) || '[]') }
  catch { return [] }
}

function saveChats(brandId: string, chats: SavedChat[]) {
  localStorage.setItem(getChatKey(brandId), JSON.stringify(chats))
}

export default function ChatView({ brandId, brand, onToast }: ChatViewProps) {
  const [chats, setChats] = useState<SavedChat[]>([])
  const [activeChatId, setActiveChatId] = useState<string | null>(null)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  const suggestions = buildBrandSuggestions(brand)

  // Load chats when brand changes
  useEffect(() => {
    if (!brandId) return
    const saved = loadChats(brandId)
    setChats(saved)
    setActiveChatId(null)
    setMessages([])
  }, [brandId])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // Auto-save current chat
  const autoSave = useCallback((msgs: ChatMessage[], chatId: string | null) => {
    if (!brandId || msgs.length === 0) return
    const title = msgs.find(m => m.role === 'user')?.content.slice(0, 50) || 'New Chat'
    const now = new Date().toISOString()

    setChats(prev => {
      let updated: SavedChat[]
      if (chatId) {
        updated = prev.map(c => c.id === chatId ? { ...c, messages: msgs, title, updatedAt: now } : c)
      } else {
        const newId = `chat-${Date.now()}`
        setActiveChatId(newId)
        updated = [{ id: newId, title, messages: msgs, createdAt: now, updatedAt: now }, ...prev]
      }
      saveChats(brandId, updated)
      return updated
    })
  }, [brandId])

  const send = async (text?: string) => {
    const msg = text || input.trim()
    if (!msg || sending) return
    setInput('')

    const userMsg: ChatMessage = { id: Date.now().toString(), role: 'user', content: msg, timestamp: Date.now() }
    const newMessages = [...messages, userMsg]
    setMessages(newMessages)
    setSending(true)

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: newMessages.map(m => ({ role: m.role, content: m.content })), brandId }),
      })
      const data = await res.json()
      if (data.error) throw new Error(data.error)

      const assistantMsg: ChatMessage = { id: (Date.now() + 1).toString(), role: 'assistant', content: data.message, timestamp: Date.now() }
      const finalMessages = [...newMessages, assistantMsg]
      setMessages(finalMessages)
      autoSave(finalMessages, activeChatId)
    } catch (err: unknown) {
      onToast(`Chat error: ${err instanceof Error ? err.message : String(err)}`, 'error')
    }
    setSending(false)
    inputRef.current?.focus()
  }

  const startNewChat = () => {
    setActiveChatId(null)
    setMessages([])
    inputRef.current?.focus()
  }

  const loadChat = (chat: SavedChat) => {
    setActiveChatId(chat.id)
    setMessages(chat.messages)
  }

  const deleteChat = (chatId: string) => {
    if (!brandId) return
    const updated = chats.filter(c => c.id !== chatId)
    setChats(updated)
    saveChats(brandId, updated)
    if (activeChatId === chatId) { setActiveChatId(null); setMessages([]) }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() }
  }

  const timeAgo = (date: string) => {
    const hours = (Date.now() - new Date(date).getTime()) / (1000 * 60 * 60)
    if (hours < 1) return 'just now'
    if (hours < 24) return `${Math.floor(hours)}h ago`
    if (hours < 168) return `${Math.floor(hours / 24)}d ago`
    return new Date(date).toLocaleDateString()
  }

  return (
    <div className="animate-fadeIn flex h-[calc(100vh-120px)]">
      {/* Sidebar - Chat History */}
      <div className="w-64 border-r border-border flex flex-col shrink-0">
        <div className="p-3 border-b border-border">
          <Button onClick={startNewChat} className="w-full justify-center" size="sm">+ New Chat</Button>
        </div>
        <div className="flex-1 overflow-y-auto">
          {chats.length === 0 ? (
            <div className="p-4 text-center text-2xs text-text-dim">No saved chats yet. Start a conversation and it'll appear here.</div>
          ) : (
            <div className="py-1">
              {chats.map(chat => (
                <div key={chat.id}
                  className={`group flex items-center gap-2 px-3 py-2.5 cursor-pointer transition-colors ${
                    activeChatId === chat.id ? 'bg-fulton/10 border-r-2 border-fulton' : 'hover:bg-elevated'
                  }`}
                  onClick={() => loadChat(chat)}>
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-semibold truncate">{chat.title}</div>
                    <div className="text-2xs text-text-dim">{timeAgo(chat.updatedAt)} · {chat.messages.length} msgs</div>
                  </div>
                  <button onClick={e => { e.stopPropagation(); deleteChat(chat.id) }}
                    className="text-2xs text-text-dim hover:text-red opacity-0 group-hover:opacity-100 shrink-0">x</button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col">
        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-4 pb-4">
          {messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center">
              <div className="text-4xl mb-4">💬</div>
              <h3 className="text-xl font-black mb-2">HyperChat</h3>
              <p className="text-sm text-text-dim mb-6 max-w-md">
                {brand?.name ? `Your AI creative strategist for ${brand.name}. ` : 'Your AI creative strategist. '}
                Ask about ad strategy, copy angles, audience insights, or anything creative.
              </p>
              <div className="flex flex-wrap gap-2 justify-center max-w-2xl">
                {suggestions.map(s => (
                  <button key={s} onClick={() => send(s)}
                    className="px-3 py-2 bg-surface border border-border rounded-lg text-xs text-text-muted hover:text-text-primary hover:border-fulton/40 transition-all text-left max-w-md">
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
        <div className="border-t border-border pt-3 pb-1 px-4">
          <div className="flex gap-2 items-end">
            <textarea
              ref={inputRef}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={brand?.name ? `Ask Claude about ${brand.name}...` : 'Ask Claude anything about creative strategy...'}
              className="flex-1 px-4 py-3 bg-surface border border-border rounded-xl text-sm text-text-primary placeholder:text-text-dim resize-none focus:border-fulton focus:outline-none min-h-[44px] max-h-[120px]"
              rows={1}
            />
            <Button onClick={() => send()} disabled={sending || !input.trim()} className="h-[44px]">
              Send
            </Button>
          </div>
          <div className="text-2xs text-text-dim mt-1.5 px-1">Shift+Enter for new line · Chats auto-save</div>
        </div>
      </div>
    </div>
  )
}
