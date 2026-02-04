import { ReactNode, InputHTMLAttributes, SelectHTMLAttributes, TextareaHTMLAttributes } from 'react';

interface FormFieldProps {
  label: string;
  error?: string;
  required?: boolean;
  children: ReactNode;
}

export const FormField = ({ label, error, required, children }: FormFieldProps) => {
  return (
    <div className="form-field">
      <label className="form-field__label">
        {label}
        {required && <span className="form-field__required">*</span>}
      </label>
      {children}
      {error && <span className="form-field__error">{error}</span>}
    </div>
  );
};

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  error?: boolean;
}

export const Input = ({ error, className = '', ...props }: InputProps) => {
  return (
    <input
      className={`form-input ${error ? 'form-input--error' : ''} ${className}`}
      {...props}
    />
  );
};

interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  error?: boolean;
}

export const Textarea = ({ error, className = '', ...props }: TextareaProps) => {
  return (
    <textarea
      className={`form-textarea ${error ? 'form-textarea--error' : ''} ${className}`}
      {...props}
    />
  );
};

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  error?: boolean;
  options: { value: string; label: string }[];
}

export const Select = ({ error, options, className = '', ...props }: SelectProps) => {
  return (
    <select
      className={`form-select ${error ? 'form-select--error' : ''} ${className}`}
      {...props}
    >
      {options.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  );
};

export default FormField;

