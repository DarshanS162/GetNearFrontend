import { useState } from 'react';
import { IconEye, IconEyeOff } from './Icons';
import './PasswordInput.css';

export default function PasswordInput({
  id,
  value,
  onChange,
  placeholder = '',
  className = '',
  autoComplete,
  onKeyDown,
  ...rest
}) {
  const [visible, setVisible] = useState(false);

  return (
    <div className={`password-input ${className}`.trim()}>
      <input
        id={id}
        type={visible ? 'text' : 'password'}
        className="form-input password-input-field"
        placeholder={placeholder}
        value={value}
        onChange={onChange}
        autoComplete={autoComplete}
        onKeyDown={onKeyDown}
        {...rest}
      />
      <button
        type="button"
        className="password-input-toggle"
        onClick={() => setVisible((v) => !v)}
        aria-label={visible ? 'Hide password' : 'Show password'}
        aria-pressed={visible}
        tabIndex={0}
      >
        {visible ? <IconEyeOff size={18} /> : <IconEye size={18} />}
      </button>
    </div>
  );
}
