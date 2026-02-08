import { useState, useEffect } from 'react'
import {
  User,
  Settings as SettingsIcon,
  Globe,
  Save,
  Loader2,
  Check,
  KeyRound,
  Eye,
  EyeOff,
} from 'lucide-react'
import { currentUser } from '../../store/mockData'
import { getStoredUser } from '../../lib/api/auth'
import { usersApi } from '../../lib/api/users'
import { useLanguage } from '../../contexts/LanguageContext'
import { languageNames, languageFlags, type Language } from '../../i18n'
import type { LlmProvider } from '../../shared/dto/user'

type NoteStyle = 'Ngắn gọn' | 'Cân bằng' | 'Chi tiết'
type ToneStyle =
  | 'Chuyên nghiệp'
  | 'Giáo dục (giải thích rõ)'
  | 'Thân thiện'
  | 'Thẳng vào vấn đề'
  | 'Socratic (hỏi gợi mở)'
type ThemeMode = 'system' | 'light' | 'dark'
type RecapInterval = 'off' | '2m' | '5m'
type LlmModelOption = { value: string; label: string }

interface UserSettings {
  personalization: {
    nickname: string
    about: string
    futureFocus: string
    role: string
    noteStyle: NoteStyle
    tone: ToneStyle
    citeEvidence: boolean
  }
  system: {
    theme: ThemeMode
    recapInterval: RecapInterval
    aiEnabled: boolean
    ai: {
      autoSummary: boolean
      documentSuggestions: boolean
      actionItemDetection: boolean
      liveRecap: boolean
      webSearch: boolean
    }
  }
}

const defaultSettings: UserSettings = {
  personalization: {
    nickname: '',
    about: '',
    futureFocus: '',
    role: '',
    noteStyle: 'Ngắn gọn',
    tone: 'Chuyên nghiệp',
    citeEvidence: true,
  },
  system: {
    theme: 'system',
    recapInterval: '2m',
    aiEnabled: true,
    ai: {
      autoSummary: true,
      documentSuggestions: true,
      actionItemDetection: true,
      liveRecap: true,
      webSearch: false,
    },
  },
}

interface LlmSettingsState {
  provider: LlmProvider
  model: string
  apiKeyInput: string
  apiKeySet: boolean
  apiKeyLast4?: string | null
  visualProvider: LlmProvider
  visualModel: string
  visualApiKeyInput: string
  visualApiKeySet: boolean
  visualApiKeyLast4?: string | null
  masterPrompt: string
}

const MODEL_OPTIONS: Record<LlmProvider, LlmModelOption[]> = {
  gemini: [
    { value: 'gemini-1.5-flash', label: 'Gemini 1.5 Flash' },
    { value: 'gemini-1.5-pro', label: 'Gemini 1.5 Pro' },
    { value: 'gemini-1.5-flash-8b', label: 'Gemini 1.5 Flash 8B' },
  ],
  groq: [
    { value: 'meta-llama/llama-4-scout-17b-16e-instruct', label: 'Llama 4 Scout 17B (Groq)' },
    { value: 'llama-3.1-8b-instant', label: 'Llama 3.1 8B Instant' },
    { value: 'llama-3.3-70b-versatile', label: 'Llama 3.3 70B Versatile' },
    { value: 'mixtral-8x7b-32768', label: 'Mixtral 8x7B 32K' },
  ],
}

const VISUAL_MODEL_OPTIONS: Record<LlmProvider, LlmModelOption[]> = {
  gemini: [
    { value: 'gemini-1.5-flash', label: 'Gemini 1.5 Flash (Vision)' },
    { value: 'gemini-1.5-pro', label: 'Gemini 1.5 Pro (Vision)' },
  ],
  groq: [
    { value: 'meta-llama/llama-4-scout-17b-16e-instruct', label: 'Llama 4 Scout 17B (Vision)' },
    { value: 'llama-3.3-70b-versatile', label: 'Llama 3.3 70B Versatile (Vision)' },
  ],
}

