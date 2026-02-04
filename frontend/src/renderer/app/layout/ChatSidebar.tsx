import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { Bot, RefreshCw, Send, Sparkles, X } from 'lucide-react';
import { aiApi } from '../../lib/api/ai';
import { knowledgeApi, type KnowledgeDocument } from '../../lib/api/knowledge';
import { useTranslation } from '../../contexts/LanguageContext';
import { useChatContext, type ChatScope, type MeetingPhase } from '../../contexts/ChatContext';
import type { Citation } from '../../shared/dto/ai';

type ChatCitation = {
  title: string;
  snippet?: string;
  meta?: string;
  url?: string;
};

type ChatMessage = {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  createdAt: string;
  citations?: ChatCitation[];
  isLoading?: boolean;
  isError?: boolean;
};

type RouteContext = {
  scope: ChatScope;
  meetingId?: string;
  projectId?: string;
  phase?: MeetingPhase;
};

type ResolvedContext = {
  key: string;
  scope: ChatScope;
  meetingId?: string;
  projectId?: string;
  phase?: MeetingPhase;
  title: string;
  subtitle: string;
  placeholder: string;
  promptPrefix?: string;
  suggestions: string[];
};

const SIDEBAR_STORAGE_KEY = 'minute_ai_sidebar_open';

const suggestionKeys = {
  general: [
    'ai.sidebar.contexts.general.suggestion1',
    'ai.sidebar.contexts.general.suggestion2',
    'ai.sidebar.contexts.general.suggestion3',
  ],
  knowledge: [
    'ai.sidebar.contexts.knowledge.suggestion1',
    'ai.sidebar.contexts.knowledge.suggestion2',
    'ai.sidebar.contexts.knowledge.suggestion3',
  ],
  project: [
    'ai.sidebar.contexts.project.suggestion1',
    'ai.sidebar.contexts.project.suggestion2',
    'ai.sidebar.contexts.project.suggestion3',
  ],
  meeting: {
    default: [
      'ai.sidebar.contexts.meeting.default.suggestion1',
      'ai.sidebar.contexts.meeting.default.suggestion2',
      'ai.sidebar.contexts.meeting.default.suggestion3',
    ],
    pre: [
      'ai.sidebar.contexts.meeting.pre.suggestion1',
      'ai.sidebar.contexts.meeting.pre.suggestion2',
      'ai.sidebar.contexts.meeting.pre.suggestion3',
    ],
    in: [
      'ai.sidebar.contexts.meeting.in.suggestion1',
      'ai.sidebar.contexts.meeting.in.suggestion2',
      'ai.sidebar.contexts.meeting.in.suggestion3',
    ],
    post: [
      'ai.sidebar.contexts.meeting.post.suggestion1',
      'ai.sidebar.contexts.meeting.post.suggestion2',
      'ai.sidebar.contexts.meeting.post.suggestion3',
    ],
  },
};

