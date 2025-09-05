"use client";
import React, { useState, useCallback } from 'react';
import { ArrowLeft } from 'lucide-react';
import clsx from 'clsx';

// Party configuration with colors and display names
const PARTIES = [
  {
    id: 'pdc',
    name: 'Demócrata Cristiano',
    color: '#16a34a', // green
    fullName: 'Partido Demócrata Cristiano'
  },
  {
    id: 'libre',
    name: 'Libre',
    color: '#dc2626', // red
    fullName: 'Partido Libertad y Refundación (LIBRE)'
  },
  {
    id: 'pinu-sd',
    name: 'PINU-SD',
    color: '#7c3aed', // purple
    fullName: 'Partido Innovación y Unidad Social Demócrata (PINU-SD)'
  },
  {
    id: 'liberal',
    name: 'Liberal',
    color: '#ef4444', // red
    fullName: 'Partido Liberal de Honduras'
  },
  {
    id: 'nacional',
    name: 'Nacional',
    color: '#2563eb', // blue
    fullName: 'Partido Nacional de Honduras'
  }
] as const;

type PartyId = typeof PARTIES[number]['id'];

interface PartyCounts {
  [key: string]: number;
}

interface AnimationState {
  show: boolean;
  x: number;
  y: number;
  partyId: PartyId;
}

export default function DiputadosEscrutinio() {
  const [partyCounts, setPartyCounts] = useState<PartyCounts>({
    pdc: 0,
    libre: 0,
    'pinu-sd': 0,
    liberal: 0,
    nacional: 0
  });
  
  const [expandedParty, setExpandedParty] = useState<PartyId | null>(null);
  const [animation, setAnimation] = useState<AnimationState>({
    show: false,
    x: 0,
    y: 0,
    partyId: 'pdc'
  });

  // Handle party card click - expand to grid
  const handlePartyClick = useCallback((partyId: PartyId) => {
    setExpandedParty(partyId);
  }, []);

  // Handle grid slot click - add vote and animate
  const handleSlotClick = useCallback((partyId: PartyId, slotNumber: number, event: React.MouseEvent) => {
    // Get click position for animation
    const rect = event.currentTarget.getBoundingClientRect();
    const x = rect.left + rect.width / 2;
    const y = rect.top + rect.height / 2;

    // Show animation
    setAnimation({
      show: true,
      x,
      y,
      partyId
    });

    // Update count
    setPartyCounts(prev => ({
      ...prev,
      [partyId]: prev[partyId] + 1
    }));

    // Hide animation after 300ms
    setTimeout(() => {
      setAnimation(prev => ({ ...prev, show: false }));
    }, 300);

    // Close grid and return to party view after animation
    setTimeout(() => {
      setExpandedParty(null);
    }, 400);

    // TODO: Future AuditLogger integration
    // AuditLogger.log({
    //   event: 'diputado_vote',
    //   partyId,
    //   slotNumber,
    //   timestamp: Date.now(),
    //   metadata: { action: 'increment' }
    // });
  }, []);

  // Handle back button
  const handleBack = useCallback(() => {
    setExpandedParty(null);
  }, []);

  // Get party by ID
  const getParty = (partyId: PartyId) => PARTIES.find(p => p.id === partyId)!;

  // Render party cards (initial view)
  const renderPartyCards = () => (
    <div className="space-y-3">
      {PARTIES.map((party) => (
        <button
          key={party.id}
          onClick={() => handlePartyClick(party.id)}
          className={clsx(
            'w-full flex items-center rounded-lg border shadow-sm focus:outline-none focus:ring-2 transition-transform',
            'active:scale-[0.98] hover:scale-[1.01]',
            'bg-white'
          )}
          style={{ borderLeftWidth: 6, borderLeftColor: party.color }}
        >
          <div className="flex-1 p-4 text-left">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-base font-semibold text-gray-900">{party.name}</div>
                <div className="text-sm text-gray-600">Diputados</div>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-2xl font-bold tabular-nums" aria-live="polite">
                  {partyCounts[party.id]}
                </span>
                <div className="text-sm text-gray-500">+</div>
              </div>
            </div>
          </div>
        </button>
      ))}
    </div>
  );

  // Render grid of 25 slots (5x5)
  const renderGrid = () => {
    if (!expandedParty) return null;
    
    const party = getParty(expandedParty);
    
    return (
      <div className="space-y-4">
        {/* Header with party info and back button */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={handleBack}
              className="p-2 rounded-lg border border-gray-300 hover:bg-gray-50 transition-colors"
              aria-label="Volver a partidos"
            >
              <ArrowLeft className="h-4 w-4" />
            </button>
            <div>
              <h3 className="text-lg font-semibold text-gray-900">{party.name}</h3>
              <p className="text-sm text-gray-600">Selecciona diputado</p>
            </div>
          </div>
          <div className="text-right">
            <div className="text-2xl font-bold" style={{ color: party.color }}>
              {partyCounts[expandedParty]}
            </div>
            <div className="text-xs text-gray-500">Total</div>
          </div>
        </div>

        {/* 5x5 Grid */}
        <div className="grid grid-cols-5 gap-2">
          {Array.from({ length: 25 }, (_, index) => {
            const slotNumber = index + 1;
            return (
              <button
                key={slotNumber}
                onClick={(e) => handleSlotClick(expandedParty, slotNumber, e)}
                className={clsx(
                  'aspect-square rounded-lg border-2 border-dashed transition-all duration-200',
                  'hover:scale-105 active:scale-95 focus:outline-none focus:ring-2 focus:ring-offset-2',
                  'text-sm font-medium text-gray-700 hover:text-gray-900',
                  'flex items-center justify-center min-h-[60px]'
                )}
                style={{
                  borderColor: party.color,
                  '--tw-ring-color': party.color
                } as React.CSSProperties}
              >
                {slotNumber}
              </button>
            );
          })}
        </div>

        {/* Instructions */}
        <div className="text-center text-sm text-gray-500">
          Toca una casilla para agregar un diputado
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-14 lg:h-16">
            <div className="flex items-center">
              <h1 className="text-lg lg:text-xl font-semibold text-gray-900">
                <span className="hidden sm:inline">Escrutinio de Diputados</span>
                <span className="sm:hidden">Diputados</span>
              </h1>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-4 lg:py-8">
        <div className="bg-white p-6 rounded-lg shadow-sm border">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">
            {expandedParty ? 'Selección de Diputado' : 'Conteo de Diputados'}
          </h2>
          
          {expandedParty ? renderGrid() : renderPartyCards()}
        </div>
      </div>

      {/* +1 Animation */}
      {animation.show && (
        <div
          className="fixed pointer-events-none z-50"
          style={{
            left: animation.x - 20,
            top: animation.y - 20,
            transform: 'translate(-50%, -50%)'
          }}
        >
          <div
            className={clsx(
              'text-2xl font-bold text-white px-3 py-1 rounded-full shadow-lg',
              'animate-pulse'
            )}
            style={{ backgroundColor: getParty(animation.partyId).color }}
          >
            +1
          </div>
        </div>
      )}
    </div>
  );
}
