import { useState, useEffect, useRef } from 'react'
import { useLocation, Link, useNavigate } from 'react-router-dom'
import {
  ArrowLeft,
  Bell,
  HelpCircle,
  Home,
  ChevronRight,
  Calendar,
  CheckSquare,
  FileText,
  AlertTriangle,
  Search,
  X,
  Check,
  Clock,
  ExternalLink,
} from 'lucide-react'
import { useLanguage } from '../../contexts/LanguageContext'

// Notification Types
type NotificationType = 'meeting_reminder' | 'action_item' | 'action_overdue' | 'minutes_ready' | 'mention'

interface Notification {
  id: string
  type: NotificationType
  title: string
  message: string
  time: Date
  read: boolean
  link?: string
  metadata?: {
    meetingId?: string
    actionId?: string
  }
}

// Storage key for read notifications
const READ_NOTIFICATIONS_KEY = 'minute_read_notifications'

// Mock notifications data
const generateMockNotifications = (): Notification[] => {
  const now = new Date()
  return [
    {
      id: 'n1',
      type: 'meeting_reminder',
      title: 'Cuộc họp sắp bắt đầu',
      message: 'Weekly Status - Core Banking sẽ bắt đầu trong 15 phút',
      time: new Date(now.getTime() - 5 * 60000), // 5 mins ago
      read: false,
      link: '/app/meetings/m0000001-0000-0000-0000-000000000001',
      metadata: { meetingId: 'm0000001-0000-0000-0000-000000000001' }
    },
    {
      id: 'n2',
      type: 'action_overdue',
      title: 'Action item quá hạn',
      message: 'Hoàn thành security review cho Mobile App đã quá hạn 2 ngày',
      time: new Date(now.getTime() - 2 * 60 * 60000), // 2 hours ago
      read: false,
      link: '/app/tasks',
      metadata: { actionId: 'a001' }
    },
    {
      id: 'n3',
      type: 'minutes_ready',
      title: 'Biên bản họp đã sẵn sàng',
      message: 'Biên bản cuộc họp Steering Committee Q4 đã được AI tạo xong',
      time: new Date(now.getTime() - 4 * 60 * 60000), // 4 hours ago
      read: false,
      link: '/app/meetings/m0000002-0000-0000-0000-000000000002',
      metadata: { meetingId: 'm0000002-0000-0000-0000-000000000002' }
    },
    {
      id: 'n4',
      type: 'action_item',
      title: 'Action item mới được giao',
      message: 'Bạn được giao task: Chuẩn bị tài liệu UAT cho Core Banking',
      time: new Date(now.getTime() - 24 * 60 * 60000), // 1 day ago
      read: true,
      link: '/app/tasks',
    },
    {
      id: 'n5',
      type: 'mention',
      title: 'Bạn được nhắc đến',
      message: '@Nguyễn Văn A đã nhắc đến bạn trong cuộc họp Budget Review',
      time: new Date(now.getTime() - 2 * 24 * 60 * 60000), // 2 days ago
      read: true,
      link: '/app/meetings/m0000003-0000-0000-0000-000000000003',
    },
  ]
}

// Format relative time
const formatRelativeTime = (date: Date): string => {
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMins = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMs / 3600000)
  const diffDays = Math.floor(diffMs / 86400000)

  if (diffMins < 1) return 'Vừa xong'
  if (diffMins < 60) return `${diffMins} phút trước`
  if (diffHours < 24) return `${diffHours} giờ trước`
  if (diffDays === 1) return 'Hôm qua'
  if (diffDays < 7) return `${diffDays} ngày trước`
  return date.toLocaleDateString('vi-VN')
}

// Get icon for notification type
const getNotificationIcon = (type: NotificationType) => {
  switch (type) {
    case 'meeting_reminder':
      return <Calendar size={16} className="notification-icon notification-icon--meeting" />
    case 'action_item':
      return <CheckSquare size={16} className="notification-icon notification-icon--action" />
    case 'action_overdue':
      return <AlertTriangle size={16} className="notification-icon notification-icon--overdue" />
    case 'minutes_ready':
      return <FileText size={16} className="notification-icon notification-icon--minutes" />
    case 'mention':
      return <Clock size={16} className="notification-icon notification-icon--mention" />
    default:
      return <Bell size={16} />
  }
}

const routeTitles: Record<string, string> = {
  '/': 'Home',
  '/app': 'Home',
  '/app/dashboard': 'Home',
  '/app/calendar': 'Lịch họp',
  '/app/meetings': 'Cuộc họp',
  '/app/projects': 'Dự án',
  '/app/knowledge': 'Kho kiến thức',
  '/app/tasks': 'Nhiệm vụ',
  '/app/settings': 'Cài đặt',
  '/app/admin': 'Bảng quản trị',
}

