import React, { useState, useEffect } from 'react';
import { X, Mail, Check } from 'lucide-react';
import { api } from '../lib/apiClient';

export const MarketingPopup = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<'idle' | 'submitting' | 'success' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    // Auto open after 3 seconds
    const timer = setTimeout(() => {
      setIsOpen(true);
    }, 3000);

    return () => clearTimeout(timer);
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;

    setStatus('submitting');
    setErrorMessage('');

    try {
      await api.post('/marketing/join', { email }, { skipAuth: true });
      setStatus('success');
      setTimeout(() => {
        setIsOpen(false);
      }, 3000);
    } catch (err: any) {
      console.error('Marketing join failed:', err);
      setStatus('error');
      // If error data is available as JSON
      setErrorMessage(err.data?.detail || 'Có lỗi xảy ra. Vui lòng thử lại.');
    }
  };

  if (!isOpen) return null;

  return (
    <div className="marketing-popup-overlay">
      <div className="marketing-popup">
        <button className="marketing-popup-close" onClick={() => setIsOpen(false)}>
          <X size={20} />
        </button>

        {status === 'success' ? (
          <div className="marketing-popup-success">
            <div className="success-icon">
              <Check size={32} />
            </div>
            <h3>Đăng ký thành công!</h3>
            <p>Cảm ơn bạn đã quan tâm đến Minute. Hãy là những người tiên phong kiến tạo tương lai cùng chúng tôi!</p>
          </div>
        ) : (
          <>
            <div className="marketing-popup-header">
              <div className="icon-wrapper">
                <Mail size={24} />
              </div>
              <h2>Tham gia cùng Minute</h2>
              <p>Để lại email để nhận thông tin mới nhất và ưu đãi trải nghiệm sớm.</p>
            </div>

            <form onSubmit={handleSubmit} className="marketing-popup-form">
              <input
                type="email"
                placeholder="Nhập email của bạn..."
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={status === 'submitting'}
                required
              />
              <button
                type="submit"
                className="btn btn-primary"
                disabled={status === 'submitting'}
              >
                {status === 'submitting' ? 'Đang gửi...' : 'Đăng ký ngay'}
              </button>
            </form>

            {status === 'error' && (
              <p className="marketing-error-msg">{errorMessage}</p>
            )}
          </>
        )}
      </div>

      <style>{`
        .marketing-popup-overlay {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(0, 0, 0, 0.5);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 9999;
          backdrop-filter: blur(4px);
          animation: fadeIn 0.3s ease;
        }

        .marketing-popup {
          background: white;
          width: 90%;
          max-width: 400px;
          border-radius: 16px;
          padding: 32px;
          position: relative;
          box-shadow: 0 20px 50px rgba(0, 0, 0, 0.2);
          animation: slideUp 0.4s cubic-bezier(0.16, 1, 0.3, 1);
        }

        .marketing-popup-close {
          position: absolute;
          top: 16px;
          right: 16px;
          background: none;
          border: none;
          color: #9ca3af;
          cursor: pointer;
          padding: 4px;
          border-radius: 50%;
          transition: all 0.2s;
        }

        .marketing-popup-close:hover {
          background: #f3f4f6;
          color: #4b5563;
        }

        .marketing-popup-header {
          text-align: center;
          margin-bottom: 24px;
        }

        .icon-wrapper {
          width: 48px;
          height: 48px;
          background: rgba(247, 167, 69, 0.1);
          color: #f7a745;
          border-radius: 12px;
          display: flex;
          align-items: center;
          justify-content: center;
          margin: 0 auto 16px;
        }

        .marketing-popup-header h2 {
          font-family: var(--font-heading, sans-serif);
          font-size: 1.5rem;
          font-weight: 700;
          margin: 0 0 8px;
          color: #111827;
        }

        .marketing-popup-header p {
          color: #6b7280;
          font-size: 0.95rem;
          margin: 0;
          line-height: 1.5;
        }

        .marketing-popup-form {
          display: flex;
          flex-direction: column;
          gap: 12px;
        }

        .marketing-popup-form input {
          padding: 12px 16px;
          border: 1px solid #e5e7eb;
          border-radius: 8px;
          font-size: 1rem;
          outline: none;
          transition: border-color 0.2s;
        }

        .marketing-popup-form input:focus {
          border-color: #f7a745;
          box-shadow: 0 0 0 3px rgba(247, 167, 69, 0.1);
        }

        .marketing-popup-form button {
          padding: 12px;
          border-radius: 8px;
          font-weight: 600;
          justify-content: center;
        }

        .marketing-error-msg {
          color: #ef4444;
          font-size: 0.875rem;
          margin-top: 12px;
          text-align: center;
        }

        .marketing-popup-success {
          text-align: center;
          padding: 20px 0;
        }

        .success-icon {
          width: 64px;
          height: 64px;
          background: #ecfdf5;
          color: #10b981;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          margin: 0 auto 16px;
        }

        .marketing-popup-success h3 {
          font-size: 1.25rem;
          font-weight: 700;
          color: #111827;
          margin: 0 0 8px;
        }

        .marketing-popup-success p {
          color: #6b7280;
        }

        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }

        @keyframes slideUp {
          from { transform: translateY(20px); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
        }
      `}</style>
    </div>
  );
};
