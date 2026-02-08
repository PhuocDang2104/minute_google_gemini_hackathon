import { useState, useEffect, useRef } from 'react';
import {
  Send,
  Sparkles,
  ExternalLink,
  Loader2,
  MessageSquare,
  FileText,
  Clock,
  Trash2,
} from 'lucide-react';
import { aiApi } from '../../../lib/api/ai';
import type { RAGResponse, Citation } from '../../../shared/dto/ai';

interface AIAssistantPanelProps {
  meetingId: string;
}

export const AIAssistantPanel = ({ meetingId }: AIAssistantPanelProps) => {
  const [query, setQuery] = useState('');
  const [responses, setResponses] = useState<RAGResponse[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingHistory, setIsLoadingHistory] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Load history on mount
  useEffect(() => {
    const loadHistory = async () => {
      try {
        const history = await aiApi.getRAGHistory(meetingId);
        setResponses(history.queries.reverse());
      } catch (err) {
        console.error('Failed to load RAG history:', err);
      } finally {
        setIsLoadingHistory(false);
      }
    };
    loadHistory();
  }, [meetingId]);

  // Scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [responses]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim() || isLoading) return;

    const userQuery = query.trim();
    setQuery('');
    setIsLoading(true);

    try {
      const response = await aiApi.queryRAG(userQuery, meetingId);
      setResponses(prev => [...prev, response]);
    } catch (err) {
      console.error('Failed to query RAG:', err);
      // Mock response
      const mockResponse: RAGResponse = {
        id: Date.now().toString(),
        query: userQuery,
        answer: 'Dựa trên các tài liệu trong knowledge base, tôi tìm thấy thông tin liên quan đến câu hỏi của bạn. Vui lòng tham khảo các citations bên dưới để xem chi tiết.',
        citations: [
          {
            title: 'Internal Documentation',
            source: 'Wiki',
            snippet: 'Thông tin tham khảo từ tài liệu nội bộ...',
            url: 'https://wiki.lpbank.vn/docs',
          },
        ],
        confidence: 0.75,
        created_at: new Date().toISOString(),
      };
      setResponses(prev => [...prev, mockResponse]);
    } finally {
      setIsLoading(false);
    }
  };

  const SUGGESTED_QUESTIONS = [
    'Recap phiên hiện tại: 3 điểm chính, 2 rủi ro, 1 quyết định quan trọng.',
    'Action items nào đã có owner nhưng chưa có deadline rõ?',
    'Quyết định nào cần bằng chứng bổ sung từ tài liệu đã upload?',
    'Đề xuất follow-up trong 24h tới theo mức độ ưu tiên.',
  ];

  return (
    <div className="ai-assistant-panel">
      <div className="ai-assistant__header">
        <div className="ai-assistant__title">
          <Sparkles size={20} />
          <h3>Minute AI Assistant</h3>
        </div>
        <p className="ai-assistant__subtitle">
          Hỏi theo context cuộc họp/dự án với câu trả lời ưu tiên bằng chứng
        </p>
      </div>

      {/* Messages */}
      <div className="ai-assistant__messages">
        {isLoadingHistory ? (
          <div className="form-loading">
            <Loader2 size={20} className="spinner" />
          </div>
        ) : responses.length === 0 ? (
          <div className="ai-assistant__empty">
            <MessageSquare size={32} className="text-muted" />
            <p>Bắt đầu hỏi Minute AI</p>
            <div className="suggested-questions">
              {SUGGESTED_QUESTIONS.map((q, i) => (
                <button
                  key={i}
                  className="suggested-question"
                  onClick={() => setQuery(q)}
                >
                  {q}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <>
            {responses.map(response => (
              <div key={response.id} className="ai-message-group">
                {/* User Query */}
                <div className="ai-message ai-message--user">
                  <div className="ai-message__content">{response.query}</div>
                </div>

                {/* AI Response */}
                <div className="ai-message ai-message--assistant">
                  <div className="ai-message__header">
                    <Sparkles size={14} />
                    <span>Minute AI</span>
                    <span className="ai-message__confidence">
                      {Math.round(response.confidence * 100)}% confidence
                    </span>
                  </div>
                  <div className="ai-message__content">
                    {response.answer}
                  </div>

                  {/* Citations */}
                  {response.citations.length > 0 && (
                    <div className="ai-message__citations">
                      <div className="citations-header">
                        <FileText size={12} />
                        <span>Sources ({response.citations.length})</span>
                      </div>
                      {response.citations.map((citation, i) => (
                        <CitationCard key={i} citation={citation} />
                      ))}
                    </div>
                  )}

                  <div className="ai-message__footer">
                    <Clock size={12} />
                    <span>
                      {new Date(response.created_at).toLocaleTimeString('vi-VN', {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                  </div>
                </div>
              </div>
            ))}
            <div ref={messagesEndRef} />
          </>
        )}

        {/* Loading indicator */}
        {isLoading && (
          <div className="ai-message ai-message--assistant ai-message--loading">
            <div className="ai-message__header">
              <Sparkles size={14} />
              <span>Minute AI đang suy nghĩ...</span>
            </div>
            <div className="ai-message__loading-dots">
              <span></span>
              <span></span>
              <span></span>
            </div>
          </div>
        )}
      </div>

      {/* Input */}
      <form className="ai-assistant__input" onSubmit={handleSubmit}>
        <input
          type="text"
          placeholder="Hỏi về recap, decision, action, risk hoặc policy liên quan..."
          value={query}
          onChange={e => setQuery(e.target.value)}
          disabled={isLoading}
        />
        <button
          type="submit"
          className="btn btn--primary"
          disabled={!query.trim() || isLoading}
        >
          {isLoading ? <Loader2 size={18} className="spinner" /> : <Send size={18} />}
        </button>
      </form>
    </div>
  );
};

// Citation Card
const CitationCard = ({ citation }: { citation: Citation }) => {
  return (
    <a
      href={citation.url || '#'}
      target="_blank"
      rel="noopener noreferrer"
      className="citation-card"
    >
      <div className="citation-card__title">
        {citation.title}
        {citation.page && <span className="citation-card__page">p.{citation.page}</span>}
      </div>
      <div className="citation-card__snippet">{citation.snippet}</div>
      <div className="citation-card__source">
        {citation.source}
        <ExternalLink size={10} />
      </div>
    </a>
  );
};

export default AIAssistantPanel;
