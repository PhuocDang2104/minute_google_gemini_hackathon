import React, { useState } from 'react'
import { Check, Mail, AlertCircle } from 'lucide-react'
import { api } from '../../lib/apiClient'
import { cn } from '../../lib/utils'

type ContactEmailFormProps = {
  className?: string
}

export const ContactEmailForm = ({ className }: ContactEmailFormProps) => {
  const [email, setEmail] = useState('')
  const [status, setStatus] = useState<'idle' | 'submitting' | 'success' | 'error'>('idle')
  const [errorMessage, setErrorMessage] = useState('')

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const trimmed = email.trim()
    if (!trimmed) return

    setStatus('submitting')
    setErrorMessage('')

    try {
      await api.post('/marketing/join', { email: trimmed }, { skipAuth: true })
      setStatus('success')
    } catch (err: any) {
      setStatus('error')
      setErrorMessage(err?.data?.detail || 'Có lỗi xảy ra. Vui lòng thử lại.')
    }
  }

  const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setEmail(event.target.value)
    if (status === 'success' || status === 'error') {
      setStatus('idle')
      setErrorMessage('')
    }
  }

  return (
    <form className={cn('contact-form', className)} onSubmit={handleSubmit}>
      <div className="contact-form__row">
        <div className="contact-input">
          <Mail size={18} />
          <input
            type="email"
            name="contactEmail"
            placeholder="Nhập Gmail của bạn..."
            value={email}
            onChange={handleChange}
            autoComplete="email"
            required
            disabled={status === 'submitting'}
          />
        </div>
        <button type="submit" className="btn btn-primary" disabled={status === 'submitting'}>
          {status === 'submitting' ? 'Đang gửi...' : 'Nhận tư vấn'}
        </button>
      </div>
      {status === 'success' ? (
        <div className="contact-form__message contact-form__message--success">
          <Check size={16} />
          Đã ghi nhận email. Minute sẽ liên hệ sớm.
        </div>
      ) : null}
      {status === 'error' ? (
        <div className="contact-form__message contact-form__message--error">
          <AlertCircle size={16} />
          {errorMessage}
        </div>
      ) : null}
    </form>
  )
}

export default ContactEmailForm
