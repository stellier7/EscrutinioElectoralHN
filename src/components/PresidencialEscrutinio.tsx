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
  const [isUploading, setIsUploading] = useState(false);
  const [isCompleting, setIsCompleting] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [isEscrutinioClosed, setIsEscrutinioClosed] = useState(false);
  const [escrutinioStatus, setEscrutinioStatus] = useState<'COMPLETED' | 'CLOSED'>('COMPLETED');
  const [isClosing, setIsClosing] = useState(false);
  const [isReopening, setIsReopening] = useState(false);
  const [cargaElectoral, setCargaElectoral] = useState<number | null>(null);

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
      
      // Solo limpiar si es un NUEVO escrutinio (diferente al anterior)
      if (lastEscrutinioIdRef.current !== escrutinioId) {
        console.log('🔄 [PRESIDENTIAL] Nuevo escrutinio detectado, limpiando store local...');
        console.log('📊 [PRESIDENTIAL] Escrutinio anterior:', lastEscrutinioIdRef.current, '→ Nuevo:', escrutinioId);
        clearVotes(); // Limpiar solo si es un nuevo escrutinio
        lastEscrutinioIdRef.current = escrutinioId;
        // Guardar en localStorage para persistir entre refrescos
        if (typeof window !== 'undefined') {
          localStorage.setItem('last-presidential-escrutinio-id', escrutinioId);
        }
      } else {
        console.log('🔄 [PRESIDENTIAL] Mismo escrutinio, manteniendo votos del store');
      }
      
      // Solo cargar votos del servidor si NO es un escrutinio nuevo
      // Los escrutinios nuevos deben empezar de 0
      if (!isNewEscrutinio) {
        console.log('📊 [PRESIDENTIAL] Cargando votos desde servidor para escrutinio:', escrutinioId);
        const { loadFromServer } = useVoteStore.getState();
        loadFromServer(escrutinioId).then(() => {
          console.log('✅ [PRESIDENTIAL] Votos cargados desde servidor');
        }).catch((error) => {
          console.error('❌ [PRESIDENTIAL] Error cargando votos desde servidor:', error);
        });
      } else {
        console.log('🆕 [PRESIDENTIAL] Escrutinio nuevo detectado, NO cargando votos del servidor (empezando de 0)');
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
          console.log('📊 [PRESIDENTIAL] Status del escrutinio:', status);
          
          // Guardar carga electoral
          if (cargaElectoralData !== null && cargaElectoralData !== undefined) {
            setCargaElectoral(cargaElectoralData);
          }
          
          // Si el escrutinio está CLOSED o COMPLETED, bloquear la interfaz
          if (status === 'CLOSED') {
            setIsEscrutinioClosed(true);
            setEscrutinioStatus('CLOSED');
            console.log('🔒 [PRESIDENTIAL] Escrutinio cerrado - bloqueando interfaz');
            onEscrutinioStatusChange?.(status);
          } else if (status === 'COMPLETED') {
            setIsEscrutinioClosed(true);
            setEscrutinioStatus('COMPLETED');
            console.log('✅ [PRESIDENTIAL] Escrutinio completado - bloqueando interfaz');
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

  const handleActaUpload = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setActaImage(file);
    }
  }, []);

  // Función para subir acta si existe
  const uploadEvidenceIfNeeded = async (): Promise<string | null> => {
    console.log('📸 [PRESIDENTIAL] uploadEvidenceIfNeeded called:', { 
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
      console.log('📸 [PRESIDENTIAL] No actaImage or escrutinioId, returning null', { 
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
      console.error('📸 [PRESIDENTIAL] No hay token de autenticación');
      throw new Error('No hay token de autenticación. Por favor inicia sesión nuevamente.');
    }
    
    try {
      console.log('📸 [PRESIDENTIAL] Uploading evidence:', { fileName: actaImage.name, contentType: actaImage.type });
      // Obtener URL de presign para subir la foto
      const presign = await axios.post('/api/upload/presign', {
        escrutinioId,
        fileName: actaImage.name,
        contentType: actaImage.type || 'image/jpeg',
      }, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      console.log('📸 [PRESIDENTIAL] Presign response:', presign.data);
      
      if (presign.data?.success && presign.data.data) {
        const { uploadUrl, publicUrl } = presign.data.data as { uploadUrl: string; publicUrl: string };
        
        if (!uploadUrl || !publicUrl) {
          throw new Error('URLs de presign inválidas');
        }
        
        console.log('📸 [PRESIDENTIAL] Uploading to:', uploadUrl.substring(0, 50) + '...');
        const uploadResponse = await fetch(uploadUrl, {
          method: 'PUT',
          headers: { 'Content-Type': actaImage.type || 'image/jpeg' },
          body: actaImage,
        });
        
        if (!uploadResponse.ok) {
          throw new Error(`Error subiendo archivo a S3: ${uploadResponse.status} ${uploadResponse.statusText}`);
        }
        
        console.log('📸 [PRESIDENTIAL] Upload successful, publicUrl:', publicUrl);
        
        // Guardar la URL en la base de datos
        try {
          const evidenceResponse = await axios.post(`/api/escrutinio/${encodeURIComponent(escrutinioId)}/evidence`, {
            publicUrl: publicUrl,
            hash: null
          }, {
            headers: { 'Authorization': `Bearer ${token}` }
          });
          
          if (evidenceResponse.data?.success) {
            console.log('📸 [PRESIDENTIAL] Evidence URL guardada exitosamente en BD');
          } else {
            console.warn('📸 [PRESIDENTIAL] Evidence guardado pero respuesta no exitosa:', evidenceResponse.data);
          }
        } catch (evidenceError: any) {
          console.error('📸 [PRESIDENTIAL] Error guardando evidence URL en BD:', evidenceError);
          // Continuar aunque falle el guardado de evidence, ya tenemos la URL
        }
        
        return publicUrl;
      } else {
        throw new Error('Respuesta de presign inválida o sin éxito');
      }
    } catch (error: any) {
      console.error('📸 [PRESIDENTIAL] S3 upload failed, trying fallback:', error);
      // Fallback: convertir a dataUrl como en legislativo
    }
    
    try {
      console.log('📸 [PRESIDENTIAL] Using fallback: converting to dataUrl');
      const toDataUrl = (file: File): Promise<string> => {
        return new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result as string);
          reader.onerror = reject;
          reader.readAsDataURL(file);
        });
      };
      
      const dataUrl = await toDataUrl(actaImage);
      console.log('📸 [PRESIDENTIAL] Fallback successful, dataUrl length:', dataUrl.length);
      
      // Guardar la URL en la base de datos también en fallback
      try {
        const token = localStorage.getItem('auth-token');
        if (token) {
          const evidenceResponse = await axios.post(`/api/escrutinio/${encodeURIComponent(escrutinioId)}/evidence`, {
            publicUrl: dataUrl,
            hash: null
          }, {
            headers: { 'Authorization': `Bearer ${token}` }
          });
          
          if (evidenceResponse.data?.success) {
            console.log('📸 [PRESIDENTIAL] DataURL guardada exitosamente en BD');
          } else {
            console.warn('📸 [PRESIDENTIAL] DataURL guardado pero respuesta no exitosa:', evidenceResponse.data);
          }
        }
      } catch (evidenceError: any) {
        console.error('📸 [PRESIDENTIAL] Error guardando DataURL en DB:', evidenceError);
        // Continuar aunque falle el guardado
      }
      
      return dataUrl;
    } catch (error) {
      console.error('📸 [PRESIDENTIAL] Fallback also failed:', error);
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
      console.log('📸 [PRESIDENTIAL] handleSendResults - Iniciando proceso:', { 
        escrutinioId, 
        actaImage: actaImage ? { name: actaImage.name, size: actaImage.size, type: actaImage.type } : null,
        hasActaImage: !!actaImage
      });
      
      // Subir acta si existe (uploadEvidenceIfNeeded ya guarda la URL en BD)
      if (actaImage) {
        try {
          const evidenceUrl = await uploadEvidenceIfNeeded();
          console.log('📸 [PRESIDENTIAL] handleSendResults - evidenceUrl result:', evidenceUrl ? 'URL obtenida' : 'null');
          
          if (!evidenceUrl) {
            console.warn('📸 [PRESIDENTIAL] No se pudo obtener URL de evidence, pero continuando...');
          }
        } catch (uploadError: any) {
          console.error('📸 [PRESIDENTIAL] Error subiendo acta:', uploadError);
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
        console.log('📸 [PRESIDENTIAL] No hay acta para subir');
      }
      
      // Marcar el escrutinio como completado definitivamente
      await axios.post(`/api/escrutinio/${encodeURIComponent(escrutinioId)}/complete`, {}, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      console.log('✅ [PRESIDENTIAL] Escrutinio completado exitosamente');
      
      // El escrutinio ya está finalizado definitivamente, no cambiar estado local
      setIsCompleting(false);
      setShowSuccessModal(true);
    } catch (error: any) {
      console.error('❌ [PRESIDENTIAL] Error enviando resultados:', error);
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
    
    console.log('🔄 [PRESIDENTIAL] Congelando escrutinio localmente');
    setIsClosing(true);
    
    // CRÍTICO: Pausar auto-save PRIMERO para evitar race conditions
    const { pauseSync, resumeSync } = useVoteStore.getState();
    pauseSync();
    console.log('⏸️ [PRESIDENTIAL] Auto-sync pausado para evitar race conditions');
    
    // CRÍTICO: Esperar un momento para que cualquier operación pendiente se complete
    await new Promise(resolve => setTimeout(resolve, 100));
    
    // CRÍTICO: Capturar snapshot de votos DESPUÉS de pausar y flush
    const votesSnapshot = { ...counts };
    console.log('📸 [PRESIDENTIAL] Snapshot de votos capturado:', votesSnapshot);
    
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
        
        console.log('📍 [PRESIDENTIAL] GPS final capturado:', finalGps);
      } catch (gpsError) {
        console.warn('⚠️ [PRESIDENTIAL] No se pudo obtener GPS final:', gpsError);
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

      console.log('✅ [PRESIDENTIAL] Checkpoint enviado con snapshot correcto');

      // Enviar GPS final al endpoint de cierre
      if (finalGps) {
        await axios.post(`/api/escrutinio/${escrutinioId}/close`, {
          finalGps: finalGps
        }, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        console.log('📍 [PRESIDENTIAL] GPS final enviado al servidor');
      }
      
      // Cambiar estado local
      setEscrutinioStatus('CLOSED');
      setIsEscrutinioClosed(true);
      console.log('✅ [PRESIDENTIAL] Escrutinio congelado localmente y checkpoint guardado');
    } catch (error) {
      console.error('Error congelando escrutinio:', error);
      alert(`Error al congelar el escrutinio: ${error instanceof Error ? error.message : 'Error desconocido'}`);
    } finally {
      // CRÍTICO: Reanudar auto-save después de completar todas las operaciones
      resumeSync();
      console.log('▶️ [PRESIDENTIAL] Auto-sync reanudado');
      setIsClosing(false);
    }
  };

  const handleReopenEscrutinio = async () => {
    if (!escrutinioId) {
      alert('Error: No se encontró el ID del escrutinio');
      return;
    }
    
    console.log('🔄 [PRESIDENTIAL] Descongelando escrutinio localmente');
    setIsReopening(true);
    try {
      const token = localStorage.getItem('auth-token');
      
      // CRÍTICO: Llamar al endpoint /reopen para actualizar el estado en la base de datos
      // Esto cambia el estado de CLOSED a COMPLETED en la base de datos
      console.log('🔄 [PRESIDENTIAL] Actualizando estado del escrutinio en servidor...');
      await axios.post(`/api/escrutinio/${escrutinioId}/reopen`, {}, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      console.log('✅ [PRESIDENTIAL] Estado del escrutinio actualizado a COMPLETED en servidor');
      
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
      console.log('✅ [PRESIDENTIAL] Escrutinio descongelado localmente y checkpoint guardado');
    } catch (error: any) {
      console.error('❌ [PRESIDENTIAL] Error descongelando escrutinio:', error);
      const errorMessage = error?.response?.data?.error || error?.message || 'Error desconocido';
      alert(`Error al descongelar el escrutinio: ${errorMessage}`);
    } finally {
      setIsReopening(false);
    }
  };


  // Función para volver a la pantalla principal
  const handleGoBack = () => {
    // Aquí se implementaría la navegación de vuelta
    window.location.href = '/';
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
                {jrvLocation || 'N/A'}
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
            <p className="text-sm text-gray-600">
              {jrvNumber ? `${jrvNumber} - ${jrvLocation || 'N/A'}` : 'Selecciona candidatos para votar'}
            </p>
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
            {candidates.map((c) => (
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
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleActaUpload}
                  disabled={false}
                  className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 disabled:opacity-50 disabled:cursor-not-allowed"
                />
                {actaImage && (
                  <div className="flex items-center gap-2 text-sm text-green-600">
                    <CheckCircle className="h-4 w-4" />
                    <span>Foto seleccionada: {actaImage.name}</span>
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
                Los resultados del escrutinio han sido enviados correctamente.
              </p>
              <div className="flex flex-col sm:flex-row gap-3">
                <button
                  onClick={handleReviewEscrutinio}
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
                >
                  Revisar Escrutinio
                </button>
                <button
                  onClick={handleGoBack}
                  className="flex-1 px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors font-medium"
                >
                  Volver
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
