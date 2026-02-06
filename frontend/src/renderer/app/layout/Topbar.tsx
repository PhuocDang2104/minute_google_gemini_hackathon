import { useState } from 'react'
import { useLocation, Link, useNavigate } from 'react-router-dom'
import { ArrowLeft, HelpCircle, Home, ChevronRight, Search } from 'lucide-react'

const routeTitles: Record<string, string> = {
  '/': 'Home',
  '/app': 'Home',
  '/app/dashboard': 'Home',
  '/app/calendar': 'Lịch họp',
  '/app/meetings': 'Workspace',
  '/app/projects': 'Dự án',
  '/app/knowledge': 'Kho kiến thức',
  '/app/tasks': 'Nhiệm vụ',
  '/app/settings': 'Cài đặt',
  '/app/admin': 'Bảng quản trị',
}

const findPageTitle = (path: string) => {
  if (routeTitles[path]) return routeTitles[path]
  if (path.startsWith('/app/meetings')) return 'Workspace'
  if (path.startsWith('/app/projects')) return 'Dự án'
  if (path.startsWith('/app/knowledge')) return 'Kho kiến thức'
  if (path.startsWith('/app/tasks')) return 'Nhiệm vụ'
  if (path.startsWith('/app/settings')) return 'Cài đặt'
  return 'Minute'
}

const routeBreadcrumbs: Array<{ match: RegExp; trail: string[] }> = [
  { match: /^\/app\/meetings\/[^/]+\/detail/, trail: ['Workspace', 'Chi tiết phiên'] },
  { match: /^\/app\/projects\/[^/]+$/, trail: ['Dự án', 'Chi tiết dự án'] },
]

const Topbar = () => {
  const location = useLocation()
  const currentPath = location.pathname
  const navigate = useNavigate()
  const isDockView = /^\/app\/meetings\/[^/]+\/dock/.test(currentPath)

  const [searchTerm, setSearchTerm] = useState('')

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
              className="topbar__icon-btn topbar__dock-back"
              onClick={() => navigate(-1)}
              title="Quay lại"
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
              const crumbs = (trail.length && trail[0] === baseCrumb) ? trail : [baseCrumb, ...trail]
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
                placeholder="Tìm kiếm cuộc họp, dự án, tài liệu..."
                value={searchTerm}
                onChange={event => setSearchTerm(event.target.value)}
              />
            </div>
          </div>

          <div className="topbar__right">
            <Link to="/about" className="topbar__icon-btn" title="Giới thiệu Minute">
              <HelpCircle size={18} />
            </Link>
          </div>
        </>
      )}
    </header>
  )
}

export default Topbar
