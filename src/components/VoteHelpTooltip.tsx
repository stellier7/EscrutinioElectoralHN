"use client";
import React, { useState, useEffect } from 'react';
import { X, Info } from 'lucide-react';

interface VoteHelpTooltipProps {
  onDismiss?: () => void;
}

export function VoteHelpTooltip({ onDismiss }: VoteHelpTooltipProps) {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    // Verificar si ya se mostró antes
    const hasSeenTooltip = localStorage.getItem('vote-help-tooltip-dismissed');
    if (!hasSeenTooltip) {
      setIsVisible(true);
    }
  }, []);

  const handleDismiss = () => {
    setIsVisible(false);
    localStorage.setItem('vote-help-tooltip-dismissed', 'true');
    onDismiss?.();
  };

  if (!isVisible) return null;

  return (
    <div className="mb-4 bg-blue-50 border border-blue-200 rounded-lg p-4 shadow-sm">
      <div className="flex items-start gap-3">
        <div className="flex-shrink-0 mt-0.5">
          <Info className="h-5 w-5 text-blue-600" />
        </div>
        <div className="flex-1">
          <h3 className="text-sm font-semibold text-blue-900 mb-1">
            ¿Cómo agregar votos?
          </h3>
          <p className="text-sm text-blue-800">
            Toca cualquier tarjeta de candidato para agregar un voto. Usa el botón "–" para restar votos.
          </p>
        </div>
        <button
          onClick={handleDismiss}
          className="flex-shrink-0 text-blue-600 hover:text-blue-800 transition-colors"
          aria-label="Cerrar ayuda"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

export default VoteHelpTooltip;

