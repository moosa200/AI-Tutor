'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { useUser } from '@clerk/nextjs'
import { ScrollArea } from '@/components/ui/scroll-area'
import { ChatMessage } from '@/components/chat/chat-message'
import { ChatInput } from '@/components/chat/chat-input'
import { Button } from '@/components/ui/button'
import { Trash2, BookOpen, Plus, MessageSquare, ArrowLeft } from 'lucide-react'
import Link from 'next/link'

interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
}

interface ChatSession {
  id: string
  title: string
  updatedAt: string
  messages: { content: string; role: string }[]
}

function formatRelativeTime(dateStr: string) {
  const date = new Date(dateStr)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMins = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMins / 60)
  const diffDays = Math.floor(diffHours / 24)

  if (diffMins < 1) return 'Just now'
  if (diffMins < 60) return `${diffMins}m ago`
  if (diffHours < 24) return `${diffHours}h ago`
  if (diffDays < 7) return `${diffDays}d ago`
  return date.toLocaleDateString()
}

export default function ChatPage() {
  const { user } = useUser()
  const [sessions, setSessions] = useState<ChatSession[]>([])
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [sessionsLoading, setSessionsLoading] = useState(true)
  const scrollRef = useRef<HTMLDivElement>(null)

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [messages])

  const loadSessions = useCallback(async () => {
    try {
      const res = await fetch('/api/chat/sessions')
      const data = await res.json()
      return data.sessions as ChatSession[]
    } catch {
      return []
    }
  }, [])

  const selectSession = useCallback(async (sessionId: string) => {
    setActiveSessionId(sessionId)
    setMessages([])
    window.history.replaceState(null, '', `/chat?session=${sessionId}`)

    try {
      const res = await fetch(`/api/chat/sessions/${sessionId}/messages`)
      const data = await res.json()
      if (data.messages) {
        setMessages(
          data.messages.map((m: any) => ({
            id: m.id,
            role: m.role as 'user' | 'assistant',
            content: m.content,
          }))
        )
      }
    } catch {
      // ignore
    }
  }, [])

  // On mount: load sessions, auto-select most recent or URL param
  useEffect(() => {
    const init = async () => {
      setSessionsLoading(true)
      let list = await loadSessions()

      if (list.length === 0) {
        // Auto-create first session
        const res = await fetch('/api/chat/sessions', { method: 'POST' })
        const data = await res.json()
        list = [data.session]
      }

      setSessions(list)

      // Check URL for session param
      const urlParams = new URLSearchParams(window.location.search)
      const urlSession = urlParams.get('session')
      const target = urlSession && list.find(s => s.id === urlSession)
        ? urlSession
        : list[0].id

      await selectSession(target)
      setSessionsLoading(false)
    }
    init()
  }, [loadSessions, selectSession])

  const createSession = async () => {
    try {
      const res = await fetch('/api/chat/sessions', { method: 'POST' })
      const data = await res.json()
      const newSession: ChatSession = data.session
      setSessions(prev => [newSession, ...prev])
      await selectSession(newSession.id)
    } catch {
      // ignore
    }
  }

  const deleteSession = async (sessionId: string, e: React.MouseEvent) => {
    e.stopPropagation()
    try {
      await fetch(`/api/chat/sessions/${sessionId}`, { method: 'DELETE' })
      const remaining = sessions.filter(s => s.id !== sessionId)
      setSessions(remaining)

      if (activeSessionId === sessionId) {
        if (remaining.length > 0) {
          await selectSession(remaining[0].id)
        } else {
          // Create a new session if all deleted
          await createSession()
        }
      }
    } catch {
      // ignore
    }
  }

  const sendMessage = async (content: string) => {
    if (!activeSessionId) return

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content,
    }

    setMessages(prev => [...prev, userMessage])
    setIsLoading(true)

    const assistantId = (Date.now() + 1).toString()
    setMessages(prev => [
      ...prev,
      { id: assistantId, role: 'assistant', content: '' },
    ])

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [...messages, userMessage].map(m => ({
            role: m.role,
            content: m.content,
          })),
          sessionId: activeSessionId,
        }),
      })

      if (!response.ok) throw new Error('Failed to get response')

      const reader = response.body?.getReader()
      const decoder = new TextDecoder()

      if (reader) {
        let fullContent = ''
        while (true) {
          const { done, value } = await reader.read()
          if (done) break

          const chunk = decoder.decode(value)
          fullContent += chunk

          setMessages(prev =>
            prev.map(m =>
              m.id === assistantId ? { ...m, content: fullContent } : m
            )
          )
        }
      }

      // Refresh sessions list to get updated title + ordering
      const updated = await loadSessions()
      setSessions(updated)
    } catch (error) {
      console.error('Chat error:', error)
      setMessages(prev =>
        prev.map(m =>
          m.id === assistantId
            ? { ...m, content: 'Sorry, I encountered an error. Please try again.' }
            : m
        )
      )
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="flex h-screen flex-col">
      {/* Header */}
      <header className="flex h-14 items-center justify-between border-b px-4 shrink-0">
        <div className="flex items-center gap-2">
          <Link href="/dashboard" className="flex items-center gap-2 hover:opacity-80">
            <ArrowLeft className="h-4 w-4" />
            <BookOpen className="h-5 w-5 text-primary" />
            <span className="font-semibold">Physics 9702</span>
          </Link>
          <span className="text-muted-foreground">|</span>
          <span className="text-sm text-muted-foreground">AI Tutor</span>
        </div>
        <span className="text-sm text-muted-foreground">
          {user?.firstName || 'Student'}
        </span>
      </header>

      {/* Body: sidebar + chat area */}
      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar */}
        <aside className="w-64 border-r flex flex-col bg-muted/30 shrink-0">
          <div className="p-3 border-b">
            <Button
              variant="outline"
              size="sm"
              className="w-full justify-start gap-2"
              onClick={createSession}
            >
              <Plus className="h-4 w-4" />
              New Chat
            </Button>
          </div>

          <ScrollArea className="flex-1">
            {sessionsLoading ? (
              <div className="p-4 text-sm text-muted-foreground">Loading...</div>
            ) : (
              <div className="p-2 space-y-1">
                {sessions.map(session => (
                  <div
                    key={session.id}
                    onClick={() => selectSession(session.id)}
                    className={`group flex items-start gap-2 rounded-md px-3 py-2 cursor-pointer text-sm transition-colors ${
                      activeSessionId === session.id
                        ? 'bg-background shadow-sm text-foreground'
                        : 'text-muted-foreground hover:bg-background/60 hover:text-foreground'
                    }`}
                  >
                    <MessageSquare className="h-4 w-4 mt-0.5 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="truncate font-medium leading-tight">
                        {session.title}
                      </p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {formatRelativeTime(session.updatedAt)}
                      </p>
                    </div>
                    <button
                      onClick={(e) => deleteSession(session.id, e)}
                      className="opacity-0 group-hover:opacity-100 hover:text-destructive transition-opacity mt-0.5 shrink-0"
                      title="Delete"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </ScrollArea>
        </aside>

        {/* Chat area */}
        <div className="flex flex-1 flex-col overflow-hidden">
          <ScrollArea className="flex-1 p-4" ref={scrollRef}>
            {messages.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-center p-8">
                <BookOpen className="h-12 w-12 text-muted-foreground mb-4" />
                <h2 className="text-xl font-semibold mb-2">Physics 9702 Tutor</h2>
                <p className="text-muted-foreground max-w-md mb-6">
                  Ask me anything about A Level Physics. I can explain concepts, help you
                  practice past paper questions, and give you exam technique tips.
                </p>
                <div className="grid gap-2 text-sm text-muted-foreground">
                  <p className="font-medium">Try asking:</p>
                  <button
                    onClick={() => sendMessage("Explain the photoelectric effect and why classical physics couldn't explain it")}
                    className="text-left hover:text-primary transition-colors"
                  >
                    "Explain the photoelectric effect"
                  </button>
                  <button
                    onClick={() => sendMessage("Give me a practice question on circular motion")}
                    className="text-left hover:text-primary transition-colors"
                  >
                    "Give me a practice question on circular motion"
                  </button>
                  <button
                    onClick={() => sendMessage("What are common mistakes in electricity questions?")}
                    className="text-left hover:text-primary transition-colors"
                  >
                    "What are common mistakes in electricity questions?"
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-4 max-w-3xl mx-auto">
                {messages.map(message => (
                  <ChatMessage
                    key={message.id}
                    role={message.role}
                    content={message.content}
                  />
                ))}
              </div>
            )}
          </ScrollArea>

          <div className="max-w-3xl mx-auto w-full px-4">
            <ChatInput onSend={sendMessage} isLoading={isLoading} />
          </div>
        </div>
      </div>
    </div>
  )
}
