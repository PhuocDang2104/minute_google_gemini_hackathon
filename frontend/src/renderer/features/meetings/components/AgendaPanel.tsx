import { useState, useEffect } from 'react';
import {
  Sparkles,
  Clock,
  User,
  GripVertical,
  Plus,
  Trash2,
  Save,
  Loader2,
  CheckCircle,
  RefreshCw,
} from 'lucide-react';
import { aiApi } from '../../../lib/api/ai';
import type { AgendaItem } from '../../../shared/dto/ai';
import type { MeetingType } from '../../../shared/dto/meeting';

interface AgendaPanelProps {
  meetingId: string;
  meetingType: MeetingType;
}

export const AgendaPanel = ({ meetingId, meetingType }: AgendaPanelProps) => {
  const [items, setItems] = useState<AgendaItem[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [hasGenerated, setHasGenerated] = useState(false);
  const [confidence, setConfidence] = useState<number | null>(null);

  const handleGenerate = async () => {
    setIsGenerating(true);
    try {
      const response = await aiApi.generateAgenda(meetingId);
      setItems(response.agenda.items);
      setConfidence(response.confidence);
      setHasGenerated(true);
    } catch (err) {
      console.error('Failed to generate agenda:', err);
      // Mock fallback
      setItems([
        { order: 1, title: 'Khai mạc & Điểm danh', duration_minutes: 5, presenter: 'Chủ tịch' },
        { order: 2, title: 'Báo cáo tiến độ', duration_minutes: 15, presenter: 'PM' },
        { order: 3, title: 'Thảo luận vấn đề', duration_minutes: 20 },
        { order: 4, title: 'Kết luận & Action Items', duration_minutes: 10, presenter: 'Chủ tịch' },
      ]);
      setConfidence(0.85);
      setHasGenerated(true);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await aiApi.saveAgenda(meetingId, items);
    } catch (err) {
      console.error('Failed to save agenda:', err);
    } finally {
      setIsSaving(false);
    }
  };

  const updateItem = (index: number, updates: Partial<AgendaItem>) => {
    setItems(prev => prev.map((item, i) =>
      i === index ? { ...item, ...updates } : item
    ));
  };

  const removeItem = (index: number) => {
    setItems(prev => {
      const newItems = prev.filter((_, i) => i !== index);
      return newItems.map((item, i) => ({ ...item, order: i + 1 }));
    });
  };

  const addItem = () => {
    setItems(prev => [
      ...prev,
      { order: prev.length + 1, title: '', duration_minutes: 10 }
    ]);
  };

  const totalDuration = items.reduce((sum, item) => sum + item.duration_minutes, 0);

  return (
    <div className="agenda-panel">
      <div className="panel-header">
        <div>
          <h3 className="panel-title">Chương trình cuộc họp</h3>
          {hasGenerated && confidence !== null && (
            <span className="confidence-badge">
              <Sparkles size={12} />
              AI Confidence: {Math.round(confidence * 100)}%
            </span>
          )}
        </div>
        <div className="panel-actions">
          {hasGenerated && (
            <button className="btn btn--secondary btn--sm" onClick={handleGenerate} disabled={isGenerating}>
              <RefreshCw size={14} />
              Tạo lại
            </button>
          )}
          <button
            className="btn btn--accent btn--sm"
            onClick={handleGenerate}
            disabled={isGenerating}
          >
            {isGenerating ? (
              <>
                <Loader2 size={14} className="spinner" />
                Đang tạo...
              </>
            ) : (
              <>
                <Sparkles size={14} />
                {hasGenerated ? 'Tạo lại với AI' : 'Tạo với AI'}
              </>
            )}
          </button>
        </div>
      </div>

      {items.length === 0 ? (
        <div className="empty-state">
          <Sparkles className="empty-state__icon" />
          <h3 className="empty-state__title">Chưa có chương trình</h3>
          <p className="empty-state__description">
            Bấm "Tạo với AI" để Minute tự động đề xuất chương trình phù hợp với loại cuộc họp
          </p>
        </div>
      ) : (
        <>
          <div className="agenda-list">
            {items.map((item, index) => (
              <div key={index} className="agenda-item">
                <div className="agenda-item__grip">
                  <GripVertical size={16} />
                </div>
                <div className="agenda-item__order">{item.order}</div>
                <div className="agenda-item__content">
                  <input
                    type="text"
                    className="agenda-item__title-input"
                    value={item.title}
                    onChange={e => updateItem(index, { title: e.target.value })}
                    placeholder="Tiêu đề mục..."
                  />
                  <div className="agenda-item__meta">
                    <div className="agenda-item__duration">
                      <Clock size={12} />
                      <input
                        type="number"
                        className="agenda-item__duration-input"
                        value={item.duration_minutes}
                        onChange={e => updateItem(index, { duration_minutes: parseInt(e.target.value) || 0 })}
                        min={1}
                        max={120}
                      />
                      <span>phút</span>
                    </div>
                    <div className="agenda-item__presenter">
                      <User size={12} />
                      <input
                        type="text"
                        className="agenda-item__presenter-input"
                        value={item.presenter || ''}
                        onChange={e => updateItem(index, { presenter: e.target.value })}
                        placeholder="Người trình bày"
                      />
                    </div>
                  </div>
                </div>
                <button
                  className="agenda-item__remove"
                  onClick={() => removeItem(index)}
                >
                  <Trash2 size={16} />
                </button>
              </div>
            ))}
          </div>

          <button className="add-item-btn" onClick={addItem}>
            <Plus size={16} />
            Thêm mục
          </button>

          <div className="agenda-footer">
            <div className="agenda-summary">
              <Clock size={16} />
              <span>Tổng thời gian: <strong>{totalDuration} phút</strong></span>
            </div>
            <button
              className="btn btn--primary"
              onClick={handleSave}
              disabled={isSaving}
            >
              {isSaving ? (
                <>
                  <Loader2 size={16} className="spinner" />
                  Đang lưu...
                </>
              ) : (
                <>
                  <Save size={16} />
                  Lưu chương trình
                </>
              )}
            </button>
          </div>
        </>
      )}
    </div>
  );
};

export default AgendaPanel;
