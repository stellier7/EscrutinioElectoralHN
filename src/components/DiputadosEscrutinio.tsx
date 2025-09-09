"use client";
import React, { useState, useCallback, useEffect } from 'react';
import { ArrowLeft, Loader2, AlertCircle, Check, X, FileText } from 'lucide-react';
import clsx from 'clsx';
import axios from 'axios';
import { usePapeleta } from '@/hooks/usePapeleta';

// Utility function to generate block-based slot ranges for legislative elections
// Input: parties[] (fixed order array), S = seatCount (number of diputados)
// Algorithm: For each party i: start = i * S + 1, end = (i + 1) * S
export function generatePartySlotRanges(seatCount: number, partyCount: number): Array<{ start: number; end: number; range: string; casillas: number[] }> {
  const ranges = [];
  for (let i = 0; i < partyCount; i++) {
    const start = i * seatCount + 1;
    const end = (i + 1) * seatCount;
    const casillas = Array.from({ length: seatCount }, (_, idx) => start + idx);
    ranges.push({
      start,
      end,
      range: `${start}–${end}`,
      casillas
    });
  }
  return ranges;
}

// Interfaces
interface Party {
  id: string;
  name: string;
  fullName: string;
  color: string;
  slots: number;
  slotRange: string;
  casillas: number[];
}

interface JRVInfo {
  jrv: string;
  nombre: string;
  departamento: string;
  diputados: number;
  municipio?: string;
}

interface DiputadosData {
  jrv: JRVInfo;
  parties: Party[];
}

interface PartyCounts {
  [key: string]: number;
}

interface AppliedVotes {
  [partyId: string]: {
    [casillaNumber: number]: number;
  };
}

interface AnimationState {
  show: boolean;
  x: number;
  y: number;
  partyId: string;
}

interface DiputadosEscrutinioProps {
  jrvNumber?: string;
  escrutinioId?: string;
  userId?: string;
}

