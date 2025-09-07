"use client";
import React, { useState, useCallback, useEffect } from 'react';
import { ArrowLeft, Loader2, AlertCircle } from 'lucide-react';
import clsx from 'clsx';
import axios from 'axios';

// Interfaces
interface Party {
  id: string;
  name: string;
  fullName: string;
  color: string;
  slots: number;
  slotRange: string;
}

interface JRVInfo {
  id: string;
  number: string;
  location: string;
  department: string;
  municipality: string;
}

interface DepartmentInfo {
  id: string;
  name: string;
  code: number | null;
  diputados: number;
}

interface DiputadosData {
  jrv: JRVInfo;
  department: DepartmentInfo;
  parties: Party[];
}

interface PartyCounts {
  [key: string]: number;
}

interface AnimationState {
  show: boolean;
  x: number;
  y: number;
  partyId: string;
}

interface DiputadosEscrutinioProps {
  jrvNumber?: string;
}

export default function DiputadosEscrutinio({ jrvNumber }: DiputadosEscrutinioProps) {
  const [diputadosData, setDiputadosData] = useState<DiputadosData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [partyCounts, setPartyCounts] = useState<PartyCounts>({});
  const [expandedParty, setExpandedParty] = useState<string | null>(null);
  const [animation, setAnimation] = useState<AnimationState>({
    show: false,
    x: 0,
    y: 0,
    partyId: ''
  });

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
        
        const response = await axios.get(`/api/diputados/jrv/${encodeURIComponent(jrvNumber)}`);
        
        if (response.data?.success) {
          const data = response.data.data;
          setDiputadosData(data);
          
          // Inicializar conteos en 0 para todos los partidos
          const initialCounts: PartyCounts = {};
          data.parties.forEach((party: Party) => {
            initialCounts[party.id] = 0;
          });
          setPartyCounts(initialCounts);
        } else {
          setError(response.data?.error || 'Error al cargar datos de diputados');
        }
      } catch (err: any) {
        console.error('Error loading diputados data:', err);
        setError(err?.response?.data?.error || 'Error al cargar datos de diputados');
      } finally {
        setLoading(false);
      }
    };

    loadDiputadosData();
  }, [jrvNumber]);

  // Handle party card click - expand to grid
  const handlePartyClick = useCallback((partyId: string) => {
    setExpandedParty(partyId);
  }, []);

  // Handle grid slot click - add vote and animate
  const handleSlotClick = useCallback((partyId: string, slotNumber: number, event: React.MouseEvent) => {
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
      [partyId]: (prev[partyId] || 0) + 1
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
  const getParty = (partyId: string) => diputadosData?.parties.find(p => p.id === partyId);

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
                    {partyCounts[party.id] || 0}
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
          <div className="text-right">
            <div className="text-2xl font-bold" style={{ color: party.color }}>
              {partyCounts[expandedParty] || 0}
            </div>
            <div className="text-xs text-gray-500">Total</div>
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
          {Array.from({ length: party.slots }, (_, index) => {
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
            <div className="flex items-center">
              <h1 className="text-lg lg:text-xl font-semibold text-gray-900">
                <span className="hidden sm:inline">Escrutinio de Diputados</span>
                <span className="sm:hidden">Diputados</span>
              </h1>
            </div>
            <div className="text-right">
              <div className="text-sm text-gray-600">
                {diputadosData.jrv.number}
              </div>
              <div className="text-xs text-gray-500">
                {diputadosData.department.name}
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
              {diputadosData.jrv.location} - {diputadosData.department.name}
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
