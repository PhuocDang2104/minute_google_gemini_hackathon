import { useEffect, useMemo, useState } from 'react';
import { Bot, MessageCircle, X, Link as LinkIcon, MessageSquare } from 'lucide-react';
import { aiApi } from '../../../lib/api/ai';
import { aiQueries } from '../../../store/mockData';
import type { Citation } from '../../../shared/dto/ai';
import { useLocaleText } from '../../../i18n/useLocaleText';

type ChatMessage = {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  createdAt: string;
  citations?: Citation[];
};

interface AIAssistantChatProps {
  meetingId: string;
  meetingTitle?: string;
}

export const AIAssistantChat = ({ meetingId, meetingTitle }: AIAssistantChatProps) => {
  const { lt } = useLocaleText();
  const [isOpen, setIsOpen] = useState(false);
  const [input, setInput] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasLoadedHistory, setHasLoadedHistory] = useState(false);
  const quickPrompts = useMemo(
    () => [
      lt(
        'Recap 5 phút gần nhất: điểm thống nhất, điểm còn mở, và rủi ro chính.',
        'Recap the last 5 minutes: agreements, open points, and key risks.',
      ),
      lt(
        'Liệt kê action items mới theo owner, deadline, priority.',
        'List new action items by owner, deadline, and priority.',
      ),
      lt(
        'Những quyết định nào đã chốt? Nêu lý do và bằng chứng liên quan.',
        'Which decisions are confirmed? Include rationale and evidence.',
      ),
      lt(
        'Đề xuất email follow-up ngắn cho stakeholder với next steps rõ ràng.',
        'Draft a short follow-up email for stakeholders with clear next steps.',
      ),
    ],
    [lt],
  );

  const seededHistory = useMemo<ChatMessage[]>(() => {
    const history = aiQueries.filter(q => q.meetingId === meetingId);
    if (!history.length) return [];

    return history.flatMap((item, index) => {
      const ts = new Date().toISOString();
      return [
        {
          id: `seed-user-${index}`,
          role: 'user',
          content: item.query,
          createdAt: ts,
        },
        {
          id: `seed-assistant-${index}`,
          role: 'assistant',
          content: item.answer,
          citations: item.citations.map(c => ({
            title: c.title,
            snippet: c.snippet,
            page: c.page,
            source: 'Mock RAG',
          })),
          createdAt: ts,
        },
      ];
    });
  }, [meetingId]);

  const [messages, setMessages] = useState<ChatMessage[]>([]);

  useEffect(() => {
    setMessages(seededHistory);
    setHasLoadedHistory(false);
  }, [seededHistory]);

  useEffect(() => {
    if (!isOpen || !meetingId || hasLoadedHistory) return;
    let cancelled = false;

    const loadHistory = async () => {
      try {
        const history = await aiApi.getRAGHistory(meetingId);
        if (!history?.queries?.length || cancelled) return;
        const converted = history.queries.flatMap((item, index) => ([
          {
            id: item.id || `hist-user-${index}`,
            role: 'user' as const,
            content: item.query,
            createdAt: item.created_at || new Date().toISOString(),
          },
          {
            id: `${item.id || `hist-assistant-${index}`}-answer`,
            role: 'assistant' as const,
            content: item.answer,
            createdAt: item.created_at || new Date().toISOString(),
            citations: item.citations,
          },
        ]));
        setMessages(converted);
        setHasLoadedHistory(true);
      } catch (err) {
        console.warn('Falling back to seeded RAG history', err);
      }
    };

    loadHistory();

    return () => {
      cancelled = true;
    };
  }, [isOpen, meetingId, hasLoadedHistory]);

  const handleSend = async () => {
    const trimmed = input.trim();
    if (!trimmed || isSending) return;

    const now = new Date().toISOString();
    const userMessage: ChatMessage = {
      id: `user-${now}`,
      role: 'user',
      content: trimmed,
      createdAt: now,
    };

    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsSending(true);
    setError(null);

    try {
      const response = await aiApi.queryRAG(trimmed, meetingId);
      const assistantMessage: ChatMessage = {
        id: response.id || `assistant-${Date.now()}`,
        role: 'assistant',
        content: response.answer,
        citations: response.citations,
        createdAt: response.created_at || new Date().toISOString(),
      };
      setMessages(prev => [...prev, assistantMessage]);
    } catch (err) {
      console.error('Failed to send AI chat message', err);
      setError(lt('Chưa gửi được tới AI. Kiểm tra backend hoặc thử lại sau.', 'Failed to send to AI. Check backend or try again.'));
    } finally {
      setIsSending(false);
    }
  };

  const handleQuickPrompt = (prompt: string) => {
    setInput(prompt);
    setIsOpen(true);
  };

  const renderCitations = (citations?: Citation[]) => {
    if (!citations || citations.length === 0) return null;
    return (
      <div className="ai-chatbox__citations">
        {citations.map((c, idx) => (
              <div key={`${c.title}-${idx}`} className="ai-chatbox__citation">
                <LinkIcon size={12} />
                <div>
                  <div className="ai-chatbox__citation-title">{c.title}</div>
                  {c.page && <div className="ai-chatbox__citation-meta">{lt('Trang', 'Page')} {c.page}</div>}
                  {c.snippet && <div className="ai-chatbox__citation-snippet">{c.snippet}</div>}
                </div>
              </div>
        ))}
      </div>
    );
  };

  return (
    <>
      {!isOpen && (
        <button className="ai-chat-trigger" onClick={() => setIsOpen(true)} title={lt('Khung hỏi đáp AI', 'AI Q&A Chatbox')}>
          <MessageSquare size={18} />
        </button>
      )}

      {isOpen && (
        <div className="ai-chatbox">
          <div className="ai-chatbox__header">
            <div>
              <div className="ai-chatbox__eyebrow">
                <Bot size={14} />
                {lt('AI Trong cuộc họp', 'In-Meeting AI')}
              </div>
              <div className="ai-chatbox__title">{lt('Khung hỏi đáp AI', 'AI Q&A Chatbox')}</div>
              <div className="ai-chatbox__subtitle">
                {meetingTitle || lt('Cuộc họp', 'Meeting')} · Q&A RAG + Recap + ADR
              </div>
            </div>
            <button className="btn btn--ghost btn--icon" onClick={() => setIsOpen(false)}>
              <X size={16} />
            </button>
          </div>

          <div className="ai-chatbox__messages">
            {messages.map(msg => (
              <div key={msg.id} className={`ai-chatbox__message ai-chatbox__message--${msg.role}`}>
                <div className="ai-chatbox__avatar">
                  {msg.role === 'assistant' ? <Bot size={16} /> : <MessageCircle size={16} />}
                </div>
                <div className="ai-chatbox__bubble">
                  <div className="ai-chatbox__role">
                    {msg.role === 'assistant' ? 'Minute AI' : lt('Bạn', 'You')}
                  </div>
                  <div className="ai-chatbox__text">{msg.content}</div>
                  {renderCitations(msg.citations)}
                </div>
              </div>
            ))}
            {isSending && (
              <div className="ai-chatbox__message ai-chatbox__message--assistant ai-chatbox__message--pending">
                <div className="ai-chatbox__avatar">
                  <Bot size={16} />
                </div>
                <div className="ai-chatbox__bubble">
                  <div className="typing-indicator">
                    <span></span>
                    <span></span>
                    <span></span>
                  </div>
                  <div className="ai-chatbox__text">{lt('Đang tạo câu trả lời...', 'Generating answer...')}</div>
                </div>
              </div>
            )}
          </div>

          {error && <div className="ai-chatbox__error">{error}</div>}

          <div className="ai-chatbox__input">
            <textarea
              placeholder={lt(
                'Hỏi về recap, decision, action item hoặc tài liệu liên quan...',
                'Ask about recap, decisions, action items, or related documents...',
              )}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSend();
                }
              }}
              rows={2}
            />
            <button className="btn btn--primary" onClick={handleSend} disabled={isSending}>
              {isSending ? lt('Đang gửi...', 'Sending...') : lt('Gửi', 'Send')}
            </button>
          </div>

          <div className="ai-chatbox__quick">
            <div className="ai-chatbox__quick-label">{lt('Gợi ý nhanh', 'Quick prompts')}</div>
            <div className="ai-chatbox__quick-list">
              {quickPrompts.map(prompt => (
                <button
                  key={prompt}
                  className="ai-chat-chip ai-chat-chip--ghost"
                  onClick={() => handleQuickPrompt(prompt)}
                >
                  {prompt}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default AIAssistantChat;
