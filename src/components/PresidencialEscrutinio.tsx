"use client";
import React, { useState, useCallback, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, AlertCircle, CheckCircle, FileText, Camera, Upload, Vote } from 'lucide-react';
import VoteCard from '@/components/VoteCard';
import VoteHelpTooltip from '@/components/VoteHelpTooltip';
import { useVoteStore } from '@/store/voteStore';
import axios from 'axios';

export type VoteListItem = {
  id: string;
  name: string;
  party: string;
  partyColor?: string;
  number?: string | number;
};

interface PresidencialEscrutinioProps {
  candidates: VoteListItem[];
  escrutinioId: string;
  userId?: string;
  mesaId?: string;
  jrvNumber?: string;
  jrvLocation?: string;
  department?: string;
  gps?: { latitude: number; longitude: number; accuracy?: number } | null;
  deviceId?: string;
  onEscrutinioStatusChange?: (status: 'PENDING' | 'IN_PROGRESS' | 'CLOSED' | 'COMPLETED') => void;
}

export default function PresidencialEscrutinio({ 
  candidates, 
  escrutinioId, 
  userId, 
  mesaId, 
  jrvNumber,
  jrvLocation,
  department,
  gps, 
  deviceId,
  onEscrutinioStatusChange
}: PresidencialEscrutinioProps) {
  const router = useRouter();
  const { counts, increment, decrement, clear: clearVotes } = useVoteStore((s) => ({
    counts: s.counts,
    increment: s.increment,
    decrement: s.decrement,
    clear: s.clear,
  }));

  // Estados para foto y finalización
  const [actaImage, setActaImage] = useState<File | null>(null);
  const [actaImageSource, setActaImageSource] = useState<'CAMERA' | 'LIBRARY' | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isCompleting, setIsCompleting] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [isEscrutinioClosed, setIsEscrutinioClosed] = useState(false);
  const [escrutinioStatus, setEscrutinioStatus] = useState<'COMPLETED' | 'CLOSED'>('COMPLETED');
  const [isClosing, setIsClosing] = useState(false);
  const [isReopening, setIsReopening] = useState(false);
  const [cargaElectoral, setCargaElectoral] = useState<number | null>(null);
  const [mesaLocationFromServer, setMesaLocationFromServer] = useState<string | null>(null);
  const [mesaDepartmentFromServer, setMesaDepartmentFromServer] = useState<string | null>(null);

  // Depuración: Registrar cambios de estado
  useEffect(() => {
    console.log('📍 [DEBUG] mesaLocationFromServer state:', mesaLocationFromServer);
    console.log('📍 [DEBUG] mesaDepartmentFromServer state:', mesaDepartmentFromServer);
  }, [mesaLocationFromServer, mesaDepartmentFromServer]);

  // Ref para trackear el último escrutinioId y limpiar store cuando cambia
  const getInitialLastEscrutinioId = (): string | null => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('last-presidential-escrutinio-id');
    }
    return null;
  };
  const lastEscrutinioIdRef = useRef<string | null>(getInitialLastEscrutinioId());

  // Cargar votos desde servidor - solo limpiar si es un NUEVO escrutinio
  useEffect(() => {
    if (escrutinioId) {
      // Verificar si es un escrutinio nuevo (recién creado)
      const isNewEscrutinio = typeof window !== 'undefined' && 
        localStorage.getItem('is-new-escrutinio') === 'true' &&
        localStorage.getItem('new-escrutinio-id') === escrutinioId;
      
      // CRITICAL: Limpiar si es un NUEVO escrutinio (diferente al anterior) o si lastEscrutinioIdRef es null
      // Esto asegura que siempre empezamos limpio cuando hay un nuevo escrutinio
      const isDifferentEscrutinio = lastEscrutinioIdRef.current !== escrutinioId;
      const isFirstEscrutinio = lastEscrutinioIdRef.current === null;
      
      if (isDifferentEscrutinio || isFirstEscrutinio) {
        console.log('🔄 [PRESIDENCIAL] Nuevo escrutinio detectado, limpiando store local...');
        console.log('📊 [PRESIDENCIAL] Escrutinio anterior:', lastEscrutinioIdRef.current, '→ Nuevo:', escrutinioId);
        // CRITICAL: Limpiar el store ANTES de cualquier otra operación
        clearVotes();
        lastEscrutinioIdRef.current = escrutinioId;
        // Guardar en localStorage para persistir entre refrescos
        if (typeof window !== 'undefined') {
          localStorage.setItem('last-presidential-escrutinio-id', escrutinioId);
        }
      } else {
        console.log('🔄 [PRESIDENCIAL] Mismo escrutinio, manteniendo votos del store');
      }
      
      // Solo cargar votos del servidor si NO es un escrutinio nuevo
      // Los escrutinios nuevos deben empezar de 0
      if (!isNewEscrutinio && !isFirstEscrutinio && !isDifferentEscrutinio) {
        console.log('📊 [PRESIDENCIAL] Cargando votos desde servidor para escrutinio:', escrutinioId);
        const { loadFromServer } = useVoteStore.getState();
        loadFromServer(escrutinioId).then(() => {
          console.log('✅ [PRESIDENCIAL] Votos cargados desde servidor');
        }).catch((error) => {
          console.error('❌ [PRESIDENCIAL] Error cargando votos desde servidor:', error);
        });
      } else {
        console.log('🆕 [PRESIDENCIAL] Escrutinio nuevo detectado, NO cargando votos del servidor (empezando de 0)');
        // Limpiar el flag después de usarlo
        if (typeof window !== 'undefined') {
          localStorage.removeItem('is-new-escrutinio');
          localStorage.removeItem('new-escrutinio-id');
        }
      }
    } else {
      // Si no hay escrutinioId, resetear el ref
      lastEscrutinioIdRef.current = null;
      if (typeof window !== 'undefined') {
        localStorage.removeItem('last-presidential-escrutinio-id');
      }
    }
  }, [escrutinioId, clearVotes]);

  const [isCheckingStatus, setIsCheckingStatus] = useState(true);

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
          const cargaElectoralData = response.data.data.cargaElectoral;
          const mesaLocation = response.data.data.mesaLocation;
          const mesaDepartment = response.data.data.mesaDepartment;
          
          // Registro de depuración
          console.log('📍 [DEBUG] Response from status API:', response.data.data);
          console.log('📍 [DEBUG] mesaLocation:', mesaLocation);
          console.log('📍 [DEBUG] mesaDepartment:', mesaDepartment);
          console.log('📍 [DEBUG] cargaElectoral:', cargaElectoralData);
          console.log('📍 [DEBUG] jrvLocation prop:', jrvLocation);
          console.log('📍 [DEBUG] department prop:', department);
          console.log('📊 [PRESIDENCIAL] Status del escrutinio:', status);
          
          // Guardar carga electoral (incluir 0 como valor válido)
          if (cargaElectoralData !== null && cargaElectoralData !== undefined) {
            setCargaElectoral(cargaElectoralData);
            console.log('📍 [DEBUG] cargaElectoral state set to:', cargaElectoralData);
          } else {
            console.log('📍 [DEBUG] cargaElectoral is null/undefined, not setting state');
            console.log('📍 [DEBUG] cargaElectoralData type:', typeof cargaElectoralData);
            console.log('📍 [DEBUG] cargaElectoralData value:', cargaElectoralData);
          }
          
          // Guardar información de la mesa desde el servidor para usar si los props no tienen la info correcta
          if (mesaLocation) {
            setMesaLocationFromServer(mesaLocation);
            console.log('📍 [DEBUG] mesaLocationFromServer state set to:', mesaLocation);
          }
          if (mesaDepartment) {
            setMesaDepartmentFromServer(mesaDepartment);
            console.log('📍 [DEBUG] mesaDepartmentFromServer state set to:', mesaDepartment);
          }
          
          // Si el escrutinio está CLOSED o COMPLETED, bloquear la interfaz
          if (status === 'CLOSED') {
            setIsEscrutinioClosed(true);
            setEscrutinioStatus('CLOSED');
            console.log('🔒 [PRESIDENCIAL] Escrutinio cerrado - bloqueando interfaz');
            onEscrutinioStatusChange?.(status);
          } else if (status === 'COMPLETED') {
            setIsEscrutinioClosed(true);
            setEscrutinioStatus('COMPLETED');
            console.log('✅ [PRESIDENCIAL] Escrutinio completado - bloqueando interfaz');
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

  const handleActaUpload = useCallback((event: React.ChangeEvent<HTMLInputElement>, source: 'CAMERA' | 'LIBRARY') => {
    const file = event.target.files?.[0];
    if (file) {
      setActaImage(file);
      setActaImageSource(source);
      console.log('📸 [PRESIDENCIAL] Acta seleccionada:', file.name, 'Origen:', source);
    }
    // Reset input para permitir seleccionar el mismo archivo de nuevo
    event.target.value = '';
  }, []);

  // Función para subir acta si existe
  const uploadEvidenceIfNeeded = async (): Promise<string | null> => {
    console.log('📸 [PRESIDENCIAL] uploadEvidenceIfNeeded called:', { 
      actaImage: !!actaImage, 
      escrutinioId,
      actaImageDetails: actaImage ? {
        name: actaImage.name,
        size: actaImage.size,
        type: actaImage.type,
        lastModified: actaImage.lastModified
      } : null
    });
    if (!actaImage || !escrutinioId) {
      console.log('📸 [PRESIDENCIAL] No actaImage or escrutinioId, returning null', { 
        hasActaImage: !!actaImage, 
        hasEscrutinioId: !!escrutinioId,
        actaImage,
        escrutinioId
      });
      return null;
    }

    // Validar token antes de proceder
    const token = localStorage.getItem('auth-token');
    if (!token) {
      console.error('📸 [PRESIDENCIAL] No hay token de autenticación');
      throw new Error('No hay token de autenticación. Por favor inicia sesión nuevamente.');
    }
    
    try {
      console.log('📸 [PRESIDENCIAL] Uploading evidence:', { fileName: actaImage.name, contentType: actaImage.type });
      // Obtener URL de presign para subir la foto
      const presign = await axios.post('/api/upload/presign', {
        escrutinioId,
        fileName: actaImage.name,
        contentType: actaImage.type || 'image/jpeg',
      }, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      console.log('📸 [PRESIDENCIAL] Presign response:', presign.data);
      
      if (presign.data?.success && presign.data.data) {
        const { uploadUrl, publicUrl } = presign.data.data as { uploadUrl: string; publicUrl: string };
        
        if (!uploadUrl || !publicUrl) {
          throw new Error('URLs de presign inválidas');
        }
        
        console.log('📸 [PRESIDENCIAL] Uploading to:', uploadUrl.substring(0, 50) + '...');
        const uploadResponse = await fetch(uploadUrl, {
          method: 'PUT',
          headers: { 'Content-Type': actaImage.type || 'image/jpeg' },
          body: actaImage,
        });
        
        if (!uploadResponse.ok) {
          throw new Error(`Error subiendo archivo a S3: ${uploadResponse.status} ${uploadResponse.statusText}`);
        }
        
        console.log('📸 [PRESIDENCIAL] Upload successful, publicUrl:', publicUrl);
        
        // Guardar la URL en la base de datos
        try {
          const evidenceResponse = await axios.post(`/api/escrutinio/${encodeURIComponent(escrutinioId)}/evidence`, {
            publicUrl: publicUrl,
            hash: null,
            actaImageSource
          }, {
            headers: { 'Authorization': `Bearer ${token}` }
          });
          
          if (evidenceResponse.data?.success) {
            console.log('📸 [PRESIDENCIAL] Evidence URL guardada exitosamente en BD');
          } else {
            console.warn('📸 [PRESIDENCIAL] Evidence guardado pero respuesta no exitosa:', evidenceResponse.data);
          }
        } catch (evidenceError: any) {
          console.error('📸 [PRESIDENCIAL] Error guardando evidence URL en BD:', evidenceError);
          // Continuar aunque falle el guardado de evidence, ya tenemos la URL
        }
        
        return publicUrl;
      } else {
        throw new Error('Respuesta de presign inválida o sin éxito');
      }
    } catch (error: any) {
      console.error('📸 [PRESIDENCIAL] S3 upload failed, trying fallback:', error);
      // Fallback: convertir a dataUrl como en legislativo
    }
    
    try {
      console.log('📸 [PRESIDENCIAL] Using fallback: converting to dataUrl');
      const toDataUrl = (file: File): Promise<string> => {
        return new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result as string);
          reader.onerror = reject;
          reader.readAsDataURL(file);
        });
      };
      
      const dataUrl = await toDataUrl(actaImage);
      console.log('📸 [PRESIDENCIAL] Fallback successful, dataUrl length:', dataUrl.length);
      
      // Guardar la URL en la base de datos también en fallback
      try {
        const token = localStorage.getItem('auth-token');
        if (token) {
          const evidenceResponse = await axios.post(`/api/escrutinio/${encodeURIComponent(escrutinioId)}/evidence`, {
            publicUrl: dataUrl,
            hash: null,
            actaImageSource
          }, {
            headers: { 'Authorization': `Bearer ${token}` }
          });
          
          if (evidenceResponse.data?.success) {
            console.log('📸 [PRESIDENCIAL] DataURL guardada exitosamente en BD');
          } else {
            console.warn('📸 [PRESIDENCIAL] DataURL guardado pero respuesta no exitosa:', evidenceResponse.data);
          }
        }
      } catch (evidenceError: any) {
        console.error('📸 [PRESIDENCIAL] Error guardando DataURL en DB:', evidenceError);
        // Continuar aunque falle el guardado
      }
      
      return dataUrl;
    } catch (error) {
      console.error('📸 [PRESIDENCIAL] Fallback also failed:', error);
      throw new Error('Error subiendo foto del acta. Por favor intenta nuevamente.');
    }
  };

  // Función para finalizar escrutinio
  const handleSendResults = async () => {
    if (!escrutinioId) {
      alert('Error: No se encontró el ID del escrutinio');
      return;
    }

    // Validar token antes de proceder
    const token = localStorage.getItem('auth-token');
    if (!token) {
      alert('Sesión expirada. Por favor inicia sesión nuevamente.');
      window.location.href = '/';
      return;
    }

    setIsCompleting(true);
    
    try {
      console.log('📸 [PRESIDENCIAL] handleSendResults - Iniciando proceso:', { 
        escrutinioId, 
        actaImage: actaImage ? { name: actaImage.name, size: actaImage.size, type: actaImage.type } : null,
        hasActaImage: !!actaImage
      });
      
      // Subir acta si existe (uploadEvidenceIfNeeded ya guarda la URL en BD)
      if (actaImage) {
        try {
          const evidenceUrl = await uploadEvidenceIfNeeded();
          console.log('📸 [PRESIDENCIAL] handleSendResults - evidenceUrl result:', evidenceUrl ? 'URL obtenida' : 'null');
          
          if (!evidenceUrl) {
            console.warn('📸 [PRESIDENCIAL] No se pudo obtener URL de evidence, pero continuando...');
          }
        } catch (uploadError: any) {
          console.error('📸 [PRESIDENCIAL] Error subiendo acta:', uploadError);
          // No bloquear el proceso si falla el upload de foto, pero mostrar warning
          const shouldContinue = confirm(
            'Hubo un error al subir la foto del acta. ¿Deseas continuar sin foto?'
          );
          if (!shouldContinue) {
            setIsCompleting(false);
            return;
          }
        }
      } else {
        console.log('📸 [PRESIDENCIAL] No hay acta para subir');
      }
      
      // Marcar el escrutinio como completado definitivamente
      await axios.post(`/api/escrutinio/${encodeURIComponent(escrutinioId)}/complete`, {}, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      console.log('✅ [PRESIDENCIAL] Escrutinio completado exitosamente');
      
      // El escrutinio ya está finalizado definitivamente, no cambiar estado local
      setIsCompleting(false);
      setShowSuccessModal(true);
    } catch (error: any) {
      console.error('❌ [PRESIDENCIAL] Error enviando resultados:', error);
      setIsCompleting(false);
      
      const errorMessage = error?.response?.data?.error || error?.message || 'Error desconocido';
      alert(`Error al enviar los resultados: ${errorMessage}`);
    }
  };

  // Función para revisar escrutinio
  const handleReviewEscrutinio = () => {
    setShowSuccessModal(false);
    // Navegar a la página de revisión
    router.push(`/revisar/${escrutinioId}`);
  };

  const handleCloseEscrutinio = async () => {
    if (!escrutinioId) {
      alert('Error: No se encontró el ID del escrutinio');
      return;
    }
    
    console.log('🔄 [PRESIDENCIAL] Congelando escrutinio localmente');
    setIsClosing(true);
    
    // CRÍTICO: Pausar auto-save PRIMERO para evitar race conditions
    const { pauseSync, resumeSync } = useVoteStore.getState();
    pauseSync();
    console.log('⏸️ [PRESIDENCIAL] Auto-sync pausado para evitar race conditions');
    
    // CRÍTICO: Esperar un momento para que cualquier operación pendiente se complete
    await new Promise(resolve => setTimeout(resolve, 100));
    
    // CRÍTICO: Capturar snapshot de votos DESPUÉS de pausar y flush
    const votesSnapshot = { ...counts };
    console.log('📸 [PRESIDENCIAL] Snapshot de votos capturado:', votesSnapshot);
    
    try {
      // Capturar GPS final
      let finalGps = null;
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
        
        console.log('📍 [PRESIDENCIAL] GPS final capturado:', finalGps);
      } catch (gpsError) {
        console.warn('⚠️ [PRESIDENCIAL] No se pudo obtener GPS final:', gpsError);
        // Continuar sin GPS
      }

      // Enviar checkpoint al servidor con el snapshot capturado
      const token = localStorage.getItem('auth-token');
      await axios.post(`/api/escrutinio/${escrutinioId}/checkpoint`, {
        action: 'FREEZE',
        votesSnapshot: votesSnapshot, // Usar snapshot capturado, no counts actual
        deviceId: navigator.userAgent,
        gps: finalGps || {
          latitude: 0,
          longitude: 0,
          accuracy: 0
        }
      }, {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      // Log de auditoría se crea automáticamente en el endpoint /api/escrutinio/[id]/close

      console.log('✅ [PRESIDENCIAL] Checkpoint enviado con snapshot correcto');

      // Enviar GPS final al endpoint de cierre
      if (finalGps) {
        await axios.post(`/api/escrutinio/${escrutinioId}/close`, {
          finalGps: finalGps
        }, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        console.log('📍 [PRESIDENCIAL] GPS final enviado al servidor');
      }
      
      // Cambiar estado local
      setEscrutinioStatus('CLOSED');
      setIsEscrutinioClosed(true);
      console.log('✅ [PRESIDENCIAL] Escrutinio congelado localmente y checkpoint guardado');
    } catch (error) {
      console.error('Error congelando escrutinio:', error);
      alert(`Error al congelar el escrutinio: ${error instanceof Error ? error.message : 'Error desconocido'}`);
    } finally {
      // CRÍTICO: Reanudar auto-save después de completar todas las operaciones
      resumeSync();
      console.log('▶️ [PRESIDENCIAL] Auto-sync reanudado');
      setIsClosing(false);
    }
  };

  const handleReopenEscrutinio = async () => {
    if (!escrutinioId) {
      alert('Error: No se encontró el ID del escrutinio');
      return;
    }
    
    console.log('🔄 [PRESIDENCIAL] Descongelando escrutinio localmente');
    setIsReopening(true);
    try {
      const token = localStorage.getItem('auth-token');
      
      // CRÍTICO: Llamar al endpoint /reopen para actualizar el estado en la base de datos
      // Esto cambia el estado de CLOSED a COMPLETED en la base de datos
      console.log('🔄 [PRESIDENCIAL] Actualizando estado del escrutinio en servidor...');
      await axios.post(`/api/escrutinio/${escrutinioId}/reopen`, {}, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      console.log('✅ [PRESIDENCIAL] Estado del escrutinio actualizado a COMPLETED en servidor');
      
      // Enviar checkpoint al servidor
      await axios.post(`/api/escrutinio/${escrutinioId}/checkpoint`, {
        action: 'UNFREEZE',
        votesSnapshot: counts,
        deviceId: navigator.userAgent,
        gps: {
          latitude: 0, // TODO: Obtener GPS real
          longitude: 0,
          accuracy: 0
        }
      }, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      // Cambiar estado local
      setEscrutinioStatus('COMPLETED');
      setIsEscrutinioClosed(false);
      console.log('✅ [PRESIDENCIAL] Escrutinio descongelado localmente y checkpoint guardado');
    } catch (error: any) {
      console.error('❌ [PRESIDENCIAL] Error descongelando escrutinio:', error);
      const errorMessage = error?.response?.data?.error || error?.message || 'Error desconocido';
      alert(`Error al descongelar el escrutinio: ${errorMessage}`);
    } finally {
      setIsReopening(false);
    }
  };


  // Función para volver a la pantalla principal
  const handleGoBack = () => {
    router.push('/dashboard');
  };

  const getTotalVotes = () => {
    return Object.values(counts).reduce((sum, count) => sum + count, 0);
  };

  // Verificar si hay al menos un voto
  const hasVotes = getTotalVotes() > 0;

  // Mostrar loading mientras se verifica el status del escrutinio
  if (isCheckingStatus) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
          <p className="text-gray-600">Cargando escrutinio...</p>
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
                <span className="hidden sm:inline">Escrutinio Presidencial</span>
                <span className="sm:hidden">Presidencial</span>
              </h1>
            </div>
            <div className="text-right">
              <div className="text-sm text-gray-600">
                JRV {jrvNumber || 'N/A'}
              </div>
              <div className="text-xs text-gray-500">
                {cargaElectoral !== null && cargaElectoral !== undefined ? (
                  `Carga Electoral: ${cargaElectoral.toLocaleString()}`
                ) : (
                  'Carga Electoral: Cargando...'
                )}
                {/* Depuración: mostrar estado actual */}
                {process.env.NODE_ENV === 'development' && (
                  <span className="ml-2 text-xs text-gray-400">
                    (state: {String(cargaElectoral)})
                  </span>
                )}
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
              Conteo de Votos Presidenciales
            </h2>
            <div className="text-sm text-gray-600">
              {(() => {
                // Usar información del servidor si los props no tienen la info correcta
                // Verificar si jrvLocation es inválido (igual al número, 'N/A', o está vacío)
                const isJrvLocationInvalid = !jrvLocation || 
                  jrvLocation === 'N/A' || 
                  jrvLocation === jrvNumber || 
                  jrvLocation === `JRV ${jrvNumber}` ||
                  (typeof jrvLocation === 'string' && jrvLocation.trim() === '');
                
                // Verificar si el departamento es inválido
                const isDepartmentInvalid = !department || 
                  department === 'N/A' || 
                  (typeof department === 'string' && department.trim() === '');
                
                // Priorizar datos del servidor si los props son inválidos, de lo contrario usar props
                const location = isJrvLocationInvalid 
                  ? (mesaLocationFromServer || jrvLocation || 'N/A')
                  : jrvLocation;
                const dept = isDepartmentInvalid 
                  ? (mesaDepartmentFromServer || department || 'N/A')
                  : department;
                
                // Format the display string
                if (location && location !== 'N/A' && dept && dept !== 'N/A') {
                  return `${location} - ${dept}`;
                } else if (location && location !== 'N/A') {
                  return location;
                } else if (dept && dept !== 'N/A') {
                  return dept;
                } else {
                  return 'N/A';
                }
              })()}
            </div>
          </div>

          {/* Carga Electoral - Simple */}
          {cargaElectoral !== null && (
            <div className="mb-4">
              <div className="text-sm text-gray-600">
                <span className={getTotalVotes() >= cargaElectoral ? 'text-red-600 font-semibold' : ''}>
                  Votos: {getTotalVotes().toLocaleString()} / {cargaElectoral.toLocaleString()}
                </span>
              </div>
              {getTotalVotes() >= cargaElectoral && (
                <div className="mt-2 text-sm text-red-600 font-semibold flex items-center gap-1">
                  <AlertCircle className="h-4 w-4" />
                  Se ha alcanzado el máximo de votos permitidos
                </div>
              )}
            </div>
          )}

          {/* Tooltip de ayuda para primera vez */}
          <VoteHelpTooltip />

          {/* Lista de Candidatos */}
          <div className="space-y-3 mb-8">
            {candidates
              .filter((c) => {
                // Excluir candidatos especiales (998 y 999) que se manejan con botones separados
                const candidateNumber = typeof c.number === 'number' ? c.number : parseInt(String(c.number || '0'));
                return candidateNumber !== 998 && candidateNumber !== 999;
              })
              .map((c) => (
              <VoteCard
                key={c.id}
                id={c.id}
                name={c.name}
                party={c.party}
                partyColor={c.partyColor}
                number={c.number}
                count={counts[c.id] || 0}
                isPending={false} // Sin indicadores de pending - conteo instantáneo
                disabled={isEscrutinioClosed} // Deshabilitado cuando el escrutinio esté cerrado
                onIncrement={() => {
                  if (!isEscrutinioClosed) {
                    // Validar que no se exceda la carga electoral
                    if (cargaElectoral !== null && getTotalVotes() >= cargaElectoral) {
                      alert(`No se pueden agregar más votos. La carga electoral máxima es ${cargaElectoral.toLocaleString()} votos.`);
                      return;
                    }
                    increment(c.id, { escrutinioId, userId, mesaId, gps: gps || undefined, deviceId });
                  }
                }}
                onDecrement={() => {
                  if (!isEscrutinioClosed) {
                    decrement(c.id, { escrutinioId, userId, mesaId, gps: gps || undefined, deviceId });
                  }
                }}
              />
            ))}
          </div>

          {/* Botones de Voto en Blanco y Voto Nulo */}
          <div className="grid grid-cols-2 gap-3 mb-8">
            <VoteCard
              id="BLANK_VOTE"
              name="Voto en Blanco"
              party=""
              partyColor="#9ca3af"
              count={counts["BLANK_VOTE"] || 0}
              isPending={false}
              disabled={isEscrutinioClosed}
              onIncrement={() => {
                if (!isEscrutinioClosed) {
                  // Validar que no se exceda la carga electoral
                  if (cargaElectoral !== null && getTotalVotes() >= cargaElectoral) {
                    alert(`No se pueden agregar más votos. La carga electoral máxima es ${cargaElectoral.toLocaleString()} votos.`);
                    return;
                  }
                  increment("BLANK_VOTE", { escrutinioId, userId, mesaId, gps: gps || undefined, deviceId });
                }
              }}
              onDecrement={() => {
                if (!isEscrutinioClosed) {
                  decrement("BLANK_VOTE", { escrutinioId, userId, mesaId, gps: gps || undefined, deviceId });
                }
              }}
            />
            <VoteCard
              id="NULL_VOTE"
              name="Voto Nulo"
              party=""
              partyColor="#6b7280"
              count={counts["NULL_VOTE"] || 0}
              isPending={false}
              disabled={isEscrutinioClosed}
              onIncrement={() => {
                if (!isEscrutinioClosed) {
                  // Validar que no se exceda la carga electoral
                  if (cargaElectoral !== null && getTotalVotes() >= cargaElectoral) {
                    alert(`No se pueden agregar más votos. La carga electoral máxima es ${cargaElectoral.toLocaleString()} votos.`);
                    return;
                  }
                  increment("NULL_VOTE", { escrutinioId, userId, mesaId, gps: gps || undefined, deviceId });
                }
              }}
              onDecrement={() => {
                if (!isEscrutinioClosed) {
                  decrement("NULL_VOTE", { escrutinioId, userId, mesaId, gps: gps || undefined, deviceId });
                }
              }}
            />
          </div>

          {/* Sección de Control de Escrutinio y Foto */}
          <div className="mt-8 space-y-4">
            {/* Control de Escrutinio */}
            <div className="bg-blue-50 p-6 rounded-lg border border-blue-200">
              <h3 className="text-lg font-semibold text-blue-900 mb-3 flex items-center gap-2">
                <Upload className="h-5 w-5" />
                Control de Escrutinio
              </h3>
              
            {/* Estado: En progreso - Mostrar solo botón Cerrar */}
            {escrutinioStatus === 'COMPLETED' && !isEscrutinioClosed && (
              <>
                <p className="text-sm text-blue-700 mb-4">
                  {isEscrutinioClosed 
                    ? 'El escrutinio está cerrado. Puedes editar para continuar agregando marcas.'
                    : 'Una vez que hayas completado el conteo de todos los votos, puedes cerrar el escrutinio para tomar la foto.'
                  }
                </p>
                <button
                  onClick={isEscrutinioClosed ? handleReopenEscrutinio : handleCloseEscrutinio}
                  disabled={isClosing || isReopening}
                  className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-orange-600 text-white rounded-lg hover:bg-orange-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium"
                >
                  {(isClosing || isReopening) ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      {isReopening ? 'Reabriendo...' : 'Cerrando...'}
                    </>
                  ) : (
                    <>
                      <AlertCircle className="h-4 w-4" />
                      {isEscrutinioClosed ? 'Corregir Escrutinio' : 'Cerrar Escrutinio'}
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
                        Corregir Escrutinio
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
                <div>
                  <label className="cursor-pointer">
                    <input
                      type="file"
                      accept="image/*"
                      capture="environment"
                      onChange={(e) => handleActaUpload(e, 'CAMERA')}
                      className="hidden"
                      id="acta-camera-presidential"
                    />
                    <div className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg text-sm text-center hover:bg-blue-700 transition-colors">
                      Tomar foto
                    </div>
                  </label>
                </div>
                {actaImage && (
                  <div className="p-2 bg-green-50 border border-green-200 rounded-lg">
                    <div className="flex items-center gap-2 text-sm text-green-800">
                      <CheckCircle className="h-4 w-4" />
                      <span>Foto seleccionada: {actaImage.name}</span>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Botón Finalizar Escrutinio - Cuando está en progreso o cerrado */}
            {(escrutinioStatus === 'COMPLETED' && !isEscrutinioClosed) || (escrutinioStatus === 'CLOSED') ? (
              <div className="bg-blue-50 p-6 rounded-lg border border-blue-200">
                <h3 className="text-lg font-semibold text-blue-900 mb-3 flex items-center gap-2">
                  <CheckCircle className="h-5 w-5" />
                  Enviar Resultados
                </h3>
                <p className="text-sm text-blue-700 mb-4">
                  {escrutinioStatus === 'CLOSED' 
                    ? 'El escrutinio está cerrado. Puedes finalizar definitivamente después de subir la foto del acta.'
                    : 'Una vez que hayas subido la foto del acta, puedes finalizar definitivamente el escrutinio.'
                  }
                </p>
                <button
                  onClick={handleSendResults}
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
                      <CheckCircle className="h-4 w-4" />
                      Enviar Resultados
                    </>
                  )}
                </button>
              </div>
            ) : null}
          </div>

        </div>
      </div>

      {/* Modal de Confirmación de Envío */}
      {showSuccessModal && (
        <div className="modal-overlay">
          <div className="modal-container">
            <div className="modal-header">
              <div className="modal-icon bg-green-100">
                <CheckCircle className="h-6 w-6 sm:h-8 sm:w-8 text-green-600" />
              </div>
              <h3 className="modal-title">
                ¡Envío exitoso!
              </h3>
              <p className="modal-description">
                Los resultados del escrutinio han sido enviados correctamente.
              </p>
            </div>
            <div className="modal-actions">
              <button
                onClick={handleReviewEscrutinio}
                className="modal-button bg-blue-600 text-white hover:bg-blue-700"
              >
                Revisar Escrutinio
              </button>
              <button
                onClick={handleGoBack}
                className="modal-button bg-gray-600 text-white hover:bg-gray-700"
              >
                Volver
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