export default function DiputadosEscrutinio({ jrvNumber, escrutinioId, userId }: DiputadosEscrutinioProps) {
  const [diputadosData, setDiputadosData] = useState<DiputadosData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [partyCounts, setPartyCounts] = useState<PartyCounts>({});
  const [appliedVotes, setAppliedVotes] = useState<AppliedVotes>({});
  const [expandedParty, setExpandedParty] = useState<string | null>(null);
  const [animation, setAnimation] = useState<AnimationState>({
    show: false,
    x: 0,
    y: 0,
    partyId: ''
  });

  // Hook para manejar papeletas
  const { 
    papeleta, 
    isLoading: papeletaLoading, 
    error: papeletaError, 
    startPapeleta, 
    addVoteToBuffer, 
    removeVoteFromBuffer,
    closePapeleta, 
    anularPapeleta, 
    resetPapeleta,
    isCasillaSelected,
    getCasillaVoteCount
  } = usePapeleta();

  // Cargar datos de diputados según la JRV
  useEffect(() => {
    const loadDiputadosData = async () => {
      if (!jrvNumber) {
        setError('Número de JRV no proporcionado');
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        setError(null);
        
        console.log('🔍 Buscando JRV:', jrvNumber);
        const url = `/api/jrv/${encodeURIComponent(jrvNumber)}`;
        console.log('🌐 URL:', url);
        
        const response = await axios.get(url);
        console.log('✅ Respuesta:', response.data);
        
        if (response.data?.success) {
          const jrvData = response.data.data;
          
          // Configuración base de partidos políticos (orden fijo)
          const baseParties = [
            {
              id: 'pdc',
              name: 'Demócrata Cristiano',
              fullName: 'Partido Demócrata Cristiano',
              color: '#16a34a'
            },
            {
              id: 'libre',
              name: 'Libre',
              fullName: 'Partido Libertad y Refundación (LIBRE)',
              color: '#dc2626'
            },
            {
              id: 'pinu-sd',
              name: 'PINU-SD',
              fullName: 'Partido Innovación y Unidad Social Demócrata (PINU-SD)',
              color: '#7c3aed'
            },
            {
              id: 'liberal',
              name: 'Liberal',
              fullName: 'Partido Liberal de Honduras',
              color: '#ef4444'
            },
            {
              id: 'nacional',
              name: 'Nacional',
              fullName: 'Partido Nacional de Honduras',
              color: '#2563eb'
            }
          ];

          // Generar rangos de casillas por bloques
          const slotRanges = generatePartySlotRanges(jrvData.diputados, baseParties.length);
          
          // Combinar datos base con rangos generados
          const parties = baseParties.map((party, index) => ({
            ...party,
            slots: jrvData.diputados,
            slotRange: slotRanges[index].range,
            casillas: slotRanges[index].casillas
          }));

          const data = {
            jrv: jrvData,
            parties: parties
          };
          
          setDiputadosData(data);
          
          // Inicializar conteos en 0 para todos los partidos
          const initialCounts: PartyCounts = {};
          parties.forEach((party: Party) => {
            initialCounts[party.id] = 0;
          });
          setPartyCounts(initialCounts);
        } else {
          console.error('❌ Error en respuesta:', response.data);
          setError(response.data?.error || 'Error al cargar datos de diputados');
        }
      } catch (err: any) {
        console.error('❌ Error loading diputados data:', err);
        console.error('❌ Error details:', {
          message: err.message,
          status: err.response?.status,
          statusText: err.response?.statusText,
          data: err.response?.data
        });
        setError(err?.response?.data?.error || 'Error al cargar datos de diputados');
      } finally {
        setLoading(false);
      }
    };

    loadDiputadosData();
  }, [jrvNumber]);

  // Iniciar papeleta cuando se cargan los datos y tenemos escrutinioId
  useEffect(() => {
    if (diputadosData && escrutinioId && userId && !papeleta.id) {
      startPapeleta(escrutinioId, userId);
    }
  }, [diputadosData, escrutinioId, userId, papeleta.id, startPapeleta]);

  // Handle party card click - expand to grid
  const handlePartyClick = useCallback((partyId: string) => {
    setExpandedParty(partyId);
  }, []);

  // Handle grid slot click - toggle vote in buffer and animate
  const handleSlotClick = useCallback(async (partyId: string, slotNumber: number, event: React.MouseEvent) => {
    if (!userId || papeleta.status !== 'OPEN') {
      setError('No hay papeleta abierta');
      return;
    }

    // Get click position for animation
    const rect = event.currentTarget.getBoundingClientRect();
    const x = rect.left + rect.width / 2;
    const y = rect.top + rect.height / 2;

    // Check if casilla is already selected
    const isSelected = isCasillaSelected(partyId, slotNumber);

    if (isSelected) {
      // Deseleccionar - remover del buffer localmente
      removeVoteFromBuffer(partyId, slotNumber);
      
      // Update local count for UI feedback
      setPartyCounts(prev => ({
        ...prev,
        [partyId]: Math.max(0, (prev[partyId] || 0) - 1)
      }));

      // Show removal animation
      setAnimation({
        show: true,
        x,
        y,
        partyId
      });
    } else {
      // Seleccionar - agregar al buffer
      const success = await addVoteToBuffer(partyId, slotNumber, userId);
      
      if (success) {
        // Update local count for UI feedback
        setPartyCounts(prev => ({
          ...prev,
          [partyId]: (prev[partyId] || 0) + 1
        }));

        // Show addition animation
        setAnimation({
          show: true,
          x,
          y,
          partyId
        });
      }
    }

    // Hide animation after 300ms
    setTimeout(() => {
      setAnimation(prev => ({ ...prev, show: false }));
    }, 300);
  }, [userId, papeleta.status, addVoteToBuffer, removeVoteFromBuffer, isCasillaSelected]);

  // Handle back button
  const handleBack = useCallback(() => {
    setExpandedParty(null);
  }, []);

  // Handle close papeleta
  const handleClosePapeleta = useCallback(async () => {
    if (!userId) return;
    
    const success = await closePapeleta(userId);
    if (success) {
      // Aplicar votos del buffer a los votos aplicados (conteo general)
      const newAppliedVotes = { ...appliedVotes };
      const newPartyCounts = { ...partyCounts };
      
      // Procesar cada voto del buffer
      papeleta.votesBuffer.forEach((vote) => {
        const { partyId, casillaNumber } = vote;
        
        // Inicializar estructura si no existe
        if (!newAppliedVotes[partyId]) {
          newAppliedVotes[partyId] = {};
        }
        if (!newAppliedVotes[partyId][casillaNumber]) {
          newAppliedVotes[partyId][casillaNumber] = 0;
        }
        
        // Incrementar conteo aplicado
        newAppliedVotes[partyId][casillaNumber] += 1;
      });
      
      // Actualizar conteos de partidos
      Object.keys(newAppliedVotes).forEach(partyId => {
        const partyVotes = Object.values(newAppliedVotes[partyId]);
        newPartyCounts[partyId] = partyVotes.reduce((sum, count) => sum + count, 0);
      });
      
      setAppliedVotes(newAppliedVotes);
      setPartyCounts(newPartyCounts);
      setExpandedParty(null);
      
      // Iniciar nueva papeleta
      if (escrutinioId) {
        startPapeleta(escrutinioId, userId);
      }
    }
  }, [userId, closePapeleta, escrutinioId, startPapeleta, appliedVotes, partyCounts, papeleta.votesBuffer]);

  // Handle anular papeleta
  const handleAnularPapeleta = useCallback(async () => {
    if (!userId) return;
    
    const success = await anularPapeleta(userId, 'Anulada por usuario');
    if (success) {
      // Solo limpiar el grid actual, mantener votos aplicados
      setExpandedParty(null);
      
      // Iniciar nueva papeleta
      if (escrutinioId) {
        startPapeleta(escrutinioId, userId);
      }
    }
  }, [userId, anularPapeleta, escrutinioId, startPapeleta]);

  // Get party by ID
  const getParty = (partyId: string) => diputadosData?.parties.find(p => p.id === partyId);

  // Helper functions for applied votes
  const isCasillaApplied = useCallback((partyId: string, casillaNumber: number): boolean => {
    return appliedVotes[partyId]?.[casillaNumber] > 0;
  }, [appliedVotes]);

  const getCasillaAppliedCount = useCallback((partyId: string, casillaNumber: number): number => {
    return appliedVotes[partyId]?.[casillaNumber] || 0;
  }, [appliedVotes]);

  const getTotalPartyCount = useCallback((partyId: string): number => {
    const bufferCount = papeleta.votesBuffer.filter(vote => vote.partyId === partyId).length;
    const appliedCount = partyCounts[partyId] || 0;
    return appliedCount + bufferCount;
  }, [papeleta.votesBuffer, partyCounts]);

  // Render party cards (initial view)
  const renderPartyCards = () => {
    if (!diputadosData) return null;

    return (
      <div className="space-y-3">
        {diputadosData.parties.map((party) => (
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
                  <div className="text-base font-semibold text-gray-900">{party.fullName}</div>
                  <div className="text-sm text-gray-600">Casillas {party.slotRange}</div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-2xl font-bold tabular-nums" aria-live="polite">
                    {getTotalPartyCount(party.id)}
                  </span>
                  <div className="text-sm text-gray-500">+</div>
                </div>
              </div>
            </div>
          </button>
        ))}
      </div>
    );
  };

  // Render grid of dynamic slots based on department
  const renderGrid = () => {
    if (!expandedParty || !diputadosData) return null;
    
    const party = getParty(expandedParty);
    if (!party) return null;
    
    // Calcular número de columnas para el grid (máximo 5)
    const columns = Math.min(5, party.slots);
    const rows = Math.ceil(party.slots / columns);
    
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
              <h3 className="text-lg font-semibold text-gray-900">{party.fullName}</h3>
              <p className="text-sm text-gray-600">Selecciona diputado</p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-right">
              <div className="text-2xl font-bold" style={{ color: party.color }}>
                {getTotalPartyCount(expandedParty)}
              </div>
              <div className="text-xs text-gray-500">Total</div>
            </div>
            <button
              onClick={handleBack}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
            >
              Partidos
            </button>
          </div>
        </div>

        {/* Dynamic Grid */}
        <div 
          className="grid gap-2"
          style={{ 
            gridTemplateColumns: `repeat(${columns}, 1fr)`,
            gridTemplateRows: `repeat(${rows}, 1fr)`
          }}
        >
          {party.casillas.map((casillaNumber, index) => {
            const isSelected = isCasillaSelected(expandedParty, casillaNumber);
            const isApplied = isCasillaApplied(expandedParty, casillaNumber);
            const bufferVoteCount = getCasillaVoteCount(expandedParty, casillaNumber);
            const appliedVoteCount = getCasillaAppliedCount(expandedParty, casillaNumber);
            const totalVoteCount = bufferVoteCount + appliedVoteCount;
            
            return (
              <button
                key={casillaNumber}
                onClick={(e) => handleSlotClick(expandedParty, casillaNumber, e)}
                className={clsx(
                  'aspect-square rounded-lg border-2 transition-all duration-200 relative',
                  'hover:scale-105 active:scale-95 focus:outline-none focus:ring-2 focus:ring-offset-2',
                  'text-sm font-medium flex items-center justify-center min-h-[60px]',
                  (isSelected || isApplied)
                    ? 'border-solid shadow-md' 
                    : 'border-dashed hover:border-solid'
                )}
                style={{
                  borderColor: party.color,
                  backgroundColor: isSelected 
                    ? `${party.color}25`  // Más intenso para selección actual
                    : isApplied 
                      ? `${party.color}15`  // Menos intenso para votos aplicados
                      : 'transparent',
                  color: (isSelected || isApplied) ? party.color : '#374151',
                  '--tw-ring-color': party.color
                } as React.CSSProperties}
              >
                <div className="flex flex-col items-center justify-center">
                  <span className="font-semibold">{casillaNumber}</span>
                  {totalVoteCount > 0 && (
                    <div 
                      className={clsx(
                        "absolute -top-1 -right-1 w-6 h-6 rounded-full text-xs font-bold text-white flex items-center justify-center shadow-lg border-2 border-white",
                        isSelected && bufferVoteCount > 0 ? "ring-2 ring-white ring-offset-1" : ""
                      )}
                      style={{ 
                        backgroundColor: party.color,
                        boxShadow: isSelected && bufferVoteCount > 0 
                          ? `0 0 0 3px ${party.color}60, 0 2px 8px ${party.color}40`
                          : `0 2px 8px ${party.color}40`
                      }}
                    >
                      {totalVoteCount}
                    </div>
                  )}
                </div>
              </button>
            );
          })}
        </div>

        {/* Instructions */}
        <div className="text-center text-sm text-gray-500 mb-4">
          Toca una casilla para seleccionar/deseleccionar diputado
        </div>

        {/* Legend */}
        <div className="flex justify-center gap-6 text-xs text-gray-600">
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded border-2 border-dashed" style={{ borderColor: party.color }}></div>
            <span>Sin votos</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded border-2 border-solid" style={{ borderColor: party.color, backgroundColor: `${party.color}15` }}></div>
            <span>Votos aplicados</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded border-2 border-solid" style={{ borderColor: party.color, backgroundColor: `${party.color}25` }}></div>
            <span>Seleccionado actual</span>
          </div>
        </div>

        {/* Papeleta Status and Controls */}
        {papeleta.status === 'OPEN' && (
          <div className="mt-6 p-4 bg-blue-50 rounded-lg border border-blue-200">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <FileText className="h-5 w-5 text-blue-600" />
                <span className="text-sm font-medium text-blue-900">Papeleta Abierta</span>
              </div>
              <span className="text-sm text-blue-700">
                {papeleta.votesBuffer.length} voto{papeleta.votesBuffer.length !== 1 ? 's' : ''}
              </span>
            </div>
            
            <div className="flex gap-2">
              <button
                onClick={handleClosePapeleta}
                disabled={papeletaLoading}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                <Check className="h-4 w-4" />
                Cerrar Papeleta
              </button>
              <button
                onClick={handleAnularPapeleta}
                disabled={papeletaLoading}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                <X className="h-4 w-4" />
                Anular Papeleta
              </button>
            </div>
          </div>
        )}

        {/* Papeleta Error */}
        {papeletaError && (
          <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-sm text-red-700">{papeletaError}</p>
          </div>
        )}
      </div>
    );
  };

  // Loading state
  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-12 w-12 animate-spin text-primary-600 mx-auto mb-4" />
          <p className="text-gray-600">Cargando datos de diputados...</p>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center max-w-md mx-auto p-6">
          <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
          <h2 className="text-lg font-semibold text-gray-900 mb-2">Error</h2>
          <p className="text-gray-600 mb-4">{error}</p>
          <button
            onClick={() => window.location.reload()}
            className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
          >
            Reintentar
          </button>
        </div>
      </div>
    );
  }

  // No data state
  if (!diputadosData) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <AlertCircle className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <p className="text-gray-600">No se encontraron datos de diputados</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-14 lg:h-16">
            <div className="flex items-center gap-4">
              <h1 className="text-lg lg:text-xl font-semibold text-gray-900">
                <span className="hidden sm:inline">Escrutinio de Diputados</span>
                <span className="sm:hidden">Diputados</span>
              </h1>
              {papeleta.status === 'OPEN' && (
                <div className="flex items-center gap-2 px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm">
                  <FileText className="h-4 w-4" />
                  Papeleta Abierta
                </div>
              )}
            </div>
            <div className="text-right">
              <div className="text-sm text-gray-600">
                {diputadosData.jrv.jrv}
              </div>
              <div className="text-xs text-gray-500">
                {diputadosData.jrv.departamento}
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-4 lg:py-8">
        <div className="bg-white p-6 rounded-lg shadow-sm border">
          <div className="mb-4">
            <h2 className="text-lg font-semibold text-gray-900">
              {expandedParty ? 'Selección de Diputado' : 'Conteo de Diputados'}
            </h2>
            <p className="text-sm text-gray-600">
              {diputadosData.jrv.nombre} - {diputadosData.jrv.departamento}
            </p>
          </div>
          
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
            style={{ backgroundColor: getParty(animation.partyId)?.color || '#10b981' }}
          >
            +1
          </div>
        </div>
      )}
    </div>
  );
}
