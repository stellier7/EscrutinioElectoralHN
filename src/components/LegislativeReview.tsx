'use client';

import React, { useState } from 'react';
import { getPartyConfig } from '@/lib/party-config';

interface LegislativeReviewProps {
  candidates: Array<{
    id: string;
    name: string;
    party: string;
    votes: number;
    number?: string | number;
  }>;
}

export default function LegislativeReview({ candidates }: LegislativeReviewProps) {
  const [expandedParty, setExpandedParty] = useState<string | null>(null);

  console.log('📊 LegislativeReview recibió candidates:', candidates);

  // Orden fijo de partidos para elecciones 2025 (solo los 5 principales)
  const partyOrder = ['pdc', 'libre', 'pinu-sd', 'liberal', 'nacional'];

  // Agrupar candidatos por partido - EXACTAMENTE como en el conteo
  const partiesData = candidates.reduce((acc: Record<string, {
    party: string;
    votes: number;
    casillas: Array<{name: string, votes: number, number?: string | number}>;
  }>, candidate: any) => {
    const party = candidate.party;
    if (!acc[party]) {
      acc[party] = {
        party: party,
        votes: 0,
        casillas: []
      };
    }
    acc[party].votes += candidate.votes;
    acc[party].casillas.push({
      name: candidate.name,
      votes: candidate.votes,
      number: candidate.number
    });
    return acc;
  }, {});

  console.log('📊 LegislativeReview - partiesData procesado:', partiesData);

  const handlePartyClick = (partyId: string) => {
    setExpandedParty(expandedParty === partyId ? null : partyId);
  };

  return (
    <div className="space-y-3">
      {/* Mostrar partidos como tarjetas - EXACTAMENTE como en el conteo */}
      {partyOrder.map((partyId) => {
        const partyData = partiesData[partyId];
        const partyConfig = getPartyConfig(partyId);
        
        // Si no hay datos para este partido, crear estructura vacía
        const safePartyData = partyData || {
          party: partyId,
          votes: 0,
          casillas: []
        };
        
        const totalCasillas = safePartyData.casillas.length;
        const firstCasilla = safePartyData.casillas[0]?.number || 1;
        const lastCasilla = safePartyData.casillas[totalCasillas - 1]?.number || totalCasillas;
        const casillaRange = totalCasillas > 1 
          ? `Casillas ${firstCasilla}-${lastCasilla}` 
          : `Casilla ${firstCasilla}`;

        return (
          <div key={partyId}>
            {/* Tarjeta del partido - EXACTAMENTE como en el conteo */}
            <div
              className="w-full flex items-center rounded-lg border focus:outline-none focus:ring-2 transition-transform bg-gray-50 opacity-60 cursor-pointer"
              onClick={() => handlePartyClick(partyId)}
              style={{ borderLeftWidth: 6, borderLeftColor: partyConfig.color }}
            >
              <div className="flex-1 p-3 sm:p-4 text-left">
                <div className="flex items-center justify-between">
                  <div className="min-w-0 flex-1">
                    <div className="text-sm sm:text-base font-semibold text-gray-900 truncate">{partyConfig.name}</div>
                    <div className="text-xs sm:text-sm text-gray-600">{casillaRange}</div>
                  </div>
                  <div className="flex items-center gap-2 ml-3">
                    <span className="text-xl sm:text-2xl font-bold tabular-nums" aria-live="polite">
                      {safePartyData.votes}
                    </span>
                    <div className="text-sm text-gray-500">+</div>
                  </div>
                </div>
              </div>
            </div>

            {/* Grid de casillas expandido */}
            {expandedParty === partyId && (
              <div className="mt-3 bg-gray-50 rounded-lg p-4">
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                  {safePartyData.casillas.map((casilla, index) => (
                    <div
                      key={index}
                      className="bg-white border border-gray-200 rounded-lg p-3 text-center"
                    >
                      <div className="text-sm font-medium text-gray-900 mb-2">
                        {casilla.name}
                      </div>
                      <div className="text-lg font-bold text-gray-900">
                        {casilla.votes}
                      </div>
                      <div className="text-xs text-gray-500">
                        marca{casilla.votes !== 1 ? 's' : ''}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
