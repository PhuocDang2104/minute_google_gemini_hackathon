import { useState, useEffect } from 'react';
import {
  UserPlus,
  Search,
  X,
  Check,
  User,
  Mail,
  Building2,
  Loader2,
} from 'lucide-react';
import { usersApi } from '../../../lib/api/users';
import { meetingsApi } from '../../../lib/api/meetings';
import type { Participant } from '../../../shared/dto/meeting';
import { getInitials } from '../../../shared/dto/user';
import { Modal } from '../../../components/ui/Modal';
import { useLocaleText } from '../../../i18n/useLocaleText';

interface ParticipantsPanelProps {
  meetingId: string;
  participants: Participant[];
  onUpdate: () => void;
}

export const ParticipantsPanel = ({ meetingId, participants, onUpdate }: ParticipantsPanelProps) => {
  const { lt } = useLocaleText();
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);

  const getParticipantRoleLabel = (role: Participant['role']) => {
    switch (role) {
      case 'organizer':
        return lt('Người tổ chức', 'Organizer');
      case 'required':
        return lt('Bắt buộc', 'Required');
      case 'optional':
        return lt('Tùy chọn', 'Optional');
      default:
        return lt('Tham dự', 'Attendee');
    }
  };

  const getResponseStatusLabel = (status: Participant['response_status']) => {
    switch (status) {
      case 'accepted':
        return lt('Đã xác nhận', 'Accepted');
      case 'declined':
        return lt('Từ chối', 'Declined');
      case 'tentative':
        return lt('Có thể', 'Tentative');
      default:
        return lt('Chờ phản hồi', 'Pending response');
    }
  };

  return (
    <div className="participants-panel">
      <div className="panel-header">
        <h3 className="panel-title">{lt('Thành viên tham gia', 'Participants')} ({participants.length})</h3>
        <button className="btn btn--primary btn--sm" onClick={() => setIsAddModalOpen(true)}>
          <UserPlus size={16} />
          {lt('Thêm thành viên', 'Add participant')}
        </button>
      </div>

      {participants.length === 0 ? (
        <div className="empty-state">
          <User className="empty-state__icon" />
          <h3 className="empty-state__title">{lt('Chưa có thành viên', 'No participants yet')}</h3>
          <p className="empty-state__description">{lt('Thêm thành viên để bắt đầu chuẩn bị cuộc họp', 'Add participants to start preparing your meeting')}</p>
        </div>
      ) : (
        <div className="participant-list">
          {participants.map(participant => (
            <div key={participant.user_id} className="participant-card">
              <div className="participant-card__avatar">
                {getInitials(participant.display_name || 'U')}
              </div>
              <div className="participant-card__info">
                <div className="participant-card__name">
                  {participant.display_name || lt('Người dùng không xác định', 'Unknown user')}
                </div>
                <div className="participant-card__email">{participant.email || ''}</div>
              </div>
              <div className="participant-card__role">
                {getParticipantRoleLabel(participant.role)}
              </div>
              <div className={`participant-card__status participant-card__status--${participant.response_status}`}>
                {getResponseStatusLabel(participant.response_status)}
              </div>
            </div>
          ))}
        </div>
      )}

      <AddParticipantModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        meetingId={meetingId}
        existingParticipants={participants}
        onSuccess={() => {
          setIsAddModalOpen(false);
          onUpdate();
        }}
      />
    </div>
  );
};

// Add Participant Modal
interface AddParticipantModalProps {
  isOpen: boolean;
  onClose: () => void;
  meetingId: string;
  existingParticipants: Participant[];
  onSuccess: () => void;
}

