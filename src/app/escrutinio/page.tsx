'use client';

import React, { useState, useEffect, Suspense } from 'react';
import axios from 'axios';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '../../components/AuthProvider';
import { useGeolocation } from '../../hooks/useGeolocation';
import { useOfflineQueue } from '../../hooks/useOfflineQueue';
import { useEscrutinioPersistence } from '../../hooks/useEscrutinioPersistence';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import SearchInput from '../../components/ui/SearchInput';
import BackButton from '../../components/ui/BackButton';
import VoteList from '@/components/VoteList';
import DiputadosEscrutinio from '@/components/DiputadosEscrutinio';
import PresidencialEscrutinio from '@/components/PresidencialEscrutinio';
import VoteFooter from '@/components/VoteFooter';
import { useVoteStore } from '@/store/voteStore';
import { getPartyConfig } from '@/lib/party-config';
import { 
  Vote, 
  MapPin, 
  Camera, 
  CheckCircle,
  ArrowLeft,
  AlertCircle,
  Loader2,
  Settings,
  Smartphone
} from 'lucide-react';

interface Mesa {
  id: string;
  number: string;
  location: string;
  address?: string;
}

interface JRVSearchResult {
  value: string;
  label: string;
  location: string;
  department: string;
}

interface Candidate {
  id: string;
  name: string;
  party: string;
  number: number;
  electionLevel: string;
}

