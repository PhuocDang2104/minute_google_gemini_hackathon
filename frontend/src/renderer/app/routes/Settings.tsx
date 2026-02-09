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
import { useLocaleText } from '../../i18n/useLocaleText'

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

const NOTE_STYLE_OPTIONS: { value: NoteStyle; labelVi: string; labelEn: string }[] = [
  { value: 'Ngắn gọn', labelVi: 'Ngắn gọn', labelEn: 'Concise' },
  { value: 'Cân bằng', labelVi: 'Cân bằng', labelEn: 'Balanced' },
  { value: 'Chi tiết', labelVi: 'Chi tiết', labelEn: 'Detailed' },
]

const TONE_OPTIONS: { value: ToneStyle; labelVi: string; labelEn: string }[] = [
  { value: 'Chuyên nghiệp', labelVi: 'Chuyên nghiệp', labelEn: 'Professional' },
  { value: 'Giáo dục (giải thích rõ)', labelVi: 'Giáo dục (giải thích rõ)', labelEn: 'Educational (clear explanation)' },
  { value: 'Thân thiện', labelVi: 'Thân thiện', labelEn: 'Friendly' },
  { value: 'Thẳng vào vấn đề', labelVi: 'Thẳng vào vấn đề', labelEn: 'Direct' },
  { value: 'Socratic (hỏi gợi mở)', labelVi: 'Socratic (hỏi gợi mở)', labelEn: 'Socratic (guided questions)' },
]

const normalizeNoteStyle = (value: unknown): NoteStyle => {
  const raw = String(value || '').trim().toLowerCase()
  if (!raw) return 'Ngắn gọn'
  if (raw.includes('concise') || raw.includes('brief') || raw.includes('ngắn')) return 'Ngắn gọn'
  if (raw.includes('detailed') || raw.includes('chi tiết')) return 'Chi tiết'
  return 'Cân bằng'
}

