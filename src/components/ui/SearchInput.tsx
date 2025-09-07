"use client";
import React, { useState, useEffect, useRef } from 'react';
import { Search, X, Loader2 } from 'lucide-react';
import clsx from 'clsx';

interface SearchResult {
  value: string;
  label: string;
  location: string;
  department: string;
}

interface SearchInputProps {
  value: string;
  onChange: (value: string) => void;
  onSelect: (result: SearchResult) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
}

export default function SearchInput({
  value,
  onChange,
  onSelect,
  placeholder = "Buscar JRV...",
  disabled = false,
  className
}: SearchInputProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Buscar JRVs cuando cambia el valor
  useEffect(() => {
    const searchJRVs = async () => {
      if (value.length < 1) {
        setResults([]);
        setIsOpen(false);
        return;
      }

      setIsLoading(true);
      try {
        const response = await fetch(`/api/jrv/search?q=${encodeURIComponent(value)}&limit=20`);
        const data = await response.json();
        
        if (data.success) {
          setResults(data.data);
          setIsOpen(data.data.length > 0);
        } else {
          setResults([]);
          setIsOpen(false);
        }
      } catch (error) {
        console.error('Error searching JRVs:', error);
        setResults([]);
        setIsOpen(false);
      } finally {
        setIsLoading(false);
      }
    };

    const timeoutId = setTimeout(searchJRVs, 300); // Debounce
    return () => clearTimeout(timeoutId);
  }, [value]);

  // Cerrar dropdown al hacer click fuera
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node) &&
        inputRef.current &&
        !inputRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
        setSelectedIndex(-1);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    onChange(newValue);
    setSelectedIndex(-1);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!isOpen || results.length === 0) return;

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setSelectedIndex(prev => 
          prev < results.length - 1 ? prev + 1 : prev
        );
        break;
      case 'ArrowUp':
        e.preventDefault();
        setSelectedIndex(prev => prev > 0 ? prev - 1 : -1);
        break;
      case 'Enter':
        e.preventDefault();
        if (selectedIndex >= 0 && selectedIndex < results.length) {
          handleSelect(results[selectedIndex]);
        }
        break;
      case 'Escape':
        setIsOpen(false);
        setSelectedIndex(-1);
        break;
    }
  };

  const handleSelect = (result: SearchResult) => {
    onSelect(result);
    setIsOpen(false);
    setSelectedIndex(-1);
  };

  const clearInput = () => {
    onChange('');
    setIsOpen(false);
    setSelectedIndex(-1);
    inputRef.current?.focus();
  };

  return (
    <div className={clsx('relative', className)}>
      <div className="relative">
        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
          {isLoading ? (
            <Loader2 className="h-4 w-4 text-gray-400 animate-spin" />
          ) : (
            <Search className="h-4 w-4 text-gray-400" />
          )}
        </div>
        <input
          ref={inputRef}
          type="text"
          value={value}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          onFocus={() => {
            if (results.length > 0) {
              setIsOpen(true);
            }
          }}
          placeholder={placeholder}
          disabled={disabled}
          className={clsx(
            'w-full pl-10 pr-10 py-2 border border-gray-300 rounded-md',
            'focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent',
            'disabled:bg-gray-50 disabled:text-gray-500',
            'text-sm'
          )}
        />
        {value && (
          <button
            type="button"
            onClick={clearInput}
            className="absolute inset-y-0 right-0 pr-3 flex items-center"
          >
            <X className="h-4 w-4 text-gray-400 hover:text-gray-600" />
          </button>
        )}
      </div>

      {/* Dropdown de resultados */}
      {isOpen && results.length > 0 && (
        <div
          ref={dropdownRef}
          className="absolute z-50 w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg max-h-60 overflow-auto"
        >
          {results.map((result, index) => (
            <button
              key={result.value}
              type="button"
              onClick={() => handleSelect(result)}
              className={clsx(
                'w-full px-4 py-2 text-left text-sm hover:bg-gray-50 focus:outline-none focus:bg-gray-50',
                'border-b border-gray-100 last:border-b-0',
                index === selectedIndex && 'bg-gray-50'
              )}
            >
              <div className="font-medium text-gray-900">{result.label}</div>
              <div className="text-xs text-gray-500">{result.department}</div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
