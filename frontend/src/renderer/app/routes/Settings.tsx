import { useState, useEffect } from 'react'
import {
  Settings as SettingsIcon,
  User,
  Bell,
  Link2,
  Shield,
  Palette,
  Bot,
  ExternalLink,
  Check,
  Save,
  Loader2,
  Globe,
} from 'lucide-react'
import { currentUser } from '../../store/mockData'
import { getStoredUser } from '../../lib/api/auth'
import { useLanguage } from '../../contexts/LanguageContext'
import { languageNames, languageFlags, type Language } from '../../i18n'

interface UserSettings {
  displayName: string
  department: string
  notifications: {
    meetingReminder: boolean
    newActionItem: boolean
    overdueActionItem: boolean
    newMinutes: boolean
  }
  ai: {
    autoAgenda: boolean
    documentSuggestions: boolean
    actionItemDetection: boolean
    liveRecap: boolean
  }
}

const defaultSettings: UserSettings = {
  displayName: currentUser.displayName,
  department: currentUser.department,
  notifications: {
    meetingReminder: true,
    newActionItem: true,
    overdueActionItem: true,
    newMinutes: true,
  },
  ai: {
    autoAgenda: true,
    documentSuggestions: true,
    actionItemDetection: true,
    liveRecap: true,
  },
}

