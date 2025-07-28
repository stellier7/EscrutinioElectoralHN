import React from 'react';
import { clsx } from 'clsx';
import type { SelectProps } from '@/types';

const Select: React.FC<SelectProps> = ({
  label,
  name,
  options,
  value,
  onChange,
  error,
  required = false,
  disabled = false,
}) => {
  const selectClasses = clsx(
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
    'bg-white',
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
      
      <select
        id={name}
        name={name}
        value={value}
        onChange={onChange}
        disabled={disabled}
        required={required}
        className={selectClasses}
        aria-invalid={error ? 'true' : 'false'}
        aria-describedby={error ? `${name}-error` : undefined}
      >
        <option value="">Seleccione una opción</option>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      
      {error && (
        <p id={`${name}-error`} className="mt-1 text-sm text-danger-600">
          {error}
        </p>
      )}
    </div>
  );
};

export default Select; 