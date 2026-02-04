import { useState, useEffect } from 'react'
import {
  User,
  Settings as SettingsIcon,
  Globe,
  Save,
  Loader2,
  Check,
} from 'lucide-react'
import { currentUser } from '../../store/mockData'
import { getStoredUser } from '../../lib/api/auth'
import { useLanguage } from '../../contexts/LanguageContext'
import { languageNames, languageFlags, type Language } from '../../i18n'

type NoteStyle = 'Ngắn gọn' | 'Cân bằng' | 'Chi tiết'
type ToneStyle =
  | 'Chuyên nghiệp'
  | 'Giáo dục (giải thích rõ)'
  | 'Thân thiện'
  | 'Thẳng vào vấn đề'
  | 'Socratic (hỏi gợi mở)'
type ThemeMode = 'system' | 'light' | 'dark'
type RecapInterval = 'off' | '2m' | '5m'
type ModelDefault = 'gemini-default' | 'gemini-1.5-pro' | 'gemini-1.5-flash'

type ApiKeyStatus = 'idle' | 'testing' | 'valid' | 'invalid'

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
    defaultModel: ModelDefault
    apiKey: string
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
    defaultModel: 'gemini-default',
    apiKey: '',
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

const Settings = () => {
  const activeUser = getStoredUser() || currentUser
  const SETTINGS_KEY = `minute_settings_${activeUser.id}`

  const [settings, setSettings] = useState<UserSettings>(defaultSettings)
  const [isSaving, setIsSaving] = useState(false)
  const [saveMessage, setSaveMessage] = useState<string | null>(null)
  const [isDirty, setIsDirty] = useState(false)
  const [apiKeyStatus, setApiKeyStatus] = useState<ApiKeyStatus>('idle')
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
        setSettings(merged)
      }
    } catch (err) {
      console.error('Failed to load settings:', err)
    }
  }, [])

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

  const handleSave = async () => {
    setIsSaving(true)
    setSaveMessage(null)
    try {
      localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings))
      await new Promise(resolve => setTimeout(resolve, 400))
      setSaveMessage('Đã lưu thành công!')
      setTimeout(() => setSaveMessage(null), 3000)
      setIsDirty(false)
    } catch (err) {
      console.error('Failed to save settings:', err)
      setSaveMessage('Lỗi khi lưu. Vui lòng thử lại.')
    } finally {
      setIsSaving(false)
    }
  }

  const handleTestKey = async () => {
    setApiKeyStatus('testing')
    await new Promise(resolve => setTimeout(resolve, 600))
    const hasKey = settings.system.apiKey.trim().length > 0
    setApiKeyStatus(hasKey ? 'valid' : 'invalid')
  }

  const apiKeyBadge = (() => {
    const hasKey = settings.system.apiKey.trim().length > 0
    if (!hasKey) {
      return { label: 'Chưa thiết lập', color: 'var(--text-muted)', bg: 'var(--bg-surface)' }
    }
    if (apiKeyStatus === 'testing') {
      return { label: 'Đang kiểm tra...', color: 'var(--text-primary)', bg: 'var(--bg-surface-hover)' }
    }
    if (apiKeyStatus === 'valid') {
      return { label: 'Hợp lệ', color: 'var(--success)', bg: 'var(--success-subtle)' }
    }
    if (apiKeyStatus === 'invalid') {
      return { label: 'Không hợp lệ', color: 'var(--error)', bg: 'var(--error-subtle)' }
    }
    return { label: 'Chưa kiểm tra', color: 'var(--text-muted)', bg: 'var(--bg-surface)' }
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
              Thiết lập phong cách và giọng điệu phản hồi của MINUTE. Không ảnh hưởng đến tính năng.
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-md)' }}>
              <div>
                <label style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 'var(--space-xs)', display: 'block' }}>
                  Biệt danh
                </label>
                <input
                  type="text"
                  placeholder="Phước, Anh Phước"
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
                  placeholder="Mình làm PM, thích bullet rõ ràng, ưu tiên evidence..."
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
                  placeholder="6 tháng tới muốn improve kỹ năng leadership, quản trị dự án..."
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
                  placeholder="Team lead backend, Sinh viên CNTT, PM sản phẩm"
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
                  Model mặc định
                </label>
                <select
                  value={settings.system.defaultModel}
                  onChange={e => updateSystem('defaultModel', e.target.value as ModelDefault)}
                  style={selectStyle}
                >
                  <option value="gemini-default">Gemini (Default)</option>
                  <option value="gemini-1.5-pro">Gemini 1.5 Pro</option>
                  <option value="gemini-1.5-flash">Gemini 1.5 Flash</option>
                </select>
              </div>
              <div>
                <label style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 'var(--space-xs)', display: 'block' }}>
                  LLM API key của riêng bạn
                </label>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <input
                    type="password"
                    placeholder="Nhập API key"
                    value={settings.system.apiKey}
                    onChange={e => {
                      updateSystem('apiKey', e.target.value)
                      setApiKeyStatus('idle')
                    }}
                    style={{ ...inputStyle, flex: 1 }}
                  />
                  <button
                    type="button"
                    className="btn btn--secondary btn--sm"
                    onClick={handleTestKey}
                    disabled={!settings.system.apiKey.trim() || apiKeyStatus === 'testing'}
                  >
                    {apiKeyStatus === 'testing' ? 'Đang test...' : 'Test key'}
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
