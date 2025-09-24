"use client";
import React, { useState, useCallback, useEffect } from 'react';
import { Loader2, AlertCircle, CheckCircle, FileText, Camera, Upload } from 'lucide-react';
import VoteCard from '@/components/VoteCard';
import { useVoteStore } from '@/store/voteStore';

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
  department,
  gps, 
  deviceId 
}: PresidencialEscrutinioProps) {
  const { counts, increment, decrement } = useVoteStore((s) => ({
    counts: s.counts,
    increment: s.increment,
    decrement: s.decrement,
  }));

  // Estados para foto y finalización
  const [actaImage, setActaImage] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isCompleting, setIsCompleting] = useState(false);

  const handleActaUpload = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setActaImage(file);
    }
  }, []);

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
                {department || 'N/A'}
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="max-w-4xl mx-auto px-3 sm:px-6 lg:px-8 py-4 lg:py-8">
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
                onIncrement={() =>
                  increment(c.id, { escrutinioId, userId, mesaId, gps: gps || undefined, deviceId })
                }
                onDecrement={() =>
                  decrement(c.id, { escrutinioId, userId, mesaId, gps: gps || undefined, deviceId })
                }
              />
            ))}
          </div>

          {/* Resumen de Votos */}
          {hasVotes && (
            <div className="mb-8 p-4 bg-blue-50 rounded-lg border border-blue-200">
              <h3 className="text-lg font-semibold text-blue-900 mb-3 flex items-center gap-2">
                <CheckCircle className="h-5 w-5" />
                Resumen de Votos
              </h3>
              <div className="space-y-2">
                {candidates
                  .filter(c => counts[c.id] > 0)
                  .map(c => (
                    <div key={c.id} className="flex justify-between items-center text-sm">
                      <span className="text-blue-700">
                        {c.number}. {c.name} ({c.party})
                      </span>
                      <span className="font-bold text-blue-900">
                        {counts[c.id]} voto{counts[c.id] !== 1 ? 's' : ''}
                      </span>
                    </div>
                  ))}
              </div>
              <div className="mt-3 pt-3 border-t border-blue-200">
                <div className="flex justify-between items-center font-semibold">
                  <span className="text-blue-700">Total:</span>
                  <span className="text-blue-900">{getTotalVotes()} voto{getTotalVotes() !== 1 ? 's' : ''}</span>
                </div>
              </div>
            </div>
          )}

          {/* Sección de Foto y Finalización */}
          <div className="space-y-4">
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

            {/* Finalizar Escrutinio */}
            <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
              <h3 className="text-lg font-semibold text-blue-900 mb-3 flex items-center gap-2">
                <Upload className="h-5 w-5" />
                Finalizar Escrutinio
              </h3>
              <p className="text-sm text-blue-700 mb-4">
                Una vez que hayas completado el conteo de todos los votos, sube la foto del acta y finaliza el escrutinio.
              </p>
              <button
                onClick={() => {
                  // Esta función se implementará cuando se integre con el flujo principal
                  console.log('Finalizar escrutinio presidencial');
                }}
                disabled={!actaImage || isCompleting || isUploading}
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
          </div>
        </div>
      </div>
    </div>
  );
}
