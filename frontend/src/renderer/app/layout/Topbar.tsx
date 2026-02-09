import { useMemo, useState } from 'react'
import { useLocation, Link, useNavigate } from 'react-router-dom'
import { ArrowLeft, HelpCircle, Home, ChevronRight, Search, LogOut } from 'lucide-react'
import { useLocaleText } from '../../i18n/useLocaleText'
import { useLanguage } from '../../contexts/LanguageContext'
import { logout } from '../../lib/api/auth'

const Topbar = () => {
  const location = useLocation()
  const currentPath = location.pathname
  const navigate = useNavigate()
  const isDockView = /^\/app\/meetings\/[^/]+\/dock/.test(currentPath)
  const { lt } = useLocaleText()
  const { language, setLanguage } = useLanguage()

  const [searchTerm, setSearchTerm] = useState('')
  const toggleLanguage = () => setLanguage(language === 'vi' ? 'en' : 'vi')
  const languageSwitchLabel = language === 'vi' ? 'EN' : 'VI'

  const routeTitles: Record<string, string> = useMemo(() => ({
    '/': 'Home',
    '/app': 'Home',
    '/app/dashboard': 'Home',
    '/app/calendar': lt('Lịch họp', 'Calendar'),
    '/app/meetings': 'Workspace',
    '/app/projects': lt('Dự án', 'Projects'),
    '/app/knowledge': lt('Kho kiến thức', 'Knowledge Hub'),
    '/app/tasks': lt('Nhiệm vụ', 'Tasks'),
    '/app/settings': lt('Cài đặt', 'Settings'),
    '/app/admin': lt('Bảng quản trị', 'Admin Console'),
  }), [lt])

  const routeBreadcrumbs: Array<{ match: RegExp; trail: string[] }> = useMemo(
    () => [
      { match: /^\/app\/meetings\/[^/]+\/detail/, trail: ['Workspace', lt('Chi tiết phiên', 'Session detail')] },
      { match: /^\/app\/projects\/[^/]+$/, trail: [lt('Dự án', 'Projects'), lt('Chi tiết dự án', 'Project detail')] },
    ],
    [lt],
  )

  const findPageTitle = (path: string) => {
    if (routeTitles[path]) return routeTitles[path]
    if (path.startsWith('/app/meetings')) return 'Workspace'
    if (path.startsWith('/app/projects')) return lt('Dự án', 'Projects')
    if (path.startsWith('/app/knowledge')) return lt('Kho kiến thức', 'Knowledge Hub')
    if (path.startsWith('/app/tasks')) return lt('Nhiệm vụ', 'Tasks')
    if (path.startsWith('/app/settings')) return lt('Cài đặt', 'Settings')
    return 'Minute'
  }

  const handleLogout = () => {
    void logout()
      .catch(() => null)
      .finally(() => navigate('/'))
  }

  return (
    <header className={`topbar ${isDockView ? 'topbar--dock' : ''}`}>
      {isDockView ? (
        <>
          <div className="topbar__dock-left">
            <div className="topbar__dock-brand">
              <img src="/minute_icon.svg" alt="Minute" className="topbar__dock-logo" />
              <span className="topbar__dock-name">Minute</span>
            </div>
            <ChevronRight size={14} className="topbar__dock-sep" />
            <span className="topbar__dock-crumb">Workspace</span>
          </div>
          <div className="topbar__dock-right">
            <button
              className="topbar__icon-btn"
              onClick={toggleLanguage}
              title={language === 'vi' ? 'Switch to English' : lt('Chuyển sang tiếng Việt', 'Switch to Vietnamese')}
              type="button"
            >
              {languageSwitchLabel}
            </button>
            <button
              className="topbar__icon-btn topbar__dock-back"
              onClick={() => navigate(-1)}
              title={lt('Quay lại', 'Back')}
              type="button"
            >
              <ArrowLeft size={18} />
            </button>
          </div>
        </>
      ) : (
        <>
          <div className="topbar__left">
            {(() => {
              const matched = routeBreadcrumbs.find(item => item.match.test(currentPath))
              const baseCrumb = findPageTitle(currentPath)
              const trail = matched ? matched.trail : []
              const crumbs = trail.length && trail[0] === baseCrumb ? trail : [baseCrumb, ...trail]
              return (
                <div className="topbar__breadcrumb">
                  <Home size={14} />
                  <ChevronRight size={14} />
                  {crumbs.map((crumb, idx) => (
                    <span
                      key={`${crumb}-${idx}`}
                      className={idx === 0 ? 'topbar__breadcrumb-current' : 'topbar__breadcrumb-extra'}
                    >
                      {idx > 0 && <ChevronRight size={12} />}
                      {crumb}
                    </span>
                  ))}
                </div>
              )
            })()}
            <div className="topbar__search">
              <Search className="topbar__search-icon" />
              <input
                type="search"
                className="topbar__search-input"
                placeholder={lt('Tìm kiếm cuộc họp, dự án, tài liệu...', 'Search meetings, projects, documents...')}
                value={searchTerm}
                onChange={event => setSearchTerm(event.target.value)}
              />
            </div>
          </div>

          <div className="topbar__right">
            <button
              className="topbar__icon-btn"
              onClick={toggleLanguage}
              title={language === 'vi' ? 'Switch to English' : lt('Chuyển sang tiếng Việt', 'Switch to Vietnamese')}
              type="button"
            >
              {languageSwitchLabel}
            </button>
            <Link to="/about" className="topbar__icon-btn" title={lt('Giới thiệu Minute', 'About Minute')}>
              <HelpCircle size={18} />
            </Link>
            <button
              type="button"
              className="topbar__icon-btn topbar__icon-btn--logout"
              title={lt('Quay về landing page', 'Back to landing page')}
              onClick={handleLogout}
            >
              <LogOut size={18} />
            </button>
          </div>
        </>
      )}
    </header>
  )
}

export default Topbar