function EscrutinioPageContent() {
  const { user } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  
  // Hook de persistencia del escrutinio
  const { 
    escrutinioState, 
    saveState, 
    clearState, 
    resetCurrentEscrutinio,
    startNewEscrutinio,
    hasActiveEscrutinio, 
    canRecoverEscrutinio 
  } = useEscrutinioPersistence();

  // Estados locales (no persistentes)
  const [isStarting, setIsStarting] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showInstructions, setShowInstructions] = useState(false);
  const [showCancelDialog, setShowCancelDialog] = useState(false);
  const [gpsSuccess, setGpsSuccess] = useState(false);
  const [gpsError, setGpsError] = useState<string | null>(null);
  const [showJRVWarning, setShowJRVWarning] = useState(false);
  const [activeEscrutinio, setActiveEscrutinio] = useState<any>(null);
  const [showSecondConfirmation, setShowSecondConfirmation] = useState(false);
  const [showImageModal, setShowImageModal] = useState(false);
  const [escrutinioStatus, setEscrutinioStatus] = useState<'PENDING' | 'IN_PROGRESS' | 'CLOSED' | 'COMPLETED' | null>(null);
  const [isInitializing, setIsInitializing] = useState(true);
  const [isLoadingMesaInfo, setIsLoadingMesaInfo] = useState(false);
  
  const voteStore = useVoteStore();
  
  // Usar el hook de geolocalización
  const { 
    location, 
    isLoading, 
    error, 
    permissionStatus,
    getCurrentLocation, 
    showLocationInstructions 
  } = useGeolocation();

  // Usar el hook de cola offline
  const { addToQueue, isOnline, hasOfflineItems } = useOfflineQueue();

  // Verificar si hay escrutinio activo en la JRV
  const checkActiveEscrutinio = async (mesaNumber: string) => {
    try {
      console.log('🔍 Verificando escrutinio activo para JRV:', mesaNumber);
      const response = await axios.get(`/api/mesas/${mesaNumber}/check-active`);
      
      if (response.data.success && response.data.hasActive) {
        console.log('⚠️ Escrutinio activo encontrado:', response.data.escrutinio);
        setActiveEscrutinio(response.data.escrutinio);
        setShowJRVWarning(true);
        return true;
      }
      return false;
    } catch (error) {
      console.error('Error verificando escrutinio activo:', error);
      return false;
    }
  };

  // Manejar selección de JRV
  const handleJRVSelect = async (result: JRVSearchResult) => {
    console.log('🎯 JRV seleccionada:', result);
    
    // Verificar si hay escrutinio activo
    const hasActive = await checkActiveEscrutinio(result.value);
    
    if (!hasActive) {
      // Solo guardar estado si no hay escrutinio activo
      saveState({
        selectedMesa: result.value,
        selectedMesaInfo: result,
      });
    } else {
      // Guardar información de la JRV pero no continuar
      saveState({
        selectedMesa: result.value,
        selectedMesaInfo: result,
      });
    }
  };

  const handleJRVChange = (value: string) => {
    saveState({
      selectedMesa: value,
      selectedMesaInfo: value ? escrutinioState.selectedMesaInfo : null,
    });
  };

  // Manejar continuar escrutinio existente
  const handleContinueEscrutinio = () => {
    if (activeEscrutinio) {
      console.log('🔄 Continuando escrutinio existente:', activeEscrutinio.id);
      router.push(`/escrutinio?escrutinioId=${activeEscrutinio.id}&level=${activeEscrutinio.electionLevel}`);
    }
    setShowJRVWarning(false);
    setActiveEscrutinio(null);
  };

  // Manejar cerrar advertencia
  const handleCloseJRVWarning = () => {
    setShowJRVWarning(false);
    setActiveEscrutinio(null);
    // Limpiar selección de JRV
    saveState({
      selectedMesa: '',
      selectedMesaInfo: null,
    });
  };

  // Manejar selección de nivel electoral (automáticamente obtiene GPS y va al conteo)
  const handleLevelSelect = async (level: 'PRESIDENTIAL' | 'LEGISLATIVE') => {
    if (!escrutinioState.selectedMesa) {
      alert('Por favor selecciona una JRV primero');
      return;
    }

    // CRITICAL: Limpiar TODO antes de iniciar un nuevo escrutinio
    console.log('🧹 [LEVEL SELECT] Limpiando stores y localStorage antes de iniciar nuevo escrutinio');
    
    // Limpiar stores de votos
    voteStore.clear();
    if (typeof window !== 'undefined') {
      import('@/store/legislativeVoteStore').then(({ useLegislativeVoteStore }) => {
        useLegislativeVoteStore.getState().clear();
      });
      
      // Limpiar localStorage keys de escrutinioId anterior
      localStorage.removeItem('last-presidential-escrutinio-id');
      localStorage.removeItem('last-legislative-escrutinio-id');
      localStorage.removeItem('last-escrutinio-key');
      
      // Marcar que el próximo escrutinio será nuevo (no cargar votos del servidor)
      localStorage.setItem('is-new-escrutinio', 'true');
      
      // Limpiar datos del otro nivel según el nivel seleccionado
      if (level === 'PRESIDENTIAL') {
        // Limpiar datos legislativos del localStorage
        console.log('🧹 [LEVEL SELECT] Limpiando datos legislativos para escrutinio presidencial');
        const savedState = localStorage.getItem('escrutinio-state');
        if (savedState) {
          try {
            const parsed = JSON.parse(savedState);
            // Remover solo datos legislativos, mantener el resto
            delete parsed.legislativePapeletaVotes;
            delete parsed.legislativeCurrentPapeleta;
            delete parsed.legislativeExpandedParty;
            delete parsed.legislativeCompletedPapeletas;
            localStorage.setItem('escrutinio-state', JSON.stringify(parsed));
          } catch (error) {
            console.warn('Error limpiando datos legislativos:', error);
          }
        }
      } else if (level === 'LEGISLATIVE') {
        // Limpiar datos presidenciales del localStorage
        console.log('🧹 [LEVEL SELECT] Limpiando datos presidenciales para escrutinio legislativo');
        // Los datos presidenciales se guardan en el store de votos, no en localStorage del estado
        // Pero podemos limpiar el escrutinioId presidencial si existe
        const savedState = localStorage.getItem('escrutinio-state');
        if (savedState) {
          try {
            const parsed = JSON.parse(savedState);
            // Si el escrutinioId actual es de tipo presidencial, limpiarlo
            // (esto se manejará mejor en saveState)
            localStorage.setItem('escrutinio-state', JSON.stringify(parsed));
          } catch (error) {
            console.warn('Error limpiando datos presidenciales:', error);
          }
        }
      }
    }

    // Si hay advertencia activa, crear nuevo escrutinio y mover el anterior a "Recientes"
    if (showJRVWarning && activeEscrutinio) {
      console.log('🔄 Creando nuevo escrutinio para JRV con escrutinio activo');
      
      // Cerrar la advertencia
      setShowJRVWarning(false);
      setActiveEscrutinio(null);
      
      // Continuar con el flujo normal de creación de nuevo escrutinio
      // El escrutinio anterior se moverá automáticamente a "Escrutinios Recientes"
      // cuando se cree el nuevo
    }

    // Guardar el nivel seleccionado
    saveState({ selectedLevel: level });

    // Automáticamente obtener GPS y continuar con el nivel correcto
    await handleGetLocation(level);
  };

  const [candidates, setCandidates] = useState<Candidate[]>([]);
  useEffect(() => {
    const load = async () => {
      if (!escrutinioState.selectedLevel) { setCandidates([]); return; }
      try {
        const resp = await axios.get('/api/candidates', { params: { level: escrutinioState.selectedLevel } });
        if (resp.data?.success) setCandidates(resp.data.data);
      } catch {}
    };
    load();
  }, [escrutinioState.selectedLevel]);

  // Inicializar estado al cargar el componente
  useEffect(() => {
    // Solo marcar como inicializado si no hay información de mesa cargando
    // Esto permite que el efecto de carga de mesa controle el estado de inicialización
    if (!escrutinioState.selectedMesa || 
        escrutinioState.selectedMesaInfo?.location !== 'Cargando...') {
      setIsInitializing(false);
    }
  }, [escrutinioState.selectedMesa, escrutinioState.selectedMesaInfo?.location]);

  // Buscar información de la mesa cuando se carga desde URL
  useEffect(() => {
    const loadMesaInfoFromUrl = async () => {
      // Solo cargar si tenemos mesa seleccionada y la info está en "Cargando..."
      if (escrutinioState.selectedMesa && 
          escrutinioState.selectedMesaInfo?.location === 'Cargando...') {
        
        // Evitar múltiples cargas simultáneas
        if (isLoadingMesaInfo) return;
        
        setIsLoadingMesaInfo(true);
        
        try {
          const mesaNumber = escrutinioState.selectedMesa;
          const response = await axios.get(`/api/mesas/search?q=${mesaNumber}`);
          
          const escrutinioIdFromUrl = searchParams.get('escrutinioId');
          
          if (response.data?.success && 
              response.data?.results && 
              Array.isArray(response.data.results) && 
              response.data.results.length > 0) {
            const mesaInfo = response.data.results[0];
            console.log('✅ Mesa info cargada:', mesaInfo);
            
            // Actualizar información de mesa y saltar al paso 2 si hay escrutinioId
            const updates: any = {
              selectedMesaInfo: mesaInfo,
            };
            
            if (escrutinioIdFromUrl && escrutinioState.currentStep === 1) {
              console.log('⏭️ Saltando al paso 2 después de cargar información de mesa');
              updates.currentStep = 2;
              updates.escrutinioId = escrutinioIdFromUrl;
            }
            
            saveState(updates);
          } else {
            // No mostrar warning en consola, solo establecer valores por defecto
            const fallbackInfo = {
              value: mesaNumber,
              label: `${mesaNumber} - ${mesaNumber}`,
              location: mesaNumber,
              department: 'N/A'
            };
            
            const updates: any = {
              selectedMesaInfo: fallbackInfo,
            };
            
            // Si hay escrutinioId en URL, saltar al paso 2 incluso con info fallback
            if (escrutinioIdFromUrl && escrutinioState.currentStep === 1) {
              console.log('⏭️ Saltando al paso 2 con información fallback');
              updates.currentStep = 2;
              updates.escrutinioId = escrutinioIdFromUrl;
            }
            
            saveState(updates);
          }
        } catch (error) {
          // No mostrar error en consola, solo establecer valores por defecto
          const fallbackInfo = {
            value: escrutinioState.selectedMesa,
            label: `${escrutinioState.selectedMesa} - ${escrutinioState.selectedMesa}`,
            location: escrutinioState.selectedMesa,
            department: 'N/A'
          };
          
          const escrutinioIdFromUrl = searchParams.get('escrutinioId');
          const updates: any = {
            selectedMesaInfo: fallbackInfo,
          };
          
          // Si hay escrutinioId en URL, saltar al paso 2 incluso con info fallback
          if (escrutinioIdFromUrl && escrutinioState.currentStep === 1) {
            console.log('⏭️ Saltando al paso 2 con información fallback después de error');
            updates.currentStep = 2;
            updates.escrutinioId = escrutinioIdFromUrl;
          }
          
          saveState(updates);
        } finally {
          setIsLoadingMesaInfo(false);
          setIsInitializing(false);
        }
      } else {
        // Si no hay información cargando, marcar como inicializado
        setIsInitializing(false);
      }
    };
    loadMesaInfoFromUrl();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [escrutinioState.selectedMesa, escrutinioState.selectedMesaInfo?.location]);

  // Los votos se cargan automáticamente en PresidencialEscrutinio y DiputadosEscrutinio
  // cuando se montan con el escrutinioId correcto. No necesitamos cargar aquí para evitar
  // conflictos con la lógica de limpieza de store en esos componentes.

  // Map party acronyms to display names using party config
  const mapPartyToDisplayName = (party: string): string => {
    return getPartyConfig(party).name;
  };

  const filteredCandidates = candidates
    .filter((c) => c.electionLevel === 'PRESIDENTIAL')
    .sort((a, b) => {
      // Force exact order by candidate number
      return a.number - b.number;
    });

  const getPartyColor = (party: string) => {
    return getPartyConfig(party).color;
  };

  const handleEscrutinioStatusChange = (status: 'PENDING' | 'IN_PROGRESS' | 'CLOSED' | 'COMPLETED') => {
    setEscrutinioStatus(status);
  };

  const handleGetLocation = async (electionLevel?: string) => {
    try {
      setIsStarting(true);
      setGpsSuccess(false);
      setGpsError(null);
      
      console.log('📍 [ESCRUTINIO] Iniciando obtención de ubicación GPS...');
      const result = await getCurrentLocation();
      
      if (!result) {
        console.error('❌ [ESCRUTINIO] No se pudo obtener ubicación GPS');
        
        // Mostrar instrucciones específicas según el error
        if (error) {
          setGpsError(`${error.userFriendlyMessage}\n\n${showLocationInstructions()}`);
        } else {
          setGpsError('No se pudo obtener tu ubicación. Por favor, habilita la ubicación en tu dispositivo e intenta nuevamente.');
        }
        setIsStarting(false);
        return;
      }
      
      console.log('✅ [ESCRUTINIO] Ubicación GPS obtenida exitosamente:', result);
      setGpsError(null); // Limpiar error si se obtuvo exitosamente
      
      // Si ya hay escrutinio activo, verificar su status antes de decidir qué hacer
      if (escrutinioState.escrutinioId) {
        try {
          console.log('🔍 Verificando status del escrutinio existente:', escrutinioState.escrutinioId);
          const token = localStorage.getItem('auth-token');
          const statusResponse = await axios.get(
            `/api/escrutinio/${escrutinioState.escrutinioId}/status`,
            { headers: { 'Authorization': `Bearer ${token}` } }
          );
          
          if (statusResponse.data?.success) {
            const status = statusResponse.data.data.status;
            console.log('📊 Status del escrutinio:', status);
            
            // Solo actualizar GPS si el escrutinio está ACTIVO (PENDING o IN_PROGRESS)
            if (status === 'PENDING' || status === 'IN_PROGRESS') {
              console.log('📍 [ESCRUTINIO] Actualizando GPS de escrutinio activo:', escrutinioState.escrutinioId);
              saveState({ location: result });
              setGpsSuccess(true);
              setTimeout(() => setGpsSuccess(false), 3000);
              setIsStarting(false);
              return;
            } else {
              console.log('⚠️ [ESCRUTINIO] Escrutinio no está activo (status:', status, '), limpiando estado local');
              // Clear localStorage completely to prevent ghost votes
              localStorage.removeItem('escrutinio-state');
              localStorage.removeItem('last-escrutinio-key');
              // El escrutinio no está activo, limpiar estado local y continuar con creación de nuevo
              saveState({ escrutinioId: null });
            }
          } else {
            console.log('⚠️ [ESCRUTINIO] No se pudo verificar status, limpiando estado local');
            saveState({ escrutinioId: null });
          }
        } catch (error) {
          console.error('❌ [ESCRUTINIO] Error verificando status del escrutinio:', error);
          // Si hay error, limpiar estado local y continuar con creación de nuevo
          localStorage.removeItem('escrutinio-state');
          localStorage.removeItem('last-escrutinio-key');
          saveState({ escrutinioId: null });
        }
      }
      
      // Usar el nivel pasado como parámetro o el del estado
      const level = electionLevel || escrutinioState.selectedLevel;
      
      // 1. NORMALIZE JRV NUMBER (pad to 5 digits)
      const normalizedJRV = escrutinioState.selectedMesa.padStart(5, '0');
      console.log(`🔢 [ESCRUTINIO] JRV normalizado: "${escrutinioState.selectedMesa}" → "${normalizedJRV}"`);

      // 2. FETCH COMPLETE MESA DATA (even if user didn't select from dropdown)
      let mesaInfo = escrutinioState.selectedMesaInfo;
      
      if (!mesaInfo || !mesaInfo.location || !mesaInfo.department) {
        console.log('📍 [ESCRUTINIO] Obteniendo información completa de la mesa...');
        try {
          const mesaResponse = await axios.get(`/api/mesas/search?q=${normalizedJRV}&exact=true`);
          if (mesaResponse.data.success && mesaResponse.data.data.length > 0) {
            const mesa = mesaResponse.data.data[0];
            mesaInfo = {
              value: mesa.number,
              label: `JRV ${mesa.number}`,
              location: mesa.location,
              department: mesa.department
            };
            console.log('✅ [ESCRUTINIO] Información de mesa obtenida:', mesaInfo);
            
            // Save the complete mesa info
            saveState({
              selectedMesa: normalizedJRV,
              selectedMesaInfo: mesaInfo
            });
          } else {
            console.warn('⚠️ [ESCRUTINIO] No se encontró información de la mesa');
          }
        } catch (error) {
          console.error('❌ [ESCRUTINIO] Error obteniendo información de mesa:', error);
        }
      }
      
      const payload = {
        mesaNumber: normalizedJRV, // Use normalized number
        electionLevel: level,
        gps: { 
          latitude: result.lat, 
          longitude: result.lng, 
          accuracy: result.accuracy || 0 
        },
      };
      
      console.log('🔍 [ESCRUTINIO] Enviando payload a /api/escrutinio/start:', JSON.stringify(payload, null, 2));
      
      const resp = await axios.post('/api/escrutinio/start', payload);
      if (resp.data?.success && resp.data?.data?.escrutinioId) {
        const newEscrutinioId = resp.data.data.escrutinioId;
        
        // NO limpiar los stores aquí - los componentes detectarán que es un nuevo escrutinio
        // y limpiarán el store cuando se monten con el nuevo escrutinioId
        // Esto permite tener múltiples escrutinios abiertos sin interferir entre sí
        
        // Limpiar localStorage del escrutinioId viejo para que el nuevo se detecte correctamente
        if (typeof window !== 'undefined') {
          localStorage.removeItem('last-presidential-escrutinio-id');
          localStorage.removeItem('last-legislative-escrutinio-id');
          // Marcar que este es un escrutinio nuevo (no cargar votos del servidor)
          localStorage.setItem('is-new-escrutinio', 'true');
          localStorage.setItem('new-escrutinio-id', newEscrutinioId);
        }
        
        // Mostrar mensaje de éxito por un momento
        setGpsSuccess(true);
        setTimeout(() => setGpsSuccess(false), 3000);
        
        // Guardar el estado del escrutinio iniciado
        saveState({
          escrutinioId: newEscrutinioId,
          currentStep: 2, // Ir al paso de conteo después de obtener GPS
          location: result,
          selectedLevel: level, // Asegurar que el nivel se guarde correctamente
        });
        
        console.log('🎉 [ESCRUTINIO] Escrutinio iniciado exitosamente con GPS');
        
        // Establecer isStarting en false DESPUÉS de guardar el estado
        // Esto previene el glimpse al asegurar que el estado esté completamente guardado
        // antes de renderizar los componentes de escrutinio
        setIsStarting(false);
      } else {
        console.error('❌ [ESCRUTINIO] Respuesta del servidor no exitosa:', resp.data);
        alert(resp.data?.error || 'No se pudo iniciar el escrutinio');
        setIsStarting(false);
      }
    } catch (e: any) {
      console.error('❌ [ESCRUTINIO] Error en handleGetLocation:', e);
      if (e.response) {
        console.error('❌ [ESCRUTINIO] Respuesta del servidor:', e.response.data);
        console.error('❌ [ESCRUTINIO] Status:', e.response.status);
      }
      
      // Manejar diferentes tipos de errores
      if (e?.response?.status === 400) {
        alert('Error en los datos enviados. Por favor, verifica que la JRV sea válida.');
      } else if (e?.response?.status === 500) {
        alert('Error del servidor. Por favor, intenta nuevamente en unos momentos.');
      } else {
        alert(e?.response?.data?.error || 'Error inesperado. Por favor, intenta nuevamente.');
      }
      
      setIsStarting(false);
    }
  };

  // counts are managed by store now

  const handleActaUpload = (e: React.ChangeEvent<HTMLInputElement>, source: 'CAMERA' | 'LIBRARY') => {
    const file = e.target.files?.[0];
    if (file) {
      saveState({ actaImage: file, actaImageSource: source });
    }
    // Reset input para permitir seleccionar el mismo archivo de nuevo
    e.target.value = '';
  };

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
    if (!escrutinioState.actaImage || !escrutinioState.escrutinioId) return;
    try {
      const presign = await axios.post('/api/upload/presign', {
        escrutinioId: escrutinioState.escrutinioId,
        fileName: escrutinioState.actaImage.name,
        contentType: escrutinioState.actaImage.type || 'image/jpeg',
      });
      if (presign.data?.success) {
        const { uploadUrl, publicUrl } = presign.data.data as { uploadUrl: string; publicUrl: string };
        await fetch(uploadUrl, {
          method: 'PUT',
          headers: { 'Content-Type': escrutinioState.actaImage.type || 'image/jpeg' },
          body: escrutinioState.actaImage,
        });
        const hash = await computeSHA256Hex(escrutinioState.actaImage);
        await axios.post(`/api/escrutinio/${encodeURIComponent(escrutinioState.escrutinioId!)}/evidence`, { 
          publicUrl, 
          hash,
          actaImageSource: escrutinioState.actaImageSource 
        });
        return;
      }
    } catch {
      // fallback below
    }
    try {
      const dataUrl = await toDataUrl(escrutinioState.actaImage);
      const hash = await computeSHA256Hex(escrutinioState.actaImage);
      await axios.post(`/api/escrutinio/${encodeURIComponent(escrutinioState.escrutinioId!)}/evidence`, { 
        publicUrl: dataUrl, 
        hash,
        actaImageSource: escrutinioState.actaImageSource 
      });
    } catch {}
  };

  const handleFinishEscrutinio = () => {
    saveState({ isEscrutinioFinished: true });
  };

  const handleEditEscrutinio = () => {
    saveState({ isEscrutinioFinished: false });
  };

  const handleSubmit = async () => {
    if (!escrutinioState.location || !escrutinioState.selectedMesa || !escrutinioState.selectedLevel) {
      alert('Por favor completa todos los campos requeridos');
      return;
    }

    setIsSubmitting(true);

    try {
      // Si estamos offline, guardar en cola
      if (!isOnline) {
        const offlineData = {
          escrutinioId: escrutinioState.escrutinioId,
          votes: voteStore.counts,
          actaImage: escrutinioState.actaImage ? {
            name: escrutinioState.actaImage.name,
            type: escrutinioState.actaImage.type,
            size: escrutinioState.actaImage.size,
          } : null,
          gps: { latitude: escrutinioState.location!.lat, longitude: escrutinioState.location!.lng, accuracy: escrutinioState.location!.accuracy || 0 },
          mesaNumber: escrutinioState.selectedMesa,
          electionLevel: escrutinioState.selectedLevel,
        };

        addToQueue('submit_escrutinio', offlineData);
        alert('Escrutinio guardado para enviar cuando regrese la conexión');
        voteStore.clear();
        router.push('/resultados');
        return;
      }

      // Si estamos online, proceder normalmente
      await uploadEvidenceIfNeeded();
      // Marcar escrutinio como completado para que aparezca en resultados
      if (escrutinioState.escrutinioId) {
        try {
          await axios.post(`/api/escrutinio/${encodeURIComponent(escrutinioState.escrutinioId)}/complete`, {
            gps: { latitude: escrutinioState.location!.lat, longitude: escrutinioState.location!.lng, accuracy: escrutinioState.location!.accuracy || 0 },
          });
        } catch (e) {
          // Continuar aunque falle el marcado como completo
        }
      }

      alert('Escrutinio enviado exitosamente!');
      // Clear local counts/batch after completing and sending the escrutinio
      voteStore.clear();
      router.push('/resultados');
    } catch (error) {
      // Si falla el envío online, intentar guardar offline
      if (isOnline) {
        const offlineData = {
          escrutinioId: escrutinioState.escrutinioId,
          votes: voteStore.counts,
          actaImage: escrutinioState.actaImage ? {
            name: escrutinioState.actaImage.name,
            type: escrutinioState.actaImage.type,
            size: escrutinioState.actaImage.size,
          } : null,
          gps: { latitude: escrutinioState.location!.lat, longitude: escrutinioState.location!.lng, accuracy: escrutinioState.location!.accuracy || 0 },
          mesaNumber: escrutinioState.selectedMesa,
          electionLevel: escrutinioState.selectedLevel,
        };

        addToQueue('submit_escrutinio', offlineData);
        alert('Error de conexión. Escrutinio guardado para enviar más tarde.');
      } else {
        alert('Error al enviar el escrutinio');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const totalVotes = Object.keys(voteStore.counts).reduce((sum, k) => sum + (voteStore.counts[k] || 0), 0);

  // Mostrar spinner mientras se inicializa
  if (isInitializing || isLoadingMesaInfo) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-12 w-12 animate-spin text-blue-600 mx-auto mb-4" />
          <p className="text-gray-600">Cargando escrutinio...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50" style={{ fontSize: "16px" }}>
      {/* Header - Mobile optimized */}
      <header className="bg-white shadow-sm border-b">
        <div className={`${escrutinioState.currentStep === 2 ? "max-w-full mx-0 px-4" : "max-w-4xl mx-auto px-4 sm:px-6 lg:px-8"}`}>
          <div className="flex justify-between items-center h-14 lg:h-16">
            <div className="flex items-center">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => router.push('/dashboard')}
              >
                <ArrowLeft className="h-4 w-4 mr-1 lg:mr-2" />
                <span>
                  {escrutinioStatus === 'CLOSED' || escrutinioStatus === 'COMPLETED' 
                    ? 'Dashboard' 
                    : 'Volver'
                  }
                </span>
              </Button>
              <h1 className="ml-2 lg:ml-4 text-lg lg:text-xl font-semibold text-gray-900">
                <span className="hidden sm:inline">Nuevo Escrutinio</span>
                <span className="sm:hidden">Escrutinio</span>
              </h1>
            </div>
            
            <div className="flex items-center space-x-2">
              {hasActiveEscrutinio && (
                <button
                  onClick={() => setShowCancelDialog(true)}
                  className="px-2 sm:px-3 py-1 text-xs bg-orange-100 text-orange-700 rounded-full hover:bg-orange-200 transition-colors whitespace-nowrap"
                  title="Reiniciar conteo de votos"
                >
                  <span>Reiniciar</span>
                </button>
              )}
              {(escrutinioState.selectedMesa || escrutinioState.selectedLevel) && !hasActiveEscrutinio && (
                <button
                  onClick={() => {
                    // Limpiar estado y ir al paso 1 (configuración)
                    clearState();
                    // Limpiar solo las claves de tracking para permitir que el nuevo escrutinio se detecte como nuevo
                    // NO borramos los stores persistidos porque pueden haber otros escrutinios abiertos
                    if (typeof window !== 'undefined') {
                      // Limpiar claves de tracking para que el nuevo escrutinio se detecte como nuevo
                      localStorage.removeItem('last-presidential-escrutinio-id');
                      localStorage.removeItem('last-legislative-escrutinio-id');
                      localStorage.removeItem('is-new-escrutinio');
                      localStorage.removeItem('new-escrutinio-id');
                    }
                    // Ir al paso 1 para configurar nuevo escrutinio
                    saveState({ currentStep: 1 });
                  }}
                  className="px-2 sm:px-3 py-1 text-xs bg-red-100 text-red-700 rounded-full hover:bg-red-200 transition-colors whitespace-nowrap"
                  title="Iniciar nuevo escrutinio"
                >
                  <span className="hidden sm:inline">Nuevo Escrutinio</span>
                  <span className="sm:hidden">Nuevo</span>
                </button>
              )}
              <MapPin className="h-4 w-4 lg:h-5 lg:w-5 text-gray-400" />
              <span className="text-xs lg:text-sm text-gray-700 hidden sm:block">
                {user?.name}
              </span>
            </div>
          </div>
        </div>
      </header>

      <div className={`${escrutinioState.currentStep === 2 ? "mobile-container bg-white" : "max-w-4xl mx-auto px-0 sm:px-6 lg:px-8 py-4 lg:py-8"}`}>
        {/* Progress Steps - Mobile optimized */}
        <div className={`${escrutinioState.currentStep === 2 ? "mb-0 px-0 pt-2 pb-1 bg-white border-b border-gray-200" : "mb-6 lg:mb-8"}`}>
          <div className="flex items-center justify-center space-x-2 lg:space-x-4">
            <div className={`flex items-center ${escrutinioState.currentStep >= 1 ? 'text-primary-600' : 'text-gray-400'}`}>
              <div className={`w-6 h-6 lg:w-8 lg:h-8 rounded-full flex items-center justify-center border-2 text-xs lg:text-sm ${
                escrutinioState.currentStep >= 1 ? 'border-primary-600 bg-primary-600 text-white' : 'border-gray-300'
              }`}>
                1
              </div>
              <span className="ml-1 lg:ml-2 text-xs lg:text-sm font-medium hidden sm:block">Configuración</span>
            </div>
            
            <div className={`w-8 lg:w-16 h-0.5 ${escrutinioState.currentStep >= 2 ? 'bg-primary-600' : 'bg-gray-300'}`}></div>
            
            <div className={`flex items-center ${escrutinioState.currentStep >= 2 ? 'text-primary-600' : 'text-gray-400'}`}>
              <div className={`w-6 h-6 lg:w-8 lg:h-8 rounded-full flex items-center justify-center border-2 text-xs lg:text-sm ${
                escrutinioState.currentStep >= 2 ? 'border-primary-600 bg-primary-600 text-white' : 'border-gray-300'
              }`}>
                2
              </div>
              <span className="ml-1 lg:ml-2 text-xs lg:text-sm font-medium hidden sm:block">Conteo</span>
            </div>
            
            <div className={`w-8 lg:w-16 h-0.5 ${escrutinioState.currentStep >= 3 ? 'bg-primary-600' : 'bg-gray-300'}`}></div>
            
            <div className={`flex items-center ${escrutinioState.currentStep >= 3 ? 'text-primary-600' : 'text-gray-400'}`}>
              <div className={`w-6 h-6 lg:w-8 lg:h-8 rounded-full flex items-center justify-center border-2 text-xs lg:text-sm ${
                escrutinioState.currentStep >= 3 ? 'border-primary-600 bg-primary-600 text-white' : 'border-gray-300'
              }`}>
                3
              </div>
              <span className="ml-1 lg:ml-2 text-xs lg:text-sm font-medium hidden sm:block">Evidencia</span>
            </div>
          </div>
        </div>
            {/* Mobile Optimization Indicator */}
            {escrutinioState.currentStep === 2 && (
              <div className="sm:hidden bg-blue-50 border-b border-blue-200 px-4 py-2">
                <div className="flex items-center justify-center">
                  <div className="w-2 h-2 bg-blue-500 rounded-full mr-2"></div>
                  <span className="text-xs text-blue-700 font-medium">Modo Conteo Optimizado</span>
                </div>
              </div>
            )}

        {/* Step 1: Configuration */}
        {escrutinioState.currentStep === 1 && (
          <div className="bg-white p-0 sm:p-6 rounded-none sm:rounded-lg shadow-none sm:shadow-sm border-0 sm:border min-h-full sm:min-h-0 w-full mobile-full-width">
            <div className="flex items-center justify-between mb-4 px-3 sm:px-0">
              <h2 className="text-lg font-semibold text-gray-900">Configuración del Escrutinio</h2>
            </div>
            

            {/* Alerta de JRV con Escrutinio Activo */}
            {showJRVWarning && activeEscrutinio && (
              <div className="mb-6 mx-3 sm:mx-0 p-4 bg-orange-50 border border-orange-200 rounded-lg">
                <div className="flex items-start">
                  <div className="w-6 h-6 bg-orange-100 rounded-full flex items-center justify-center mr-3 mt-0.5">
                    <AlertCircle className="h-4 w-4 text-orange-600" />
                  </div>
                  <div className="flex-1">
                    <h3 className="text-sm font-semibold text-orange-900 mb-1">
                      Escrutinio Activo Encontrado
                    </h3>
                    <p className="text-sm text-orange-700 mb-3">
                      JRV <strong>{activeEscrutinio.mesaNumber}</strong> ya tiene un escrutinio abierto.<br/>
                      Nivel: <strong>{activeEscrutinio.electionLevel}</strong> | Iniciado por: <strong>{activeEscrutinio.user.name}</strong>
                    </p>
                    <div className="flex gap-2">
                      <button
                        onClick={handleContinueEscrutinio}
                        className="px-3 py-1 text-sm bg-orange-600 text-white rounded-md hover:bg-orange-700 transition-colors"
                      >
                        Continuar Escrutinio
                      </button>
                      <button
                        onClick={handleCloseJRVWarning}
                        className="px-3 py-1 text-sm bg-gray-500 text-white rounded-md hover:bg-gray-600 transition-colors"
                      >
                        Cerrar
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}
            
            <div className="space-y-4 px-3 sm:px-0">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Mesa Electoral (JRV)
                </label>
                <SearchInput
                  value={escrutinioState.selectedMesa}
                  onChange={handleJRVChange}
                  onSelect={handleJRVSelect}
                  placeholder="Escribir número de JRV (ej: 00001)"
                  disabled={isStarting}
                />
                {escrutinioState.selectedMesaInfo && (
                  <div className="mt-2 p-3 bg-green-50 border border-green-200 rounded-md">
                    <div className="flex items-center">
                      <CheckCircle className="h-4 w-4 text-green-600 mr-2" />
                      <div>
                        <div className="text-sm font-medium text-green-800">
                          {escrutinioState.selectedMesaInfo?.label}
                        </div>
                        <div className="text-xs text-green-600">
                          {escrutinioState.selectedMesaInfo?.department}
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-3">
                  Nivel Electoral
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 w-full">
                  <button
                    onClick={() => handleLevelSelect('PRESIDENTIAL')}
                    disabled={isLoading || isStarting}
                    className={`px-6 py-4 rounded-lg border-2 font-medium transition-all duration-200 ${
                      escrutinioState.selectedLevel === 'PRESIDENTIAL'
                        ? 'border-blue-500 bg-blue-50 text-blue-700'
                        : 'border-gray-200 bg-white text-gray-700 hover:border-blue-300 hover:bg-blue-50'
                    } ${(isLoading || isStarting) ? 'opacity-50 cursor-not-allowed' : ''}`}
                  >
                    <div className="flex items-center justify-center">
                      {isLoading && escrutinioState.selectedLevel === 'PRESIDENTIAL' && (
                        <Loader2 className="h-5 w-5 animate-spin mr-2" />
                      )}
                      <span>Presidencial</span>
                    </div>
                  </button>
                  
                  <button
                    onClick={() => handleLevelSelect('LEGISLATIVE')}
                    disabled={isLoading || isStarting}
                    className={`px-6 py-4 rounded-lg border-2 font-medium transition-all duration-200 ${
                      escrutinioState.selectedLevel === 'LEGISLATIVE'
                        ? 'border-blue-500 bg-blue-50 text-blue-700'
                        : 'border-gray-200 bg-white text-gray-700 hover:border-blue-300 hover:bg-blue-50'
                    } ${(isLoading || isStarting) ? 'opacity-50 cursor-not-allowed' : ''}`}
                  >
                    <div className="flex items-center justify-center">
                      {isLoading && escrutinioState.selectedLevel === 'LEGISLATIVE' && (
                        <Loader2 className="h-5 w-5 animate-spin mr-2" />
                      )}
                      <span>Legislativo</span>
                    </div>
                  </button>
                </div>
                
                <p className="mt-3 text-sm text-gray-600 text-center">
                  Al seleccionar un nivel, estarás brindando tu ubicación para agregarla al escrutinio
                </p>
              </div>

              {/* Información del usuario que realizará el escrutinio */}
              {user && (
                <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                  <div className="flex items-start">
                    <div className="w-6 h-6 bg-blue-100 rounded-full flex items-center justify-center mr-3 mt-0.5">
                      <Settings className="h-4 w-4 text-blue-600" />
                    </div>
                    <div>
                      <h3 className="text-sm font-medium text-blue-900 mb-1">
                        Información del Escrutinio
                      </h3>
                      <p className="text-sm text-blue-700">
                        Estarás realizando este escrutinio con el nombre <span className="font-semibold">{user.name}</span> y correo electrónico <span className="font-semibold">{user.email}</span>
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {error && (
                <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-md">
                  <div className="flex">
                    <AlertCircle className="h-5 w-5 text-red-400" />
                    <div className="ml-3">
                      <p className="text-sm text-red-800">{error.userFriendlyMessage}</p>
                      {error.code === 1 && (
                        <button
                          onClick={() => setShowInstructions(!showInstructions)}
                          className="text-xs text-red-700 underline mt-1"
                        >
                          Ver instrucciones detalladas
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {showInstructions && (
                <div className="mt-4 p-4 bg-gray-50 border border-gray-200 rounded-md">
                  <div className="flex items-start">
                    <Smartphone className="h-4 w-4 text-gray-600 mt-0.5 flex-shrink-0" />
                    <div className="ml-2">
                      <p className="text-xs text-gray-800 font-medium mb-2">Instrucciones para habilitar ubicación:</p>
                      <pre className="text-xs text-gray-700 whitespace-pre-line">{showLocationInstructions()}</pre>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Step 2: Vote Counting */}
        {escrutinioState.currentStep === 2 && (
          <div className="bg-white p-6 rounded-lg shadow-sm border">
            <h2 className="text-lg font-semibold text-gray-900 mb-4 hidden sm:block">Conteo de Votos</h2>
            
            {/* Banner de ubicación consolidado */}
            {(() => {
              // Si hay error de GPS, mostrar error
              if (gpsError) {
                return (
                  <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
                    <div className="flex items-start">
                      <AlertCircle className="h-5 w-5 text-red-600 mr-2 mt-0.5 flex-shrink-0" />
                      <div className="flex-1">
                        <p className="text-sm text-red-800 mb-3">
                          ❌ Error al obtener ubicación GPS
                        </p>
                        <p className="text-xs text-red-700 mb-3 whitespace-pre-line">
                          {gpsError}
                        </p>
                        <button
                          onClick={() => handleGetLocation(escrutinioState.selectedLevel)}
                          disabled={isStarting}
                          className="px-3 py-1 bg-red-600 text-white text-xs rounded hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          {isStarting ? 'Obteniendo GPS...' : 'Intentar Nuevamente'}
                        </button>
                      </div>
                    </div>
                  </div>
                );
              }
              
              // Si hay éxito reciente, mostrar mensaje temporal
              if (gpsSuccess) {
                return (
                  <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg">
                    <div className="flex items-center">
                      <CheckCircle className="h-5 w-5 text-green-600 mr-2" />
                      <span className="text-sm text-green-800">
                        ✅ GPS obtenido correctamente. Ubicación registrada para el escrutinio.
                      </span>
                    </div>
                  </div>
                );
              }
              
              // Si ya tenemos ubicación guardada, mostrar estado
              if (escrutinioState.location) {
                return (
                  <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center">
                        <MapPin className="h-5 w-5 text-blue-600 mr-2" />
                        <div>
                          <p className="text-sm font-medium text-blue-800">Ubicación guardada</p>
                          <p className="text-xs text-blue-700">
                            Precisión: ±{Math.round(escrutinioState.location.accuracy || 0)}m
                          </p>
                        </div>
                      </div>
                      <button
                        onClick={() => handleGetLocation(escrutinioState.selectedLevel)}
                        disabled={isStarting}
                        className="px-3 py-1 bg-blue-600 text-white text-xs rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {isStarting ? 'Actualizando...' : 'Actualizar'}
                      </button>
                    </div>
                  </div>
                );
              }
              
              // Si no hay ubicación, mostrar botón para obtener
              return (
                <div className="mb-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center">
                      <MapPin className="h-5 w-5 text-yellow-600 mr-2" />
                      <div>
                        <p className="text-sm font-medium text-yellow-800">Ubicación requerida</p>
                        <p className="text-xs text-yellow-700">
                          Se necesita tu ubicación para iniciar el escrutinio
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={() => handleGetLocation(escrutinioState.selectedLevel)}
                      disabled={isStarting}
                      className="px-3 py-1 bg-yellow-600 text-white text-xs rounded hover:bg-yellow-700 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {isStarting ? 'Obteniendo...' : 'Obtener Ubicación'}
                    </button>
                  </div>
                </div>
              );
            })()}
            {/* Show loading spinner mientras se está creando el escrutinio */}
            {isStarting ? (
              <div className="bg-white p-6 rounded-lg shadow-sm border">
                <div className="text-center py-8">
                  <Loader2 className="h-12 w-12 animate-spin text-blue-600 mx-auto mb-4" />
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">Iniciando Escrutinio</h3>
                  <p className="text-gray-600">
                    Obteniendo ubicación GPS y creando escrutinio...
                  </p>
                </div>
              </div>
            ) : escrutinioState.selectedLevel === 'LEGISLATIVE' ? (
              <DiputadosEscrutinio 
                jrvNumber={escrutinioState.selectedMesa} 
                escrutinioId={escrutinioState.escrutinioId || undefined}
                userId={user?.id}
                onEscrutinioStatusChange={handleEscrutinioStatusChange}
              />
            ) : escrutinioState.escrutinioId ? (
              (() => {
                const jrvLocationProp = escrutinioState.selectedMesaInfo?.location || 'N/A';
                const departmentProp = escrutinioState.selectedMesaInfo?.department || 'N/A';
                console.log('📍 [DEBUG] Props passed to PresidencialEscrutinio:', {
                  jrvNumber: escrutinioState.selectedMesa,
                  jrvLocation: jrvLocationProp,
                  department: departmentProp,
                  selectedMesaInfo: escrutinioState.selectedMesaInfo
                });
                return (
                  <PresidencialEscrutinio
                    candidates={filteredCandidates.map((c) => ({
                      id: c.id,
                      name: c.name,
                      party: mapPartyToDisplayName(c.party),
                      number: c.number,
                      partyColor: getPartyColor(c.party),
                    }))}
                    escrutinioId={escrutinioState.escrutinioId}
                    userId={user?.id}
                    mesaId={escrutinioState.selectedMesa}
                    jrvNumber={escrutinioState.selectedMesa}
                    jrvLocation={jrvLocationProp}
                    department={departmentProp}
                    gps={escrutinioState.location ? { latitude: escrutinioState.location.lat, longitude: escrutinioState.location.lng, accuracy: escrutinioState.location.accuracy || 0 } : null}
                    deviceId={typeof window !== 'undefined' ? localStorage.getItem('device-id') || undefined : undefined}
                    onEscrutinioStatusChange={handleEscrutinioStatusChange}
                  />
                );
              })()
            ) : (
              <div className="bg-white p-6 rounded-lg shadow-sm border">
                <div className="text-center py-8">
                  <AlertCircle className="h-12 w-12 text-amber-500 mx-auto mb-4" />
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">Iniciando Escrutinio</h3>
                  <p className="text-gray-600">
                    Necesitas iniciar el escrutinio desde el paso 1 para comenzar el conteo.
                  </p>
                </div>
              </div>
            )}
          </div>
        )}


        {/* Step 3: Evidence Upload */}
        {escrutinioState.currentStep === 3 && (
          <div className="bg-white p-6 rounded-lg shadow-sm border">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Carga de Evidencia</h2>
            
            <div className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Foto del Acta Firmada
                </label>
                <div className="space-y-3">
                  <div className="flex gap-2">
                    <label className={`flex-1 cursor-pointer ${escrutinioState.isEscrutinioFinished ? 'opacity-50 cursor-not-allowed' : ''}`}>
                      <input
                        type="file"
                        accept="image/*"
                        capture="environment"
                        onChange={(e) => handleActaUpload(e, 'CAMERA')}
                        className="hidden"
                        id="acta-camera-main"
                        disabled={escrutinioState.isEscrutinioFinished}
                      />
                      <div className={`w-full px-4 py-3 bg-blue-600 text-white rounded-lg text-sm text-center hover:bg-blue-700 transition-colors ${escrutinioState.isEscrutinioFinished ? 'opacity-50' : ''}`}>
                        📷 Tomar foto
                      </div>
                    </label>
                    <label className={`flex-1 cursor-pointer ${escrutinioState.isEscrutinioFinished ? 'opacity-50 cursor-not-allowed' : ''}`}>
                      <input
                        type="file"
                        accept="image/*"
                        onChange={(e) => handleActaUpload(e, 'LIBRARY')}
                        className="hidden"
                        id="acta-library-main"
                        disabled={escrutinioState.isEscrutinioFinished}
                      />
                      <div className={`w-full px-4 py-3 bg-gray-600 text-white rounded-lg text-sm text-center hover:bg-gray-700 transition-colors ${escrutinioState.isEscrutinioFinished ? 'opacity-50' : ''}`}>
                        🖼️ Seleccionar de galería
                      </div>
                    </label>
                  </div>
                  <p className="text-sm text-gray-500 text-center">
                    PNG, JPG hasta 10MB
                  </p>
                </div>
                {escrutinioState.actaImage && (
                  <div className="mt-4 space-y-3">
                    <div className="p-4 bg-green-50 border border-green-200 rounded-md">
                      <div className="flex items-center">
                        <CheckCircle className="h-5 w-5 text-green-600" />
                        <span className="ml-2 text-sm text-green-800">
                          {escrutinioState.actaImage.name} seleccionada
                          {escrutinioState.actaImageSource && (
                            <span className="ml-2 text-green-600">
                              ({escrutinioState.actaImageSource === 'CAMERA' ? 'Tomada con cámara' : 'Subida desde galería'})
                            </span>
                          )}
                        </span>
                      </div>
                    </div>
                    
                    {/* Vista previa de la imagen */}
                    <div className="relative">
                      <img
                        src={URL.createObjectURL(escrutinioState.actaImage)}
                        alt="Vista previa del acta"
                        className="w-full h-48 object-cover rounded-lg border border-gray-200 cursor-pointer hover:opacity-90 transition-opacity"
                        onClick={() => setShowImageModal(true)}
                      />
                      <div className="absolute inset-0 bg-black bg-opacity-0 hover:bg-opacity-10 transition-all duration-200 rounded-lg flex items-center justify-center">
                        <div className="bg-white bg-opacity-90 rounded-full p-2 opacity-0 hover:opacity-100 transition-opacity">
                          <Camera className="h-6 w-6 text-gray-700" />
                        </div>
                      </div>
                      <div className="absolute bottom-2 left-2 bg-black bg-opacity-70 text-white text-xs px-2 py-1 rounded">
                        Click para ver en grande
                      </div>
                    </div>
                  </div>
                )}
              </div>

              <div className="pt-4 space-y-3">
                {!escrutinioState.isEscrutinioFinished ? (
                  <Button
                    variant="primary"
                    size="lg"
                    onClick={handleFinishEscrutinio}
                    disabled={!escrutinioState.actaImage}
                  >
                    Fin de Escrutinio
                  </Button>
                ) : (
                  <div className="space-y-3">
                    <Button
                      variant="primary"
                      size="lg"
                      onClick={handleSubmit}
                      disabled={isSubmitting}
                      loading={isSubmitting}
                    >
                      {isSubmitting ? 'Enviando...' : 'Mandar Escrutinio'}
                    </Button>
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={handleEditEscrutinio}
                    >
                      Editar
                    </Button>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Componente de estado offline */}
      {(hasOfflineItems || !isOnline) && (
        <div className="fixed bottom-4 left-4 right-4 z-50 md:left-auto md:right-4 md:max-w-sm">
          {!isOnline ? (
            <div className="bg-red-500 text-white p-4 rounded-lg shadow-lg">
              <div className="flex items-center">
                <div className="w-3 h-3 bg-red-200 rounded-full mr-3 animate-pulse"></div>
                <div className="flex-1">
                  <p className="font-semibold">Sin conexión a internet</p>
                  <p className="text-sm opacity-90">
                    {hasOfflineItems 
                      ? `${hasOfflineItems} escrutinios guardados para cuando regrese la conexión`
                      : 'Tus datos se guardarán automáticamente'
                    }
                  </p>
                </div>
              </div>
            </div>
          ) : hasOfflineItems ? (
            <div className="bg-yellow-500 text-white p-4 rounded-lg shadow-lg">
              <div className="flex items-center">
                <div className="w-3 h-3 bg-yellow-200 rounded-full mr-3"></div>
                <div className="flex-1">
                  <p className="font-semibold">Escrutinios pendientes</p>
                  <p className="text-sm opacity-90">
                    {hasOfflineItems} escrutinios guardados para sincronizar
                  </p>
                </div>
              </div>
            </div>
          ) : null}
        </div>
      )}


      {/* Diálogo de Confirmación de Cancelación */}
      {showCancelDialog && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full">
            {!showSecondConfirmation ? (
              <div className="p-6">
                <div className="flex items-center mb-4">
                  <div className="w-10 h-10 bg-orange-100 rounded-full flex items-center justify-center mr-3">
                    <AlertCircle className="h-6 w-6 text-orange-600" />
                  </div>
                  <h3 className="text-lg font-semibold text-gray-900">
                    ¿Reiniciar Conteo?
                  </h3>
                </div>
                <p className="text-gray-600 mb-6">
                  ¿Estás seguro de que deseas reiniciar el conteo de votos? 
                  Se borrarán todos los votos registrados y tendrás que seleccionar el JRV nuevamente para empezar de cero.
                </p>
                <div className="flex flex-col sm:flex-row gap-3">
                  <button
                    onClick={() => setShowSecondConfirmation(true)}
                    className="flex-1 px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors font-medium"
                  >
                    Sí, Reiniciar
                  </button>
                  <button
                    onClick={() => setShowCancelDialog(false)}
                    className="flex-1 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors font-medium"
                  >
                    No, Continuar
                  </button>
                </div>
              </div>
            ) : (
              <div className="p-6">
                <div className="flex items-center mb-4">
                  <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center mr-3">
                    <AlertCircle className="h-6 w-6 text-red-600" />
                  </div>
                  <h3 className="text-lg font-semibold text-red-900">
                    ⚠️ Última Advertencia
                  </h3>
                </div>
                <p className="text-gray-700 mb-2 font-medium">
                  Esta acción BORRARÁ PERMANENTEMENTE:
                </p>
                <ul className="text-gray-600 mb-6 space-y-1 text-sm">
                  <li>• Todos los votos registrados en este escrutinio</li>
                  <li>• La imagen del acta subida</li>
                  <li>• El GPS capturado</li>
                  <li>• Toda la información del conteo</li>
                </ul>
                <p className="text-red-600 mb-6 font-medium text-sm">
                  Esta acción NO se puede deshacer.
                </p>
                <div className="flex flex-col sm:flex-row gap-3">
                  <button
                    onClick={() => {
                      setShowCancelDialog(false);
                      setShowSecondConfirmation(false);
                      resetCurrentEscrutinio();
                    }}
                    className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors font-medium"
                  >
                    Confirmar Borrado
                  </button>
                  <button
                    onClick={() => {
                      setShowSecondConfirmation(false);
                    }}
                    className="flex-1 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors font-medium"
                  >
                    Cancelar
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Modal de zoom para la imagen del acta */}
      {showImageModal && escrutinioState.actaImage && (
        <div className="fixed inset-0 bg-black bg-opacity-90 flex items-center justify-center z-50 p-4">
          <div className="relative max-w-4xl max-h-full">
            <button
              onClick={() => setShowImageModal(false)}
              className="absolute top-4 right-4 z-10 bg-white bg-opacity-90 hover:bg-opacity-100 rounded-full p-2 transition-all"
            >
              <svg className="h-6 w-6 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
            <img
              src={URL.createObjectURL(escrutinioState.actaImage)}
              alt="Acta en tamaño completo"
              className="max-w-full max-h-full object-contain rounded-lg"
            />
            <div className="absolute bottom-4 left-4 bg-black bg-opacity-70 text-white text-sm px-3 py-2 rounded">
              {escrutinioState.actaImage.name}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function EscrutinioPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Cargando...</p>
        </div>
      </div>
    }>
      <EscrutinioPageContent />
    </Suspense>
  );
} 