const normalizeToneStyle = (value: unknown): ToneStyle => {
  const raw = String(value || '').trim().toLowerCase()
  if (!raw) return 'Chuyên nghiệp'
  if (raw.includes('educational') || raw.includes('giáo dục')) return 'Giáo dục (giải thích rõ)'
  if (raw.includes('friendly') || raw.includes('thân thiện')) return 'Thân thiện'
  if (raw.includes('direct') || raw.includes('thẳng')) return 'Thẳng vào vấn đề'
  if (raw.includes('socratic')) return 'Socratic (hỏi gợi mở)'
  return 'Chuyên nghiệp'
}

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
  const { lt } = useLocaleText()

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
        const nextNoteStyle = normalizeNoteStyle(behavior.note_style)
        const nextTone = normalizeToneStyle(behavior.tone)
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
        setLlmError(lt('Không thể tải cấu hình LLM. Hãy thử lại.', 'Unable to load LLM settings. Please try again.'))
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
        setLlmError(lt('LLM đang tải, vui lòng thử lại.', 'LLM settings are loading, please try again.'))
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
          setLlmError(lt('Không thể lưu cấu hình LLM. Vui lòng thử lại.', 'Unable to save LLM settings. Please try again.'))
        }
      }

      await new Promise(resolve => setTimeout(resolve, 400))
      if (llmSaved) {
        setSaveMessage(lt('Đã lưu thành công!', 'Saved successfully!'))
        setIsDirty(false)
      } else {
        setSaveMessage(lt('Đã lưu cấu hình cơ bản, nhưng cấu hình LLM chưa được lưu.', 'Saved base settings, but LLM settings were not saved.'))
      }
      setTimeout(() => setSaveMessage(null), 3000)
    } catch (err) {
      console.error('Failed to save settings:', err)
      setSaveMessage(lt('Lỗi khi lưu. Vui lòng thử lại.', 'Save failed. Please try again.'))
    } finally {
      setIsSaving(false)
    }
  }

  const apiKeyBadge = (() => {
    if (llmLoading) {
      return { label: lt('Đang tải...', 'Loading...'), color: 'var(--text-muted)', bg: 'var(--bg-surface)' }
    }
    if (llmSettings.apiKeyInput.trim().length > 0) {
      return { label: lt('Sẽ cập nhật khi lưu', 'Will update on save'), color: 'var(--text-primary)', bg: 'var(--bg-surface-hover)' }
    }
    if (clearApiKey) {
      return { label: lt('Sẽ xoá khi lưu', 'Will remove on save'), color: 'var(--error)', bg: 'var(--error-subtle)' }
    }
    if (llmSettings.apiKeySet) {
      const suffix = llmSettings.apiKeyLast4 ? `•••• ${llmSettings.apiKeyLast4}` : lt('Đã lưu', 'Saved')
      return { label: suffix, color: 'var(--success)', bg: 'var(--success-subtle)' }
    }
    return { label: lt('Chưa thiết lập', 'Not set'), color: 'var(--text-muted)', bg: 'var(--bg-surface)' }
  })()

  const visualApiKeyBadge = (() => {
    if (llmLoading) {
      return { label: lt('Đang tải...', 'Loading...'), color: 'var(--text-muted)', bg: 'var(--bg-surface)' }
    }
    if (llmSettings.visualApiKeyInput.trim().length > 0) {
      return { label: lt('Sẽ cập nhật khi lưu', 'Will update on save'), color: 'var(--text-primary)', bg: 'var(--bg-surface-hover)' }
    }
    if (clearVisualApiKey) {
      return { label: lt('Sẽ xoá khi lưu', 'Will remove on save'), color: 'var(--error)', bg: 'var(--error-subtle)' }
    }
    if (llmSettings.visualApiKeySet) {
      const suffix = llmSettings.visualApiKeyLast4 ? `•••• ${llmSettings.visualApiKeyLast4}` : lt('Đã lưu', 'Saved')
      return { label: suffix, color: 'var(--success)', bg: 'var(--success-subtle)' }
    }
    return { label: lt('Chưa thiết lập', 'Not set'), color: 'var(--text-muted)', bg: 'var(--bg-surface)' }
  })()

  const inputStyle = {
    width: '100%',
    padding: 'var(--space-sm) var(--space-md)',
    background: 'var(--bg-surface)',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius-sm)',
    color: 'var(--text-primary)',
    fontSize: '13px',
    fontFamily: 'var(--font-body)',
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
    <div className="settings-page">
      <div className="page-header">
        <div>
          <h1 className="page-header__title">{lt('Cài đặt', 'Settings')}</h1>
          <p className="page-header__subtitle">{lt('Cá nhân hoá và cấu hình hệ thống', 'Personalization and system configuration')}</p>
        </div>
        <div className="page-header__actions">
          {saveMessage && (
            <span
              style={{
                color: (saveMessage.toLowerCase().includes('thành công') || saveMessage.toLowerCase().includes('success'))
                  ? 'var(--success)'
                  : 'var(--error)',
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
            {lt('Lưu thay đổi', 'Save changes')}
          </button>
        </div>
      </div>

      <div className="grid grid--2">
        <div className="card">
          <div className="card__header">
            <h3 className="card__title">
              <User size={18} className="card__title-icon" />
              {lt('Cá nhân hoá', 'Personalization')}
            </h3>
          </div>
          <div className="card__body">
            <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 'var(--space-md)' }}>
              {lt(
                'Thiết lập phong cách phản hồi của MINUTE. Các thông tin này được đưa vào prompt để AI trả lời đúng ngữ cảnh sản phẩm.',
                'Configure MINUTE response style. These fields are injected into prompts so AI replies fit your product context.',
              )}
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-md)' }}>
              <div>
                <label style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 'var(--space-xs)', display: 'block' }}>
                  {lt('Biệt danh', 'Nickname')}
                </label>
                <input
                  type="text"
                  placeholder={lt('Ví dụ: Phước (PM), Lan (Tech Lead)', 'e.g. Alex (PM), Sam (Tech Lead)')}
                  value={settings.personalization.nickname}
                  onChange={e => updatePersonal('nickname', e.target.value)}
                  style={inputStyle}
                />
              </div>
              <div>
                <label style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 'var(--space-xs)', display: 'block' }}>
                  {lt('Hãy kể thêm về bạn', 'Tell us more about you')}
                </label>
                <textarea
                  placeholder={lt(
                    'Ví dụ: Mình làm PM fintech, thích output dạng bullet, ưu tiên số liệu và bằng chứng.',
                    'e.g. I am a fintech PM, prefer bullet outputs, and prioritize data with evidence.',
                  )}
                  value={settings.personalization.about}
                  onChange={e => updatePersonal('about', e.target.value)}
                  style={textAreaStyle}
                />
              </div>
              <div>
                <label style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 'var(--space-xs)', display: 'block' }}>
                  {lt('Mô tả định hướng tương lai', 'Future focus')}
                </label>
                <textarea
                  placeholder={lt(
                    'Ví dụ: 3-6 tháng tới cần cải thiện leadership, delivery tốc độ cao, giảm rủi ro vận hành.',
                    'e.g. In 3-6 months, improve leadership, faster delivery, and reduce operational risks.',
                  )}
                  value={settings.personalization.futureFocus}
                  onChange={e => updatePersonal('futureFocus', e.target.value)}
                  style={textAreaStyle}
                />
              </div>
              <div>
                <label style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 'var(--space-xs)', display: 'block' }}>
                  {lt('Nghề nghiệp / Vai trò', 'Occupation / Role')}
                </label>
                <input
                  type="text"
                  placeholder={lt('Ví dụ: Product Manager, PMO, Engineering Manager', 'e.g. Product Manager, PMO, Engineering Manager')}
                  value={settings.personalization.role}
                  onChange={e => updatePersonal('role', e.target.value)}
                  style={inputStyle}
                />
              </div>
              <div>
                <label style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 'var(--space-xs)', display: 'block' }}>
                  {lt('Định hướng ghi chú', 'Note style')}
                </label>
                <select
                  value={settings.personalization.noteStyle}
                  onChange={e => updatePersonal('noteStyle', e.target.value as NoteStyle)}
                  style={selectStyle}
                >
                  {NOTE_STYLE_OPTIONS.map(item => (
                    <option key={item.value} value={item.value}>
                      {language === 'en' ? item.labelEn : item.labelVi}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 'var(--space-xs)', display: 'block' }}>
                  {lt('Văn giọng', 'Tone')}
                </label>
                <select
                  value={settings.personalization.tone}
                  onChange={e => updatePersonal('tone', e.target.value as ToneStyle)}
                  style={selectStyle}
                >
                  {TONE_OPTIONS.map(item => (
                    <option key={item.value} value={item.value}>
                      {language === 'en' ? item.labelEn : item.labelVi}
                    </option>
                  ))}
                </select>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600 }}>{lt('Trích dẫn & bằng chứng', 'Citations & evidence')}</div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                    {lt('Luôn kèm timestamp/tài liệu khi có', 'Always include timestamp/document evidence when available')}
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
              {lt('Thiết lập hệ thống', 'System settings')}
            </h3>
          </div>
          <div className="card__body">
            <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 'var(--space-md)' }}>
              {lt('Cấu hình model, khóa API và các tính năng AI trong phiên/post-session.', 'Configure models, API keys, and AI features for in-session/post-session flow.')}
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-md)' }}>
              <div>
                <label style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 'var(--space-xs)', display: 'block' }}>
                  {lt('Recap trong phiên', 'In-session recap')}
                </label>
                <select
                  value={settings.system.recapInterval}
                  onChange={e => updateSystem('recapInterval', e.target.value as RecapInterval)}
                  style={selectStyle}
                >
                  <option value="off">{lt('Tắt', 'Off')}</option>
                  <option value="2m">{lt('2 phút', '2 minutes')}</option>
                  <option value="5m">{lt('5 phút', '5 minutes')}</option>
                </select>
              </div>
              <div>
                <label style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 'var(--space-xs)', display: 'block' }}>
                  {lt('Cấu hình model', 'LLM model configuration')}
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
                  {lt('LLM API key của riêng bạn', 'Your LLM API key')}
                </label>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <input
                    type={showApiKey ? 'text' : 'password'}
                    placeholder={lt('Nhập API key (không lưu trên trình duyệt)', 'Enter API key (not stored in browser)')}
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
                    {lt('Xoá key', 'Remove key')}
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
                  {lt('API key được mã hoá và chỉ lưu trên server. Không lưu vào localStorage.', 'API key is encrypted and stored only on server. Never stored in localStorage.')}
                </div>
                {llmError && (
                  <div style={{ fontSize: 11, color: 'var(--error)', marginTop: 6 }}>
                    {llmError}
                  </div>
                )}
              </div>
              <div style={{ borderTop: '1px solid var(--border)', paddingTop: 'var(--space-md)' }}>
                <label style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 'var(--space-xs)', display: 'block' }}>
                  {lt('Visual model (video/frame understanding)', 'Visual model (video/frame understanding)')}
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
                    <option value="gemini">{lt('Google Gemini (Vision)', 'Google Gemini (Vision)')}</option>
                    <option value="groq">{lt('Groq (Vision)', 'Groq (Vision)')}</option>
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
                  {lt('Dùng cho pipeline ảnh/video (slide/frame caption), tách riêng khỏi chatbot để giảm hallucination.', 'Used for image/video pipeline (slide/frame caption), separated from chatbot to reduce hallucination.')}
                </div>
              </div>
              <div>
                <label style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 'var(--space-xs)', display: 'block' }}>
                  {lt('Visual API key (riêng)', 'Visual API key (separate)')}
                </label>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <input
                    type={showVisualApiKey ? 'text' : 'password'}
                    placeholder={lt('Nhập API key cho vision model', 'Enter API key for vision model')}
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
                    {lt('Xoá key', 'Remove key')}
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
                  {lt('Master prompt cho AI', 'Master prompt for AI')}
                </label>
                <textarea
                  placeholder={lt(
                    'Ví dụ: Luôn trả lời theo format Executive Summary -> Decision Table -> Action Table (owner/deadline/priority). Bắt buộc trích dẫn transcript/tài liệu/timecode; nếu thiếu dữ liệu phải nêu rõ và đề xuất câu hỏi tiếp theo.',
                    'e.g. Always answer in format Executive Summary -> Decision Table -> Action Table (owner/deadline/priority). Must cite transcript/doc/timecode; if evidence is missing, state it and suggest follow-up questions.',
                  )}
                  value={llmSettings.masterPrompt}
                  onChange={e => updateLlm('masterPrompt', e.target.value)}
                  style={{ ...textAreaStyle, minHeight: '120px' }}
                />
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 6 }}>
                  {lt('Prompt này được ghép vào system prompt cho chatbot/tóm tắt và lưu trên server. Nên mô tả rõ format đầu ra để demo hackathon nhất quán.', 'This prompt is appended to system prompt for chatbot/summary and stored on server. Define output format clearly for consistent hackathon demos.')}
                </div>
              </div>

              <div style={{ marginTop: 'var(--space-sm)' }}>
                <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 8 }}>{lt('Tính năng AI', 'AI Features')}</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-base)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 500 }}>{lt('Tính năng AI', 'AI Features')}</div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{lt('Bật/tắt toàn bộ AI trong ứng dụng', 'Enable/disable all AI features in the app')}</div>
                    </div>
                    <Toggle
                      checked={settings.system.aiEnabled}
                      onChange={(checked) => updateSystem('aiEnabled', checked)}
                    />
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 500 }}>{lt('Tự động tóm tắt', 'Auto summary')}</div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{lt('Tạo summary sau phiên', 'Generate summary after session')}</div>
                    </div>
                    <Toggle
                      checked={settings.system.ai.autoSummary}
                      onChange={(checked) => updateAI('autoSummary', checked)}
                    />
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 500 }}>{lt('Gợi ý tài liệu để đính kèm', 'Suggest related documents')}</div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{lt('Đề xuất docs liên quan theo nội dung', 'Recommend related docs from context')}</div>
                    </div>
                    <Toggle
                      checked={settings.system.ai.documentSuggestions}
                      onChange={(checked) => updateAI('documentSuggestions', checked)}
                    />
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 500 }}>{lt('Phát hiện action items', 'Action item detection')}</div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{lt('Trích xuất task/owner/deadline (gợi ý)', 'Extract task/owner/deadline (suggested)')}</div>
                    </div>
                    <Toggle
                      checked={settings.system.ai.actionItemDetection}
                      onChange={(checked) => updateAI('actionItemDetection', checked)}
                    />
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 500 }}>{lt('Live recap', 'Live recap')}</div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{lt('Cập nhật recap theo thời gian thực', 'Update recap in real-time')}</div>
                    </div>
                    <Toggle
                      checked={settings.system.ai.liveRecap}
                      onChange={(checked) => updateAI('liveRecap', checked)}
                    />
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 500 }}>{lt('Web search', 'Web search')}</div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{lt('Khi thiếu bằng chứng, có thể đề xuất tìm web', 'When evidence is missing, suggest searching the web')}</div>
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
              {lt('Ngôn ngữ', 'Language')}
            </h3>
          </div>
          <div className="card__body">
            <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: 'var(--space-md)' }}>
              {lt('Chọn ngôn ngữ hiển thị cho ứng dụng', 'Choose application display language')}
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
