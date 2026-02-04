import { useState, FormEvent } from 'react';
import { Calendar, Clock, MapPin, Users, Link2, FileText, Tag, Loader2 } from 'lucide-react';
import { FormField, Input, Textarea, Select } from '../../../components/ui/FormField';
import type { MeetingCreate, MeetingType } from '../../../shared/dto/meeting';
import { MEETING_TYPE_LABELS } from '../../../shared/dto/meeting';
import { meetingsApi } from '../../../lib/api/meetings';

interface CreateMeetingFormProps {
  onSuccess: () => void;
  onCancel: () => void;
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

export const CreateMeetingForm = ({ onSuccess, onCancel }: CreateMeetingFormProps) => {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const [formData, setFormData] = useState<FormData>({
    title: '',
    description: '',
    meeting_type: 'weekly_status',
    project_id: '',
    start_date: '',
    start_time: '',
    end_date: '',
    end_time: '',
    location: '',
    teams_link: '',
  });
  
  const [errors, setErrors] = useState<FormErrors>({});

  const handleChange = (field: keyof FormData, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    // Clear error when user types
    if (errors[field as keyof FormErrors]) {
      setErrors(prev => ({ ...prev, [field]: undefined }));
    }
  };

  const validate = (): boolean => {
    const newErrors: FormErrors = {};
    
    if (!formData.title.trim()) {
      newErrors.title = 'Vui lòng nhập tiêu đề cuộc họp';
    }
    
    if (!formData.start_date) {
      newErrors.start_date = 'Vui lòng chọn ngày bắt đầu';
    }
    
    if (!formData.start_time) {
      newErrors.start_time = 'Vui lòng chọn giờ bắt đầu';
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    
    if (!validate()) return;
    
    setIsSubmitting(true);
    setError(null);
    
    try {
      // Build start_time and end_time ISO strings
      const startDateTime = formData.start_date && formData.start_time
        ? new Date(`${formData.start_date}T${formData.start_time}`).toISOString()
        : undefined;
      
      const endDateTime = formData.end_date && formData.end_time
        ? new Date(`${formData.end_date}T${formData.end_time}`).toISOString()
        : formData.start_date && formData.start_time
          ? new Date(new Date(`${formData.start_date}T${formData.start_time}`).getTime() + 60 * 60 * 1000).toISOString()
          : undefined;
      
      const payload: MeetingCreate = {
        title: formData.title.trim(),
        description: formData.description.trim() || undefined,
        meeting_type: formData.meeting_type,
        // organizer_id is optional - will be set when auth is implemented
        organizer_id: undefined,
        project_id: formData.project_id || undefined,
        start_time: startDateTime,
        end_time: endDateTime,
        location: formData.location.trim() || undefined,
        teams_link: formData.teams_link.trim() || undefined,
      };
      
      await meetingsApi.create(payload);
      onSuccess();
    } catch (err) {
      console.error('Failed to create meeting:', err);
      setError(err instanceof Error ? err.message : 'Không thể tạo cuộc họp. Vui lòng thử lại.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Get today's date for min attribute
  const today = new Date().toISOString().split('T')[0];

  return (
    <form onSubmit={handleSubmit}>
      {error && (
        <div style={{
          padding: 'var(--space-md)',
          background: 'var(--error-subtle)',
          borderRadius: 'var(--radius-sm)',
          marginBottom: 'var(--space-lg)',
          fontSize: '13px',
          color: 'var(--error)',
          border: '1px solid var(--error)',
        }}>
          {error}
        </div>
      )}

      {/* Title */}
      <FormField label="Tiêu đề cuộc họp" required error={errors.title}>
        <Input
          type="text"
          placeholder="VD: Weekly Status - Mobile Banking Sprint 24"
          value={formData.title}
          onChange={(e) => handleChange('title', e.target.value)}
          error={!!errors.title}
          autoFocus
        />
      </FormField>

      {/* Description */}
      <FormField label="Mô tả">
        <Textarea
          placeholder="Mô tả ngắn gọn nội dung và mục tiêu cuộc họp..."
          value={formData.description}
          onChange={(e) => handleChange('description', e.target.value)}
          rows={3}
        />
      </FormField>

      {/* Meeting Type & Project */}
      <div className="form-row">
        <FormField label="Loại cuộc họp">
          <Select
            value={formData.meeting_type}
            onChange={(e) => handleChange('meeting_type', e.target.value)}
            options={MEETING_TYPE_OPTIONS}
          />
        </FormField>
        
        <FormField label="Dự án">
          <Select
            value={formData.project_id}
            onChange={(e) => handleChange('project_id', e.target.value)}
            options={PROJECT_OPTIONS}
          />
        </FormField>
      </div>

      {/* Date & Time */}
      <div className="form-row">
        <FormField label="Ngày bắt đầu" required error={errors.start_date}>
          <Input
            type="date"
            value={formData.start_date}
            onChange={(e) => handleChange('start_date', e.target.value)}
            min={today}
            error={!!errors.start_date}
          />
        </FormField>
        
        <FormField label="Giờ bắt đầu" required error={errors.start_time}>
          <Input
            type="time"
            value={formData.start_time}
            onChange={(e) => handleChange('start_time', e.target.value)}
            error={!!errors.start_time}
          />
        </FormField>
      </div>

      <div className="form-row">
        <FormField label="Ngày kết thúc">
          <Input
            type="date"
            value={formData.end_date}
            onChange={(e) => handleChange('end_date', e.target.value)}
            min={formData.start_date || today}
          />
        </FormField>
        
        <FormField label="Giờ kết thúc">
          <Input
            type="time"
            value={formData.end_time}
            onChange={(e) => handleChange('end_time', e.target.value)}
          />
        </FormField>
      </div>

      {/* Location */}
      <FormField label="Địa điểm">
        <Input
          type="text"
          placeholder="VD: Phòng họp VIP - Tầng 15 hoặc Online - Microsoft Teams"
          value={formData.location}
          onChange={(e) => handleChange('location', e.target.value)}
        />
      </FormField>

      {/* Teams Link */}
      <FormField label="Link Teams/Zoom">
        <Input
          type="url"
          placeholder="https://teams.microsoft.com/l/meetup-join/..."
          value={formData.teams_link}
          onChange={(e) => handleChange('teams_link', e.target.value)}
        />
      </FormField>

      {/* Actions */}
      <div className="form-actions">
        <button
          type="button"
          className="btn btn--secondary"
          onClick={onCancel}
          disabled={isSubmitting}
        >
          Hủy
        </button>
        <button
          type="submit"
          className="btn btn--primary"
          disabled={isSubmitting}
        >
          {isSubmitting ? (
            <>
              <Loader2 size={16} className="spinner" style={{ animation: 'spin 0.8s linear infinite' }} />
              Đang tạo...
            </>
          ) : (
            <>
              <Calendar size={16} />
              Tạo cuộc họp
            </>
          )}
        </button>
      </div>
    </form>
  );
};

export default CreateMeetingForm;

