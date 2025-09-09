"use client";
import React, { useState, useEffect, useRef } from 'react';
import { Search, MapPin, ChevronDown } from 'lucide-react';
import clsx from 'clsx';

interface MesaOption {
  id: string;
  number: string;
  location: string;
  department: string;
  displayName: string;
}

interface MesaSearchInputProps {
  value: string;
  onChange: (value: string) => void;
  onSelect: (mesa: MesaOption | null) => void;
  placeholder?: string;
  className?: string;
}

export function MesaSearchInput({ 
  value, 
  onChange, 
  onSelect, 
  placeholder = "Buscar mesa...",
  className 
}: MesaSearchInputProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [options, setOptions] = useState<MesaOption[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedMesa, setSelectedMesa] = useState<MesaOption | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Buscar mesas cuando cambia el query
  useEffect(() => {
    const searchMesas = async () => {
      if (value.length < 1) {
        setOptions([]);
        return;
      }

      setIsLoading(true);
      try {
        const response = await fetch(`/api/mesas/search?q=${encodeURIComponent(value)}&limit=10`);
        const data = await response.json();
        
        if (data.success) {
          setOptions(data.data);
        }
      } catch (error) {
        console.error('Error searching mesas:', error);
      } finally {
        setIsLoading(false);
      }
    };

    const timeoutId = setTimeout(searchMesas, 300); // Debounce
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
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    onChange(newValue);
    setIsOpen(true);
    
    // Si se borra el input, limpiar selección
    if (newValue === '') {
      setSelectedMesa(null);
      onSelect(null);
    }
  };

  const handleOptionSelect = (mesa: MesaOption) => {
    setSelectedMesa(mesa);
    onChange(mesa.displayName);
    onSelect(mesa);
    setIsOpen(false);
  };

  const handleInputFocus = () => {
    if (options.length > 0) {
      setIsOpen(true);
    }
  };

  return (
    <div className={clsx("relative", className)}>
      <div className="relative">
        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
          <Search className="h-4 w-4 text-gray-400" />
        </div>
        <input
          ref={inputRef}
          type="text"
          value={value}
          onChange={handleInputChange}
          onFocus={handleInputFocus}
          placeholder={placeholder}
          className="block w-full pl-10 pr-10 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        />
        <div className="absolute inset-y-0 right-0 pr-3 flex items-center">
          <ChevronDown className={clsx(
            "h-4 w-4 text-gray-400 transition-transform",
            isOpen && "rotate-180"
          )} />
        </div>
      </div>

      {/* Dropdown */}
      {isOpen && (
        <div
          ref={dropdownRef}
          className="absolute z-50 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg max-h-60 overflow-auto"
        >
          {isLoading ? (
            <div className="px-4 py-2 text-sm text-gray-500">Buscando...</div>
          ) : options.length === 0 ? (
            <div className="px-4 py-2 text-sm text-gray-500">
              {value.length < 1 ? "Escribe para buscar mesas" : "No se encontraron mesas"}
            </div>
          ) : (
            options.map((mesa) => (
              <button
                key={mesa.id}
                onClick={() => handleOptionSelect(mesa)}
                className="w-full px-4 py-2 text-left hover:bg-gray-50 focus:bg-gray-50 focus:outline-none"
              >
                <div className="flex items-center gap-2">
                  <MapPin className="h-4 w-4 text-gray-400 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-gray-900 truncate">
                      {mesa.displayName}
                    </div>
                    <div className="text-xs text-gray-500 truncate">
                      {mesa.department}
                    </div>
                  </div>
                </div>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}
