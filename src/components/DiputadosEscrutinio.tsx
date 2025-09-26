"use client";
import React, { useState, useCallback, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, ArrowRight, Loader2, AlertCircle, Check, X, FileText, Camera, Upload, CheckCircle } from 'lucide-react';
import clsx from 'clsx';
import axios from 'axios';
import { useLegislativeVoteStore } from '@/store/legislativeVoteStore';

// Utility function to generate block-based slot ranges for legislative elections
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
  const [expandedParty, setExpandedParty] = useState<string | null>(null);
  const [animation, setAnimation] = useState<AnimationState>({ show: false, x: 0, y: 0, partyId: '' });
  const [actaImage, setActaImage] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isCompleting, setIsCompleting] = useState(false);
  const [isClosing, setIsClosing] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [escrutinioStatus, setEscrutinioStatus] = useState<'OPEN' | 'CLOSED' | 'COMPLETED'>('OPEN');
  const [isEscrutinioClosed, setIsEscrutinioClosed] = useState(false);

  // Hook para manejar votos legislativos (como el presidencial)
  const { 
    counts, 
    increment, 
    decrement, 
    loadFromServer: loadVotesFromServer,
    getPartyCount,
    getCasillaCount,
    clear: clearVotes
  } = useLegislativeVoteStore();

  // Cargar votos desde servidor al montar el componente (como el presidencial)
  useEffect(() => {
    if (escrutinioId) {
      console.log('📊 [LEGISLATIVE] Cargando votos desde servidor para escrutinio:', escrutinioId);
      loadVotesFromServer(escrutinioId).then(() => {
        console.log('✅ [LEGISLATIVE] Votos cargados desde servidor');
      }).catch((error) => {
        console.error('❌ [LEGISLATIVE] Error cargando votos desde servidor:', error);
      });
    }
  }, [escrutinioId, loadVotesFromServer]);

  // Cargar datos de diputados según la JRV
  useEffect(() => {
    const loadDiputadosData = async () => {
      if (!jrvNumber) {
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        setError(null);

        // USAR EL ENDPOINT CORRECTO QUE YA EXISTÍA Y FUNCIONABA
        const response = await axios.get(`/api/diputados/jrv/${jrvNumber}`);
        if (response.data?.success && response.data.data) {
          const data = response.data.data;
          const diputados = data.department.diputados || 0;
          
          if (diputados === 0) {
            setError('Esta JRV no tiene diputados asignados');
            setLoading(false);
            return;
          }

          // Usar los datos que vienen del endpoint correcto
          const jrvInfo: JRVInfo = {
            jrv: data.jrv.number,
            nombre: data.jrv.location,
            departamento: data.jrv.department,
            diputados: diputados,
            municipio: data.jrv.municipality
          };

          // Usar los partidos que vienen del endpoint
          const parties = data.parties.map((party: any) => ({
            ...party,
            casillas: Array.from({ length: party.slots }, (_, i) => i + 1)
          }));

          setDiputadosData({
            jrv: jrvInfo,
            parties,
            diputados
          });

          console.log('✅ [LEGISLATIVE] Datos de diputados cargados desde endpoint correcto:', { jrvInfo, parties });
        } else {
          setError('No se encontraron datos para esta JRV');
        }
      } catch (err: any) {
        console.error('❌ [LEGISLATIVE] Error cargando datos de diputados:', err);
        setError(err?.response?.data?.error || 'Error cargando datos de la JRV');
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

  // Handle grid slot click - toggle vote using legislative store (like presidential)
  const handleSlotClick = useCallback(async (partyId: string, slotNumber: number, event: React.MouseEvent) => {
    console.log('🖱️ [LEGISLATIVE] Click en casilla:', partyId, slotNumber, 'userId:', userId);
    
    if (!userId || !escrutinioId) {
      console.log('❌ [LEGISLATIVE] Click bloqueado - userId:', userId, 'escrutinioId:', escrutinioId);
      setError('No hay usuario o escrutinio válido');
      return;
    }
    
    if (isEscrutinioClosed) {
      console.log('🔒 [LEGISLATIVE] Click en casilla ignorado - escrutinio cerrado');
      return;
    }

    // Get click position for animation
    const rect = event.currentTarget.getBoundingClientRect();
    const x = rect.left + rect.width / 2;
    const y = rect.top + rect.height / 2;

    // Check if casilla already has votes
    const currentCount = getCasillaCount(partyId, slotNumber);
    const isSelected = currentCount > 0;

    if (isSelected) {
      // Decrement vote
      decrement(partyId, slotNumber, {
        escrutinioId,
        userId,
        mesaId: jrvNumber
      });
      
      console.log('➖ [LEGISLATIVE] Voto decrementado para:', partyId, slotNumber);
    } else {
      // Increment vote
      increment(partyId, slotNumber, {
        escrutinioId,
        userId,
        mesaId: jrvNumber
      });
      
      console.log('➕ [LEGISLATIVE] Voto incrementado para:', partyId, slotNumber);
    }
    
    // Show animation
    setAnimation({
      show: true,
      x,
      y,
      partyId
    });

    // Hide animation after 200ms
    setTimeout(() => {
      setAnimation(prev => ({ ...prev, show: false }));
    }, 200);
  }, [userId, escrutinioId, increment, decrement, getCasillaCount, isEscrutinioClosed, jrvNumber]);

  // Handle back button
  const handleBack = useCallback(() => {
    setExpandedParty(null);
  }, []);

  // Navigation functions
  const handlePreviousParty = useCallback(() => {
    if (!diputadosData || !expandedParty) return;
    const currentIndex = diputadosData.parties.findIndex(p => p.id === expandedParty);
    if (currentIndex > 0) {
      setExpandedParty(diputadosData.parties[currentIndex - 1].id);
    }
  }, [diputadosData, expandedParty]);

  const handleNextParty = useCallback(() => {
    if (!diputadosData || !expandedParty) return;
    const currentIndex = diputadosData.parties.findIndex(p => p.id === expandedParty);
    if (currentIndex < diputadosData.parties.length - 1) {
      setExpandedParty(diputadosData.parties[currentIndex + 1].id);
    }
  }, [diputadosData, expandedParty]);

  // Get party by ID
  const getParty = (partyId: string) => diputadosData?.parties.find(p => p.id === partyId);

  const getTotalPartyCount = useCallback((partyId: string): number => {
    // Usar el store legislativo directamente (como el presidencial)
    const count = getPartyCount(partyId);
    console.log(`📊 [LEGISLATIVE] Partido ${partyId}: total=${count}`);
    return count;
  }, [getPartyCount]);

  const getTotalPartyCountFormatted = useCallback((partyId: string): string => {
    const count = getTotalPartyCount(partyId);
    return count.toString();
  }, [getTotalPartyCount]);

  // Funciones para manejar foto y cierre de escrutinio
  const handleActaUpload = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setActaImage(file);
      console.log('📸 [LEGISLATIVE] Acta seleccionada:', file.name);
    }
  }, []);

  const uploadEvidenceIfNeeded = useCallback(async (): Promise<string | null> => {
    if (!actaImage || !escrutinioId) {
      console.log('📸 [LEGISLATIVE] No hay acta para subir');
      return null;
    }

    try {
      setIsUploading(true);
      console.log('📸 [LEGISLATIVE] Subiendo acta...');

      // Intentar subir a S3 primero
      const presignResponse = await axios.post('/api/upload/presign', {
        escrutinioId,
        fileName: actaImage.name,
        contentType: actaImage.type
      });

      if (presignResponse.data?.success && presignResponse.data.presignedUrl) {
        const { presignedUrl, publicUrl } = presignResponse.data;
        
        // Subir archivo a S3
        await axios.put(presignedUrl, actaImage, {
          headers: { 'Content-Type': actaImage.type }
        });

        console.log('📸 [LEGISLATIVE] Acta subida a S3:', publicUrl);
        return publicUrl;
      }
    } catch (error) {
      console.error('📸 [LEGISLATIVE] Error subiendo a S3:', error);
    }

    // Fallback: convertir a dataUrl
    try {
      console.log('📸 [LEGISLATIVE] Usando fallback: convirtiendo a dataUrl');
      const toDataUrl = (file: File): Promise<string> => {
        return new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result as string);
          reader.onerror = reject;
          reader.readAsDataURL(file);
        });
      };
      
      const dataUrl = await toDataUrl(actaImage);
      console.log('📸 [LEGISLATIVE] Fallback exitoso, dataUrl length:', dataUrl.length);
      return dataUrl;
    } catch (error) {
      console.error('📸 [LEGISLATIVE] Fallback también falló:', error);
    } finally {
      setIsUploading(false);
    }

    return null;
  }, [actaImage, escrutinioId]);

  const handleCompleteEscrutinio = useCallback(async () => {
    if (!escrutinioId) {
      setError('No hay escrutinio activo');
      return;
    }

    setIsCompleting(true);
    try {
      // 1. Subir foto si existe
      await uploadEvidenceIfNeeded();
      
      // 2. Finalizar escrutinio definitivamente
      await axios.post(`/api/escrutinio/${encodeURIComponent(escrutinioId)}/complete`);
      
      // 3. Mostrar modal de éxito
      setShowSuccessModal(true);
    } catch (error: any) {
      console.error('Error completando escrutinio:', error);
      setError(error?.response?.data?.error || 'Error completando escrutinio');
    } finally {
      setIsCompleting(false);
    }
  }, [escrutinioId, uploadEvidenceIfNeeded]);

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
    
    console.log('🔄 [LEGISLATIVE] Cerrando escrutinio:', escrutinioId);
    setIsClosing(true);
    setError(null);
    
    try {
      // Cerrar escrutinio (los votos ya están guardados por el store)
      const response = await axios.post(`/api/escrutinio/${escrutinioId}/close`);
      console.log('✅ [LEGISLATIVE] Escrutinio cerrado exitosamente:', response.data);
      
      setEscrutinioStatus('CLOSED');
      setIsEscrutinioClosed(true);
    } catch (error: any) {
      console.error('❌ [LEGISLATIVE] Error cerrando escrutinio:', error);
      const errorMessage = error?.response?.data?.error || error?.message || 'Error cerrando escrutinio';
      setError(errorMessage);
      alert(`Error cerrando escrutinio: ${errorMessage}`);
    } finally {
      setIsClosing(false);
    }
  }, [escrutinioId]);

  // Render grid for expanded party
  const renderGrid = () => {
    if (!expandedParty || !diputadosData) return null;
    
    const party = getParty(expandedParty);
    if (!party) return null;

    const currentIndex = diputadosData.parties.findIndex(p => p.id === expandedParty);
    const prevParty = currentIndex > 0 ? diputadosData.parties[currentIndex - 1] : null;
    const nextParty = currentIndex < diputadosData.parties.length - 1 ? diputadosData.parties[currentIndex + 1] : null;

    const columns = Math.min(party.slots, 8);
    const rows = Math.ceil(party.slots / columns);
    
    return (
      <div className="space-y-4">
        {/* Party Navigation Numbers */}
        <div className="flex justify-center mb-4">
          <div className="flex items-center gap-2">
            {diputadosData?.parties.map((p, index) => {
              const isCurrent = p.id === expandedParty;
              const isPrevious = index === (diputadosData.parties.findIndex(party => party.id === expandedParty) - 1);
              const isNext = index === (diputadosData.parties.findIndex(party => party.id === expandedParty) + 1);
              
              return (
                <div
                  key={p.id}
                  className={clsx(
                    "w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium transition-colors",
                    isCurrent 
                      ? "bg-blue-600 text-white" 
                      : isPrevious || isNext
                        ? "bg-gray-200 text-gray-600"
                        : "bg-gray-100 text-gray-400"
                  )}
                >
                  {index + 1}
                </div>
              );
            })}
          </div>
        </div>

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
          
          {/* Centered Navigation arrows */}
          <div className="flex items-center gap-2">
            <button
              onClick={handlePreviousParty}
              disabled={!diputadosData || diputadosData.parties.findIndex(p => p.id === expandedParty) === 0}
              className="flex items-center gap-2 px-3 py-2 rounded-lg border border-gray-300 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              aria-label="Partido anterior"
            >
              <ArrowLeft className="h-4 w-4" />
              <span className="text-sm font-medium hidden sm:inline">
                {(() => {
                  if (!diputadosData || !expandedParty) return '';
                  const currentIndex = diputadosData.parties.findIndex(p => p.id === expandedParty);
                  if (currentIndex > 0) {
                    const prevParty = diputadosData.parties[currentIndex - 1];
                    const firstCasilla = prevParty.casillas[0];
                    const lastCasilla = prevParty.casillas[prevParty.casillas.length - 1];
                    return `${prevParty.fullName} (${firstCasilla}-${lastCasilla})`;
                  }
                  return '';
                })()}
              </span>
            </button>
            <button
              onClick={handleNextParty}
              disabled={!diputadosData || diputadosData.parties.findIndex(p => p.id === expandedParty) === diputadosData.parties.length - 1}
              className="flex items-center gap-2 px-3 py-2 rounded-lg border border-gray-300 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              aria-label="Siguiente partido"
            >
              <span className="text-sm font-medium hidden sm:inline">
                {(() => {
                  if (!diputadosData || !expandedParty) return '';
                  const currentIndex = diputadosData.parties.findIndex(p => p.id === expandedParty);
                  if (currentIndex < diputadosData.parties.length - 1) {
                    const nextParty = diputadosData.parties[currentIndex + 1];
                    const firstCasilla = nextParty.casillas[0];
                    const lastCasilla = nextParty.casillas[nextParty.casillas.length - 1];
                    return `${nextParty.fullName} (${firstCasilla}-${lastCasilla})`;
                  }
                  return '';
                })()}
              </span>
              <ArrowRight className="h-4 w-4" />
            </button>
          </div>
          
          <div className="flex items-center justify-between sm:justify-end gap-4">
            <div className="text-right">
              <div className="text-xl sm:text-2xl font-bold" style={{ color: party.color }}>
                {getTotalPartyCountFormatted(expandedParty)}
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
        <div className="grid gap-3 grid-cols-4 sm:grid-cols-5 md:grid-cols-6 lg:grid-cols-7 xl:grid-cols-8">
          {party.casillas.map((casillaNumber, index) => {
            const totalVoteCount = getCasillaCount(expandedParty, casillaNumber);
            const isSelected = totalVoteCount > 0;
            
            return (
              <button
                key={casillaNumber}
                onClick={(e) => handleSlotClick(expandedParty, casillaNumber, e)}
                className={clsx(
                  'aspect-square rounded-lg border-2 transition-all duration-150 relative',
                  'focus:outline-none focus:ring-2 focus:ring-offset-2',
                  'text-sm font-medium flex items-center justify-center',
                  'min-h-[60px] sm:min-h-[70px]',
                  'touch-manipulation',
                  'select-none',
                  isEscrutinioClosed 
                    ? 'opacity-50 cursor-not-allowed'
                    : 'active:scale-95',
                  isSelected
                    ? 'border-solid shadow-md' 
                    : 'border-dashed'
                )}
                style={{
                  borderColor: party.color,
                  backgroundColor: isSelected
                    ? `${party.color}25`
                    : 'transparent',
                  color: isSelected ? party.color : '#374151',
                  '--tw-ring-color': party.color,
                  borderWidth: isSelected ? '3px' : '2px'
                } as React.CSSProperties}
              >
                <div className="flex flex-col items-center justify-center">
                  <span className="font-semibold">{casillaNumber}</span>
                  {totalVoteCount > 0 && (
                    <div 
                      className={clsx(
                        "absolute -top-1 -right-1 w-5 h-5 sm:w-6 sm:h-6 rounded-full text-xs font-bold text-white flex items-center justify-center shadow-lg border-2 border-white",
                        isSelected ? "bg-blue-600" : "bg-gray-500"
                      )}
                      style={{ backgroundColor: party.color }}
                    >
                      {totalVoteCount}
                    </div>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      </div>
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
          <p className="text-gray-600">Cargando datos de diputados...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="flex flex-col items-center gap-4 text-center">
          <AlertCircle className="h-12 w-12 text-red-500" />
          <div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Error</h3>
            <p className="text-gray-600">{error}</p>
          </div>
        </div>
      </div>
    );
  }

  if (!diputadosData) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="flex flex-col items-center gap-4 text-center">
          <AlertCircle className="h-12 w-12 text-gray-400" />
          <div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">No hay datos</h3>
            <p className="text-gray-600">No se encontraron datos para esta JRV</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto p-4 sm:p-6">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-2">
          Marcas por Diputado - JRV {diputadosData.jrv.jrv}
        </h1>
        <p className="text-gray-600">
          {diputadosData.jrv.nombre} • {diputadosData.jrv.departamento}
        </p>
        <p className="text-sm text-gray-500">
          {diputadosData.diputados} diputados • {diputadosData.parties.length} partidos
        </p>
      </div>

      {/* Animation */}
      {animation.show && (
        <div
          className="fixed pointer-events-none z-50"
          style={{
            left: animation.x - 20,
            top: animation.y - 20,
            transform: 'translate(-50%, -50%)',
          }}
        >
          <div className="w-10 h-10 bg-blue-500 rounded-full flex items-center justify-center text-white font-bold animate-ping">
            +
          </div>
        </div>
      )}

      {/* Main Content */}
      {!expandedParty ? (
        // Party Selection View
        <div className="space-y-4">
          {diputadosData.parties.map((party) => (
            <div key={party.id}>
              <div
                className="w-full flex items-center rounded-lg border focus:outline-none focus:ring-2 transition-transform bg-gray-50 opacity-60 cursor-pointer"
                onClick={() => handlePartyClick(party.id)}
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
                        {getTotalPartyCountFormatted(party.id)}
                      </span>
                      <div className="text-sm text-gray-500">+</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        // Grid View
        renderGrid()
      )}

      {/* Action Cards */}
      <div className="mt-8 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Cerrar Escrutinio */}
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="flex items-center gap-3 mb-3">
            <div className="p-2 bg-orange-100 rounded-lg">
              <X className="h-5 w-5 text-orange-600" />
            </div>
            <div>
              <h3 className="font-semibold text-gray-900">Cerrar Escrutinio</h3>
              <p className="text-sm text-gray-600">Pausar temporalmente</p>
            </div>
          </div>
          <button
            onClick={handleCloseEscrutinio}
            disabled={isClosing || isEscrutinioClosed}
            className="w-full px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {isClosing ? <Loader2 className="h-4 w-4 animate-spin mx-auto" /> : 'Cerrar Escrutinio'}
          </button>
        </div>

        {/* Foto del Acta */}
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="flex items-center gap-3 mb-3">
            <div className="p-2 bg-blue-100 rounded-lg">
              <Camera className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <h3 className="font-semibold text-gray-900">Foto del Acta</h3>
              <p className="text-sm text-gray-600">Subir evidencia</p>
            </div>
          </div>
          <input
            type="file"
            accept="image/*"
            onChange={handleActaUpload}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
          />
          {actaImage && (
            <p className="text-xs text-green-600 mt-1">✓ {actaImage.name}</p>
          )}
        </div>

        {/* Enviar Resultados */}
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="flex items-center gap-3 mb-3">
            <div className="p-2 bg-green-100 rounded-lg">
              <Check className="h-5 w-5 text-green-600" />
            </div>
            <div>
              <h3 className="font-semibold text-gray-900">Enviar Resultados</h3>
              <p className="text-sm text-gray-600">Finalizar escrutinio</p>
            </div>
          </div>
          <button
            onClick={handleCompleteEscrutinio}
            disabled={isCompleting || isEscrutinioClosed}
            className="w-full px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {isCompleting ? <Loader2 className="h-4 w-4 animate-spin mx-auto" /> : 'Enviar Resultados'}
          </button>
        </div>

        {/* Control de Escrutinio */}
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="flex items-center gap-3 mb-3">
            <div className="p-2 bg-purple-100 rounded-lg">
              <FileText className="h-5 w-5 text-purple-600" />
            </div>
            <div>
              <h3 className="font-semibold text-gray-900">Control</h3>
              <p className="text-sm text-gray-600">Estado del escrutinio</p>
            </div>
          </div>
          <div className="text-sm">
            <p className="text-gray-600">Estado: <span className="font-medium">{escrutinioStatus}</span></p>
            <p className="text-gray-600">Total votos: <span className="font-medium">{Object.values(counts).reduce((sum, count) => sum + count, 0)}</span></p>
          </div>
        </div>
      </div>

      {/* Success Modal */}
      {showSuccessModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg p-6 max-w-md w-full">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 bg-green-100 rounded-lg">
                <CheckCircle className="h-6 w-6 text-green-600" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-900">¡Escrutinio Completado!</h3>
                <p className="text-sm text-gray-600">Los resultados han sido enviados exitosamente</p>
              </div>
            </div>
            <div className="flex gap-3">
              <button
                onClick={handleReviewEscrutinio}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                Revisar Resultados
              </button>
              <button
                onClick={() => setShowSuccessModal(false)}
                className="flex-1 px-4 py-2 bg-gray-300 text-gray-700 rounded-lg hover:bg-gray-400 transition-colors"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
