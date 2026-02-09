import React, { useState } from 'react'
import { Check, Mail, AlertCircle } from 'lucide-react'
import { cn } from '../../lib/utils'

type ContactEmailFormProps = {
  className?: string
}

export const ContactEmailForm = ({ className }: ContactEmailFormProps) => {
  const [email, setEmail] = useState('')
  const [status, setStatus] = useState<'idle' | 'submitting' | 'success' | 'error'>('idle')
  const [errorMessage, setErrorMessage] = useState('')
  const supportEmail = 'minute.support@gmail.com'

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const trimmed = email.trim()
    if (!trimmed) return

    setStatus('submitting')
    setErrorMessage('')

    try {
      const subject = encodeURIComponent('Minute product consultation')
      const body = encodeURIComponent(`Please contact me at: ${trimmed}`)
      window.location.href = `mailto:${supportEmail}?subject=${subject}&body=${body}`
      setStatus('success')
    } catch {
      setStatus('error')
      setErrorMessage('Something went wrong. Please try again.')
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
            placeholder="Enter your work email..."
            value={email}
            onChange={handleChange}
            autoComplete="email"
            required
            disabled={status === 'submitting'}
          />
        </div>
        <button type="submit" className="btn btn-primary" disabled={status === 'submitting'}>
          {status === 'submitting' ? 'Opening mail app...' : 'Request Consultation'}
        </button>
      </div>
      {status === 'success' ? (
        <div className="contact-form__message contact-form__message--success">
          <Check size={16} />
          Thanks. Your email app has been opened to send the request.
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
