"use client";
import React, { useState, useCallback, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Loader2, AlertCircle, Check, X, FileText, Camera, Upload, CheckCircle } from 'lucide-react';
import clsx from 'clsx';
import axios from 'axios';
import { usePapeleta } from '@/hooks/usePapeleta';
import { VoteLimitAlert } from './ui/VoteLimitAlert';

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
  diputados: number;
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
  const router = useRouter();
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
  
  // Estados para foto y cierre de escrutinio
  const [actaImage, setActaImage] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isCompleting, setIsCompleting] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  
  // Estados para alerta de límite de marcas
  const [showVoteLimitAlert, setShowVoteLimitAlert] = useState(false);
  const [isClosingPapeleta, setIsClosingPapeleta] = useState(false);
  const [papeletaNumber, setPapeletaNumber] = useState(1);
  
  // Estados para control de escrutinio
  const [escrutinioStatus, setEscrutinioStatus] = useState<'COMPLETED' | 'CLOSED'>('COMPLETED');
  const [isEscrutinioClosed, setIsEscrutinioClosed] = useState(false);
  const [isClosing, setIsClosing] = useState(false);
  const [isReopening, setIsReopening] = useState(false);

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
    getCasillaVoteCount,
    isVoteLimitReached,
    getTotalVotesInBuffer,
    loadPapeletaFromServer
  } = usePapeleta();

  // Inicializar papeleta automáticamente cuando se carga el componente
  useEffect(() => {
    if (escrutinioId && userId && papeleta.status === null) {
      console.log('🔄 Inicializando papeleta automáticamente...');
      startPapeleta(escrutinioId, userId);
    }
  }, [escrutinioId, userId, papeleta.status, startPapeleta]);

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
              fullName: 'Demócrata Cristiano',
              color: '#16a34a'
            },
            {
              id: 'libre',
              name: 'Libre',
              fullName: 'Libre',
              color: '#dc2626'
            },
            {
              id: 'pinu-sd',
              name: 'PINU',
              fullName: 'PINU',
              color: '#ea580c'
            },
            {
              id: 'liberal',
              name: 'Liberal',
              fullName: 'Liberal',
              color: '#ef4444'
            },
            {
              id: 'nacional',
              name: 'Nacional',
              fullName: 'Nacional',
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
            parties: parties,
            diputados: jrvData.diputados
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

  // Cargar o iniciar papeleta cuando se cargan los datos y tenemos escrutinioId
  useEffect(() => {
    const loadOrStartPapeleta = async () => {
      if (diputadosData && escrutinioId && userId && !papeleta.id) {
        // Primero intentar cargar papeleta existente desde el servidor
        const loaded = await loadPapeletaFromServer(escrutinioId);
        if (!loaded) {
          // Si no hay papeleta existente, crear una nueva
          console.log('🆕 No hay papeleta existente, creando nueva...');
          startPapeleta(escrutinioId, userId);
        } else {
          console.log('✅ Papeleta existente cargada desde servidor');
        }
      }
    };
    
    loadOrStartPapeleta();
  }, [diputadosData, escrutinioId, userId, papeleta.id, startPapeleta, loadPapeletaFromServer]);

  // Handle party card click - expand to grid
  const handlePartyClick = useCallback((partyId: string) => {
    setExpandedParty(partyId);
  }, []);

  // Handle grid slot click - toggle vote in buffer and animate (optimized for touch)
  const handleSlotClick = useCallback(async (partyId: string, slotNumber: number, event: React.MouseEvent) => {
    if (!userId || papeleta.status !== 'OPEN') {
      setError('No hay papeleta abierta');
      return;
    }
    
    if (isEscrutinioClosed) {
      setError('El escrutinio está cerrado. No se pueden hacer cambios.');
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
      
      // No actualizar partyCounts aquí - el hook ya maneja el buffer
      // Solo mostrar animación
      setAnimation({
        show: true,
        x,
        y,
        partyId
      });
    } else {
      // Verificar límite de marcas antes de agregar
      const voteLimit = diputadosData?.diputados || 0;
      if (voteLimit > 0 && isVoteLimitReached(voteLimit)) {
        // Mostrar alerta de límite alcanzado
        setShowVoteLimitAlert(true);
        return;
      }

      // Seleccionar - agregar al buffer con límite
      const success = await addVoteToBuffer(partyId, slotNumber, userId, voteLimit);
      
      if (success) {
        // No actualizar partyCounts aquí - el hook ya maneja el buffer
        // Solo mostrar animación
        setAnimation({
          show: true,
          x,
          y,
          partyId
        });

        // Verificar si se alcanzó el límite después de agregar la marca
        if (voteLimit > 0 && isVoteLimitReached(voteLimit)) {
          setShowVoteLimitAlert(true);
        }
      }
    }

    // Hide animation after 200ms (más rápido)
    setTimeout(() => {
      setAnimation(prev => ({ ...prev, show: false }));
    }, 200);
  }, [userId, papeleta.status, addVoteToBuffer, removeVoteFromBuffer, isCasillaSelected, diputadosData?.diputados, isVoteLimitReached, isEscrutinioClosed]);

  // Handle back button
  const handleBack = useCallback(() => {
    setExpandedParty(null);
  }, []);

  // Handle close papeleta
  const handleClosePapeleta = useCallback(async () => {
    if (!userId) return;
    
    const success = await closePapeleta(userId);
    if (success) {
      // Aplicar marcas del buffer a las marcas aplicadas (conteo general)
      const newAppliedVotes = { ...appliedVotes };
      const newPartyCounts = { ...partyCounts };
      
      // Procesar cada marca del buffer
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
      
      // Incrementar número de papeleta
      setPapeletaNumber(prev => prev + 1);
      
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
      // Solo limpiar el grid actual, mantener marcas aplicadas
      setExpandedParty(null);
      
      // Incrementar número de papeleta
      setPapeletaNumber(prev => prev + 1);
      
      // Iniciar nueva papeleta
      if (escrutinioId) {
        startPapeleta(escrutinioId, userId);
      }
    }
  }, [userId, anularPapeleta, escrutinioId, startPapeleta]);

  // Handle vote limit alert
  const handleCloseVoteLimitAlert = useCallback(() => {
    setShowVoteLimitAlert(false);
  }, []);

  const handleClosePapeletaFromAlert = useCallback(async () => {
    if (!userId) return;
    
    setIsClosingPapeleta(true);
    try {
      await handleClosePapeleta();
      setShowVoteLimitAlert(false);
    } finally {
      setIsClosingPapeleta(false);
    }
  }, [userId, handleClosePapeleta]);

  const handleAnularPapeletaFromAlert = useCallback(async () => {
    if (!userId) return;
    
    setIsClosingPapeleta(true);
    try {
      await handleAnularPapeleta();
      setShowVoteLimitAlert(false);
    } finally {
      setIsClosingPapeleta(false);
    }
  }, [userId, handleAnularPapeleta]);

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

  // Funciones para manejar foto y cierre de escrutinio
  const handleActaUpload = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setActaImage(file);
    }
  }, []);

  const computeSHA256Hex = async (file: File): Promise<string> => {
    const buf = await file.arrayBuffer();
    const digest = await crypto.subtle.digest('SHA-256', buf);
    const byteArray = Array.from(new Uint8Array(digest));
    return byteArray.map((b) => b.toString(16).padStart(2, '0')).join('');
  };

  const toDataUrl = (file: File): Promise<string> =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });

  const uploadEvidenceIfNeeded = async (): Promise<void> => {
    if (!actaImage || !escrutinioId) return;
    try {
      const presign = await axios.post('/api/upload/presign', {
        escrutinioId,
        fileName: actaImage.name,
        contentType: actaImage.type || 'image/jpeg',
      });
      if (presign.data?.success) {
        const { uploadUrl, publicUrl } = presign.data.data as { uploadUrl: string; publicUrl: string };
        await fetch(uploadUrl, {
          method: 'PUT',
          headers: { 'Content-Type': actaImage.type || 'image/jpeg' },
          body: actaImage,
        });
        const hash = await computeSHA256Hex(actaImage);
        await axios.post(`/api/escrutinio/${encodeURIComponent(escrutinioId)}/evidence`, { publicUrl, hash });
        return;
      }
    } catch {
      // fallback below
    }
    try {
      const dataUrl = await toDataUrl(actaImage);
      const hash = await computeSHA256Hex(actaImage);
      await axios.post(`/api/escrutinio/${encodeURIComponent(escrutinioId)}/evidence`, { publicUrl: dataUrl, hash });
    } catch {}
  };

  const handleCompleteEscrutinio = useCallback(async () => {
    if (!escrutinioId) {
      setError('No hay escrutinio activo');
      return;
    }

    setIsCompleting(true);
    try {
      // Subir foto si existe
      await uploadEvidenceIfNeeded();
      
      // Finalizar escrutinio definitivamente
      await axios.post(`/api/escrutinio/${encodeURIComponent(escrutinioId)}/complete`);
      
      // Mostrar modal de éxito
      setShowSuccessModal(true);
    } catch (error: any) {
      console.error('Error completando escrutinio:', error);
      setError(error?.response?.data?.error || 'Error completando escrutinio');
    } finally {
      setIsCompleting(false);
    }
  }, [escrutinioId, actaImage, uploadEvidenceIfNeeded]);

  // Función para revisar escrutinio
  const handleReviewEscrutinio = () => {
    setShowSuccessModal(false);
    router.push(`/revisar/${escrutinioId}`);
  };

  // Función para cerrar escrutinio (pausar)
  const handleCloseEscrutinio = useCallback(async () => {
    if (!escrutinioId) {
      setError('No hay escrutinio activo');
      return;
    }
    setIsClosing(true);
    try {
      await axios.post(`/api/escrutinio/${encodeURIComponent(escrutinioId)}/close`);
      setEscrutinioStatus('CLOSED');
      setIsEscrutinioClosed(true);
    } catch (error: any) {
      console.error('Error cerrando escrutinio:', error);
      setError(error?.response?.data?.error || 'Error cerrando escrutinio');
    } finally {
      setIsClosing(false);
    }
  }, [escrutinioId]);

  // Función para reabrir escrutinio (editar)
  const handleReopenEscrutinio = useCallback(async () => {
    if (!escrutinioId) {
      setError('No hay escrutinio activo');
      return;
    }
    setIsReopening(true);
    try {
      await axios.post(`/api/escrutinio/${encodeURIComponent(escrutinioId)}/reopen`);
      setEscrutinioStatus('COMPLETED');
      setIsEscrutinioClosed(false);
    } catch (error: any) {
      console.error('Error reabriendo escrutinio:', error);
      setError(error?.response?.data?.error || 'Error reabriendo escrutinio');
    } finally {
      setIsReopening(false);
    }
  }, [escrutinioId]);

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
              'active:scale-[0.98] touch-manipulation select-none',
              'bg-white min-h-[60px]' // Altura mínima para mejor toque
            )}
            style={{ borderLeftWidth: 6, borderLeftColor: party.color }}
          >
            <div className="flex-1 p-3 sm:p-4 text-left">
              <div className="flex items-center justify-between">
                <div className="min-w-0 flex-1">
                  <div className="text-sm sm:text-base font-semibold text-gray-900 truncate">{party.fullName}</div>
                  <div className="text-xs sm:text-sm text-gray-600">Casillas {party.slotRange}</div>
                </div>
                <div className="flex items-center gap-2 ml-3">
                  <span className="text-xl sm:text-2xl font-bold tabular-nums" aria-live="polite">
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
    
    // Calcular número de columnas responsive para el grid
    const columns = Math.min(4, party.slots); // Máximo 4 columnas en móvil
    const rows = Math.ceil(party.slots / columns);
    
    return (
      <div className="space-y-4">
        {/* Header with party info and back button - Responsive */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <button
              onClick={handleBack}
              className="p-2 rounded-lg border border-gray-300 hover:bg-gray-50 transition-colors"
              aria-label="Volver a partidos"
            >
              <ArrowLeft className="h-4 w-4" />
            </button>
            <div className="min-w-0 flex-1">
              <h3 className="text-base sm:text-lg font-semibold text-gray-900 truncate">{party.fullName}</h3>
              <p className="text-sm text-gray-600">Selecciona diputado</p>
            </div>
          </div>
          <div className="flex items-center justify-between sm:justify-end gap-4">
            <div className="text-right">
              <div className="text-xl sm:text-2xl font-bold" style={{ color: party.color }}>
                {getTotalPartyCount(expandedParty)}
              </div>
              <div className="text-xs text-gray-500">Total</div>
            </div>
            <button
              onClick={handleBack}
              className="px-4 py-3 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg active:bg-gray-50 transition-colors whitespace-nowrap touch-manipulation select-none min-h-[44px]"
            >
              Partidos
            </button>
          </div>
        </div>

        {/* Dynamic Grid - Responsive */}
        <div className="grid gap-3 grid-cols-3 sm:grid-cols-4 md:grid-cols-5">
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
                  'aspect-square rounded-lg border-2 transition-all duration-150 relative',
                  'active:scale-95 focus:outline-none focus:ring-2 focus:ring-offset-2',
                  'text-sm font-medium flex items-center justify-center',
                  'min-h-[60px] sm:min-h-[70px]', // Más grande para mejor toque
                  'touch-manipulation', // Optimización para touch
                  'select-none', // Evitar selección de texto
                  (isSelected || isApplied)
                    ? 'border-solid shadow-md' 
                    : 'border-dashed'
                )}
                style={{
                  borderColor: party.color,
                  backgroundColor: (isSelected || isApplied)
                    ? `${party.color}25`  // Color para selección actual Y casillas con votos
                    : 'transparent',      // Sin votos = transparente
                  color: isSelected ? party.color : '#374151',
                  '--tw-ring-color': party.color,
                  borderWidth: isSelected ? '3px' : '2px' // Borde más grueso para seleccionadas
                } as React.CSSProperties}
              >
                <div className="flex flex-col items-center justify-center">
                  <span className="font-semibold">{casillaNumber}</span>
                  {totalVoteCount > 0 && (
                    <div 
                      className={clsx(
                        "absolute -top-1 -right-1 w-5 h-5 sm:w-6 sm:h-6 rounded-full text-xs font-bold text-white flex items-center justify-center shadow-lg border-2 border-white",
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

        {/* Papeleta Status and Controls - Moved up for mobile */}
        {papeleta.status === 'OPEN' && (
          <div className="mt-6 p-6 bg-blue-50 rounded-lg border border-blue-200">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <FileText className="h-5 w-5 text-blue-600" />
                <span className="text-sm font-medium text-blue-900">Papeleta número: {papeletaNumber}</span>
              </div>
              <span className="text-sm text-blue-700">
                {papeleta.votesBuffer.length} marca{papeleta.votesBuffer.length !== 1 ? 's' : ''}
              </span>
            </div>
            
            <div className="flex flex-col sm:flex-row gap-2">
              <button
                onClick={handleClosePapeleta}
                disabled={papeletaLoading}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-3 sm:py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-sm font-medium"
              >
                <Check className="h-4 w-4" />
                <span className="hidden sm:inline">Cerrar Papeleta</span>
                <span className="sm:hidden">Cerrar Papeleta</span>
              </button>
              <button
                onClick={handleAnularPapeleta}
                disabled={papeletaLoading}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-3 sm:py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-sm font-medium"
              >
                <X className="h-4 w-4" />
                <span className="hidden sm:inline">Anular Papeleta</span>
                <span className="sm:hidden">Anular Papeleta</span>
              </button>
            </div>
          </div>
        )}

        {/* Legend - Moved down for mobile */}
        <div className="flex flex-col sm:flex-row justify-center gap-3 sm:gap-6 text-xs text-gray-600">
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded border-2 border-dashed" style={{ borderColor: party.color }}></div>
            <span>Sin marcas</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded border-2 border-solid" style={{ borderColor: party.color }}></div>
            <span>Con marcas</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded border-2 border-solid" style={{ borderColor: party.color, backgroundColor: `${party.color}25` }}></div>
            <span>Seleccionado actual</span>
          </div>
        </div>

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
                  Papeleta #{papeletaNumber}
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
      <div className="max-w-4xl mx-auto px-3 sm:px-6 lg:px-8 py-4 lg:py-8 pb-20 sm:pb-8">
        <div className="bg-white p-4 sm:p-6 rounded-lg shadow-sm border">
          <div className="mb-4">
            <h2 className="text-lg font-semibold text-gray-900">
              {expandedParty ? 'Selección de Diputado' : 'Conteo de Diputados'}
            </h2>
            <p className="text-sm text-gray-600">
              {diputadosData.jrv.nombre} - {diputadosData.jrv.departamento}
            </p>
          </div>
          
          {papeleta.status === 'OPEN' ? (
            expandedParty ? renderGrid() : renderPartyCards()
          ) : (
            <div className="text-center py-8">
              <AlertCircle className="h-12 w-12 text-amber-500 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-gray-900 mb-2">No hay papeleta abierta</h3>
              <p className="text-gray-600 mb-4">
                {papeleta.status === null ? 'Inicializando papeleta...' : 'Necesitas abrir una nueva papeleta para comenzar el conteo.'}
              </p>
              {papeleta.status !== null && (
                <button
                  onClick={() => startPapeleta(escrutinioId!, userId!)}
                  disabled={loading}
                  className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors font-medium"
                >
                  {loading ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin mr-2 inline" />
                      Abriendo...
                    </>
                  ) : (
                    'Abrir Nueva Papeleta'
                  )}
                </button>
              )}
            </div>
          )}
          
          {/* Sección de Foto y Cierre de Escrutinio */}
          {!expandedParty && (
            <div className="mt-8 space-y-4">
              {/* Papeleta Status and Controls - Show when papeleta is open */}
              {papeleta.status === 'OPEN' && (
                <div className="p-6 bg-blue-50 rounded-lg border border-blue-200">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <FileText className="h-5 w-5 text-blue-600" />
                      <span className="text-sm font-medium text-blue-900">Papeleta número: {papeletaNumber}</span>
                    </div>
                    <span className="text-sm text-blue-700">
                      {papeleta.votesBuffer.length} marca{papeleta.votesBuffer.length !== 1 ? 's' : ''}
                    </span>
                  </div>
                  
                  <div className="flex flex-col sm:flex-row gap-2">
                    <button
                      onClick={handleClosePapeleta}
                      disabled={papeletaLoading}
                      className="flex-1 flex items-center justify-center gap-2 px-4 py-3 sm:py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-sm font-medium"
                    >
                      <Check className="h-4 w-4" />
                      <span>Cerrar Papeleta</span>
                    </button>
                    <button
                      onClick={handleAnularPapeleta}
                      disabled={papeletaLoading}
                      className="flex-1 flex items-center justify-center gap-2 px-4 py-3 sm:py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-sm font-medium"
                    >
                      <X className="h-4 w-4" />
                      <span>Anular Papeleta</span>
                    </button>
                  </div>
                </div>
              )}

              {/* Control de Escrutinio */}
              <div className="bg-blue-50 p-6 rounded-lg border border-blue-200">
                <h3 className="text-lg font-semibold text-blue-900 mb-3 flex items-center gap-2">
                  <Upload className="h-5 w-5" />
                  Control de Escrutinio
                </h3>
                
                {/* Estado: En progreso - Mostrar botón Cerrar Escrutinio */}
                {escrutinioStatus === 'COMPLETED' && !isEscrutinioClosed && (
                  <>
                    <p className="text-sm text-blue-700 mb-4">
                      Una vez que hayas completado el conteo de todas las papeletas, puedes cerrar el escrutinio para pausar las ediciones.
                    </p>
                    <button
                      onClick={handleCloseEscrutinio}
                      disabled={isClosing}
                      className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-orange-600 text-white rounded-lg hover:bg-orange-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium"
                    >
                      {isClosing ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin" />
                          Cerrando...
                        </>
                      ) : (
                        <>
                          <AlertCircle className="h-4 w-4" />
                          Cerrar Escrutinio
                        </>
                      )}
                    </button>
                  </>
                )}

              {/* Estado: Cerrado - Mostrar solo opción para Editar */}
              {escrutinioStatus === 'CLOSED' && (
                <>
                  <div className="bg-orange-100 border border-orange-300 rounded-lg p-3 mb-4">
                    <div className="flex items-center gap-2 text-orange-800">
                      <AlertCircle className="h-4 w-4" />
                      <span className="font-medium">Escrutinio Cerrado</span>
                    </div>
                    <p className="text-sm text-orange-700 mt-1">
                      Este escrutinio está pausado. Los votos están congelados. Puedes reabrir para editar o finalizar definitivamente después de subir la foto del acta.
                    </p>
                  </div>
                  
                  <button
                    onClick={handleReopenEscrutinio}
                    disabled={isReopening}
                    className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium"
                  >
                    {isReopening ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Reabriendo...
                      </>
                    ) : (
                      <>
                        <FileText className="h-4 w-4" />
                        Editar Escrutinio
                      </>
                    )}
                  </button>
                </>
              )}
              </div>

              {/* Subir Foto del Acta */}
              <div className="bg-gray-50 p-6 rounded-lg border">
                <h3 className="text-lg font-semibold text-gray-900 mb-3 flex items-center gap-2">
                  <Camera className="h-5 w-5" />
                  Foto del Acta
                </h3>
                <div className="space-y-3">
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleActaUpload}
                    className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
                  />
                  {actaImage && (
                    <div className="flex items-center gap-2 text-sm text-green-600">
                      <Check className="h-4 w-4" />
                      <span>Foto seleccionada: {actaImage.name}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Botón Finalizar Escrutinio - Cuando está en progreso o cerrado */}
              {(escrutinioStatus === 'COMPLETED' && !isEscrutinioClosed) || (escrutinioStatus === 'CLOSED') ? (
                <div className="bg-blue-50 p-6 rounded-lg border border-blue-200">
                  <h3 className="text-lg font-semibold text-blue-900 mb-3 flex items-center gap-2">
                    <Check className="h-5 w-5" />
                    Finalizar Escrutinio
                  </h3>
                  <p className="text-sm text-blue-700 mb-4">
                    {escrutinioStatus === 'CLOSED' 
                      ? 'El escrutinio está cerrado. Puedes finalizar definitivamente después de subir la foto del acta.'
                      : 'Una vez que hayas subido la foto del acta, puedes finalizar definitivamente el escrutinio.'
                    }
                  </p>
                  <button
                    onClick={handleCompleteEscrutinio}
                    disabled={isCompleting || isUploading}
                    className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium"
                  >
                    {isCompleting ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Finalizando...
                      </>
                    ) : (
                      <>
                        <Check className="h-4 w-4" />
                        Finalizar Escrutinio
                      </>
                    )}
                  </button>
                </div>
              ) : null}
            </div>
          )}
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

      {/* Vote Limit Alert */}
      <VoteLimitAlert
        isVisible={showVoteLimitAlert}
        currentVotes={getTotalVotesInBuffer()}
        voteLimit={diputadosData?.diputados || 0}
        onClose={handleCloseVoteLimitAlert}
        onClosePapeleta={handleClosePapeletaFromAlert}
        onAnularPapeleta={handleAnularPapeletaFromAlert}
        isClosingPapeleta={isClosingPapeleta}
      />

      {/* Modal de Confirmación de Envío */}
      {showSuccessModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
            <div className="text-center">
              <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-green-100 mb-4">
                <CheckCircle className="h-6 w-6 text-green-600" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                ¡Envío exitoso!
              </h3>
              <p className="text-sm text-gray-600 mb-6">
                El escrutinio legislativo ha sido finalizado correctamente. Los resultados han sido registrados en el sistema.
              </p>
              <div className="flex flex-col sm:flex-row gap-3">
                <button
                  onClick={() => router.push('/dashboard')}
                  className="flex-1 px-4 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300 transition-colors font-medium"
                >
                  Volver al Dashboard
                </button>
                <button
                  onClick={handleReviewEscrutinio}
                  className="flex-1 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors font-medium"
                >
                  Revisar Escrutinio
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
