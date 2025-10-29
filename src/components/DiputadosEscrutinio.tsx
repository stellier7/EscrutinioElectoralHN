"use client";
import React, { useState, useCallback, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, ArrowRight, Loader2, AlertCircle, Check, X, FileText, Camera, Upload, CheckCircle, Edit } from 'lucide-react';
import clsx from 'clsx';
import axios from 'axios';
import { useLegislativeVoteStore } from '@/store/legislativeVoteStore';
import { VoteLimitAlert } from './ui/VoteLimitAlert';
import { getTransparentColor } from '@/lib/party-config';
import { useEscrutinioPersistence } from '@/hooks/useEscrutinioPersistence';

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
  onEscrutinioStatusChange?: (status: 'PENDING' | 'IN_PROGRESS' | 'CLOSED' | 'COMPLETED') => void;
}

export default function DiputadosEscrutinio({ jrvNumber, escrutinioId, userId, onEscrutinioStatusChange }: DiputadosEscrutinioProps) {
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
  const [showNoPhotoWarning, setShowNoPhotoWarning] = useState(false);

  // Hook de persistencia del escrutinio
  const { 
    escrutinioState, 
    saveState 
  } = useEscrutinioPersistence();

  const [isCheckingStatus, setIsCheckingStatus] = useState(true);
  
  // Ref para trackear el último escrutinioId y solo limpiar si cambia (nuevo escrutinio)
  // Inicializar desde localStorage de inmediato si está disponible
  const getInitialLastEscrutinioId = (): string | null => {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('last-legislative-escrutinio-id');
      if (stored) {
        console.log('📦 Último escrutinio legislativo cargado desde localStorage:', stored);
        return stored;
      }
    }
    return null;
  };
  const lastEscrutinioIdRef = useRef<string | null>(getInitialLastEscrutinioId());
  const isStateInitializedRef = useRef(false);
  const isInitializingRef = useRef(true); // Prevenir guardado durante inicialización

  // Verificar estado del escrutinio al cargar
  useEffect(() => {
    const checkEscrutinioStatus = async () => {
      if (!escrutinioId) {
        setIsCheckingStatus(false);
        return;
      }
      
      try {
        setIsCheckingStatus(true);
        const token = localStorage.getItem('auth-token');
        const response = await axios.get(
          `/api/escrutinio/${escrutinioId}/status`,
          { headers: { 'Authorization': `Bearer ${token}` } }
        );
        
        if (response.data?.success) {
          const status = response.data.data.status;
          console.log('📊 [LEGISLATIVE] Status del escrutinio:', status);
          
          // Si el escrutinio está CLOSED o COMPLETED, bloquear la interfaz
          if (status === 'CLOSED') {
            setIsEscrutinioClosed(true);
            setEscrutinioStatus('CLOSED');
            console.log('🔒 [LEGISLATIVE] Escrutinio cerrado - bloqueando interfaz');
            onEscrutinioStatusChange?.(status);
          } else if (status === 'COMPLETED') {
            setIsEscrutinioClosed(true);
            setEscrutinioStatus('COMPLETED');
            console.log('✅ [LEGISLATIVE] Escrutinio completado - bloqueando interfaz');
            onEscrutinioStatusChange?.(status);
          } else {
            // Notificar status activo también
            onEscrutinioStatusChange?.(status);
          }
        }
      } catch (error) {
        console.error('❌ Error verificando status del escrutinio:', error);
      } finally {
        setIsCheckingStatus(false);
      }
    };
    
    checkEscrutinioStatus();
  }, [escrutinioId]);
  
  // Estados para sistema de papeletas simplificado
  const [currentPapeleta, setCurrentPapeleta] = useState(1);
  const [completedPapeletasCount, setCompletedPapeletasCount] = useState(0);
  const [papeletaVotes, setPapeletaVotes] = useState<{[key: string]: number}>({});
  const [showVoteLimitAlert, setShowVoteLimitAlert] = useState(false);
  const [showAnularConfirmation, setShowAnularConfirmation] = useState(false);

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

  // Cargar votos desde servidor - solo limpiar si es un NUEVO escrutinio
  useEffect(() => {
    if (escrutinioId) {
      // Solo limpiar si es un NUEVO escrutinio (diferente al anterior)
      if (lastEscrutinioIdRef.current !== escrutinioId) {
        console.log('🔄 [LEGISLATIVE] Nuevo escrutinio detectado, limpiando store local...');
        console.log('📊 [LEGISLATIVE] Escrutinio anterior:', lastEscrutinioIdRef.current, '→ Nuevo:', escrutinioId);
        clearVotes(); // Limpiar solo si es un nuevo escrutinio
        lastEscrutinioIdRef.current = escrutinioId;
        // Guardar en localStorage para persistir entre refrescos
        if (typeof window !== 'undefined') {
          localStorage.setItem('last-legislative-escrutinio-id', escrutinioId);
        }
        // Resetear flags de inicialización para permitir que se restaure el estado
        isStateInitializedRef.current = false;
        isInitializingRef.current = true; // Permitir inicialización del nuevo escrutinio
      } else {
        console.log('🔄 [LEGISLATIVE] Mismo escrutinio, manteniendo votos del store');
      }
      
      console.log('📊 [LEGISLATIVE] Cargando votos desde servidor para escrutinio:', escrutinioId);
      loadVotesFromServer(escrutinioId).then(() => {
        console.log('✅ [LEGISLATIVE] Votos cargados desde servidor');
      }).catch((error) => {
        console.error('❌ [LEGISLATIVE] Error cargando votos desde servidor:', error);
      });
    } else {
      // Si no hay escrutinioId, resetear los refs
      lastEscrutinioIdRef.current = null;
      isStateInitializedRef.current = false;
      isInitializingRef.current = false;
      if (typeof window !== 'undefined') {
        localStorage.removeItem('last-legislative-escrutinio-id');
      }
    }
  }, [escrutinioId, loadVotesFromServer, clearVotes]);

  // Inicializar papeleta desde estado persistido o default (SOLO cuando el estado está disponible)
  useEffect(() => {
    // Solo inicializar si tenemos escrutinioId y userId, y aún no se ha inicializado
    // Y también verificar que el escrutinioId del estado coincide con el prop
    // IMPORTANTE: Verificar que el estado NO sea undefined/null para asegurar que se cargó desde localStorage
    const hasLoadedState = escrutinioState.escrutinioId !== null && escrutinioState.escrutinioId !== undefined;
    const isStateReady = escrutinioId && userId && !isStateInitializedRef.current && escrutinioState.escrutinioId === escrutinioId && hasLoadedState;
    
    if (isStateReady) {
      // CRÍTICO: Establecer flag de inicialización ANTES de restaurar para prevenir guardado prematuro
      isInitializingRef.current = true;
      
      // Leer directamente desde localStorage como fuente principal (el hook puede no haber cargado aún)
      let localStorageState: any = null;
      try {
        const stored = localStorage.getItem('escrutinio-state');
        if (stored) {
          localStorageState = JSON.parse(stored);
        }
      } catch (error) {
        console.warn('Error leyendo localStorage:', error);
      }
      
      console.log('🔄 Inicializando papeleta simplificada...');
      console.log('📦 Estado desde hook:', {
        papeleta: escrutinioState.legislativeCurrentPapeleta,
        party: escrutinioState.legislativeExpandedParty,
        votes: escrutinioState.legislativePapeletaVotes,
        completed: escrutinioState.legislativeCompletedPapeletas
      });
      console.log('📦 Estado desde localStorage:', localStorageState);
      
      // Usar localStorage como fuente principal, fallback al hook si localStorage no tiene los valores
      const persistedPapeleta = localStorageState?.legislativeCurrentPapeleta ?? escrutinioState.legislativeCurrentPapeleta;
      const persistedParty = localStorageState?.legislativeExpandedParty ?? escrutinioState.legislativeExpandedParty;
      const persistedVotes = localStorageState?.legislativePapeletaVotes ?? escrutinioState.legislativePapeletaVotes;
      const persistedCompletedCount = localStorageState?.legislativeCompletedPapeletas ?? escrutinioState.legislativeCompletedPapeletas;
      
      // Restaurar número de papeleta (aceptar cualquier número >= 1)
      if (persistedPapeleta !== undefined && persistedPapeleta !== null && persistedPapeleta >= 1) {
        console.log('📦 Restaurando papeleta desde estado persistido:', persistedPapeleta);
        setCurrentPapeleta(persistedPapeleta);
      } else {
        console.log('📦 No hay papeleta persistida válida, inicializando en 1');
        setCurrentPapeleta(1);
      }
      
      // Restaurar partido expandido
      if (persistedParty !== undefined && persistedParty !== null) {
        console.log('📦 Restaurando partido expandido:', persistedParty);
        setExpandedParty(persistedParty);
      }
      
      // CRÍTICO: Restaurar marcas si existen
      // Usar localStorage como fuente principal
      if (persistedVotes !== undefined && persistedVotes !== null) {
        if (Object.keys(persistedVotes).length > 0) {
          console.log('📦 Restaurando marcas desde estado persistido:', persistedVotes);
          setPapeletaVotes(persistedVotes);
        } else {
          console.log('📦 Estado persistido indica marcas vacías, inicializando vacío');
          setPapeletaVotes({});
        }
      } else {
        console.log('⏸️ Esperando que el estado se cargue completamente...');
        // No hacer nada aún, el estado aún no está completamente cargado
        isInitializingRef.current = false; // Resetear flag si no podemos restaurar
        return;
      }
      
      // Restaurar contador de papeletas completadas (aceptar 0 también)
      if (persistedCompletedCount !== undefined && persistedCompletedCount !== null && persistedCompletedCount >= 0) {
        console.log('📦 Restaurando papeletas completadas:', persistedCompletedCount);
        setCompletedPapeletasCount(persistedCompletedCount);
      } else {
        console.log('📦 No hay contador persistido válido, inicializando en 0');
        setCompletedPapeletasCount(0);
      }
      
      // Marcar como inicializado SOLO después de restaurar todos los valores
      isStateInitializedRef.current = true;
      
      // CRÍTICO: Establecer flag de inicialización en false DESPUÉS de restaurar todo
      // Usar setTimeout para asegurar que todos los setState se hayan procesado
      setTimeout(() => {
        isInitializingRef.current = false;
        console.log('✅ Inicialización completada, persistencia habilitada');
      }, 100);
    } else if (!escrutinioId) {
      // Resetear flags si no hay escrutinioId
      isStateInitializedRef.current = false;
      isInitializingRef.current = false;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [escrutinioId, userId, escrutinioState.escrutinioId, escrutinioState.legislativeCurrentPapeleta, escrutinioState.legislativePapeletaVotes, escrutinioState.legislativeCompletedPapeletas]);

  // Persistir estado de papeleta cuando cambia
  useEffect(() => {
    // CRÍTICO: NO guardar durante la inicialización para evitar sobrescribir valores correctos
    if (isInitializingRef.current) {
      console.log('⏸️ Persistencia pausada durante inicialización');
      return;
    }
    
    if (escrutinioId) {
      console.log('💾 Guardando estado de papeleta:', {
        papeleta: currentPapeleta,
        party: expandedParty,
        votes: papeletaVotes,
        completed: completedPapeletasCount
      });
      saveState({
        legislativeCurrentPapeleta: currentPapeleta,
        legislativeExpandedParty: expandedParty,
        legislativePapeletaVotes: papeletaVotes,
        legislativeCompletedPapeletas: completedPapeletasCount
      });
    }
  }, [currentPapeleta, expandedParty, papeletaVotes, completedPapeletasCount, escrutinioId, saveState]);

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
        const token = localStorage.getItem('auth-token');
        const response = await axios.get(`/api/diputados/jrv/${jrvNumber}`, {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });
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

          // Usar los partidos que vienen del endpoint (mantener casillas originales)
          const parties = data.parties.map((party: any) => ({
            ...party
            // No sobrescribir casillas - usar las que vienen del API
          }));

          setDiputadosData({
            jrv: jrvInfo,
            parties,
            diputados
          });

          console.log('✅ [LEGISLATIVE] Datos de diputados cargados desde endpoint correcto:', { jrvInfo, parties });
          
          // Debug: Log de cada partido y sus casillas
          parties.forEach((party: any) => {
            console.log(`🔍 [DEBUG] Partido ${party.fullName}:`, {
              id: party.id,
              slots: party.slots,
              slotRange: party.slotRange,
              casillas: party.casillas
            });
          });
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
    console.log('🖱️ [LEGISLATIVE] Click en casilla:', partyId, slotNumber);
    
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

    // Check if this slot already has a vote in the current papeleta
    const voteKey = `${partyId}-${slotNumber}`;
    const currentVoteCount = papeletaVotes[voteKey] || 0;

    // TOGGLE: If already has a vote, remove it (toggle off)
    if (currentVoteCount > 0) {
      console.log('➖ [LEGISLATIVE] Quitando voto (toggle off):', partyId, slotNumber);
      
      // Remove vote from current papeleta
      setPapeletaVotes(prev => {
        const newVotes = { ...prev };
        delete newVotes[voteKey];
        return newVotes;
      });

      // Also remove from main store
      decrement(partyId, slotNumber, {
        escrutinioId: escrutinioId!,
        userId: userId!,
        mesaId: diputadosData?.jrv.jrv
      });

      return;
    }

    // If no vote yet, check vote limit before adding
    const voteLimit = diputadosData?.diputados || 0;
    const currentVotes = Object.values(papeletaVotes).reduce((sum, count) => sum + count, 0);

    if (currentVotes >= voteLimit) {
      console.log('⚠️ [LEGISLATIVE] Límite de votos alcanzado en papeleta');
      setShowVoteLimitAlert(true);
      return;
    }

    // Add vote to current papeleta (toggle on)
    console.log('➕ [LEGISLATIVE] Agregando voto (toggle on):', partyId, slotNumber);
    
    setPapeletaVotes(prev => ({
      ...prev,
      [voteKey]: 1
    }));

    // Also add to main store for persistence
    increment(partyId, slotNumber, {
      escrutinioId: escrutinioId!,
      userId: userId!,
      mesaId: diputadosData?.jrv.jrv
    });
    
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
  }, [userId, escrutinioId, papeletaVotes, diputadosData, isEscrutinioClosed, increment, decrement]);

  // Funciones de utilidad para conteo de votos
  const getCasillaVoteCount = useCallback((partyId: string, slotNumber: number) => {
    const voteKey = `${partyId}-${slotNumber}`;
    return papeletaVotes[voteKey] || 0;
  }, [papeletaVotes]);

  const getTotalVotesInPapeleta = useCallback(() => {
    if (!diputadosData) return 0;
    
    let total = 0;
    
    // ✅ Loop through ALL parties
    diputadosData.parties.forEach(party => {
      if (!party.casillas) return;
      
      // Count marks for each casilla in this party
      party.casillas.forEach(casillaNumber => {
        const voteKey = `${party.id}-${casillaNumber}`;
        
        // Count from papeletaVotes (current papeleta, not yet saved)
        const localVotes = papeletaVotes[voteKey] || 0;
        
        total += localVotes;
      });
    });
    
    return total;
  }, [diputadosData, papeletaVotes]);

  // Funciones para manejo de papeletas simplificado
  const handleClosePapeleta = useCallback(async () => {
    console.log('✅ Papeleta cerrada exitosamente');
    setShowVoteLimitAlert(false);
    
    // Increment completed papeletas counter
    const totalVotes = getTotalVotesInPapeleta();
    const maxVotes = diputadosData?.diputados || 0;
    
    // If papeleta is complete (8/8), increment completed counter
    if (totalVotes === maxVotes) {
      setCompletedPapeletasCount(prev => prev + 1);
      console.log('📊 Papeleta completada, contador incrementado');
    }
    
    // Regresar al primer partido (Demócrata Cristiano)
    if (diputadosData?.parties && diputadosData.parties.length > 0) {
      setExpandedParty(diputadosData.parties[0].id);
      console.log('🔄 Regresando al primer partido:', diputadosData.parties[0].id);
    }
    
    // Crear nueva papeleta automáticamente
    console.log('🔄 Creando nueva papeleta...');
    setCurrentPapeleta(prev => prev + 1);
    setPapeletaVotes({});
    console.log('✅ Nueva papeleta creada');
  }, [diputadosData, getTotalVotesInPapeleta]);

  const handleAnularPapeleta = useCallback(async () => {
    console.log('✅ Papeleta anulada exitosamente');
    setShowAnularConfirmation(false);
    setShowVoteLimitAlert(false);
    
    // Remover votos de la papeleta actual del store principal
    Object.entries(papeletaVotes).forEach(([voteKey, count]) => {
      const [partyId, slotNumber] = voteKey.split('-');
      for (let i = 0; i < count; i++) {
        decrement(partyId, parseInt(slotNumber), {
          escrutinioId: escrutinioId!,
          userId: userId!,
          mesaId: diputadosData?.jrv.jrv
        });
      }
    });
    
    // Limpiar votos de la papeleta actual
    setPapeletaVotes({});
    
    // Crear nueva papeleta automáticamente
    console.log('🔄 Creando nueva papeleta después de anular...');
    setCurrentPapeleta(prev => prev + 1);
    console.log('✅ Nueva papeleta creada');
  }, [papeletaVotes, decrement]);

  const handleCloseVoteLimitAlert = useCallback(() => {
    setShowVoteLimitAlert(false);
  }, []);

  const handleClosePapeletaFromAlert = useCallback(() => {
    handleClosePapeleta();
  }, [handleClosePapeleta]);

  const handleAnularPapeletaFromAlert = useCallback(() => {
    setShowAnularConfirmation(true);
  }, []);

  // Handle back button
  const handleBack = useCallback(() => {
    setExpandedParty(null);
  }, []);

  // Navigation functions
  const handlePreviousParty = useCallback(() => {
    if (!diputadosData || !expandedParty || !diputadosData.parties || !Array.isArray(diputadosData.parties) || diputadosData.parties.length === 0) return;
    const currentIndex = diputadosData.parties.findIndex(p => p.id === expandedParty);
    if (currentIndex > 0) {
      setExpandedParty(diputadosData.parties[currentIndex - 1].id);
    }
  }, [diputadosData, expandedParty]);

  const handleNextParty = useCallback(() => {
    if (!diputadosData || !expandedParty || !diputadosData.parties || !Array.isArray(diputadosData.parties) || diputadosData.parties.length === 0) return;
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

    // Validar token antes de proceder
    const token = localStorage.getItem('auth-token');
    if (!token) {
      console.error('📸 [LEGISLATIVE] No hay token de autenticación');
      throw new Error('No hay token de autenticación. Por favor inicia sesión nuevamente.');
    }

    try {
      setIsUploading(true);
      console.log('📸 [LEGISLATIVE] Subiendo acta...');

      // Intentar subir a S3 primero
      const presignResponse = await axios.post('/api/upload/presign', {
        escrutinioId,
        fileName: actaImage.name,
        contentType: actaImage.type || 'image/jpeg'
      }, {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      console.log('📸 [LEGISLATIVE] Presign response:', presignResponse.data);

      if (presignResponse.data?.success && presignResponse.data.data) {
        const { uploadUrl, publicUrl } = presignResponse.data.data as { uploadUrl: string; publicUrl: string };
        
        if (!uploadUrl || !publicUrl) {
          throw new Error('URLs de presign inválidas');
        }
        
        console.log('📸 [LEGISLATIVE] Uploading to:', uploadUrl.substring(0, 50) + '...');
        
        // Subir archivo a S3
        const uploadResponse = await fetch(uploadUrl, {
          method: 'PUT',
          headers: { 'Content-Type': actaImage.type || 'image/jpeg' },
          body: actaImage
        });

        if (!uploadResponse.ok) {
          throw new Error(`Error subiendo archivo a S3: ${uploadResponse.status} ${uploadResponse.statusText}`);
        }

        console.log('📸 [LEGISLATIVE] Acta subida a S3:', publicUrl);
        
        // Guardar la URL en la base de datos
        try {
          const evidenceResponse = await axios.post(`/api/escrutinio/${encodeURIComponent(escrutinioId)}/evidence`, 
            { publicUrl }, 
            { headers: { 'Authorization': `Bearer ${token}` } }
          );
          
          if (evidenceResponse.data?.success) {
            console.log('📸 [LEGISLATIVE] URL guardada exitosamente en base de datos');
          } else {
            console.warn('📸 [LEGISLATIVE] URL guardada pero respuesta no exitosa:', evidenceResponse.data);
          }
        } catch (error: any) {
          console.error('📸 [LEGISLATIVE] Error guardando URL en DB:', error);
          // Continuar aunque falle el guardado de evidence, ya tenemos la URL
        }
        
        setIsUploading(false);
        return publicUrl;
      } else {
        throw new Error('Respuesta de presign inválida o sin éxito');
      }
    } catch (error: any) {
      console.error('📸 [LEGISLATIVE] Error subiendo a S3:', error);
      setIsUploading(false);
      // Continuar con fallback
    }

    // Fallback: convertir a dataUrl
    try {
      console.log('📸 [LEGISLATIVE] Usando fallback: convirtiendo a dataUrl');
      setIsUploading(true);
      
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
      
      // Guardar la URL en la base de datos
      try {
        const token = localStorage.getItem('auth-token');
        if (token) {
          const evidenceResponse = await axios.post(`/api/escrutinio/${encodeURIComponent(escrutinioId)}/evidence`, 
            { publicUrl: dataUrl }, 
            { headers: { 'Authorization': `Bearer ${token}` } }
          );
          
          if (evidenceResponse.data?.success) {
            console.log('📸 [LEGISLATIVE] DataURL guardada exitosamente en base de datos');
          } else {
            console.warn('📸 [LEGISLATIVE] DataURL guardada pero respuesta no exitosa:', evidenceResponse.data);
          }
        }
      } catch (error: any) {
        console.error('📸 [LEGISLATIVE] Error guardando DataURL en DB:', error);
        // Continuar aunque falle el guardado
      }
      
      setIsUploading(false);
      return dataUrl;
    } catch (error: any) {
      console.error('📸 [LEGISLATIVE] Fallback también falló:', error);
      setIsUploading(false);
      throw new Error('Error subiendo foto del acta. Por favor intenta nuevamente.');
    }
  }, [actaImage, escrutinioId]);

  // Función para proceder con la finalización del escrutinio
  const proceedWithCompletion = useCallback(async () => {
    if (!escrutinioId) {
      setError('No hay escrutinio activo');
      return;
    }
    
    // Validar token antes de proceder
    const token = localStorage.getItem('auth-token');
    if (!token) {
      setError('Sesión expirada. Por favor inicia sesión nuevamente.');
      setTimeout(() => window.location.href = '/', 2000);
      return;
    }
    
    setIsCompleting(true);
    setShowNoPhotoWarning(false); // Cerrar warning si está abierto
    setError(null); // Limpiar errores previos
    
    try {
      // 1. Subir foto si existe
      if (actaImage) {
        try {
          console.log('📸 [LEGISLATIVE] Subiendo foto antes de completar...');
          const evidenceUrl = await uploadEvidenceIfNeeded();
          
          if (!evidenceUrl) {
            console.warn('📸 [LEGISLATIVE] No se pudo obtener URL de evidence');
            const shouldContinue = confirm(
              'No se pudo subir la foto del acta. ¿Deseas continuar sin foto?'
            );
            if (!shouldContinue) {
              setIsCompleting(false);
              return;
            }
          } else {
            console.log('✅ [LEGISLATIVE] Foto subida exitosamente');
          }
        } catch (uploadError: any) {
          console.error('📸 [LEGISLATIVE] Error subiendo foto:', uploadError);
          const shouldContinue = confirm(
            `Hubo un error al subir la foto del acta: ${uploadError.message || 'Error desconocido'}. ¿Deseas continuar sin foto?`
          );
          if (!shouldContinue) {
            setIsCompleting(false);
            return;
          }
        }
      } else {
        console.log('📸 [LEGISLATIVE] No hay foto para subir');
      }
      
      // 2. Guardar snapshot del conteo actual antes de completar
      const snapshotData = {
        partyCounts: counts,
        timestamp: Date.now(),
        source: 'legislative_store',
        completedPapeletas: completedPapeletasCount,
        currentPapeleta: currentPapeleta
      };
      
      console.log('📊 [LEGISLATIVE] Guardando snapshot del conteo:', snapshotData);
      
      const completeResponse = await axios.post(`/api/escrutinio/${encodeURIComponent(escrutinioId)}/complete`, {
        originalData: snapshotData
      }, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      if (!completeResponse.data?.success) {
        throw new Error(completeResponse.data?.error || 'Error completando escrutinio');
      }
      
      console.log('✅ [LEGISLATIVE] Escrutinio completado exitosamente');
      
      // 3. Mostrar modal de éxito
      setShowSuccessModal(true);
    } catch (error: any) {
      console.error('❌ [LEGISLATIVE] Error completando escrutinio:', error);
      const errorMessage = error?.response?.data?.error || error?.message || 'Error completando escrutinio';
      setError(errorMessage);
      
      // Mostrar alerta al usuario
      alert(`Error completando escrutinio: ${errorMessage}`);
    } finally {
      setIsCompleting(false);
    }
  }, [escrutinioId, uploadEvidenceIfNeeded, counts, actaImage, completedPapeletasCount, currentPapeleta]);

  const handleCompleteEscrutinio = useCallback(async () => {
    if (!escrutinioId) {
      setError('No hay escrutinio activo');
      return;
    }

    // Verificar si hay foto del acta
    if (!actaImage) {
      console.warn('⚠️ [LEGISLATIVE] Intentando enviar sin foto del acta');
      setShowNoPhotoWarning(true);
      return;
    }

    await proceedWithCompletion();
  }, [escrutinioId, actaImage, proceedWithCompletion]);

  // Función para revisar escrutinio
  const handleReviewEscrutinio = useCallback(() => {
    console.log('📋 [LEGISLATIVE] Navegando a revisar escrutinio:', escrutinioId);
    
    // Limpiar estado de papeleta persistido
    saveState({
      legislativeCurrentPapeleta: undefined,
      legislativeExpandedParty: undefined,
      legislativePapeletaVotes: undefined,
      legislativeCompletedPapeletas: undefined
    });
    
    // Cerrar modal
    setShowSuccessModal(false);
    
    // Navegar después de un pequeño delay para asegurar que el estado se limpie
    setTimeout(() => {
      router.push(`/revisar/${escrutinioId}`);
    }, 100);
  }, [escrutinioId, router, saveState]);

  // Función para congelar/descongelar escrutinio
  const handleToggleFreeze = useCallback(async () => {
    if (!escrutinioId) {
      setError('No hay escrutinio activo');
      return;
    }
    
    console.log('🔄 [LEGISLATIVE] Toggle freeze escrutinio:', escrutinioId, 'Current state:', isEscrutinioClosed);
    setIsClosing(true);
    setError(null);
    
    try {
      const action = isEscrutinioClosed ? 'UNFREEZE' : 'FREEZE';
      
      // CRÍTICO: Si estamos congelando (FREEZE), pausar sync antes de capturar snapshot
      if (action === 'FREEZE') {
        // Importar dinámicamente el store legislativo
        const { useLegislativeVoteStore } = await import('@/store/legislativeVoteStore');
        const { pauseSync, resumeSync } = useLegislativeVoteStore.getState();
        
        pauseSync();
        console.log('⏸️ [LEGISLATIVE] Auto-sync pausado para evitar race conditions');
        
        // Esperar un momento para que cualquier operación pendiente se complete
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      
      const votesSnapshot = counts; // Snapshot actual de votos después de pausar
      
      // Capturar GPS final solo cuando se congela (FREEZE)
      let finalGps = null;
      if (action === 'FREEZE') {
        try {
          const position = await new Promise<GeolocationPosition>((resolve, reject) => {
            navigator.geolocation.getCurrentPosition(resolve, reject, {
              enableHighAccuracy: true,
              timeout: 10000,
              maximumAge: 0
            });
          });
          
          finalGps = {
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
            accuracy: position.coords.accuracy
          };
          
          console.log('📍 [LEGISLATIVE] GPS final capturado:', finalGps);
        } catch (gpsError) {
          console.warn('⚠️ [LEGISLATIVE] No se pudo obtener GPS final:', gpsError);
          // Continuar sin GPS
        }
      }
      
      // Enviar checkpoint al servidor
      const token = localStorage.getItem('auth-token');
      await axios.post(`/api/escrutinio/${escrutinioId}/checkpoint`, {
        action,
        votesSnapshot,
        deviceId: navigator.userAgent,
        gps: finalGps || {
          latitude: 0,
          longitude: 0,
          accuracy: 0
        }
      }, {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      // Enviar GPS final al endpoint de cierre solo cuando se congela
      if (action === 'FREEZE' && finalGps) {
        await axios.post(`/api/escrutinio/${escrutinioId}/close`, {
          finalGps: finalGps
        }, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        console.log('📍 [LEGISLATIVE] GPS final enviado al servidor');
      }
      
      // CRÍTICO: Reanudar auto-sync después de completar operaciones
      if (action === 'FREEZE') {
        const { resumeSync } = useLegislativeVoteStore.getState();
        resumeSync();
        console.log('▶️ [LEGISLATIVE] Auto-sync reanudado');
      }
      
      if (isEscrutinioClosed) {
        // Descongelar - cambiar estado local
        console.log('✅ [LEGISLATIVE] Descongelando escrutinio localmente');
        setEscrutinioStatus('OPEN');
        setIsEscrutinioClosed(false);
      } else {
        // Congelar - cambiar estado local
        console.log('✅ [LEGISLATIVE] Congelando escrutinio localmente');
        setEscrutinioStatus('CLOSED');
        setIsEscrutinioClosed(true);
      }
      
      console.log(`✅ [LEGISLATIVE] Checkpoint ${action} guardado exitosamente`);
    } catch (error: any) {
      console.error('❌ [LEGISLATIVE] Error toggle freeze:', error);
      const errorMessage = error?.response?.data?.error || error?.message || 'Error cambiando estado';
      setError(errorMessage);
    } finally {
      setIsClosing(false);
    }
  }, [escrutinioId, isEscrutinioClosed, counts]);

  // Render grid for expanded party
  const renderGrid = () => {
    if (!expandedParty || !diputadosData) return null;
    
    const party = getParty(expandedParty);
    if (!party) return null;

    const currentIndex = diputadosData.parties.findIndex(p => p.id === expandedParty);
    const prevParty = currentIndex > 0 ? diputadosData.parties[currentIndex - 1] : null;
    const nextParty = currentIndex < (diputadosData.parties?.length || 0) - 1 ? diputadosData.parties[currentIndex + 1] : null;

    const columns = Math.min(party.slots, 8);
    const rows = Math.ceil(party.slots / columns);
    
    return (
      <div className="space-y-4">
        {/* Party Navigation Numbers */}
        <div className="flex justify-center mb-4">
          <div className="flex items-center gap-2">
                   {diputadosData?.parties && Array.isArray(diputadosData.parties) ? diputadosData.parties.map((p, index) => {
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
                   }) : null}
                 </div>
               </div>

        {/* Header con navegación centrada */}
        <div className="flex items-center justify-between gap-4 mb-4">
          <button
            onClick={handleBack}
            className="p-2 rounded-lg border border-gray-300 hover:bg-gray-50 transition-colors"
            aria-label="Volver a partidos"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
          
          <div className="flex-1 text-center">
            <h3 className="text-base sm:text-lg font-semibold text-gray-900 truncate">{party.fullName}</h3>
            <p className="text-sm text-gray-600">Selecciona diputado</p>
          </div>
          
          <div className="text-right">
            <div className="text-xl sm:text-2xl font-bold" style={{ color: party.color }}>
              {getTotalPartyCountFormatted(expandedParty)}
            </div>
            <div className="text-xs text-gray-500">Total</div>
          </div>
        </div>

        {/* Party Navigation - Desktop & Mobile */}
        <div className="flex justify-center items-center mb-6">
          <div className="flex items-center gap-3">
            <button
              onClick={handlePreviousParty}
              disabled={!diputadosData || !diputadosData.parties || diputadosData.parties.findIndex(p => p.id === expandedParty) === 0}
              className="flex items-center gap-2 px-4 py-2.5 rounded-lg border border-gray-300 bg-white hover:bg-gray-50 disabled:bg-gray-100 disabled:text-gray-400 disabled:cursor-not-allowed transition-colors shadow-sm"
              aria-label="Partido anterior"
            >
              <ArrowLeft className="h-4 w-4" />
              <span className="text-sm font-medium hidden sm:inline">
                {(() => {
                  if (!diputadosData || !diputadosData.parties || !expandedParty) return '';
                  const currentIndex = diputadosData.parties.findIndex(p => p.id === expandedParty);
                  if (currentIndex > 0) {
                    const prevParty = diputadosData.parties[currentIndex - 1];
                    if (prevParty.casillas && Array.isArray(prevParty.casillas) && prevParty.casillas.length > 0) {
                      const firstCasilla = prevParty.casillas[0];
                      const lastCasilla = prevParty.casillas[prevParty.casillas.length - 1];
                      return `${prevParty.fullName} (${firstCasilla}-${lastCasilla})`;
                    }
                    return prevParty.fullName;
                  }
                  return '';
                })()}
              </span>
            </button>
            
            <button
              onClick={handleNextParty}
              disabled={!diputadosData || !diputadosData.parties || !Array.isArray(diputadosData.parties) || diputadosData.parties.findIndex(p => p.id === expandedParty) === diputadosData.parties.length - 1}
              className="flex items-center gap-2 px-4 py-2.5 rounded-lg border border-gray-300 bg-white hover:bg-gray-50 disabled:bg-gray-100 disabled:text-gray-400 disabled:cursor-not-allowed transition-colors shadow-sm"
              aria-label="Siguiente partido"
            >
              <span className="text-sm font-medium hidden sm:inline">
                {(() => {
                  if (!diputadosData || !diputadosData.parties || !expandedParty) return '';
                  const currentIndex = diputadosData.parties.findIndex(p => p.id === expandedParty);
                  if (currentIndex < diputadosData.parties.length - 1) {
                    const nextParty = diputadosData.parties[currentIndex + 1];
                    if (nextParty.casillas && Array.isArray(nextParty.casillas) && nextParty.casillas.length > 0) {
                      const firstCasilla = nextParty.casillas[0];
                      const lastCasilla = nextParty.casillas[nextParty.casillas.length - 1];
                      return `${nextParty.fullName} (${firstCasilla}-${lastCasilla})`;
                    }
                    return nextParty.fullName;
                  }
                  return '';
                })()}
              </span>
              <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Dynamic Grid - Responsive */}
        <div className="grid gap-3 grid-cols-4 sm:grid-cols-5 md:grid-cols-6 lg:grid-cols-7 xl:grid-cols-8">
          {party.casillas.map((casillaNumber, index) => {
            const totalVoteCount = getCasillaCount(expandedParty, casillaNumber);
            const currentPapeletaVotes = getCasillaVoteCount(expandedParty, casillaNumber);
            const isSelected = currentPapeletaVotes > 0;
            
            // Debug logs
            console.log(`🔍 Party: ${party.fullName}, Casillas array:`, party.casillas);
            console.log(`🔍 Casilla ${casillaNumber} (${expandedParty}): total=${totalVoteCount}, current=${currentPapeletaVotes}`);
            
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
                    ? getTransparentColor(party.color, 0.25)
                    : getTransparentColor(party.color, 0.1),
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

        {/* Controles de papeleta - justo debajo de las casillas */}
        <div className="mt-4 p-4 bg-blue-50 rounded-lg border border-blue-200">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <div className="p-2 bg-blue-100 rounded-lg">
                <FileText className="h-4 w-4 text-blue-600" />
              </div>
              <div>
                <p className="text-sm font-medium text-blue-900">
                  Papeleta {currentPapeleta}
                </p>
                <p className="text-xs text-blue-700">
                  {getTotalVotesInPapeleta()}/{diputadosData.diputados} marcas
                </p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-sm text-blue-700">
                {getTotalVotesInPapeleta() > 0 ? `${getTotalVotesInPapeleta()} marcas aplicadas` : 'Sin marcas'}
              </p>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-2">
            <button
              onClick={handleClosePapeleta}
              disabled={getTotalVotesInPapeleta() === 0}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-3 sm:py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-gray-400 disabled:text-gray-200 disabled:cursor-not-allowed transition-colors text-sm font-medium"
            >
              <Check className="h-4 w-4" />
              <span className="hidden sm:inline">Cerrar Papeleta</span>
              <span className="sm:hidden">Cerrar</span>
            </button>
            <button
              onClick={handleAnularPapeletaFromAlert}
              disabled={getTotalVotesInPapeleta() === 0}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-3 sm:py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:bg-gray-400 disabled:text-gray-200 disabled:cursor-not-allowed transition-colors text-sm font-medium"
            >
              <X className="h-4 w-4" />
              <span className="hidden sm:inline">Anular Papeleta</span>
              <span className="sm:hidden">Anular</span>
            </button>
          </div>
        </div>

      </div>
    );
  };

  // Mostrar loading mientras se verifica el status o se cargan datos
  if (isCheckingStatus || loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
          <p className="text-gray-600">
            {isCheckingStatus ? 'Cargando escrutinio...' : 'Cargando datos de diputados...'}
          </p>
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
    <div className="max-w-7xl mx-auto p-4 sm:p-6 pb-20 sm:pb-6">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-2">
          Diputados - JRV {diputadosData.jrv.jrv}
        </h1>
        <div className="mt-2 p-2 bg-blue-50 rounded-lg border border-blue-200">
          <p className="text-sm text-blue-700">
            <span className="font-medium">Papeleta {currentPapeleta}</span>
            {' • '}
            {getTotalVotesInPapeleta()}/{diputadosData.diputados} marcas
            {completedPapeletasCount > 0 && (
              <>
                {' • '}
                <span className="font-medium">{completedPapeletasCount} papeleta{completedPapeletasCount !== 1 ? 's' : ''} completada{completedPapeletasCount !== 1 ? 's' : ''}</span>
              </>
            )}
          </p>
        </div>
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
          {/* Banner de controles de papeleta en vista de partidos */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-lg font-semibold text-blue-800">Controles de Papeleta</h4>
              <span className="text-sm font-medium text-blue-600">
                Papeleta {currentPapeleta} • {getTotalVotesInPapeleta()}/{diputadosData.diputados} marcas
              </span>
            </div>
            <div className="flex gap-3">
              <button
                onClick={handleClosePapeleta}
                disabled={isEscrutinioClosed || getTotalVotesInPapeleta() === 0}
                className="flex-1 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg disabled:bg-gray-300 disabled:text-gray-600 disabled:cursor-not-allowed transition-colors"
              >
                Cerrar Papeleta
              </button>
              <button
                onClick={() => setShowAnularConfirmation(true)}
                disabled={isEscrutinioClosed || getTotalVotesInPapeleta() === 0}
                className="flex-1 border border-red-500 text-red-600 hover:bg-red-50 px-4 py-2 rounded-lg disabled:bg-gray-300 disabled:text-gray-600 disabled:cursor-not-allowed transition-colors"
              >
                Anular Papeleta
              </button>
            </div>
          </div>
          {diputadosData.parties.map((party) => (
            <div key={party.id}>
              <div
                className="w-full flex items-center rounded-lg border focus:outline-none focus:ring-2 transition-transform cursor-pointer"
                onClick={() => handlePartyClick(party.id)}
                style={{ 
                  borderLeftWidth: 6, 
                  borderLeftColor: party.color,
                  backgroundColor: getTransparentColor(party.color, 0.2),
                  borderColor: getTransparentColor(party.color, 0.3)
                }}
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
        {/* Cerrar/Editar Escrutinio */}
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="flex items-center gap-3 mb-3">
            <div className="p-2 bg-orange-100 rounded-lg">
              {isEscrutinioClosed ? <Edit className="h-5 w-5 text-orange-600" /> : <X className="h-5 w-5 text-orange-600" />}
            </div>
            <div>
              <h3 className="font-semibold text-gray-900">
                {isEscrutinioClosed ? 'Editar Escrutinio' : 'Cerrar Escrutinio'}
              </h3>
              <p className="text-sm text-gray-600">
                {isEscrutinioClosed ? 'Continuar agregando marcas' : 'Cerrar para tomar foto'}
              </p>
            </div>
          </div>
          <button
            onClick={handleToggleFreeze}
            disabled={isClosing}
            className="w-full px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 disabled:bg-gray-400 disabled:text-gray-200 disabled:cursor-not-allowed transition-colors"
          >
            {isClosing ? <Loader2 className="h-4 w-4 animate-spin mx-auto" /> : 
             (isEscrutinioClosed ? 'Editar' : 'Cerrar')}
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
            disabled={false}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm disabled:bg-gray-100 disabled:text-gray-400 disabled:cursor-not-allowed"
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
            disabled={isCompleting}
            className="w-full px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-gray-400 disabled:text-gray-200 disabled:cursor-not-allowed transition-colors"
          >
            {isCompleting ? <Loader2 className="h-4 w-4 animate-spin mx-auto" /> : 'Enviar Resultados'}
          </button>
        </div>

      </div>


      {/* No Photo Warning Modal */}
      {showNoPhotoWarning && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg p-6 max-w-md w-full">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 bg-amber-100 rounded-lg">
                <AlertCircle className="h-6 w-6 text-amber-600" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-900">¡Atención!</h3>
                <p className="text-sm text-gray-600">No has subido la foto del acta</p>
              </div>
            </div>
            <p className="text-sm text-gray-700 mb-4">
              Es altamente recomendable subir la foto del acta para verificación. 
              ¿Estás seguro que deseas continuar sin foto?
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowNoPhotoWarning(false)}
                className="flex-1 px-4 py-2 bg-gray-300 text-gray-700 rounded-lg hover:bg-gray-400 transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={proceedWithCompletion}
                className="flex-1 px-4 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700 transition-colors"
              >
                Continuar sin foto
              </button>
            </div>
          </div>
        </div>
      )}

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

      {/* Vote Limit Alert */}
      <VoteLimitAlert
        isVisible={showVoteLimitAlert}
        currentVotes={getTotalVotesInPapeleta()}
        voteLimit={diputadosData?.diputados || 0}
        onClose={handleCloseVoteLimitAlert}
        onClosePapeleta={handleClosePapeletaFromAlert}
        onAnularPapeleta={handleAnularPapeletaFromAlert}
        isClosingPapeleta={false}
      />

      {/* Modal de Confirmación de Anulación */}
      {showAnularConfirmation && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
            <div className="text-center">
              <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-red-100 mb-4">
                <X className="h-6 w-6 text-red-600" />
              </div>
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                Confirmar Anulación
              </h3>
              <p className="text-sm text-gray-600 mb-6">
                ¿Seguro que deseas anular esta papeleta? Se perderán todas las marcas.
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => setShowAnularConfirmation(false)}
                  className="flex-1 px-4 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleAnularPapeleta}
                  className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
                >
                  Confirmar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
