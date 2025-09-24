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
    startNewEscrutinio,
    hasActiveEscrutinio, 
    canRecoverEscrutinio 
  } = useEscrutinioPersistence();

  // Estados locales (no persistentes)
  const [isStarting, setIsStarting] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showInstructions, setShowInstructions] = useState(false);
  const [showRecoveryAlert, setShowRecoveryAlert] = useState(false);
  const [showCancelDialog, setShowCancelDialog] = useState(false);
  const [gpsSuccess, setGpsSuccess] = useState(false);
  
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

  // Manejar selección de JRV
  const handleJRVSelect = (result: JRVSearchResult) => {
    saveState({
      selectedMesa: result.value,
      selectedMesaInfo: result,
    });
  };

  const handleJRVChange = (value: string) => {
    saveState({
      selectedMesa: value,
      selectedMesaInfo: value ? escrutinioState.selectedMesaInfo : null,
    });
  };

  // Manejar selección de nivel electoral (automáticamente obtiene GPS y va al conteo)
  const handleLevelSelect = async (level: 'PRESIDENTIAL' | 'LEGISLATIVE') => {
    if (!escrutinioState.selectedMesa) {
      alert('Por favor selecciona una JRV primero');
      return;
    }

    // Si hay un escrutinio anterior, limpiarlo primero
    if (showRecoveryAlert) {
      clearState();
      voteStore.clear();
      if (typeof window !== 'undefined') {
        localStorage.removeItem('last-escrutinio-key');
      }
      setShowRecoveryAlert(false);
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

  // Cargar votos existentes cuando se establece el escrutinioId
  useEffect(() => {
    const loadExistingVotes = async () => {
      if (!escrutinioState.escrutinioId) return;
      try {
        await voteStore.loadFromServer(escrutinioState.escrutinioId);
      } catch (error) {
        console.warn('No se pudieron cargar votos existentes:', error);
      }
    };
    loadExistingVotes();
  }, [escrutinioState.escrutinioId, voteStore]);

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

  const handleGetLocation = async (electionLevel?: string) => {
    const result = await getCurrentLocation();
    if (!result) return;
    try {
      setIsStarting(true);
      setGpsSuccess(false);
      
      // Usar el nivel pasado como parámetro o el del estado
      const level = electionLevel || escrutinioState.selectedLevel;
      
      const payload = {
        mesaNumber: escrutinioState.selectedMesa,
        electionLevel: level,
        gps: { 
          latitude: result.lat, 
          longitude: result.lng, 
          accuracy: result.accuracy || 0 
        },
      };
      
      console.log('🔍 [ESCRUTINIO] Enviando payload a /api/escrutinio/start:', JSON.stringify(payload, null, 2));
      console.log('🔍 [ESCRUTINIO] GPS result:', result);
      
      const resp = await axios.post('/api/escrutinio/start', payload);
      if (resp.data?.success && resp.data?.data?.escrutinioId) {
        // Reset any previous counts/batch when starting a brand new escrutinio
        voteStore.clear();
        
        // Mostrar mensaje de éxito por un momento
        setGpsSuccess(true);
        setTimeout(() => setGpsSuccess(false), 3000);
        
        // Guardar el estado del escrutinio iniciado
        saveState({
          escrutinioId: resp.data.data.escrutinioId,
          currentStep: 2, // Ir al paso de conteo después de obtener GPS
          location: result,
          selectedLevel: level, // Asegurar que el nivel se guarde correctamente
        });
      } else {
        console.error('❌ [ESCRUTINIO] Respuesta del servidor no exitosa:', resp.data);
        alert(resp.data?.error || 'No se pudo iniciar el escrutinio');
      }
    } catch (e: any) {
      console.error('❌ [ESCRUTINIO] Error obteniendo ubicación:', e);
      if (e.response) {
        console.error('❌ [ESCRUTINIO] Respuesta del servidor:', e.response.data);
        console.error('❌ [ESCRUTINIO] Status:', e.response.status);
      }
      alert(e?.response?.data?.error || 'Error al iniciar el escrutinio');
    } finally {
      setIsStarting(false);
    }
  };

  // counts are managed by store now

  const handleActaUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      saveState({ actaImage: file });
    }
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
        await axios.post(`/api/escrutinio/${encodeURIComponent(escrutinioState.escrutinioId!)}/evidence`, { publicUrl, hash });
        return;
      }
    } catch {
      // fallback below
    }
    try {
      const dataUrl = await toDataUrl(escrutinioState.actaImage);
      const hash = await computeSHA256Hex(escrutinioState.actaImage);
      await axios.post(`/api/escrutinio/${encodeURIComponent(escrutinioState.escrutinioId!)}/evidence`, { publicUrl: dataUrl, hash });
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

  // Mostrar alerta de recuperación con delay cuando hay JRV seleccionado
  useEffect(() => {
    if (canRecoverEscrutinio && !hasActiveEscrutinio && escrutinioState.selectedMesa) {
      // Esperar 3 segundos antes de mostrar la advertencia
      const timer = setTimeout(() => {
        setShowRecoveryAlert(true);
      }, 3000);
      
      // Limpiar timer si cambia el estado antes de que se ejecute
      return () => clearTimeout(timer);
    }
  }, [canRecoverEscrutinio, hasActiveEscrutinio, escrutinioState.selectedMesa]);

  // Limpiar votos cuando cambie el JRV o el nivel
  useEffect(() => {
    if (escrutinioState.selectedMesa && escrutinioState.selectedLevel) {
      // Crear una clave única para este JRV y nivel
      const currentKey = `${escrutinioState.selectedMesa}-${escrutinioState.selectedLevel}`;
      const lastKey = localStorage.getItem('last-escrutinio-key');
      
      console.log('🔍 Verificando cambio de JRV/nivel:', { 
        currentKey, 
        lastKey, 
        currentStep: escrutinioState.currentStep,
        escrutinioId: escrutinioState.escrutinioId 
      });
      
      // Si cambió el JRV o nivel, limpiar los votos
      if (lastKey && lastKey !== currentKey) {
        console.log('🔄 JRV o nivel cambió, limpiando votos:', { lastKey, currentKey });
        voteStore.clear();
        // También limpiar el escrutinioId para forzar nuevo escrutinio
        saveState({ escrutinioId: null, currentStep: 1 });
      }
      
      // Guardar la clave actual
      localStorage.setItem('last-escrutinio-key', currentKey);
    }
  }, [escrutinioState.selectedMesa, escrutinioState.selectedLevel, voteStore, saveState]);

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
                <span className="hidden sm:inline">Volver</span>
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
                  className="px-3 py-1 text-xs bg-red-100 text-red-700 rounded-full hover:bg-red-200 transition-colors"
                  title="Cancelar escrutinio actual"
                >
                  Cancelar Escrutinio
                </button>
              )}
              {(escrutinioState.selectedMesa || escrutinioState.selectedLevel) && !hasActiveEscrutinio && (
                <button
                  onClick={() => {
                    // Limpiar estado y ir al paso 1 (configuración)
                    clearState();
                    // Limpiar también el store de votos y la clave del último escrutinio
                    if (typeof window !== 'undefined') {
                      import('@/store/voteStore').then(({ useVoteStore }) => {
                        useVoteStore.getState().clear();
                      });
                      localStorage.removeItem('last-escrutinio-key');
                    }
                    // Ir al paso 1 para configurar nuevo escrutinio
                    saveState({ currentStep: 1 });
                  }}
                  className="px-3 py-1 text-xs bg-red-100 text-red-700 rounded-full hover:bg-red-200 transition-colors"
                  title="Iniciar nuevo escrutinio"
                >
                  Nuevo Escrutinio
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

      <div className={`${escrutinioState.currentStep === 2 ? "mobile-container bg-white" : "max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-4 lg:py-8"}`}>
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
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-900">Configuración del Escrutinio</h2>
            </div>
            
            {/* Alerta de Escrutinio Anterior */}
            {showRecoveryAlert && (
              <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                <div className="flex items-start">
                  <div className="w-6 h-6 bg-blue-100 rounded-full flex items-center justify-center mr-3 mt-0.5">
                    <CheckCircle className="h-4 w-4 text-blue-600" />
                  </div>
                  <div className="flex-1">
                    <h3 className="text-sm font-semibold text-blue-900 mb-1">
                      Escrutinio Anterior Encontrado
                    </h3>
                    <p className="text-sm text-blue-700 mb-3">
                      Se encontró un escrutinio previo para la JRV <strong>{escrutinioState.selectedMesaInfo?.label || escrutinioState.selectedMesa}</strong> 
                      ({escrutinioState.selectedLevel === 'PRESIDENTIAL' ? 'Presidencial' : 'Legislativo'}). 
                      ¿Deseas continuar con el escrutinio anterior o iniciar uno nuevo?
                    </p>
                    <div className="flex gap-2">
                      <button
                        onClick={() => {
                          setShowRecoveryAlert(false);
                          // Cargar los votos guardados y continuar con el escrutinio
                          if (escrutinioState.escrutinioId) {
                            voteStore.loadFromServer(escrutinioState.escrutinioId).then(() => {
                              saveState({ currentStep: 2 });
                            }).catch((error) => {
                              console.warn('No se pudieron cargar los votos guardados:', error);
                              saveState({ currentStep: 2 });
                            });
                          } else {
                            saveState({ currentStep: 2 });
                          }
                        }}
                        className="px-3 py-1 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
                      >
                        Continuar con el escrutinio
                      </button>
                      <button
                        onClick={() => {
                          setShowRecoveryAlert(false);
                          // Limpiar todo y permitir iniciar nuevo escrutinio
                          clearState();
                          voteStore.clear();
                          if (typeof window !== 'undefined') {
                            localStorage.removeItem('last-escrutinio-key');
                          }
                        }}
                        className="px-3 py-1 text-sm bg-gray-600 text-white rounded-md hover:bg-gray-700 transition-colors"
                      >
                        Cerrar
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Mesa Electoral (JRV)
                </label>
                <SearchInput style={{ fontSize: "16px" }}
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
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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
            
            {/* Mensaje de éxito del GPS */}
            {gpsSuccess && (
              <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg">
                <div className="flex items-center">
                  <CheckCircle className="h-5 w-5 text-green-600 mr-2" />
                  <span className="text-sm text-green-800">
                    ✅ GPS obtenido correctamente. Ubicación registrada para el escrutinio.
                  </span>
                </div>
              </div>
            )}
            
            {escrutinioState.location && (
              <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-md">
                <div className="flex items-center">
                  <CheckCircle className="h-5 w-5 text-green-600" />
                  <div className="ml-3">
                    <p className="text-sm font-medium text-green-800">Ubicación verificada</p>
                    <p className="text-sm text-green-700">
                      Lat: {escrutinioState.location.lat.toFixed(6)}, Lng: {escrutinioState.location.lng.toFixed(6)}
                    </p>
                  </div>
                </div>
              </div>
            )}
            {/* Show different UI based on election level */}
            {escrutinioState.selectedLevel === 'LEGISLATIVE' ? (
              <DiputadosEscrutinio 
                jrvNumber={escrutinioState.selectedMesa} 
                escrutinioId={escrutinioState.escrutinioId || undefined}
                userId={user?.id}
              />
            ) : escrutinioState.escrutinioId ? (
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
                department={escrutinioState.selectedMesaInfo?.department || 'N/A'}
                gps={escrutinioState.location ? { latitude: escrutinioState.location.lat, longitude: escrutinioState.location.lng, accuracy: escrutinioState.location.accuracy || 0 } : null}
                deviceId={typeof window !== 'undefined' ? localStorage.getItem('device-id') || undefined : undefined}
              />
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

        {escrutinioState.currentStep === 2 && escrutinioState.selectedLevel !== 'LEGISLATIVE' && escrutinioState.escrutinioId && (
          <VoteFooter
            escrutinioId={escrutinioState.escrutinioId}
            onContinue={() => saveState({ currentStep: 3 })}
          />
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
                <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center">
                  <Camera className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleActaUpload}
                    className="hidden"
                    id="acta-upload"
                    disabled={escrutinioState.isEscrutinioFinished}
                  />
                  <label htmlFor="acta-upload" className={`cursor-pointer ${escrutinioState.isEscrutinioFinished ? 'opacity-50 cursor-not-allowed' : ''}`}>
                    <span className="text-primary-600 hover:text-primary-500 font-medium">
                      Seleccionar imagen
                    </span>
                    <span className="text-gray-500"> o arrastrar aquí</span>
                  </label>
                  <p className="text-sm text-gray-500 mt-2">
                    PNG, JPG hasta 10MB
                  </p>
                </div>
                {escrutinioState.actaImage && (
                  <div className="mt-4 p-4 bg-green-50 border border-green-200 rounded-md">
                    <div className="flex items-center">
                      <CheckCircle className="h-5 w-5 text-green-600" />
                      <span className="ml-2 text-sm text-green-800">
                        {escrutinioState.actaImage.name} seleccionada
                      </span>
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
            <div className="p-6">
              <div className="flex items-center mb-4">
                <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center mr-3">
                  <AlertCircle className="h-6 w-6 text-red-600" />
                </div>
                <h3 className="text-lg font-semibold text-gray-900">
                  ¿Cancelar Escrutinio?
                </h3>
              </div>
              <p className="text-gray-600 mb-6">
                ¿Estás seguro de que deseas cancelar el escrutinio actual? 
                Se perderán todos los votos registrados y tendrás que empezar de nuevo.
              </p>
              <div className="flex flex-col sm:flex-row gap-3">
                <button
                  onClick={() => {
                    setShowCancelDialog(false);
                    startNewEscrutinio();
                  }}
                  className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors font-medium"
                >
                  Sí, Cancelar
                </button>
                <button
                  onClick={() => setShowCancelDialog(false)}
                  className="flex-1 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors font-medium"
                >
                  No, Continuar
                </button>
              </div>
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