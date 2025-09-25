"use client";
import React, { useState, useCallback, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, AlertCircle, CheckCircle, FileText, Camera, Upload } from 'lucide-react';
import VoteCard from '@/components/VoteCard';
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
  deviceId 
}: PresidencialEscrutinioProps) {
  const router = useRouter();
  const { counts, increment, decrement } = useVoteStore((s) => ({
    counts: s.counts,
    increment: s.increment,
    decrement: s.decrement,
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

  const handleActaUpload = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setActaImage(file);
    }
  }, []);

  // Función para subir evidencia si existe
  const uploadEvidenceIfNeeded = async (): Promise<string | null> => {
    if (!actaImage || !escrutinioId) return null;
    
    try {
      // Obtener URL de presign para subir la foto
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
        return publicUrl;
      }
    } catch (error) {
      console.error('Error subiendo evidencia:', error);
      return null;
    }
    
    return null;
  };

  // Función para finalizar escrutinio
  const handleSendResults = async () => {
    if (!escrutinioId) {
      alert('Error: No se encontró el ID del escrutinio');
      return;
    }

    setIsCompleting(true);
    
    try {
      // Subir evidencia si existe (opcional)
      await uploadEvidenceIfNeeded();
      
      // Marcar el escrutinio como completado definitivamente
      await axios.post(`/api/escrutinio/${encodeURIComponent(escrutinioId)}/complete`);
      
      // El escrutinio ya está finalizado definitivamente, no cambiar estado local
      setIsCompleting(false);
      setShowSuccessModal(true);
    } catch (error) {
      console.error('Error enviando resultados:', error);
      setIsCompleting(false);
      alert(`Error al enviar los resultados: ${error instanceof Error ? error.message : 'Error desconocido'}`);
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
    setIsClosing(true);
    try {
      await axios.post(`/api/escrutinio/${encodeURIComponent(escrutinioId)}/close`);
      setEscrutinioStatus('CLOSED');
      setIsEscrutinioClosed(true);
    } catch (error) {
      console.error('Error cerrando escrutinio:', error);
      alert(`Error al cerrar el escrutinio: ${error instanceof Error ? error.message : 'Error desconocido'}`);
    } finally {
      setIsClosing(false);
    }
  };

  const handleReopenEscrutinio = async () => {
    if (!escrutinioId) {
      alert('Error: No se encontró el ID del escrutinio');
      return;
    }
    setIsReopening(true);
    try {
      await axios.post(`/api/escrutinio/${encodeURIComponent(escrutinioId)}/reopen`);
      setEscrutinioStatus('COMPLETED');
      setIsEscrutinioClosed(false);
    } catch (error) {
      console.error('Error reabriendo escrutinio:', error);
      alert(`Error al reabrir el escrutinio: ${error instanceof Error ? error.message : 'Error desconocido'}`);
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
              <div className="flex items-center gap-2 px-3 py-1 bg-green-100 text-green-800 rounded-full text-sm">
                <FileText className="h-4 w-4" />
                Votos: {getTotalVotes()}
              </div>
            </div>
            <div className="text-right">
              <div className="text-sm text-gray-600">
                {jrvNumber || 'N/A'}
              </div>
              <div className="text-xs text-gray-500">
                {jrvLocation || 'N/A'}
              </div>
              <div className="text-xs text-gray-400">
                {department || 'N/A'}
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
              {jrvNumber ? `${jrvNumber} - ${department}` : 'Selecciona candidatos para votar'}
            </p>
          </div>
          

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
            <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
              <h3 className="text-lg font-semibold text-blue-900 mb-3 flex items-center gap-2">
                <Upload className="h-5 w-5" />
                Control de Escrutinio
              </h3>
              
            {/* Estado: En progreso - Mostrar solo botón Cerrar */}
            {escrutinioStatus === 'COMPLETED' && !isEscrutinioClosed && (
              <>
                <p className="text-sm text-blue-700 mb-4">
                  Una vez que hayas completado el conteo de todos los votos, puedes cerrar el escrutinio para pausar las ediciones.
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
            <div className="bg-gray-50 p-4 rounded-lg border">
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
                    <CheckCircle className="h-4 w-4" />
                    <span>Foto seleccionada: {actaImage.name}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Botón Finalizar Escrutinio - Cuando está en progreso o cerrado */}
            {(escrutinioStatus === 'COMPLETED' && !isEscrutinioClosed) || (escrutinioStatus === 'CLOSED') ? (
              <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
                <h3 className="text-lg font-semibold text-blue-900 mb-3 flex items-center gap-2">
                  <CheckCircle className="h-5 w-5" />
                  Finalizar Escrutinio
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
                      Finalizar Escrutinio
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
