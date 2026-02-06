import { useState, FormEvent } from 'react';
import { Calendar, Clock, MapPin, Users, Link2, FileText, Tag, Loader2 } from 'lucide-react';
import { FormField, Input, Textarea, Select } from '../../../components/ui/FormField';
import type { MeetingCreate, MeetingType } from '../../../shared/dto/meeting';
import { MEETING_TYPE_LABELS } from '../../../shared/dto/meeting';
import { meetingsApi } from '../../../lib/api/meetings';

interface CreateMeetingFormProps {
  onSuccess: (meetingId: string) => void;
  onCancel: () => void;
  projectId?: string;
}

const MEETING_TYPE_OPTIONS = Object.entries(MEETING_TYPE_LABELS).map(([value, label]) => ({
  value,
  label,
}));

// TODO: Fetch from API
const PROJECT_OPTIONS = [
  { value: '', label: 'Chọn dự án' },
  { value: 'p0000001-0000-0000-0000-000000000001', label: 'Core Banking Modernization' },
  { value: 'p0000002-0000-0000-0000-000000000002', label: 'Mobile Banking 3.0' },
  { value: 'p0000003-0000-0000-0000-000000000003', label: 'Loan Origination System' },
  { value: 'p0000004-0000-0000-0000-000000000004', label: 'KYC Enhancement' },
];

// Current user ID (TODO: get from auth context)
const CURRENT_USER_ID = 'u0000001-0000-0000-0000-000000000001';

interface FormData {
  title: string;
  description: string;
  meeting_type: MeetingType;
  project_id: string;
  start_date: string;
  start_time: string;
  end_date: string;
  end_time: string;
  location: string;
  teams_link: string;
}

interface FormErrors {
  title?: string;
  start_date?: string;
  start_time?: string;
}

export const CreateMeetingForm = ({ onSuccess, onCancel, projectId }: CreateMeetingFormProps) => {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [formData, setFormData] = useState<FormData>({
    title: '',
    description: '',
    meeting_type: 'project_meeting',
    project_id: '',
    start_date: '',
    start_time: '',
    end_date: '',
    end_time: '',
    location: '',
    teams_link: '',
  });

  const [errors, setErrors] = useState<FormErrors>({});

  /* Step 1: Mode Selection State */
  const [step, setStep] = useState<'selection' | 'creating'>('selection');

  const handleQuickCreate = async (type: MeetingType) => {
    setIsSubmitting(true);
    setStep('creating');

    try {
      const now = new Date();
      // Format as "Untitled - HH:MM DD/MM/YYYY" or similar, but simplified
      const defaultTitle = `Untitled ${type === 'study_session' ? 'Session' : 'Meeting'} - ${now.toLocaleString('vi-VN')}`;

      const payload: MeetingCreate = {
        title: defaultTitle,
        meeting_type: type,
        start_time: now.toISOString(),
        // Default 1 hour duration
        end_time: new Date(now.getTime() + 60 * 60 * 1000).toISOString(),
      };
      if (projectId) {
        payload.project_id = projectId;
      }

      const response = await meetingsApi.create(payload);
      onSuccess(response.id);
    } catch (err) {
      console.error('Failed to quick create meeting:', err);
      // Fallback to error state in selection screen
      setIsSubmitting(false);
      setStep('selection');
      // Show simple alert for now as we don't have global toast
      alert('Không thể tạo nhanh cuộc họp. Vui lòng thử lại.');
    }
  };

  const handleChange = (field: keyof FormData, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    // Clear error when user types
    if (errors[field as keyof FormErrors]) {
      setErrors(prev => ({ ...prev, [field]: undefined }));
    }
  };

  if (step === 'creating') {
    return (
      <div className="mode-selection-container" style={{ textAlign: 'center', padding: '60px 0' }}>
        <Loader2 size={48} className="spinner" style={{ animation: 'spin 1s linear infinite', color: '#6366f1', margin: '0 auto 24px' }} />
        <h3 style={{ fontSize: 18, color: 'var(--text-primary)' }}>Đang tạo phiên làm việc mới...</h3>
        <p style={{ color: 'var(--text-secondary)', marginTop: 8 }}>Vui lòng đợi trong giây lát</p>
      </div>
    );
  }

  // Quick Create Selection Screen
  return (
    <div className="mode-selection-container" style={{ textAlign: 'center', padding: '20px 0' }}>
      <h3 style={{ marginBottom: 24, fontSize: 18, color: 'var(--text-primary)' }}>Bạn muốn tạo loại phiên làm việc nào?</h3>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
        <button
          type="button"
          className="mode-card"
          onClick={() => handleQuickCreate('project_meeting')}
          disabled={isSubmitting}
          style={{
            padding: '30px 20px',
            border: '2px solid var(--border)',
            borderRadius: '12px',
            background: 'var(--bg-secondary)',
            cursor: 'pointer',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 16,
            transition: 'all 0.2s ease',
            opacity: isSubmitting ? 0.7 : 1
          }}
          onMouseEnter={(e) => {
            if (!isSubmitting) {
              e.currentTarget.style.borderColor = '#6366f1';
              e.currentTarget.style.background = '#e0e7ff';
            }
          }}
          onMouseLeave={(e) => {
            if (!isSubmitting) {
              e.currentTarget.style.borderColor = 'var(--border)';
              e.currentTarget.style.background = 'var(--bg-secondary)';
            }
          }}
        >
          <div style={{
            width: 60,
            height: 60,
            borderRadius: '50%',
            background: '#e0e7ff',
            color: '#4338ca',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}>
            <Users size={32} />
          </div>
          <div>
            <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 4 }}>Dự án / Công việc</div>
            <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>Tạo ngay cuộc họp dự án mới</div>
          </div>
        </button>

        <button
          type="button"
          className="mode-card"
          onClick={() => handleQuickCreate('study_session')}
          disabled={isSubmitting}
          style={{
            padding: '30px 20px',
            border: '2px solid var(--border)',
            borderRadius: '12px',
            background: 'var(--bg-secondary)',
            cursor: 'pointer',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 16,
            transition: 'all 0.2s ease',
            opacity: isSubmitting ? 0.7 : 1
          }}
          onMouseEnter={(e) => {
            if (!isSubmitting) {
              e.currentTarget.style.borderColor = '#8b5cf6';
              e.currentTarget.style.background = '#ede9fe';
            }
          }}
          onMouseLeave={(e) => {
            if (!isSubmitting) {
              e.currentTarget.style.borderColor = 'var(--border)';
              e.currentTarget.style.background = 'var(--bg-secondary)';
            }
          }}
        >
          <div style={{
            width: 60,
            height: 60,
            borderRadius: '50%',
            background: '#f3e8ff',
            color: '#7e22ce',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}>
            <Calendar size={32} />
          </div>
          <div>
            <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 4 }}>Lớp học Online</div>
            <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>Tạo ngay session học tập mới</div>
          </div>
        </button>
      </div>

      <div style={{ marginTop: 32, display: 'flex', justifyContent: 'center' }}>
        <button type="button" className="btn btn--ghost" onClick={onCancel} disabled={isSubmitting}>
          Hủy bỏ
        </button>
      </div>
    </div>
  );
};

export default CreateMeetingForm;