const findPageTitle = (path: string) => {
  if (routeTitles[path]) return routeTitles[path]
  if (path.startsWith('/app/meetings')) return 'Cuộc họp'
  if (path.startsWith('/app/projects')) return 'Dự án'
  if (path.startsWith('/app/knowledge')) return 'Kho kiến thức'
  if (path.startsWith('/app/tasks')) return 'Nhiệm vụ'
  if (path.startsWith('/app/settings')) return 'Cài đặt'
  return 'Minute'
}

const routeBreadcrumbs: Array<{ match: RegExp; trail: string[] }> = [
  { match: /^\/app\/meetings\/[^/]+\/detail/, trail: ['Cuộc họp', 'Chi tiết cuộc họp'] },
  { match: /^\/app\/projects\/[^/]+$/, trail: ['Dự án', 'Chi tiết dự án'] },
]

const Topbar = () => {
  const location = useLocation()
  const currentPath = location.pathname
  const navigate = useNavigate()
  const { t } = useLanguage()
  const pageTitle = findPageTitle(currentPath)
  const isDockView = /^\/app\/meetings\/[^/]+\/dock/.test(currentPath)

  const [showNotifications, setShowNotifications] = useState(false)
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [searchTerm, setSearchTerm] = useState('')
  const dropdownRef = useRef<HTMLDivElement>(null)

  // Load notifications
  useEffect(() => {
    const mockNotifications = generateMockNotifications()

    // Load read status from localStorage
    try {
      const readIds = JSON.parse(localStorage.getItem(READ_NOTIFICATIONS_KEY) || '[]')
      const updatedNotifications = mockNotifications.map(n => ({
        ...n,
        read: readIds.includes(n.id) || n.read
      }))
      setNotifications(updatedNotifications)
    } catch {
      setNotifications(mockNotifications)
    }
  }, [])

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowNotifications(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Mark notification as read
  const markAsRead = (id: string) => {
    setNotifications(prev => prev.map(n =>
      n.id === id ? { ...n, read: true } : n
    ))

    // Persist to localStorage
    try {
      const readIds = JSON.parse(localStorage.getItem(READ_NOTIFICATIONS_KEY) || '[]')
      if (!readIds.includes(id)) {
        localStorage.setItem(READ_NOTIFICATIONS_KEY, JSON.stringify([...readIds, id]))
      }
    } catch { }
  }

  // Mark all as read
  const markAllAsRead = () => {
    const allIds = notifications.map(n => n.id)
    setNotifications(prev => prev.map(n => ({ ...n, read: true })))
    localStorage.setItem(READ_NOTIFICATIONS_KEY, JSON.stringify(allIds))
  }

  // Unread count
  const unreadCount = notifications.filter(n => !n.read).length

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
            <span className="topbar__dock-crumb">Cuộc họp</span>
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
            {/* Notifications */}
            <div className="notification-wrapper" ref={dropdownRef}>
              <button
                className={`topbar__icon-btn ${unreadCount > 0 ? 'topbar__icon-btn--badge' : ''}`}
                title="Thông báo"
                onClick={() => setShowNotifications(!showNotifications)}
                data-count={unreadCount > 9 ? '9+' : unreadCount}
              >
                <Bell size={18} />
              </button>

              {/* Notification Dropdown */}
              {showNotifications && (
                <div className="notification-dropdown">
                  <div className="notification-dropdown__header">
                    <h3>Thông báo</h3>
                    {unreadCount > 0 && (
                      <button
                        className="notification-dropdown__mark-all"
                        onClick={markAllAsRead}
                      >
                        <Check size={14} />
                        Đánh dấu tất cả đã đọc
                      </button>
                    )}
                  </div>

                  <div className="notification-dropdown__list">
                    {notifications.length === 0 ? (
                      <div className="notification-dropdown__empty">
                        <Bell size={32} />
                        <p>Không có thông báo mới</p>
                      </div>
                    ) : (
                      notifications.map(notification => (
                        <Link
                          key={notification.id}
                          to={notification.link || '#'}
                          className={`notification-item ${!notification.read ? 'notification-item--unread' : ''}`}
                          onClick={() => {
                            markAsRead(notification.id)
                            setShowNotifications(false)
                          }}
                        >
                          <div className="notification-item__icon">
                            {getNotificationIcon(notification.type)}
                          </div>
                          <div className="notification-item__content">
                            <div className="notification-item__title">{notification.title}</div>
                            <div className="notification-item__message">{notification.message}</div>
                            <div className="notification-item__time">{formatRelativeTime(notification.time)}</div>
                          </div>
                          {!notification.read && <div className="notification-item__dot" />}
                        </Link>
                      ))
                    )}
                  </div>

                  <div className="notification-dropdown__footer">
                    <Link
                      to="/app/settings"
                      className="notification-dropdown__settings"
                      onClick={() => setShowNotifications(false)}
                    >
                      Cài đặt thông báo
                    </Link>
                  </div>
                </div>
              )}
            </div>

            {/* Help */}
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
