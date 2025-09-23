"use client";
import React, { useCallback, useEffect, useRef, useState } from 'react';
import clsx from 'clsx';
import { getPartyConfig } from '@/lib/party-config';
import Image from 'next/image';

type Props = {
  id: string;
  // Title should display full party name (no abbreviations)
  party: string;
  // Subtitle should display candidate initial + surname
  name: string;
  partyColor?: string;
  number?: string | number;
  count: number;
  onIncrement: () => void;
  onDecrement: () => void;
  isPending?: boolean; // pending batch indicator
};

export function VoteCard({ id, name, party, partyColor = '#e5e7eb', number, count, onIncrement, onDecrement, isPending }: Props) {
  const [animate, setAnimate] = useState(false);
  const pressTimer = useRef<number | null>(null);
  
  // Obtener configuración del partido
  const partyConfig = getPartyConfig(party);
  const effectivePartyColor = partyColor !== '#e5e7eb' ? partyColor : partyConfig.color;

  const handleClick = useCallback(() => {
    onIncrement();
    setAnimate(true);
  }, [onIncrement]);

  useEffect(() => {
    if (!animate) return;
    const t = setTimeout(() => setAnimate(false), 150);
    return () => clearTimeout(t);
  }, [animate]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLButtonElement>) => {
    if (e.key === 'Enter' || e.key === ' ') {
      if (e.shiftKey) {
        onDecrement();
      } else {
        onIncrement();
        setAnimate(true);
      }
      e.preventDefault();
    }
  };

  const startLongPress = () => {
    if (pressTimer.current) window.clearTimeout(pressTimer.current);
    pressTimer.current = window.setTimeout(() => {
      onDecrement();
      pressTimer.current = null;
    }, 500);
  };

  const cancelLongPress = () => {
    if (pressTimer.current) {
      window.clearTimeout(pressTimer.current);
      pressTimer.current = null;
    }
  };

  return (
    <button
      type="button"
      aria-pressed="false"
      aria-label={`${name} - sumar voto`}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      onTouchStart={startLongPress}
      onTouchEnd={cancelLongPress}
      onMouseDown={startLongPress}
      onMouseUp={cancelLongPress}
      className={clsx(
        'w-full flex items-center rounded-lg border shadow-sm focus:outline-none focus:ring-2 transition-transform',
        'active:scale-[0.98] touch-manipulation select-none',
        animate && 'scale-[1.02]',
        'min-h-[70px]' // Altura mínima para mejor toque
      )}
      style={{ 
        backgroundColor: effectivePartyColor,
        borderLeftWidth: 6, 
        borderLeftColor: effectivePartyColor,
        borderColor: effectivePartyColor
      }}
      data-testid={`vote-card-${id}`}
    >
      <div className="flex-1 p-4 text-left">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {/* Logo del partido */}
            {partyConfig.logoUrl && (
              <div className="flex-shrink-0">
                <Image
                  src={partyConfig.logoUrl}
                  alt={`Logo ${partyConfig.name}`}
                  width={40}
                  height={40}
                  className="rounded-full bg-white/20 p-1"
                />
              </div>
            )}
            <div>
              <div className="text-base font-semibold text-white drop-shadow-sm">{partyConfig.name}</div>
              <div className="text-sm text-white/90 drop-shadow-sm">{formatInitialSurname(name)}{number !== undefined ? ` • Lista ${number}` : ''}</div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-2xl font-bold tabular-nums text-white drop-shadow-sm" aria-live="polite">{count}</span>
            <button
              type="button"
              aria-label={`Restar 1 a ${name}`}
              onClick={(e) => { e.stopPropagation(); onDecrement(); }}
              className="px-3 py-2 text-sm rounded border bg-white/20 active:bg-white/30 touch-manipulation select-none min-h-[32px] min-w-[32px] text-white border-white/30 hover:bg-white/30"
            >
              –
            </button>
          </div>
        </div>
      </div>
    </button>
  );
}

export default VoteCard;

function formatInitialSurname(fullName: string): string {
  const parts = fullName.trim().split(/\s+/);
  if (parts.length === 0) return fullName;
  const initial = parts[0].charAt(0).toUpperCase();
  const surname = parts[parts.length - 1];
  return `${initial}. ${surname}`;
}

