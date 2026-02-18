'use client'

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { toast } from 'sonner'
import { PageHeader } from '@/components/layout/page-header'
import { ChatInterface } from '@/components/analyst/chat-interface'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { api } from '@/lib/api'
import { useAnalystQuery } from '@/lib/hooks/use-analyst'
import { AlertTriangle, Zap } from 'lucide-react'

interface Message {
  role: 'user' | 'assistant'
  content: string
}

const defaultSuggestions = [
  'Is this quotation competitive compared to history?',
  'Which items should I negotiate on?',
  'Summarize pricing trends for top SKUs',
  "What's the total spend impact?",
]

export default function AnalystPage() {
  const [messages, setMessages] = useState<Message[]>([
    {
      role: 'assistant',
      content:
        'Welcome! I\'m your AI procurement analyst powered by H2OGPTE. I can help you analyze pricing, compare quotations, identify trends, and find negotiation opportunities. What would you like to know?',
    },
  ])
  const [suggestions, setSuggestions] = useState<string[]>(defaultSuggestions)

  const { data: health } = useQuery({
    queryKey: ['health'],
    queryFn: () => api.health.h2ogpte(),
  })

  const analystMutation = useAnalystQuery()

  const handleSend = async (message: string) => {
    setMessages((prev) => [...prev, { role: 'user', content: message }])
    setSuggestions([])

    try {
      const result = await analystMutation.mutateAsync({ query: message })
      setMessages((prev) => [...prev, { role: 'assistant', content: result.response }])
      setSuggestions(result.suggestions || [])
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Failed to get response'
      setMessages((prev) => [
        ...prev,
        { role: 'assistant', content: `Sorry, I encountered an error: ${errorMsg}` },
      ])
      toast.error('Analyst query failed')
      setSuggestions(defaultSuggestions)
    }
  }

  const handleClear = () => {
    setMessages([
      {
        role: 'assistant',
        content: 'Chat cleared. How can I help you with your procurement data?',
      },
    ])
    setSuggestions(defaultSuggestions)
  }

  if (health && !health.connected) {
    return (
      <div className="space-y-6">
        <PageHeader title="AI Analyst" />
        <Card>
          <CardContent className="flex flex-col items-center justify-center gap-4 p-12">
            <AlertTriangle className="h-12 w-12 text-amber-400" />
            <h3 className="text-lg font-semibold">H2OGPTE Not Connected</h3>
            <p className="text-sm text-muted-foreground text-center max-w-md">
              The AI analyst requires an active H2OGPTE connection. Please check your
              configuration and ensure the service is running.
            </p>
            {health.error && (
              <p className="text-xs text-red-400 font-mono">{health.error}</p>
            )}
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <PageHeader
        title="AI Analyst"
        actions={
          <Badge variant="outline" className="gap-1">
            <Zap className="h-3 w-3" />
            {health?.model || 'H2OGPTE'}
          </Badge>
        }
      />

      <ChatInterface
        messages={messages}
        suggestions={suggestions}
        isLoading={analystMutation.isPending}
        onSend={handleSend}
        onClear={handleClear}
      />
    </div>
  )
}