const AddParticipantModal = ({
  isOpen,
  onClose,
  meetingId,
  existingParticipants,
  onSuccess,
}: AddParticipantModalProps) => {
  const { lt } = useLocaleText();
  const [searchQuery, setSearchQuery] = useState('');
  const [users, setUsers] = useState<UserType[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedUsers, setSelectedUsers] = useState<Set<string>>(new Set());
  const [isAdding, setIsAdding] = useState(false);

  // Fetch users when search changes
  useEffect(() => {
    const fetchUsers = async () => {
      setIsLoading(true);
      try {
        const response = await usersApi.list({ search: searchQuery || undefined });
        // Filter out existing participants
        const existingIds = new Set(existingParticipants.map(p => p.user_id));
        setUsers(response.users.filter(u => !existingIds.has(u.id)));
      } catch (err) {
        console.error('Failed to fetch users:', err);
        // Mock data for demo
        setUsers([
          { id: 'mock-1', email: 'user1@lpbank.vn', display_name: 'Nguyễn Văn A', role: 'user', department_name: 'PMO' },
          { id: 'mock-2', email: 'user2@lpbank.vn', display_name: 'Trần Thị B', role: 'user', department_name: 'Công nghệ' },
          { id: 'mock-3', email: 'user3@lpbank.vn', display_name: 'Lê Văn C', role: 'PMO', department_name: 'PMO' },
        ]);
      } finally {
        setIsLoading(false);
      }
    };

    if (isOpen) {
      fetchUsers();
    }
  }, [isOpen, searchQuery, existingParticipants]);

  const toggleUser = (userId: string) => {
    const newSelected = new Set(selectedUsers);
    if (newSelected.has(userId)) {
      newSelected.delete(userId);
    } else {
      newSelected.add(userId);
    }
    setSelectedUsers(newSelected);
  };

  const handleAdd = async () => {
    if (selectedUsers.size === 0) return;

    setIsAdding(true);
    try {
      // Add each selected user
      for (const userId of selectedUsers) {
        await meetingsApi.addParticipant(meetingId, userId, 'attendee');
      }
      onSuccess();
    } catch (err) {
      console.error('Failed to add participants:', err);
    } finally {
      setIsAdding(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={lt('Thêm thành viên', 'Add participant')} size="md">
      <div className="add-participant-modal">
        {/* Search */}
        <div className="search-box">
          <Search size={16} className="search-box__icon" />
          <input
            type="text"
            className="search-box__input"
            placeholder={lt('Tìm theo tên hoặc email...', 'Search by name or email...')}
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
          />
          {searchQuery && (
            <button className="search-box__clear" onClick={() => setSearchQuery('')}>
              <X size={16} />
            </button>
          )}
        </div>

        {/* User List */}
        <div className="user-select-list">
          {isLoading ? (
            <div className="form-loading">
              <Loader2 size={20} className="spinner" />
            </div>
          ) : users.length === 0 ? (
            <div className="empty-state" style={{ padding: 'var(--space-lg)' }}>
              <p className="text-muted">{lt('Không tìm thấy người dùng', 'No users found')}</p>
            </div>
          ) : (
            users.map(user => (
              <div
                key={user.id}
                className={`user-select-item ${selectedUsers.has(user.id) ? 'user-select-item--selected' : ''}`}
                onClick={() => toggleUser(user.id)}
              >
                <div className="user-select-item__checkbox">
                  {selectedUsers.has(user.id) && <Check size={14} />}
                </div>
                <div className="user-select-item__avatar">
                  {getInitials(user.display_name)}
                </div>
                <div className="user-select-item__info">
                  <div className="user-select-item__name">{user.display_name}</div>
                  <div className="user-select-item__meta">
                    <Mail size={12} />
                    {user.email}
                    {user.department_name && (
                      <>
                        <Building2 size={12} />
                        {user.department_name}
                      </>
                    )}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Actions */}
        <div className="form-actions">
          <button className="btn btn--secondary" onClick={onClose}>
            {lt('Hủy', 'Cancel')}
          </button>
          <button
            className="btn btn--primary"
            onClick={handleAdd}
            disabled={selectedUsers.size === 0 || isAdding}
          >
            {isAdding ? (
              <>
                <Loader2 size={16} className="spinner" />
                {lt('Đang thêm...', 'Adding...')}
              </>
            ) : (
              <>
                <UserPlus size={16} />
                {lt('Thêm', 'Add')} {selectedUsers.size > 0 ? `(${selectedUsers.size})` : ''}
              </>
            )}
          </button>
        </div>
      </div>
    </Modal>
  );
};

export default ParticipantsPanel;
