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

  // Agrupar candidatos por partido
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
    <div className="space-y-4">
      {/* Mostrar partidos como tarjetas */}
      {Object.entries(partiesData).map(([partyId, partyData]) => {
        const partyConfig = getPartyConfig(partyId);
        const totalCasillas = partyData.casillas.length;
        const casillaRange = totalCasillas > 1 
          ? `Casillas 1-${totalCasillas}` 
          : `Casilla ${String(partyData.casillas[0]?.number || '1')}`;

        return (
          <div key={partyId}>
            {/* Tarjeta del partido */}
            <div
              className="bg-white border border-gray-200 rounded-lg p-4 cursor-pointer hover:shadow-md transition-shadow"
              onClick={() => handlePartyClick(partyId)}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div 
                    className="w-4 h-12 rounded"
                    style={{ backgroundColor: partyConfig.color }}
                  />
                  <div>
                    <h3 className="font-semibold text-gray-900">{partyConfig.name}</h3>
                    <p className="text-sm text-gray-600">{casillaRange}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-2xl font-bold text-gray-900">{partyData.votes}</p>
                  <p className="text-sm text-gray-500">+</p>
                </div>
              </div>
            </div>

            {/* Grid de casillas expandido */}
            {expandedParty === partyId && (
              <div className="mt-3 bg-gray-50 rounded-lg p-4">
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                  {partyData.casillas.map((casilla, index) => (
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