const Settings = () => {
  const activeUser = getStoredUser() || currentUser
  const SETTINGS_KEY = `minute_settings_${activeUser.id}`

  const [settings, setSettings] = useState<UserSettings>({
    ...defaultSettings,
    displayName: activeUser.displayName,
    department: activeUser.department,
  })
  const [isSaving, setIsSaving] = useState(false)
  const [saveMessage, setSaveMessage] = useState<string | null>(null)
  const [isEditingProfile, setIsEditingProfile] = useState(false)
  const { language, setLanguage, t } = useLanguage()

  // Load settings from localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem(SETTINGS_KEY)
      if (saved) {
        setSettings({ ...defaultSettings, ...JSON.parse(saved) })
      }
    } catch (err) {
      console.error('Failed to load settings:', err)
    }
  }, [])

  // Save settings
  const handleSave = async () => {
    setIsSaving(true)
    setSaveMessage(null)
    try {
      localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings))
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 500))
      setSaveMessage('Đã lưu thành công!')
      setTimeout(() => setSaveMessage(null), 3000)
      setIsEditingProfile(false)
    } catch (err) {
      console.error('Failed to save settings:', err)
      setSaveMessage('Lỗi khi lưu. Vui lòng thử lại.')
    } finally {
      setIsSaving(false)
    }
  }

  // Update notification settings
  const updateNotification = (key: keyof UserSettings['notifications'], value: boolean) => {
    setSettings(prev => ({
      ...prev,
      notifications: { ...prev.notifications, [key]: value },
    }))
  }

  // Update AI settings
  const updateAI = (key: keyof UserSettings['ai'], value: boolean) => {
    setSettings(prev => ({
      ...prev,
      ai: { ...prev.ai, [key]: value },
    }))
  }

  const integrations = [
    { name: 'Microsoft Teams', status: 'connected', icon: '📞' },
    { name: 'Microsoft Planner', status: 'connected', icon: '📋' },
    { name: 'Jira', status: 'connected', icon: '🎯' },
    { name: 'SharePoint', status: 'connected', icon: '📁' },
    { name: 'LOffice', status: 'pending', icon: '📄' },
  ]

  return (
    <div>
      {/* Page Header */}
      <div className="page-header">
        <div>
          <h1 className="page-header__title">Cài đặt</h1>
          <p className="page-header__subtitle">Quản lý tài khoản và tích hợp</p>
        </div>
        <div className="page-header__actions">
          {saveMessage && (
            <span style={{
              color: saveMessage.includes('thành công') ? 'var(--success)' : 'var(--error)',
              fontSize: 13,
              marginRight: 'var(--space-md)',
            }}>
              {saveMessage}
            </span>
          )}
          <button
            className="btn btn--primary"
            onClick={handleSave}
            disabled={isSaving || !isEditingProfile}
          >
            {isSaving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
            Lưu thay đổi
          </button>
        </div>
      </div>

      <div className="grid grid--2">
        {/* Profile Settings */}
        <div className="card">
          <div className="card__header">
            <h3 className="card__title">
              <User size={18} className="card__title-icon" />
              Thông tin cá nhân
            </h3>
            <button
              className="btn btn--ghost btn--sm"
              onClick={() => setIsEditingProfile((v) => !v)}
              type="button"
            >
              {isEditingProfile ? 'Khóa chỉnh sửa' : 'Chỉnh sửa'}
            </button>
          </div>
          <div className="card__body">
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-lg)', marginBottom: 'var(--space-lg)' }}>
              <div style={{
                width: '64px',
                height: '64px',
                background: 'var(--accent)',
                borderRadius: 'var(--radius-md)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '24px',
                fontWeight: 700,
                color: 'var(--bg-base)'
              }}>
                {(settings.displayName || activeUser.displayName || '?')
                  .trim()
                  .split(' ')
                  .filter(Boolean)
                  .slice(-1)[0]
                  .charAt(0)
                  .toUpperCase()}
              </div>
              <div>
                <div style={{ fontSize: '16px', fontWeight: 600 }}>{settings.displayName}</div>
                <div style={{ fontSize: '13px', color: 'var(--text-muted)' }}>{activeUser.email}</div>
                <span className="badge badge--accent" style={{ marginTop: 'var(--space-xs)' }}>
                  {activeUser.role}
                </span>
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-md)' }}>
              <div>
                <label style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: 'var(--space-xs)', display: 'block' }}>
                  Họ và tên
                </label>
                <input
                  type="text"
                  value={settings.displayName}
                  onChange={e => setSettings(prev => ({ ...prev, displayName: e.target.value }))}
                  disabled={!isEditingProfile}
                  style={{
                    width: '100%',
                    padding: 'var(--space-sm) var(--space-md)',
                    background: 'var(--bg-surface)',
                    border: '1px solid var(--border)',
                    borderRadius: 'var(--radius-sm)',
                    color: 'var(--text-primary)',
                    fontSize: '13px',
                  }}
                />
              </div>
              <div>
                <label style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: 'var(--space-xs)', display: 'block' }}>
                  Email
                </label>
                <input
                  type="email"
                  defaultValue={activeUser.email}
                  disabled
                  style={{
                    width: '100%',
                    padding: 'var(--space-sm) var(--space-md)',
                    background: 'var(--bg-base)',
                    border: '1px solid var(--border)',
                    borderRadius: 'var(--radius-sm)',
                    color: 'var(--text-muted)',
                    fontSize: '13px',
                  }}
                />
              </div>
              <div>
                <label style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: 'var(--space-xs)', display: 'block' }}>
                  Phòng ban
                </label>
                <input
                  type="text"
                  value={settings.department}
                  onChange={e => setSettings(prev => ({ ...prev, department: e.target.value }))}
                  disabled={!isEditingProfile}
                  style={{
                    width: '100%',
                    padding: 'var(--space-sm) var(--space-md)',
                    background: 'var(--bg-surface)',
                    border: '1px solid var(--border)',
                    borderRadius: 'var(--radius-sm)',
                    color: 'var(--text-primary)',
                    fontSize: '13px',
                  }}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Integrations */}
        <div className="card">
          <div className="card__header">
            <h3 className="card__title">
              <Link2 size={18} className="card__title-icon" />
              Tích hợp
            </h3>
          </div>
          <div className="card__body">
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-sm)' }}>
              {integrations.map((integration, index) => (
                <div
                  key={index}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: 'var(--space-md)',
                    background: 'var(--bg-surface)',
                    borderRadius: 'var(--radius-sm)',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-md)' }}>
                    <div style={{
                      width: '36px',
                      height: '36px',
                      background: 'var(--bg-base)',
                      borderRadius: 'var(--radius-sm)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '18px'
                    }}>
                      {integration.icon}
                    </div>
                    <span style={{ fontSize: '13px', fontWeight: 500 }}>{integration.name}</span>
                  </div>
                  {integration.status === 'connected' ? (
                    <span className="badge badge--success">
                      <Check size={10} />
                      Connected
                    </span>
                  ) : (
                    <button
                      className="btn btn--secondary btn--sm"
                      onClick={() => alert(`Kết nối ${integration.name} sẽ được hỗ trợ trong phiên bản tiếp theo.`)}
                    >
                      <ExternalLink size={12} />
                      Connect
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Notifications */}
        <div className="card">
          <div className="card__header">
            <h3 className="card__title">
              <Bell size={18} className="card__title-icon" />
              Thông báo
            </h3>
          </div>
          <div className="card__body">
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-base)' }}>
              {[
                { key: 'meetingReminder', label: 'Nhắc nhở trước cuộc họp', description: '15 phút trước khi họp' },
                { key: 'newActionItem', label: 'Action items mới', description: 'Khi có action item được giao' },
                { key: 'overdueActionItem', label: 'Action items quá hạn', description: 'Cảnh báo khi quá deadline' },
                { key: 'newMinutes', label: 'Biên bản họp', description: 'Khi có biên bản mới' },
              ].map((item) => (
                <div
                  key={item.key}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                  }}
                >
                  <div>
                    <div style={{ fontSize: '13px', fontWeight: 500 }}>{item.label}</div>
                    <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{item.description}</div>
                  </div>
                  <Toggle
                    checked={settings.notifications[item.key as keyof UserSettings['notifications']]}
                    onChange={(checked) => updateNotification(item.key as keyof UserSettings['notifications'], checked)}
                  />
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* AI Settings */}
        <div className="card">
          <div className="card__header">
            <h3 className="card__title">
              <Bot size={18} className="card__title-icon" />
              {t('settings.aiFeatures')}
            </h3>
          </div>
          <div className="card__body">
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-base)' }}>
              {[
                { key: 'autoAgenda', label: t('settings.autoSummary'), description: 'AI tạo agenda dựa trên lịch sử họp' },
                { key: 'documentSuggestions', label: 'Gợi ý tài liệu', description: 'RAG tìm tài liệu liên quan' },
                { key: 'actionItemDetection', label: 'Phát hiện action items', description: 'Tự động nhận diện trong transcript' },
                { key: 'liveRecap', label: 'Live recap', description: 'Tóm tắt realtime trong cuộc họp' },
              ].map((item) => (
                <div
                  key={item.key}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                  }}
                >
                  <div>
                    <div style={{ fontSize: '13px', fontWeight: 500 }}>{item.label}</div>
                    <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{item.description}</div>
                  </div>
                  <Toggle
                    checked={settings.ai[item.key as keyof UserSettings['ai']]}
                    onChange={(checked) => updateAI(item.key as keyof UserSettings['ai'], checked)}
                  />
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Language Settings */}
        <div className="card">
          <div className="card__header">
            <h3 className="card__title">
              <Globe size={18} className="card__title-icon" />
              {t('settings.language')}
            </h3>
          </div>
          <div className="card__body">
            <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: 'var(--space-md)' }}>
              {language === 'vi' ? 'Chọn ngôn ngữ hiển thị cho ứng dụng' : 'Select display language for the application'}
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

// Toggle Component
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
    <div style={{
      width: '18px',
      height: '18px',
      background: 'white',
      borderRadius: '50%',
      position: 'absolute',
      top: '2px',
      left: checked ? '20px' : '2px',
      transition: 'left 0.2s',
      boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
    }}></div>
  </div>
)

export default Settings
