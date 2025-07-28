import React from 'react';
import { clsx } from 'clsx';
import type { InputProps } from '@/types';

const Input: React.FC<InputProps> = ({
  label,
  name,
  type = 'text',
  placeholder,
  value,
  onChange,
  error,
  required = false,
  disabled = false,
}) => {
  const inputClasses = clsx(
    'block',
    'w-full',
    'px-3',
    'py-2',
    'border',
    'rounded-md',
    'shadow-sm',
    'transition-colors',
    'focus:outline-none',
    'focus:ring-2',
    'focus:ring-offset-2',
    'disabled:bg-gray-50',
    'disabled:cursor-not-allowed',
    {
      'border-gray-300 focus:border-primary-500 focus:ring-primary-500': !error,
      'border-danger-300 focus:border-danger-500 focus:ring-danger-500': error,
    }
  );

  const labelClasses = clsx(
    'block',
    'text-sm',
    'font-medium',
    'mb-1',
    {
      'text-gray-700': !error,
      'text-danger-700': error,
    }
  );

  return (
    <div className="w-full">
      {label && (
        <label htmlFor={name} className={labelClasses}>
          {label}
          {required && <span className="text-danger-500 ml-1">*</span>}
        </label>
      )}
      
      <input
        id={name}
        name={name}
        type={type}
        placeholder={placeholder}
        value={value}
        onChange={onChange}
        disabled={disabled}
        required={required}
        className={inputClasses}
        aria-invalid={error ? 'true' : 'false'}
        aria-describedby={error ? `${name}-error` : undefined}
      />
      
      {error && (
        <p id={`${name}-error`} className="mt-1 text-sm text-danger-600">
          {error}
        </p>
      )}
    </div>
  );
};

export default Input; 