const createId = () => `msg-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

const deriveRouteContext = (pathname: string): RouteContext => {
  if (pathname.startsWith('/app/knowledge')) {
    return { scope: 'knowledge' };
  }

  const projectMatch = pathname.match(/\/app\/projects\/([^/]+)/);
  if (projectMatch) {
    return { scope: 'project', projectId: projectMatch[1] };
  }

  const meetingMatch = pathname.match(/\/app\/meetings\/([^/]+)(?:\/(pre|in|post|detail|dock|capture))?/);
  if (meetingMatch) {
    const meetingId = meetingMatch[1];
    const segment = meetingMatch[2];
    let phase: MeetingPhase | undefined;
    if (segment === 'pre' || segment === 'in' || segment === 'post') {
      phase = segment;
    } else if (segment === 'dock' || segment === 'capture') {
      phase = 'in';
    }
    return { scope: 'meeting', meetingId, phase };
  }

  return { scope: 'general' };
};

const normalizeRagCitations = (citations?: Citation[]): ChatCitation[] => {
  if (!citations?.length) return [];
  return citations.map(c => ({
    title: c.title,
    snippet: c.snippet,
    meta: [c.source, c.page ? `p.${c.page}` : null].filter(Boolean).join(' | '),
    url: c.url,
  }));
};

const normalizeDocuments = (docs?: KnowledgeDocument[]): ChatCitation[] => {
  if (!docs?.length) return [];
  return docs.map(doc => ({
    title: doc.title,
    snippet: doc.description,
    meta: [doc.source, doc.document_type].filter(Boolean).join(' | '),
    url: doc.file_url,
  }));
};

const ChatSidebar = () => {
  const { t } = useTranslation();
  const { override } = useChatContext();
  const location = useLocation();

  const routeContext = useMemo(() => deriveRouteContext(location.pathname), [location.pathname]);

  const overrideMatchesRoute = useMemo(() => {
    if (!override) return false;
    if (override.scope !== routeContext.scope) return false;
    if (override.scope === 'meeting' && override.meetingId && routeContext.meetingId) {
      return override.meetingId === routeContext.meetingId;
    }
    if (override.scope === 'project' && override.projectId && routeContext.projectId) {
      return override.projectId === routeContext.projectId;
    }
    return true;
  }, [override, routeContext]);

  const activeOverride = overrideMatchesRoute ? override : null;

  const context = useMemo<ResolvedContext>(() => {
    const scope = activeOverride?.scope ?? routeContext.scope;
    const meetingId = activeOverride?.meetingId ?? routeContext.meetingId;
    const projectId = activeOverride?.projectId ?? routeContext.projectId;
    const phase = activeOverride?.phase ?? routeContext.phase;

    const applyName = (label: string, name?: string) => {
      return name ? `${label} - ${name}` : label;
    };

    const resolvePrompt = (templateKey: string, fallbackKey: string, name?: string) => {
      const template = t(templateKey);
      if (template === templateKey) return '';
      const fallbackName = t(fallbackKey);
      const resolvedName = name || fallbackName;
      return template.replace('{name}', resolvedName).trim();
    };

    if (scope === 'knowledge') {
      const baseKey = 'ai.sidebar.contexts.knowledge';
      const suggestions = (activeOverride?.suggestions ?? suggestionKeys.knowledge.map(key => t(key)));
      return {
        key: 'knowledge',
        scope,
        title: applyName(t(`${baseKey}.title`), activeOverride?.title),
        subtitle: activeOverride?.subtitle || t(`${baseKey}.subtitle`),
        placeholder: activeOverride?.placeholder || t(`${baseKey}.placeholder`),
        promptPrefix: activeOverride?.promptPrefix || t(`${baseKey}.prompt`),
        suggestions,
      };
    }

    if (scope === 'project') {
      const baseKey = 'ai.sidebar.contexts.project';
      const suggestions = (activeOverride?.suggestions ?? suggestionKeys.project.map(key => t(key)));
      const promptPrefix = activeOverride?.promptPrefix
        || resolvePrompt(`${baseKey}.prompt`, `${baseKey}.fallbackName`, activeOverride?.title);
      return {
        key: `project:${projectId || 'unknown'}`,
        scope,
        projectId,
        title: applyName(t(`${baseKey}.title`), activeOverride?.title),
        subtitle: activeOverride?.subtitle || t(`${baseKey}.subtitle`),
        placeholder: activeOverride?.placeholder || t(`${baseKey}.placeholder`),
        promptPrefix,
        suggestions,
      };
    }

    if (scope === 'meeting') {
      const meetingPhase = phase || 'default';
      const baseKey = `ai.sidebar.contexts.meeting.${meetingPhase}`;
      const meetingSuggestions = suggestionKeys.meeting[meetingPhase] || suggestionKeys.meeting.default;
      const suggestions = (activeOverride?.suggestions ?? meetingSuggestions.map(key => t(key)));
      const promptPrefix = activeOverride?.promptPrefix
        || resolvePrompt(`${baseKey}.prompt`, 'ai.sidebar.contexts.meeting.fallbackName', activeOverride?.title);
      return {
        key: `meeting:${meetingId || 'unknown'}:${meetingPhase}`,
        scope,
        meetingId,
        phase: meetingPhase === 'default' ? undefined : meetingPhase,
        title: applyName(t(`${baseKey}.title`), activeOverride?.title),
        subtitle: activeOverride?.subtitle || t(`${baseKey}.subtitle`),
        placeholder: activeOverride?.placeholder || t(`${baseKey}.placeholder`),
        promptPrefix,
        suggestions,
      };
    }

    const baseKey = 'ai.sidebar.contexts.general';
    const suggestions = (activeOverride?.suggestions ?? suggestionKeys.general.map(key => t(key)));
    return {
      key: 'general',
      scope: 'general',
      title: applyName(t(`${baseKey}.title`), activeOverride?.title),
      subtitle: activeOverride?.subtitle || t(`${baseKey}.subtitle`),
      placeholder: activeOverride?.placeholder || t(`${baseKey}.placeholder`),
      promptPrefix: activeOverride?.promptPrefix || t(`${baseKey}.prompt`),
      suggestions,
    };
  }, [activeOverride, routeContext, t]);

  const [isOpen, setIsOpen] = useState(() => {
    const stored = localStorage.getItem(SIDEBAR_STORAGE_KEY);
    if (stored === '0' || stored === '1') {
      return stored === '1';
    }
    return window.innerWidth >= 1200;
  });
  const [inputValue, setInputValue] = useState('');
  const [messagesByContext, setMessagesByContext] = useState<Record<string, ChatMessage[]>>({});
  const [pendingByContext, setPendingByContext] = useState<Record<string, boolean>>({});
  const [errorByContext, setErrorByContext] = useState<Record<string, string | null>>({});

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const historyLoadedRef = useRef<Set<string>>(new Set());

  const messages = messagesByContext[context.key] || [];
  const isPending = pendingByContext[context.key] || false;
  const errorMessage = errorByContext[context.key] || null;

  const setMessagesForKey = useCallback((key: string, updater: (current: ChatMessage[]) => ChatMessage[]) => {
    setMessagesByContext(prev => {
      const current = prev[key] || [];
      const next = updater(current);
      if (next === current) return prev;
      return { ...prev, [key]: next };
    });
  }, []);

  useEffect(() => {
    localStorage.setItem(SIDEBAR_STORAGE_KEY, isOpen ? '1' : '0');
  }, [isOpen]);

  useEffect(() => {
    document.body.classList.toggle('ai-sidebar-open', isOpen);
    return () => {
      document.body.classList.remove('ai-sidebar-open');
    };
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isOpen, context.key]);

  useEffect(() => {
    setInputValue('');
    if (inputRef.current) {
      inputRef.current.style.height = 'auto';
    }
  }, [context.key]);

  useEffect(() => {
    if (context.scope !== 'meeting' || !context.meetingId) return;
    if (historyLoadedRef.current.has(context.key)) return;
    historyLoadedRef.current.add(context.key);

    aiApi.getRAGHistory(context.meetingId)
      .then(history => {
        if (!history?.queries?.length) return;
        setMessagesByContext(prev => {
          if ((prev[context.key] || []).length > 0) return prev;
          const converted = history.queries.flatMap(item => {
            const createdAt = item.created_at || new Date().toISOString();
            const userMessage: ChatMessage = {
              id: `${item.id}-user`,
              role: 'user',
              content: item.query,
              createdAt,
            };
            const assistantMessage: ChatMessage = {
              id: `${item.id}-assistant`,
              role: 'assistant',
              content: item.answer,
              createdAt,
              citations: normalizeRagCitations(item.citations),
            };
            return [userMessage, assistantMessage];
          });
          return { ...prev, [context.key]: converted };
        });
      })
      .catch(() => null);
  }, [context.key, context.meetingId, context.scope]);

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInputValue(e.target.value);
    e.target.style.height = 'auto';
    e.target.style.height = `${Math.min(e.target.scrollHeight, 140)}px`;
  };

  const handleSend = async (content: string) => {
    const trimmed = content.trim();
    if (!trimmed || isPending) return;

    const now = new Date().toISOString();
    const activeKey = context.key;
    const assistantId = createId();
    const promptInput = context.promptPrefix ? `${context.promptPrefix}\n\n${trimmed}` : trimmed;

    setMessagesForKey(activeKey, current => ([
      ...current,
      { id: createId(), role: 'user', content: trimmed, createdAt: now },
      { id: assistantId, role: 'assistant', content: '', createdAt: now, isLoading: true },
    ]));
    setInputValue('');
    setPendingByContext(prev => ({ ...prev, [activeKey]: true }));
    setErrorByContext(prev => ({ ...prev, [activeKey]: null }));

    try {
      if (context.scope === 'meeting') {
        const response = await aiApi.queryRAG(promptInput, context.meetingId);
        setMessagesForKey(activeKey, current => current.map(msg => (
          msg.id === assistantId
            ? {
              ...msg,
              content: response.answer,
              citations: normalizeRagCitations(response.citations),
              isLoading: false,
            }
            : msg
        )));
      } else {
        const response = await knowledgeApi.query({
          query: promptInput,
          include_documents: true,
          include_meetings: context.scope !== 'project',
          limit: 5,
          project_id: context.scope === 'project' ? context.projectId : undefined,
        });
        setMessagesForKey(activeKey, current => current.map(msg => (
          msg.id === assistantId
            ? {
              ...msg,
              content: response.answer,
              citations: normalizeDocuments(response.relevant_documents),
              isLoading: false,
            }
            : msg
        )));
      }
    } catch (err) {
      const errorText = t('ai.sidebar.error');
      setErrorByContext(prev => ({ ...prev, [activeKey]: errorText }));
      setMessagesForKey(activeKey, current => current.map(msg => (
        msg.id === assistantId
          ? {
            ...msg,
            content: errorText,
            isLoading: false,
            isError: true,
          }
          : msg
      )));
    } finally {
      setPendingByContext(prev => ({ ...prev, [activeKey]: false }));
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend(inputValue);
    }
  };

  const handleClear = () => {
    setMessagesForKey(context.key, () => []);
    setErrorByContext(prev => ({ ...prev, [context.key]: null }));
  };

  const isEmpty = messages.length === 0;

  return (
    <>
      <aside className={`ai-sidebar ${isOpen ? 'ai-sidebar--open' : ''}`} aria-hidden={!isOpen}>
        <div className="ai-sidebar__header">
          <div className="ai-sidebar__header-left">
            <div className="ai-sidebar__avatar">
              <Bot size={18} />
            </div>
            <div>
              <div className="ai-sidebar__title">{context.title}</div>
              <div className="ai-sidebar__subtitle">{context.subtitle}</div>
            </div>
          </div>
          <div className="ai-sidebar__header-actions">
            {!isEmpty && (
              <button className="ai-sidebar__icon-btn" onClick={handleClear} title={t('ai.sidebar.clear')}>
                <RefreshCw size={16} />
              </button>
            )}
            <button className="ai-sidebar__icon-btn" onClick={() => setIsOpen(false)} title={t('ai.sidebar.toggleClose')}>
              <X size={18} />
            </button>
          </div>
        </div>

        <div className="ai-sidebar__messages">
          {isEmpty ? (
            <div className="ai-sidebar__empty">
              <div className="ai-sidebar__empty-icon">
                <Sparkles size={24} />
              </div>
              <div className="ai-sidebar__empty-title">{t('ai.sidebar.emptyTitle')}</div>
              <div className="ai-sidebar__empty-text">{t('ai.sidebar.emptyHint')}</div>
              <div className="ai-sidebar__suggestions">
                <div className="ai-sidebar__suggestions-label">{t('ai.sidebar.suggestionsLabel')}</div>
                <div className="ai-sidebar__suggestions-list">
                  {context.suggestions.map(item => (
                    <button
                      key={item}
                      className="ai-sidebar__suggestion"
                      onClick={() => handleSend(item)}
                      disabled={isPending}
                    >
                      {item}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <div className="ai-sidebar__message-list">
              {messages.map(message => (
                <div
                  key={message.id}
                  className={`ai-sidebar__message ai-sidebar__message--${message.role} ${message.isLoading ? 'ai-sidebar__message--loading' : ''
                    } ${message.isError ? 'ai-sidebar__message--error' : ''}`}
                >
                  {message.role === 'assistant' && (
                    <div className="ai-sidebar__message-avatar">
                      <Bot size={14} />
                    </div>
                  )}
                  <div className="ai-sidebar__message-bubble">
                    {message.isLoading ? (
                      <div className="ai-sidebar__typing">
                        <span></span>
                        <span></span>
                        <span></span>
                      </div>
                    ) : (
                      <>
                        <div className="ai-sidebar__message-content">{message.content}</div>
                        {!!message.citations?.length && (
                          <div className="ai-sidebar__citations">
                            {message.citations.map((citation, idx) => (
                              <div key={`${citation.title}-${idx}`} className="ai-sidebar__citation">
                                <div className="ai-sidebar__citation-title">
                                  {citation.url ? (
                                    <a href={citation.url} target="_blank" rel="noopener noreferrer">
                                      {citation.title}
                                    </a>
                                  ) : (
                                    citation.title
                                  )}
                                </div>
                                {citation.meta && (
                                  <div className="ai-sidebar__citation-meta">{citation.meta}</div>
                                )}
                                {citation.snippet && (
                                  <div className="ai-sidebar__citation-snippet">{citation.snippet}</div>
                                )}
                              </div>
                            ))}
                          </div>
                        )}
                      </>
                    )}
                  </div>
                </div>
              ))}
              <div ref={messagesEndRef} />
            </div>
          )}

          {errorMessage && (
            <div className="ai-sidebar__error">
              {errorMessage}
            </div>
          )}
        </div>

        <div className="ai-sidebar__input">
          <div className="ai-sidebar__input-wrap">
            <textarea
              ref={inputRef}
              className="ai-sidebar__textarea"
              value={inputValue}
              onChange={handleInputChange}
              onKeyDown={handleKeyDown}
              placeholder={context.placeholder}
              rows={1}
              disabled={isPending}
            />
            <button
              className="ai-sidebar__send"
              onClick={() => handleSend(inputValue)}
              disabled={!inputValue.trim() || isPending}
              title={isPending ? t('ai.sidebar.sending') : t('ai.sidebar.send')}
            >
              <Send size={18} />
            </button>
          </div>
        </div>
      </aside>

      <button
        className={`ai-sidebar__toggle ${isOpen ? 'ai-sidebar__toggle--hidden' : ''}`}
        onClick={() => setIsOpen(true)}
        title={t('ai.sidebar.toggleOpen')}
      >
        <img
          src="/minute_ai.png"
          alt="Minute AI"
          className="ai-sidebar__toggle-img"
        />
        <span className="ai-sidebar__toggle-label" aria-hidden="true">Ask me!</span>
      </button>
    </>
  );
};

export default ChatSidebar;
