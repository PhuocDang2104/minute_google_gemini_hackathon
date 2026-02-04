import { useState, useEffect, useCallback } from 'react'
import {
  CheckSquare,
  Clock,
  User,
  AlertTriangle,
  Filter,
  Plus,
  Check,
  ExternalLink,
  X,
  Loader2,
  RefreshCw,
  Calendar,
  FileText,
} from 'lucide-react'
import { itemsApi, ActionItem, ActionItemFilters } from '../../lib/api/items'
import { actionItems as mockActionItems } from '../../store/mockData'
import { USE_API } from '../../config/env'

// Helper to check if date is overdue
const isOverdue = (deadline?: string) => {
  if (!deadline) return false
  return new Date(deadline) < new Date()
}

// Transform mock data to API format
const transformMockToApi = (mock: typeof mockActionItems[0]): ActionItem => ({
  id: mock.id,
  meeting_id: mock.meetingId,
  description: mock.description,
  owner_user_id: mock.owner.id,
  owner_name: mock.owner.displayName,
  meeting_title: mock.meetingTitle,
  deadline: mock.deadline.toISOString().split('T')[0],
  priority: mock.priority,
  status: mock.status as ActionItem['status'],
  external_task_link: mock.externalLink,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
})

const Tasks = () => {
  const [items, setItems] = useState<ActionItem[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showFilterModal, setShowFilterModal] = useState(false)
  const [showAddModal, setShowAddModal] = useState(false)
  const [filters, setFilters] = useState<ActionItemFilters>({})
  const [activeFilter, setActiveFilter] = useState<string>('all')

  // Fetch action items
  const fetchItems = useCallback(async (filterParams?: ActionItemFilters) => {
    setIsLoading(true)
    setError(null)
    try {
      if (USE_API) {
        const response = await itemsApi.listAllActions(filterParams)
        setItems(response.items)
      } else {
        // Use mock data
        let mockItems = mockActionItems.map(transformMockToApi)
        
        // Apply filters to mock data
        if (filterParams?.status) {
          mockItems = mockItems.filter(i => i.status === filterParams.status)
        }
        if (filterParams?.priority) {
          mockItems = mockItems.filter(i => i.priority === filterParams.priority)
        }
        if (filterParams?.overdue_only) {
          mockItems = mockItems.filter(i => isOverdue(i.deadline) && i.status !== 'completed')
        }
        
        setItems(mockItems)
      }
    } catch (err) {
      console.error('Failed to fetch action items:', err)
      // Fallback to mock data
      setItems(mockActionItems.map(transformMockToApi))
      setError('Không thể tải dữ liệu. Đang hiển thị dữ liệu mẫu.')
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchItems(filters)
  }, [fetchItems, filters])

  // Toggle item status
  const toggleStatus = async (item: ActionItem) => {
    const newStatus = item.status === 'completed' ? 'in_progress' : 'completed'
    
    try {
      if (USE_API) {
        await itemsApi.updateAction(item.id, { status: newStatus })
      }
      // Update local state
      setItems(prev => prev.map(i => 
        i.id === item.id ? { ...i, status: newStatus } : i
      ))
    } catch (err) {
      console.error('Failed to update status:', err)
      // Still update UI for demo
      setItems(prev => prev.map(i => 
        i.id === item.id ? { ...i, status: newStatus } : i
      ))
    }
  }

  // Filter handlers
  const handleFilterChange = (filterType: string) => {
    setActiveFilter(filterType)
    switch (filterType) {
      case 'overdue':
        setFilters({ overdue_only: true })
        break
      case 'in_progress':
        setFilters({ status: 'in_progress' })
        break
      case 'completed':
        setFilters({ status: 'completed' })
        break
      case 'high':
        setFilters({ priority: 'high' })
        break
      default:
        setFilters({})
    }
  }

  // Stats
  const overdue = items.filter(a => isOverdue(a.deadline) && a.status !== 'completed')
  const inProgress = items.filter(a => a.status === 'in_progress')
  const pending = items.filter(a => a.status === 'proposed' || a.status === 'confirmed')
  const completed = items.filter(a => a.status === 'completed')

  return (
    <div>
      {/* Page Header */}
      <div className="page-header">
        <div>
          <h1 className="page-header__title">Action Items</h1>
          <p className="page-header__subtitle">Theo dõi tất cả action items từ các cuộc họp</p>
        </div>
        <div className="page-header__actions">
          <button 
            className="btn btn--ghost" 
            onClick={() => fetchItems(filters)}
            disabled={isLoading}
            title="Làm mới"
          >
            <RefreshCw size={16} className={isLoading ? 'animate-spin' : ''} />
          </button>
          <button 
            className="btn btn--secondary"
            onClick={() => setShowFilterModal(true)}
          >
            <Filter size={16} />
            Lọc
            {Object.keys(filters).length > 0 && (
              <span className="badge badge--accent" style={{ marginLeft: 4 }}>
                {Object.keys(filters).length}
              </span>
            )}
          </button>
          <button 
            className="btn btn--primary"
            onClick={() => setShowAddModal(true)}
          >
            <Plus size={16} />
            Thêm mới
          </button>
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <div className="card mb-4" style={{ borderColor: 'var(--warning)', borderLeftWidth: 3 }}>
          <div className="card__body" style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-md)' }}>
            <AlertTriangle size={18} style={{ color: 'var(--warning)' }} />
            <span>{error}</span>
          </div>
        </div>
      )}

      {/* Quick Filters */}
      <div className="mb-4" style={{ display: 'flex', gap: 'var(--space-sm)', flexWrap: 'wrap' }}>
        {[
          { key: 'all', label: 'Tất cả', count: items.length },
          { key: 'overdue', label: 'Quá hạn', count: overdue.length, variant: 'error' },
          { key: 'in_progress', label: 'Đang thực hiện', count: inProgress.length, variant: 'warning' },
          { key: 'completed', label: 'Hoàn thành', count: completed.length, variant: 'success' },
          { key: 'high', label: 'Ưu tiên cao', count: items.filter(i => i.priority === 'high' || i.priority === 'critical').length, variant: 'accent' },
        ].map(filter => (
          <button
            key={filter.key}
            className={`btn btn--sm ${activeFilter === filter.key ? 'btn--primary' : 'btn--secondary'}`}
            onClick={() => handleFilterChange(filter.key)}
          >
            {filter.label}
            <span className={`badge badge--${filter.variant || 'neutral'}`} style={{ marginLeft: 4 }}>
              {filter.count}
            </span>
          </button>
        ))}
      </div>

      {/* Stats */}
      <div className="grid grid--4 mb-6">
        <div className="card stats-card">
          <div className="stats-card__icon stats-card__icon--info">
            <CheckSquare size={22} />
          </div>
          <div className="stats-card__content">
            <div className="stats-card__label">Tổng số</div>
            <div className="stats-card__value">{items.length}</div>
          </div>
        </div>
        <div className="card stats-card">
          <div className="stats-card__icon stats-card__icon--error">
            <AlertTriangle size={22} />
          </div>
          <div className="stats-card__content">
            <div className="stats-card__label">Quá hạn</div>
            <div className="stats-card__value">{overdue.length}</div>
          </div>
        </div>
        <div className="card stats-card">
          <div className="stats-card__icon stats-card__icon--warning">
            <Clock size={22} />
          </div>
          <div className="stats-card__content">
            <div className="stats-card__label">Đang thực hiện</div>
            <div className="stats-card__value">{inProgress.length}</div>
          </div>
        </div>
        <div className="card stats-card">
          <div className="stats-card__icon stats-card__icon--success">
            <Check size={22} />
          </div>
          <div className="stats-card__content">
            <div className="stats-card__label">Hoàn thành</div>
            <div className="stats-card__value">{completed.length}</div>
          </div>
        </div>
      </div>

      {/* Loading State */}
      {isLoading && (
        <div className="card">
          <div className="card__body" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 'var(--space-xl)' }}>
            <Loader2 size={24} className="animate-spin" style={{ marginRight: 'var(--space-md)' }} />
            <span>Đang tải...</span>
          </div>
        </div>
      )}

      {/* Overdue Section */}
      {!isLoading && overdue.length > 0 && activeFilter !== 'completed' && (
        <div className="card mb-6" style={{ borderColor: 'var(--error)', borderLeftWidth: '3px' }}>
          <div className="card__header">
            <h3 className="card__title">
              <AlertTriangle size={18} style={{ color: 'var(--error)' }} />
              Quá hạn
            </h3>
            <span className="badge badge--error">{overdue.length}</span>
          </div>
          <div className="card__body">
            <div className="action-list">
              {overdue.map(action => (
                <ActionCard key={action.id} action={action} onToggle={toggleStatus} />
              ))}
            </div>
          </div>
        </div>
      )}

      {/* In Progress */}
      {!isLoading && inProgress.length > 0 && activeFilter !== 'completed' && activeFilter !== 'overdue' && (
        <div className="card mb-6">
          <div className="card__header">
            <h3 className="card__title">
              <Clock size={18} className="card__title-icon" />
              Đang thực hiện
            </h3>
            <span className="badge badge--warning">{inProgress.length}</span>
          </div>
          <div className="card__body">
            <div className="action-list">
              {inProgress.map(action => (
                <ActionCard key={action.id} action={action} onToggle={toggleStatus} />
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Pending */}
      {!isLoading && pending.length > 0 && activeFilter !== 'completed' && activeFilter !== 'overdue' && activeFilter !== 'in_progress' && (
        <div className="card mb-6">
          <div className="card__header">
            <h3 className="card__title">
              <CheckSquare size={18} className="card__title-icon" />
              Chờ xử lý
            </h3>
            <span className="badge badge--info">{pending.length}</span>
          </div>
          <div className="card__body">
            <div className="action-list">
              {pending.map(action => (
                <ActionCard key={action.id} action={action} onToggle={toggleStatus} />
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Completed */}
      {!isLoading && completed.length > 0 && (activeFilter === 'all' || activeFilter === 'completed') && (
        <div className="card">
          <div className="card__header">
            <h3 className="card__title">
              <Check size={18} className="card__title-icon" />
              Hoàn thành
            </h3>
            <span className="badge badge--success">{completed.length}</span>
          </div>
          <div className="card__body">
            <div className="action-list">
              {completed.map(action => (
                <ActionCard key={action.id} action={action} onToggle={toggleStatus} />
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Empty State */}
      {!isLoading && items.length === 0 && (
        <div className="card">
          <div className="card__body" style={{ textAlign: 'center', padding: 'var(--space-xl)' }}>
            <CheckSquare size={48} style={{ color: 'var(--text-muted)', marginBottom: 'var(--space-md)' }} />
            <p style={{ color: 'var(--text-muted)' }}>Không có action items nào</p>
          </div>
        </div>
      )}

      {/* Filter Modal */}
      {showFilterModal && (
        <FilterModal
          filters={filters}
          onApply={(newFilters) => {
            setFilters(newFilters)
            setActiveFilter('custom')
            setShowFilterModal(false)
          }}
          onClose={() => setShowFilterModal(false)}
        />
      )}

      {/* Add Modal */}
      {showAddModal && (
        <AddActionModal
          onAdd={async (data) => {
            try {
              if (USE_API) {
                await itemsApi.createAction(data)
              }
              fetchItems(filters)
              setShowAddModal(false)
            } catch (err) {
              console.error('Failed to create action:', err)
            }
          }}
          onClose={() => setShowAddModal(false)}
        />
      )}
    </div>
  )
}

// Action Card Component
interface ActionCardProps {
  action: ActionItem
  onToggle: (action: ActionItem) => void
}

const ActionCard = ({ action, onToggle }: ActionCardProps) => {
  const overdue = isOverdue(action.deadline) && action.status !== 'completed'
  
  return (
    <div className="action-item">
      <div 
        className={`action-item__checkbox ${action.status === 'completed' ? 'action-item__checkbox--checked' : ''}`}
        onClick={() => onToggle(action)}
        style={{ cursor: 'pointer' }}
      >
        {action.status === 'completed' && <Check size={12} />}
      </div>
      <div className="action-item__content">
        <div className={`action-item__title ${action.status === 'completed' ? 'action-item__title--completed' : ''}`}>
          {action.description}
        </div>
        <div className="action-item__meta">
          <span className={`action-item__priority action-item__priority--${action.priority}`}>
            {action.priority}
          </span>
          {action.owner_name && (
            <span className="action-item__meta-item">
              <User size={12} />
              {action.owner_name}
            </span>
          )}
          {action.deadline && (
            <span className={`action-item__meta-item ${overdue ? 'action-item__deadline--overdue' : ''}`}>
              <Calendar size={12} />
              {overdue ? 'Quá hạn ' : ''}{new Date(action.deadline).toLocaleDateString('vi-VN')}
            </span>
          )}
          {action.meeting_title && (
            <span className="action-item__meta-item" style={{ color: 'var(--text-muted)' }}>
              <FileText size={12} />
              {action.meeting_title}
            </span>
          )}
          {action.external_task_link && (
            <a 
              href={action.external_task_link} 
              target="_blank" 
              rel="noopener noreferrer" 
              style={{ color: 'var(--accent)', display: 'flex', alignItems: 'center', gap: '4px' }}
            >
              <ExternalLink size={12} />
              {action.external_task_link.includes('jira') ? 'Jira' : 'Planner'}
            </a>
          )}
        </div>
      </div>
    </div>
  )
}

// Filter Modal Component
interface FilterModalProps {
  filters: ActionItemFilters
  onApply: (filters: ActionItemFilters) => void
  onClose: () => void
}

const FilterModal = ({ filters, onApply, onClose }: FilterModalProps) => {
  const [localFilters, setLocalFilters] = useState<ActionItemFilters>(filters)

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 400 }}>
        <div className="modal__header">
          <h3>Lọc Action Items</h3>
          <button className="btn btn--ghost btn--icon" onClick={onClose}>
            <X size={18} />
          </button>
        </div>
        <div className="modal__body">
          <div className="form-group">
            <label className="form-label">Trạng thái</label>
            <select 
              className="form-select"
              value={localFilters.status || ''}
              onChange={e => setLocalFilters(prev => ({ ...prev, status: e.target.value || undefined }))}
            >
              <option value="">Tất cả</option>
              <option value="proposed">Đề xuất</option>
              <option value="confirmed">Đã xác nhận</option>
              <option value="in_progress">Đang thực hiện</option>
              <option value="completed">Hoàn thành</option>
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">Độ ưu tiên</label>
            <select 
              className="form-select"
              value={localFilters.priority || ''}
              onChange={e => setLocalFilters(prev => ({ ...prev, priority: e.target.value || undefined }))}
            >
              <option value="">Tất cả</option>
              <option value="critical">Rất cao</option>
              <option value="high">Cao</option>
              <option value="medium">Trung bình</option>
              <option value="low">Thấp</option>
            </select>
          </div>
          <div className="form-group">
            <label className="form-checkbox">
              <input 
                type="checkbox"
                checked={localFilters.overdue_only || false}
                onChange={e => setLocalFilters(prev => ({ ...prev, overdue_only: e.target.checked || undefined }))}
              />
              <span>Chỉ hiển thị quá hạn</span>
            </label>
          </div>
        </div>
        <div className="modal__footer">
          <button className="btn btn--secondary" onClick={() => {
            setLocalFilters({})
            onApply({})
          }}>
            Xóa bộ lọc
          </button>
          <button className="btn btn--primary" onClick={() => onApply(localFilters)}>
            Áp dụng
          </button>
        </div>
      </div>
    </div>
  )
}

// Add Action Modal Component
interface AddActionModalProps {
  onAdd: (data: { meeting_id: string; description: string; deadline?: string; priority?: string }) => void
  onClose: () => void
}

const AddActionModal = ({ onAdd, onClose }: AddActionModalProps) => {
  const [formData, setFormData] = useState({
    meeting_id: 'm0000001-0000-0000-0000-000000000001', // Default meeting
    description: '',
    deadline: '',
    priority: 'medium',
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!formData.description.trim()) return
    onAdd({
      ...formData,
      deadline: formData.deadline || undefined,
    })
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 500 }}>
        <div className="modal__header">
          <h3>Thêm Action Item</h3>
          <button className="btn btn--ghost btn--icon" onClick={onClose}>
            <X size={18} />
          </button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="modal__body">
            <div className="form-group">
              <label className="form-label">Mô tả *</label>
              <textarea
                className="form-textarea"
                rows={3}
                value={formData.description}
                onChange={e => setFormData(prev => ({ ...prev, description: e.target.value }))}
                placeholder="Mô tả chi tiết action item..."
                required
              />
            </div>
            <div className="form-group">
              <label className="form-label">Deadline</label>
              <input
                type="date"
                className="form-input"
                value={formData.deadline}
                onChange={e => setFormData(prev => ({ ...prev, deadline: e.target.value }))}
              />
            </div>
            <div className="form-group">
              <label className="form-label">Độ ưu tiên</label>
              <select 
                className="form-select"
                value={formData.priority}
                onChange={e => setFormData(prev => ({ ...prev, priority: e.target.value }))}
              >
                <option value="low">Thấp</option>
                <option value="medium">Trung bình</option>
                <option value="high">Cao</option>
                <option value="critical">Rất cao</option>
              </select>
            </div>
          </div>
          <div className="modal__footer">
            <button type="button" className="btn btn--secondary" onClick={onClose}>
              Hủy
            </button>
            <button type="submit" className="btn btn--primary">
              <Plus size={16} />
              Thêm
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default Tasks

