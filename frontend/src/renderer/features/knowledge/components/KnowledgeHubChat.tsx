/**
 * KnowledgeHubChat - AI Chat Panel for Knowledge Hub
 * Modern enterprise-style chat interface
 */
import { useState, useRef, useEffect, useCallback } from 'react'
import { Bot, Send, Sparkles, RefreshCw, ChevronUp, X, AlertCircle } from 'lucide-react'
import { knowledgeApi } from '../../../lib/api/knowledge'

// Types
interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: Date
  isLoading?: boolean
  isError?: boolean
}

interface KnowledgeHubChatProps {
  /** Whether the chat is expanded (for mobile drawer) */
  isExpanded?: boolean
  /** Callback when chat is toggled (mobile) */
  onToggle?: () => void
  /** Quick suggestion chips */
  suggestions?: string[]
}

// Default suggestions
const DEFAULT_SUGGESTIONS = [
  'Data retention policy',
  'KYC requirements', 
  'Security standards',
  'Quy trình Change Request',
]

// Generate unique ID
const generateId = () => `msg-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`

export const KnowledgeHubChat = ({
  isExpanded = true,
  onToggle,
  suggestions = DEFAULT_SUGGESTIONS,
}: KnowledgeHubChatProps) => {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [inputValue, setInputValue] = useState('')
  const [isStreaming, setIsStreaming] = useState(false)
  const [error, setError] = useState<string | null>(null)
  
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  // Auto-scroll to bottom when messages change
  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [])

  useEffect(() => {
    scrollToBottom()
  }, [messages, scrollToBottom])

  // Auto-resize textarea
  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInputValue(e.target.value)
    // Auto-resize
    e.target.style.height = 'auto'
    e.target.style.height = `${Math.min(e.target.scrollHeight, 120)}px`
  }

  // Send message
  const sendMessage = async (content: string) => {
    if (!content.trim() || isStreaming) return

    const userMessage: ChatMessage = {
      id: generateId(),
      role: 'user',
      content: content.trim(),
      timestamp: new Date(),
    }

    // Add user message
    setMessages(prev => [...prev, userMessage])
    setInputValue('')
    setError(null)
    setIsStreaming(true)

    // Reset textarea height
    if (inputRef.current) {
      inputRef.current.style.height = 'auto'
    }

    // Add loading message
    const loadingId = generateId()
    setMessages(prev => [...prev, {
      id: loadingId,
      role: 'assistant',
      content: '',
      timestamp: new Date(),
      isLoading: true,
    }])

    try {
      const response = await knowledgeApi.query({
        query: content.trim(),
        include_documents: true,
        include_meetings: true,
        limit: 5,
      })

      // Replace loading message with actual response
      setMessages(prev => prev.map(msg => 
        msg.id === loadingId
          ? {
              ...msg,
              content: response.answer,
              isLoading: false,
            }
          : msg
      ))
    } catch (err) {
      console.error('Chat error:', err)
      setError('Không thể kết nối với AI. Vui lòng thử lại.')
      
      // Mark message as error
      setMessages(prev => prev.map(msg =>
        msg.id === loadingId
          ? {
              ...msg,
              content: 'Đã xảy ra lỗi. Vui lòng thử lại.',
              isLoading: false,
              isError: true,
            }
          : msg
      ))
    } finally {
      setIsStreaming(false)
    }
  }

  // Handle key press
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage(inputValue)
    }
  }

  // Handle suggestion click
  const handleSuggestionClick = (suggestion: string) => {
    sendMessage(suggestion)
  }

  // Retry last message
  const retryLastMessage = () => {
    const lastUserMessage = [...messages].reverse().find(m => m.role === 'user')
    if (lastUserMessage) {
      // Remove error message
      setMessages(prev => prev.filter(m => !m.isError))
      sendMessage(lastUserMessage.content)
    }
  }

  // Clear chat
  const clearChat = () => {
    setMessages([])
    setError(null)
  }

  const isEmpty = messages.length === 0

  return (
    <div className={`knowledge-chat ${isExpanded ? 'knowledge-chat--expanded' : ''}`}>
      {/* Header */}
      <div className="knowledge-chat__header">
        <div className="knowledge-chat__header-left">
          <div className="knowledge-chat__avatar">
            <Bot size={18} />
          </div>
          <div className="knowledge-chat__header-text">
            <h3 className="knowledge-chat__title">Hỏi AI</h3>
            <p className="knowledge-chat__subtitle">Hỏi về policies, tài liệu...</p>
          </div>
        </div>
        <div className="knowledge-chat__header-actions">
          {messages.length > 0 && (
            <button 
              className="knowledge-chat__header-btn"
              onClick={clearChat}
              title="Xóa cuộc trò chuyện"
            >
              <RefreshCw size={16} />
            </button>
          )}
          {onToggle && (
            <button 
              className="knowledge-chat__header-btn knowledge-chat__toggle-btn"
              onClick={onToggle}
            >
              {isExpanded ? <ChevronUp size={18} /> : <X size={18} />}
            </button>
          )}
        </div>
      </div>

      {/* Messages Area */}
      <div className="knowledge-chat__messages">
        {isEmpty ? (
          // Empty State
          <div className="knowledge-chat__empty">
            <div className="knowledge-chat__empty-icon">
              <Sparkles size={28} />
            </div>
            <h4 className="knowledge-chat__empty-title">Xin chào!</h4>
            <p className="knowledge-chat__empty-text">
              Tôi có thể giúp bạn tìm kiếm thông tin về policies, quy định và tài liệu.
            </p>
            
            {/* Quick Suggestions */}
            <div className="knowledge-chat__suggestions">
              <span className="knowledge-chat__suggestions-label">Gợi ý:</span>
              <div className="knowledge-chat__suggestions-list">
                {suggestions.map((suggestion, idx) => (
                  <button
                    key={idx}
                    className="knowledge-chat__suggestion"
                    onClick={() => handleSuggestionClick(suggestion)}
                  >
                    {suggestion}
                  </button>
                ))}
              </div>
            </div>
          </div>
        ) : (
          // Chat Messages
          <div className="knowledge-chat__message-list">
            {messages.map((message) => (
              <div
                key={message.id}
                className={`knowledge-chat__message knowledge-chat__message--${message.role} ${
                  message.isLoading ? 'knowledge-chat__message--loading' : ''
                } ${message.isError ? 'knowledge-chat__message--error' : ''}`}
              >
                {message.role === 'assistant' && (
                  <div className="knowledge-chat__message-avatar">
                    <Bot size={14} />
                  </div>
                )}
                <div className="knowledge-chat__message-bubble">
                  {message.isLoading ? (
                    <div className="knowledge-chat__typing">
                      <span></span>
                      <span></span>
                      <span></span>
                    </div>
                  ) : (
                    <div className="knowledge-chat__message-content">
                      {message.content}
                    </div>
                  )}
                </div>
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>
        )}

        {/* Error Toast */}
        {error && (
          <div className="knowledge-chat__error">
            <AlertCircle size={16} />
            <span>{error}</span>
            <button 
              className="knowledge-chat__error-retry"
              onClick={retryLastMessage}
            >
              Thử lại
            </button>
          </div>
        )}
      </div>

      {/* Input Area */}
      <div className="knowledge-chat__input-area">
        {/* Quick suggestions when not empty */}
        {!isEmpty && messages.length < 3 && (
          <div className="knowledge-chat__quick-chips">
            {suggestions.slice(0, 2).map((suggestion, idx) => (
              <button
                key={idx}
                className="knowledge-chat__quick-chip"
                onClick={() => handleSuggestionClick(suggestion)}
                disabled={isStreaming}
              >
                {suggestion}
              </button>
            ))}
          </div>
        )}
        
        <div className="knowledge-chat__input-wrapper">
          <textarea
            ref={inputRef}
            className="knowledge-chat__input"
            value={inputValue}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            placeholder="Nhập câu hỏi..."
            rows={1}
            disabled={isStreaming}
          />
          <button
            className="knowledge-chat__send"
            onClick={() => sendMessage(inputValue)}
            disabled={!inputValue.trim() || isStreaming}
          >
            <Send size={18} />
          </button>
        </div>
      </div>
    </div>
  )
}

export default KnowledgeHubChat