const defaultLlmSettings: LlmSettingsState = {
  provider: 'gemini',
  model: MODEL_OPTIONS.gemini[0].value,
  apiKeyInput: '',
  apiKeySet: false,
  apiKeyLast4: null,
  visualProvider: 'gemini',
  visualModel: VISUAL_MODEL_OPTIONS.gemini[0].value,
  visualApiKeyInput: '',
  visualApiKeySet: false,
  visualApiKeyLast4: null,
  masterPrompt: '',
}

const Settings = () => {
  const activeUser = getStoredUser() || currentUser
  const SETTINGS_KEY = `minute_settings_${activeUser.id}`

  const [settings, setSettings] = useState<UserSettings>(defaultSettings)
  const [isSaving, setIsSaving] = useState(false)
  const [saveMessage, setSaveMessage] = useState<string | null>(null)
  const [isDirty, setIsDirty] = useState(false)
  const [llmSettings, setLlmSettings] = useState<LlmSettingsState>(defaultLlmSettings)
  const [llmLoading, setLlmLoading] = useState(false)
  const [llmError, setLlmError] = useState<string | null>(null)
  const [showApiKey, setShowApiKey] = useState(false)
  const [clearApiKey, setClearApiKey] = useState(false)
  const [showVisualApiKey, setShowVisualApiKey] = useState(false)
  const [clearVisualApiKey, setClearVisualApiKey] = useState(false)
  const { language, setLanguage } = useLanguage()

  useEffect(() => {
    try {
      const saved = localStorage.getItem(SETTINGS_KEY)
      if (saved) {
        const parsed = JSON.parse(saved) as Partial<UserSettings>
        const merged: UserSettings = {
          ...defaultSettings,
          personalization: {
            ...defaultSettings.personalization,
            ...(parsed.personalization || {}),
          },
          system: {
            ...defaultSettings.system,
            ...(parsed.system || {}),
            ai: {
              ...defaultSettings.system.ai,
              ...(parsed.system?.ai || {}),
            },
          },
        }
        const systemSanitized = merged.system as Record<string, unknown>
        if ('apiKey' in systemSanitized) {
          delete systemSanitized.apiKey
        }
        if ('defaultModel' in systemSanitized) {
          delete systemSanitized.defaultModel
        }
        setSettings(merged)
      }
    } catch (err) {
      console.error('Failed to load settings:', err)
    }
  }, [])

  useEffect(() => {
    let active = true
    const loadLlmSettings = async () => {
      setLlmLoading(true)
      setLlmError(null)
      try {
        const response = await usersApi.getLlmSettings(activeUser.id)
        if (!active) return
        const provider = response.provider || 'gemini'
        const modelOptions = MODEL_OPTIONS[provider as LlmProvider] || MODEL_OPTIONS.gemini
        const model = response.model || modelOptions[0]?.value || ''
        const visualProvider = response.visual_provider || 'gemini'
        const visualModelOptions = VISUAL_MODEL_OPTIONS[visualProvider as LlmProvider] || VISUAL_MODEL_OPTIONS.gemini
        const visualModel = response.visual_model || visualModelOptions[0]?.value || ''
        setLlmSettings({
          provider: provider as LlmProvider,
          model,
          apiKeyInput: '',
          apiKeySet: response.api_key_set,
          apiKeyLast4: response.api_key_last4 || null,
          visualProvider: visualProvider as LlmProvider,
          visualModel,
          visualApiKeyInput: '',
          visualApiKeySet: Boolean(response.visual_api_key_set),
          visualApiKeyLast4: response.visual_api_key_last4 || null,
          masterPrompt: response.master_prompt || '',
        })
        const behavior = response.behavior || {}
        const nextNoteStyle = ['Ngắn gọn', 'Cân bằng', 'Chi tiết'].includes(String(behavior.note_style))
          ? (behavior.note_style as NoteStyle)
          : defaultSettings.personalization.noteStyle
        const nextTone = [
          'Chuyên nghiệp',
          'Giáo dục (giải thích rõ)',
          'Thân thiện',
          'Thẳng vào vấn đề',
          'Socratic (hỏi gợi mở)',
        ].includes(String(behavior.tone))
          ? (behavior.tone as ToneStyle)
          : defaultSettings.personalization.tone
        setSettings(prev => ({
          ...prev,
          personalization: {
            ...prev.personalization,
            nickname: behavior.nickname ?? '',
            about: behavior.about ?? '',
            futureFocus: behavior.future_focus ?? '',
            role: behavior.role ?? '',
            noteStyle: nextNoteStyle,
            tone: nextTone,
            citeEvidence:
              typeof behavior.cite_evidence === 'boolean'
                ? behavior.cite_evidence
                : defaultSettings.personalization.citeEvidence,
          },
        }))
      } catch (err) {
        if (!active) return
        console.error('Failed to load LLM settings:', err)
        setLlmError('Không thể tải cấu hình LLM. Hãy thử lại.')
      } finally {
        if (active) {
          setLlmLoading(false)
        }
      }
    }
    loadLlmSettings()
    return () => {
      active = false
    }
  }, [activeUser.id])

  const markDirty = () => setIsDirty(true)

  const updatePersonal = <K extends keyof UserSettings['personalization']>(
    key: K,
    value: UserSettings['personalization'][K]
  ) => {
    setSettings(prev => ({
      ...prev,
      personalization: { ...prev.personalization, [key]: value },
    }))
    markDirty()
  }

  const updateSystem = <K extends keyof UserSettings['system']>(
    key: K,
    value: UserSettings['system'][K]
  ) => {
    setSettings(prev => ({
      ...prev,
      system: { ...prev.system, [key]: value },
    }))
    markDirty()
  }

  const updateAI = <K extends keyof UserSettings['system']['ai']>(
    key: K,
    value: UserSettings['system']['ai'][K]
  ) => {
    setSettings(prev => ({
      ...prev,
      system: {
        ...prev.system,
        ai: { ...prev.system.ai, [key]: value },
      },
    }))
    markDirty()
  }

  const updateLlm = <K extends keyof LlmSettingsState>(
    key: K,
    value: LlmSettingsState[K]
  ) => {
    setLlmSettings(prev => ({
      ...prev,
      [key]: value,
    }))
    markDirty()
  }

  const handleSave = async () => {
    setIsSaving(true)
    setSaveMessage(null)
    try {
      const sanitizedSettings = {
        ...settings,
        system: { ...settings.system },
      } as Record<string, unknown>
      const systemRecord = sanitizedSettings.system as Record<string, unknown>
      if ('apiKey' in systemRecord) {
        delete systemRecord.apiKey
      }
      if ('defaultModel' in systemRecord) {
        delete systemRecord.defaultModel
      }
      localStorage.setItem(SETTINGS_KEY, JSON.stringify(sanitizedSettings))
      let llmSaved = true
      if (llmLoading) {
        llmSaved = false
        setLlmError('LLM đang tải, vui lòng thử lại.')
      } else {
        try {
          const payload: {
            provider: LlmProvider
            model: string
            api_key?: string
            clear_api_key?: boolean
            visual_provider: LlmProvider
            visual_model: string
            visual_api_key?: string
            clear_visual_api_key?: boolean
            master_prompt?: string | null
            clear_master_prompt?: boolean
            behavior?: {
              nickname: string
              about: string
              future_focus: string
              role: string
              note_style: string
              tone: string
              cite_evidence: boolean
            }
          } = {
            provider: llmSettings.provider,
            model: llmSettings.model,
            visual_provider: llmSettings.visualProvider,
            visual_model: llmSettings.visualModel,
            behavior: {
              nickname: settings.personalization.nickname,
              about: settings.personalization.about,
              future_focus: settings.personalization.futureFocus,
              role: settings.personalization.role,
              note_style: settings.personalization.noteStyle,
              tone: settings.personalization.tone,
              cite_evidence: settings.personalization.citeEvidence,
            },
          }
          const trimmedMasterPrompt = llmSettings.masterPrompt.trim()
          if (trimmedMasterPrompt) {
            payload.master_prompt = trimmedMasterPrompt
          } else {
            payload.master_prompt = null
            payload.clear_master_prompt = true
          }
          const trimmedKey = llmSettings.apiKeyInput.trim()
          if (clearApiKey) {
            payload.clear_api_key = true
          } else if (trimmedKey) {
            payload.api_key = trimmedKey
          }
          const trimmedVisualKey = llmSettings.visualApiKeyInput.trim()
          if (clearVisualApiKey) {
            payload.clear_visual_api_key = true
          } else if (trimmedVisualKey) {
            payload.visual_api_key = trimmedVisualKey
          }
          const result = await usersApi.updateLlmSettings(activeUser.id, payload)
          setLlmSettings(prev => ({
            ...prev,
            provider: result.provider || prev.provider,
            model: result.model || prev.model,
            apiKeyInput: '',
            apiKeySet: result.api_key_set,
            apiKeyLast4: result.api_key_last4 || null,
            visualProvider: result.visual_provider || prev.visualProvider,
            visualModel: result.visual_model || prev.visualModel,
            visualApiKeyInput: '',
            visualApiKeySet: Boolean(result.visual_api_key_set),
            visualApiKeyLast4: result.visual_api_key_last4 || null,
            masterPrompt: result.master_prompt || '',
          }))
          setClearApiKey(false)
          setClearVisualApiKey(false)
          setLlmError(null)
        } catch (err) {
          console.error('Failed to save LLM settings:', err)
          llmSaved = false
          setLlmError('Không thể lưu cấu hình LLM. Vui lòng thử lại.')
        }
      }

      await new Promise(resolve => setTimeout(resolve, 400))
      if (llmSaved) {
        setSaveMessage('Đã lưu thành công!')
        setIsDirty(false)
      } else {
        setSaveMessage('Đã lưu cấu hình cơ bản, LLM chưa lưu.')
      }
      setTimeout(() => setSaveMessage(null), 3000)
    } catch (err) {
      console.error('Failed to save settings:', err)
      setSaveMessage('Lỗi khi lưu. Vui lòng thử lại.')
    } finally {
      setIsSaving(false)
    }
  }

  const apiKeyBadge = (() => {
    if (llmLoading) {
      return { label: 'Đang tải...', color: 'var(--text-muted)', bg: 'var(--bg-surface)' }
    }
    if (llmSettings.apiKeyInput.trim().length > 0) {
      return { label: 'Sẽ cập nhật khi lưu', color: 'var(--text-primary)', bg: 'var(--bg-surface-hover)' }
    }
    if (clearApiKey) {
      return { label: 'Sẽ xoá khi lưu', color: 'var(--error)', bg: 'var(--error-subtle)' }
    }
    if (llmSettings.apiKeySet) {
      const suffix = llmSettings.apiKeyLast4 ? `•••• ${llmSettings.apiKeyLast4}` : 'Đã lưu'
      return { label: suffix, color: 'var(--success)', bg: 'var(--success-subtle)' }
    }
    return { label: 'Chưa thiết lập', color: 'var(--text-muted)', bg: 'var(--bg-surface)' }
  })()

  const visualApiKeyBadge = (() => {
    if (llmLoading) {
      return { label: 'Đang tải...', color: 'var(--text-muted)', bg: 'var(--bg-surface)' }
    }
    if (llmSettings.visualApiKeyInput.trim().length > 0) {
      return { label: 'Sẽ cập nhật khi lưu', color: 'var(--text-primary)', bg: 'var(--bg-surface-hover)' }
    }
    if (clearVisualApiKey) {
      return { label: 'Sẽ xoá khi lưu', color: 'var(--error)', bg: 'var(--error-subtle)' }
    }
    if (llmSettings.visualApiKeySet) {
      const suffix = llmSettings.visualApiKeyLast4 ? `•••• ${llmSettings.visualApiKeyLast4}` : 'Đã lưu'
      return { label: suffix, color: 'var(--success)', bg: 'var(--success-subtle)' }
    }
    return { label: 'Chưa thiết lập', color: 'var(--text-muted)', bg: 'var(--bg-surface)' }
  })()

  const inputStyle = {
    width: '100%',
    padding: 'var(--space-sm) var(--space-md)',
    background: 'var(--bg-surface)',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius-sm)',
    color: 'var(--text-primary)',
    fontSize: '13px',
  }

  const textAreaStyle = {
    ...inputStyle,
    minHeight: '76px',
    resize: 'vertical' as const,
  }

  const selectStyle = {
    ...inputStyle,
    appearance: 'none' as const,
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-header__title">Cài đặt</h1>
          <p className="page-header__subtitle">Cá nhân hoá và cấu hình hệ thống</p>
        </div>
        <div className="page-header__actions">
          {saveMessage && (
            <span
              style={{
                color: saveMessage.includes('thành công') ? 'var(--success)' : 'var(--error)',
                fontSize: 13,
                marginRight: 'var(--space-md)',
              }}
            >
              {saveMessage}
            </span>
          )}
          <button
            className="btn btn--primary"
            onClick={handleSave}
            disabled={isSaving || !isDirty}
          >
            {isSaving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
            Lưu thay đổi
          </button>
        </div>
      </div>

      <div className="grid grid--2">
        <div className="card">
          <div className="card__header">
            <h3 className="card__title">
              <User size={18} className="card__title-icon" />
              Cá nhân hoá
            </h3>
          </div>
          <div className="card__body">
            <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 'var(--space-md)' }}>
              Thiết lập phong cách phản hồi của MINUTE. Các thông tin này được đưa vào prompt để AI trả lời đúng ngữ cảnh sản phẩm.
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-md)' }}>
              <div>
                <label style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 'var(--space-xs)', display: 'block' }}>
                  Biệt danh
                </label>
                <input
                  type="text"
                  placeholder="Ví dụ: Phước (PM), Lan (Tech Lead)"
                  value={settings.personalization.nickname}
                  onChange={e => updatePersonal('nickname', e.target.value)}
                  style={inputStyle}
                />
              </div>
              <div>
                <label style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 'var(--space-xs)', display: 'block' }}>
                  Hãy kể thêm về bạn
                </label>
                <textarea
                  placeholder="Ví dụ: Mình làm PM fintech, thích output dạng bullet, ưu tiên số liệu và bằng chứng."
                  value={settings.personalization.about}
                  onChange={e => updatePersonal('about', e.target.value)}
                  style={textAreaStyle}
                />
              </div>
              <div>
                <label style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 'var(--space-xs)', display: 'block' }}>
                  Mô tả định hướng tương lai
                </label>
                <textarea
                  placeholder="Ví dụ: 3-6 tháng tới cần cải thiện leadership, delivery tốc độ cao, giảm rủi ro vận hành."
                  value={settings.personalization.futureFocus}
                  onChange={e => updatePersonal('futureFocus', e.target.value)}
                  style={textAreaStyle}
                />
              </div>
              <div>
                <label style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 'var(--space-xs)', display: 'block' }}>
                  Nghề nghiệp / Vai trò
                </label>
                <input
                  type="text"
                  placeholder="Ví dụ: Product Manager, PMO, Engineering Manager"
                  value={settings.personalization.role}
                  onChange={e => updatePersonal('role', e.target.value)}
                  style={inputStyle}
                />
              </div>
              <div>
                <label style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 'var(--space-xs)', display: 'block' }}>
                  Định hướng ghi chú
                </label>
                <select
                  value={settings.personalization.noteStyle}
                  onChange={e => updatePersonal('noteStyle', e.target.value as NoteStyle)}
                  style={selectStyle}
                >
                  {(['Ngắn gọn', 'Cân bằng', 'Chi tiết'] as NoteStyle[]).map(item => (
                    <option key={item} value={item}>{item}</option>
                  ))}
                </select>
              </div>
              <div>
                <label style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 'var(--space-xs)', display: 'block' }}>
                  Văn giọng
                </label>
                <select
                  value={settings.personalization.tone}
                  onChange={e => updatePersonal('tone', e.target.value as ToneStyle)}
                  style={selectStyle}
                >
                  {([
                    'Chuyên nghiệp',
                    'Giáo dục (giải thích rõ)',
                    'Thân thiện',
                    'Thẳng vào vấn đề',
                    'Socratic (hỏi gợi mở)',
                  ] as ToneStyle[]).map(item => (
                    <option key={item} value={item}>{item}</option>
                  ))}
                </select>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600 }}>Trích dẫn & bằng chứng</div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                    Luôn kèm timestamp/tài liệu khi có
                  </div>
                </div>
                <Toggle
                  checked={settings.personalization.citeEvidence}
                  onChange={(checked) => updatePersonal('citeEvidence', checked)}
                />
              </div>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="card__header">
            <h3 className="card__title">
              <SettingsIcon size={18} className="card__title-icon" />
              Thiết lập hệ thống
            </h3>
          </div>
          <div className="card__body">
            <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 'var(--space-md)' }}>
              Cấu hình model, khóa API và các tính năng AI trong phiên/post-session.
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-md)' }}>
              <div>
                <label style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 'var(--space-xs)', display: 'block' }}>
                  Giao diện
                </label>
                <div style={{ display: 'flex', gap: 8 }}>
                  {([
                    { value: 'light', label: 'Sáng' },
                    { value: 'dark', label: 'Tối' },
                    { value: 'system', label: 'Theo hệ thống' },
                  ] as { value: ThemeMode; label: string }[]).map(option => (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => updateSystem('theme', option.value)}
                      style={{
                        padding: '8px 12px',
                        borderRadius: '999px',
                        border: `1px solid ${settings.system.theme === option.value ? 'var(--accent)' : 'var(--border)'}`,
                        background: settings.system.theme === option.value ? 'var(--accent)' : 'var(--bg-surface)',
                        color: settings.system.theme === option.value ? 'white' : 'var(--text-primary)',
                        fontSize: 12,
                        fontWeight: 600,
                        cursor: 'pointer',
                      }}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 'var(--space-xs)', display: 'block' }}>
                  Recap trong phiên
                </label>
                <select
                  value={settings.system.recapInterval}
                  onChange={e => updateSystem('recapInterval', e.target.value as RecapInterval)}
                  style={selectStyle}
                >
                  <option value="off">Tắt</option>
                  <option value="2m">2 phút</option>
                  <option value="5m">5 phút</option>
                </select>
              </div>
              <div>
                <label style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 'var(--space-xs)', display: 'block' }}>
                  Cấu hình model
                </label>
                <div style={{ display: 'flex', gap: 8 }}>
                  <select
                    value={llmSettings.provider}
                    onChange={e => {
                      const nextProvider = e.target.value as LlmProvider
                      const options = MODEL_OPTIONS[nextProvider] || MODEL_OPTIONS.gemini
                      const nextModel = options.find(item => item.value === llmSettings.model)?.value || options[0]?.value || ''
                      updateLlm('provider', nextProvider)
                      updateLlm('model', nextModel)
                    }}
                    style={{ ...selectStyle, flex: 1 }}
                  >
                    <option value="gemini">Google Gemini</option>
                    <option value="groq">Groq</option>
                  </select>
                  <select
                    value={llmSettings.model}
                    onChange={e => updateLlm('model', e.target.value)}
                    style={{ ...selectStyle, flex: 1 }}
                  >
                    {(MODEL_OPTIONS[llmSettings.provider] || []).map(item => (
                      <option key={item.value} value={item.value}>{item.label}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div>
                <label style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 'var(--space-xs)', display: 'block' }}>
                  LLM API key của riêng bạn
                </label>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <input
                    type={showApiKey ? 'text' : 'password'}
                    placeholder="Nhập API key (không lưu trên trình duyệt)"
                    value={llmSettings.apiKeyInput}
                    onChange={e => {
                      updateLlm('apiKeyInput', e.target.value)
                      setClearApiKey(false)
                    }}
                    style={{ ...inputStyle, flex: 1 }}
                  />
                  <button
                    type="button"
                    className="btn btn--secondary btn--sm"
                    onClick={() => setShowApiKey(prev => !prev)}
                  >
                    {showApiKey ? <EyeOff size={14} /> : <Eye size={14} />}
                  </button>
                  <button
                    type="button"
                    className="btn btn--secondary btn--sm"
                    onClick={() => {
                      setClearApiKey(true)
                      updateLlm('apiKeyInput', '')
                    }}
                    disabled={!llmSettings.apiKeySet}
                  >
                    Xoá key
                  </button>
                  <span
                    style={{
                      padding: '6px 10px',
                      borderRadius: 999,
                      background: apiKeyBadge.bg,
                      color: apiKeyBadge.color,
                      fontSize: 11,
                      fontWeight: 600,
                      border: '1px solid var(--border)',
                    }}
                  >
                    {apiKeyBadge.label}
                  </span>
                </div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 6, display: 'flex', gap: 6, alignItems: 'center' }}>
                  <KeyRound size={12} />
                  API key được mã hoá và chỉ lưu trên server. Không lưu vào localStorage.
                </div>
                {llmError && (
                  <div style={{ fontSize: 11, color: 'var(--error)', marginTop: 6 }}>
                    {llmError}
                  </div>
                )}
              </div>
              <div style={{ borderTop: '1px solid var(--border)', paddingTop: 'var(--space-md)' }}>
                <label style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 'var(--space-xs)', display: 'block' }}>
                  Visual model (video/frame understanding)
                </label>
                <div style={{ display: 'flex', gap: 8 }}>
                  <select
                    value={llmSettings.visualProvider}
                    onChange={e => {
                      const nextProvider = e.target.value as LlmProvider
                      const options = VISUAL_MODEL_OPTIONS[nextProvider] || VISUAL_MODEL_OPTIONS.gemini
                      const nextModel = options.find(item => item.value === llmSettings.visualModel)?.value || options[0]?.value || ''
                      updateLlm('visualProvider', nextProvider)
                      updateLlm('visualModel', nextModel)
                    }}
                    style={{ ...selectStyle, flex: 1 }}
                  >
                    <option value="gemini">Google Gemini (Vision)</option>
                    <option value="groq">Groq (Vision)</option>
                  </select>
                  <select
                    value={llmSettings.visualModel}
                    onChange={e => updateLlm('visualModel', e.target.value)}
                    style={{ ...selectStyle, flex: 1 }}
                  >
                    {(VISUAL_MODEL_OPTIONS[llmSettings.visualProvider] || []).map(item => (
                      <option key={item.value} value={item.value}>{item.label}</option>
                    ))}
                  </select>
                </div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 6 }}>
                  Dùng cho pipeline ảnh/video (slide/frame caption), tách riêng khỏi chatbot để giảm hallucination.
                </div>
              </div>
              <div>
                <label style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 'var(--space-xs)', display: 'block' }}>
                  Visual API key (riêng)
                </label>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <input
                    type={showVisualApiKey ? 'text' : 'password'}
                    placeholder="Nhập API key cho vision model"
                    value={llmSettings.visualApiKeyInput}
                    onChange={e => {
                      updateLlm('visualApiKeyInput', e.target.value)
                      setClearVisualApiKey(false)
                    }}
                    style={{ ...inputStyle, flex: 1 }}
                  />
                  <button
                    type="button"
                    className="btn btn--secondary btn--sm"
                    onClick={() => setShowVisualApiKey(prev => !prev)}
                  >
                    {showVisualApiKey ? <EyeOff size={14} /> : <Eye size={14} />}
                  </button>
                  <button
                    type="button"
                    className="btn btn--secondary btn--sm"
                    onClick={() => {
                      setClearVisualApiKey(true)
                      updateLlm('visualApiKeyInput', '')
                    }}
                    disabled={!llmSettings.visualApiKeySet}
                  >
                    Xoá key
                  </button>
                  <span
                    style={{
                      padding: '6px 10px',
                      borderRadius: 999,
                      background: visualApiKeyBadge.bg,
                      color: visualApiKeyBadge.color,
                      fontSize: 11,
                      fontWeight: 600,
                      border: '1px solid var(--border)',
                    }}
                  >
                    {visualApiKeyBadge.label}
                  </span>
                </div>
              </div>
              <div>
                <label style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 'var(--space-xs)', display: 'block' }}>
                  Master prompt cho AI
                </label>
                <textarea
                  placeholder="Ví dụ: Luôn trả lời theo format Executive Summary -> Decision Table -> Action Table (owner/deadline/priority). Bắt buộc trích dẫn transcript/tài liệu/timecode; nếu thiếu dữ liệu phải nêu rõ và đề xuất câu hỏi tiếp theo."
                  value={llmSettings.masterPrompt}
                  onChange={e => updateLlm('masterPrompt', e.target.value)}
                  style={{ ...textAreaStyle, minHeight: '120px' }}
                />
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 6 }}>
                  Prompt này được ghép vào system prompt cho chatbot/tóm tắt và lưu trên server. Nên mô tả rõ format đầu ra để demo hackathon nhất quán.
                </div>
              </div>

              <div style={{ marginTop: 'var(--space-sm)' }}>
                <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 8 }}>Tính năng AI</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-base)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 500 }}>Tính năng AI</div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Bật/tắt toàn bộ AI trong ứng dụng</div>
                    </div>
                    <Toggle
                      checked={settings.system.aiEnabled}
                      onChange={(checked) => updateSystem('aiEnabled', checked)}
                    />
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 500 }}>Tự động tóm tắt</div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Tạo summary sau phiên</div>
                    </div>
                    <Toggle
                      checked={settings.system.ai.autoSummary}
                      onChange={(checked) => updateAI('autoSummary', checked)}
                    />
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 500 }}>Gợi ý tài liệu để đính kèm</div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Đề xuất docs liên quan theo nội dung</div>
                    </div>
                    <Toggle
                      checked={settings.system.ai.documentSuggestions}
                      onChange={(checked) => updateAI('documentSuggestions', checked)}
                    />
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 500 }}>Phát hiện action items</div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Trích xuất task/owner/deadline (gợi ý)</div>
                    </div>
                    <Toggle
                      checked={settings.system.ai.actionItemDetection}
                      onChange={(checked) => updateAI('actionItemDetection', checked)}
                    />
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 500 }}>Live recap</div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Cập nhật recap theo thời gian thực</div>
                    </div>
                    <Toggle
                      checked={settings.system.ai.liveRecap}
                      onChange={(checked) => updateAI('liveRecap', checked)}
                    />
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 500 }}>Web search</div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Khi thiếu bằng chứng, có thể đề xuất tìm web</div>
                    </div>
                    <Toggle
                      checked={settings.system.ai.webSearch}
                      onChange={(checked) => updateAI('webSearch', checked)}
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="card" style={{ gridColumn: '1 / -1' }}>
          <div className="card__header">
            <h3 className="card__title">
              <Globe size={18} className="card__title-icon" />
              Ngôn ngữ
            </h3>
          </div>
          <div className="card__body">
            <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: 'var(--space-md)' }}>
              Chọn ngôn ngữ hiển thị cho ứng dụng
            </p>
            <div style={{ display: 'flex', gap: 'var(--space-sm)' }}>
              {(['vi', 'en'] as Language[]).map((lang) => (
                <button
                  key={lang}
                  onClick={() => setLanguage(lang)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 'var(--space-sm)',
                    padding: 'var(--space-md) var(--space-lg)',
                    background: language === lang ? 'var(--accent)' : 'var(--bg-surface)',
                    border: `1px solid ${language === lang ? 'var(--accent)' : 'var(--border)'}`,
                    borderRadius: 'var(--radius-md)',
                    color: language === lang ? 'white' : 'var(--text-primary)',
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                    fontSize: '13px',
                    fontWeight: 500,
                  }}
                >
                  <span style={{ fontSize: '18px' }}>{languageFlags[lang]}</span>
                  <span>{languageNames[lang]}</span>
                  {language === lang && <Check size={14} />}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

interface ToggleProps {
  checked: boolean
  onChange: (checked: boolean) => void
}

const Toggle = ({ checked, onChange }: ToggleProps) => (
  <div
    onClick={() => onChange(!checked)}
    style={{
      width: '40px',
      height: '22px',
      background: checked ? 'var(--accent)' : 'var(--bg-surface-hover)',
      borderRadius: '11px',
      position: 'relative',
      cursor: 'pointer',
      transition: 'background 0.2s',
    }}
  >
    <div
      style={{
        width: '18px',
        height: '18px',
        background: 'white',
        borderRadius: '50%',
        position: 'absolute',
        top: '2px',
        left: checked ? '20px' : '2px',
        transition: 'left 0.2s',
        boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
      }}
    ></div>
  </div>
)

export default Settings
