'use client';

import React, { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useAuth } from '../../../components/AuthProvider';
import axios from 'axios';
import { 
  ArrowLeft, 
  CheckCircle, 
  Calendar, 
  MapPin, 
  User,
  Eye,
  FileText,
  Camera,
  BarChart3,
  Navigation,
  ExternalLink
} from 'lucide-react';
import Button from '../../../components/ui/Button';
import LegislativeReview from '../../../components/LegislativeReview';
import { CheckpointTimeline } from '../../../components/CheckpointTimeline';

interface EscrutinioData {
  id: string;
  mesaNumber: string;
  mesaName: string;
  department: string;
  electionLevel: string;
  startedAt: string;
  completedAt: string;
  totalVotes: number;
  candidates: Array<{
    id: string;
    name: string;
    party: string;
    partyColor?: string;
    number?: string | number;
    votes: number;
  }>;
  actaUrl?: string;
  initialGps?: {
    latitude: number;
    longitude: number;
    accuracy: number;
  };
  finalGps?: {
    latitude: number;
    longitude: number;
    accuracy: number;
  };
  user: {
    id: string;
    name: string;
    email: string;
  };
  // Campos de privacidad GPS
  gpsHidden?: boolean;
  gpsHiddenReason?: string;
  gpsHiddenBy?: string;
  gpsHiddenAt?: string;
}

// Helper functions for map links
const getGoogleMapsUrl = (lat: number, lng: number) => 
  `https://www.google.com/maps?q=${lat},${lng}`;

const getWazeUrl = (lat: number, lng: number) => 
  `https://waze.com/ul?ll=${lat},${lng}&navigate=yes`;

const getAppleMapsUrl = (lat: number, lng: number) => 
  `https://maps.apple.com/?q=${lat},${lng}`;

export default function RevisarEscrutinioPage() {
  const { user, isLoading } = useAuth();
  const router = useRouter();
  const params = useParams();
  const escrutinioId = params.id as string;
  
  const [escrutinioData, setEscrutinioData] = useState<EscrutinioData | null>(null);
  const [checkpoints, setCheckpoints] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showHideModal, setShowHideModal] = useState(false);
  const [hideReason, setHideReason] = useState('');
  const [isUpdatingGps, setIsUpdatingGps] = useState(false);

  useEffect(() => {
    if (!isLoading && !user) {
      router.push('/');
    }
  }, [user, isLoading, router]);

  useEffect(() => {
    if (escrutinioId) {
      loadEscrutinioData();
    }
  }, [escrutinioId]);

  const loadEscrutinioData = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const token = localStorage.getItem('auth-token');
      
      if (!token) {
        console.error('❌ No hay token de autenticación');
        setError('Sesión expirada. Por favor inicia sesión nuevamente.');
        setTimeout(() => window.location.href = '/', 2000);
        return;
      }

      console.log('🔐 Token encontrado para review:', token.substring(0, 20) + '...');
      
      // Cargar datos del escrutinio
      const response = await axios.get(`/api/escrutinio/${escrutinioId}/review`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      if (response.data.success) {
        console.log('📊 Datos del escrutinio cargados:', response.data.data);
        console.log('📊 Candidatos:', response.data.data.candidates);
        console.log('📊 Total de votos:', response.data.data.totalVotes);
        console.log('📸 Acta URL recibida:', response.data.data.actaUrl);
        setEscrutinioData(response.data.data);
      } else {
        throw new Error(response.data.error || 'Error al cargar el escrutinio');
      }
      
      // Cargar checkpoints de auditoría
      try {
        const checkpointsResponse = await axios.get(`/api/escrutinio/${escrutinioId}/checkpoint`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        
        if (checkpointsResponse.data.success) {
          console.log('📋 Checkpoints cargados:', checkpointsResponse.data.data.checkpoints);
          setCheckpoints(checkpointsResponse.data.data.checkpoints);
        }
      } catch (checkpointErr) {
        console.warn('⚠️ No se pudieron cargar los checkpoints:', checkpointErr);
        // No es crítico, continuar sin checkpoints
      }
    } catch (err: any) {
      console.error('❌ Error loading escrutinio:', err);
      console.error('❌ Error response:', err?.response?.data);
      console.error('❌ Error status:', err?.response?.status);
      
      if (err?.response?.status === 401) {
        setError('Sesión expirada. Por favor inicia sesión nuevamente.');
        setTimeout(() => window.location.href = '/', 2000);
      } else {
        setError(err instanceof Error ? err.message : 'Error desconocido');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleHideGps = async () => {
    if (!hideReason.trim()) {
      alert('Por favor ingresa una razón para ocultar la ubicación');
      return;
    }

    try {
      setIsUpdatingGps(true);
      const token = localStorage.getItem('auth-token');
      
      if (!token) {
        alert('Sesión expirada. Por favor inicia sesión nuevamente.');
        window.location.href = '/';
        return;
      }

      console.log('🔐 Token encontrado:', token.substring(0, 20) + '...');
      
      const response = await axios.post(`/api/escrutinio/${escrutinioId}/hide-gps`, {
        reason: hideReason.trim()
      }, {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      console.log('✅ Respuesta hide-gps:', response.data);

      if (response.data?.success) {
        // Recargar datos del escrutinio
        await loadEscrutinioData();
        setShowHideModal(false);
        setHideReason('');
        alert('Ubicación GPS oculta exitosamente');
      } else {
        alert('Error ocultando ubicación: ' + response.data?.error);
      }
    } catch (error: any) {
      console.error('❌ Error ocultando GPS:', error);
      console.error('❌ Error response:', error?.response?.data);
      console.error('❌ Error status:', error?.response?.status);
      
      if (error?.response?.status === 401) {
        alert('Sesión expirada. Por favor inicia sesión nuevamente.');
        window.location.href = '/';
      } else {
        alert('Error ocultando ubicación: ' + (error?.response?.data?.error || error.message));
      }
    } finally {
      setIsUpdatingGps(false);
    }
  };

  const handleShowGps = async () => {
    try {
      setIsUpdatingGps(true);
      const token = localStorage.getItem('auth-token');
      
      if (!token) {
        alert('Sesión expirada. Por favor inicia sesión nuevamente.');
        window.location.href = '/';
        return;
      }

      console.log('🔐 Token encontrado para show-gps:', token.substring(0, 20) + '...');
      
      const response = await axios.post(`/api/escrutinio/${escrutinioId}/show-gps`, {}, {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      console.log('✅ Respuesta show-gps:', response.data);

      if (response.data?.success) {
        // Recargar datos del escrutinio
        await loadEscrutinioData();
        alert('Ubicación GPS mostrada exitosamente');
      } else {
        alert('Error mostrando ubicación: ' + response.data?.error);
      }
    } catch (error: any) {
      console.error('❌ Error mostrando GPS:', error);
      console.error('❌ Error response:', error?.response?.data);
      console.error('❌ Error status:', error?.response?.status);
      
      if (error?.response?.status === 401) {
        alert('Sesión expirada. Por favor inicia sesión nuevamente.');
        window.location.href = '/';
      } else {
        alert('Error mostrando ubicación: ' + (error?.response?.data?.error || error.message));
      }
    } finally {
      setIsUpdatingGps(false);
    }
  };

  if (isLoading || loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Cargando escrutinio...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-red-600 mb-4">{error}</p>
            <Button
              variant="primary"
              onClick={() => router.push('/dashboard')}
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Volver al Dashboard
            </Button>
          </div>
        </div>
      </div>
    );
  }

  if (!escrutinioData) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-600">No se encontró el escrutinio</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-4">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => router.push('/dashboard')}
              >
                <ArrowLeft className="h-4 w-4 mr-2" />
                Volver
              </Button>
              <div className="flex items-center gap-2">
                <Eye className="h-6 w-6 text-primary-600" />
                <h1 className="text-xl font-semibold text-gray-900">
                  Revisar Escrutinio
                </h1>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <div className="px-3 py-1 bg-green-100 text-green-800 rounded-full text-sm font-medium">
                <CheckCircle className="h-4 w-4 inline mr-1" />
                Completado
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Información del Escrutinio */}
        <div className="bg-white rounded-lg shadow-sm border mb-6">
          <div className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-100 rounded-lg">
                  <MapPin className="h-5 w-5 text-blue-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-600">Mesa Electoral</p>
                  <p className="font-semibold text-gray-900">{escrutinioData.mesaNumber}</p>
                  <p className="text-sm text-gray-500">{escrutinioData.mesaName}</p>
                </div>
              </div>
              
              <div className="flex items-center gap-3">
                <div className="p-2 bg-green-100 rounded-lg">
                  <FileText className="h-5 w-5 text-green-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-600">Nivel Electoral</p>
                  <p className="font-semibold text-gray-900">{escrutinioData.electionLevel}</p>
                </div>
              </div>
              
              <div className="flex items-center gap-3">
                <div className="p-2 bg-purple-100 rounded-lg">
                  <Calendar className="h-5 w-5 text-purple-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-600">Completado</p>
                  <p className="font-semibold text-gray-900">
                    {new Date(escrutinioData.completedAt).toLocaleDateString()}
                  </p>
                  <p className="text-sm text-gray-500">
                    {new Date(escrutinioData.completedAt).toLocaleTimeString()}
                  </p>
                </div>
              </div>
              
              <div className="flex items-center gap-3">
                <div className="p-2 bg-orange-100 rounded-lg">
                  <User className="h-5 w-5 text-orange-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-600">Responsable</p>
                  <p className="font-semibold text-gray-900">{escrutinioData.user.name}</p>
                  <p className="text-sm text-gray-500">{escrutinioData.user.email}</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Ubicación GPS */}
        {(escrutinioData.initialGps || escrutinioData.finalGps) ? (
          <div className="bg-white rounded-lg shadow-sm border mb-6">
            <div className="p-6">
              <div className="flex items-center gap-3 mb-6">
                <div className="p-2 bg-green-100 rounded-lg">
                  <Navigation className="h-5 w-5 text-green-600" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-gray-900">Ubicación del Escrutinio</h2>
                  <p className="text-sm text-gray-600">Coordenadas GPS capturadas durante el escrutinio</p>
                </div>
              </div>
              
              <div className="space-y-6">
                {/* GPS Inicial */}
                {escrutinioData.initialGps && (
                  <div className="border rounded-lg p-4">
                    <div className="mb-3">
                      <h3 className="text-md font-semibold text-gray-900">📍 Ubicación cuando se inició el escrutinio</h3>
                    </div>
                    
                    {escrutinioData.gpsHidden ? (
                      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                        <div className="flex items-center gap-2 text-yellow-800">
                          <span className="text-sm font-medium">Ubicación oculta por privacidad</span>
                        </div>
                        <p className="text-sm text-yellow-700 mt-1">
                          Razón: {escrutinioData.gpsHiddenReason}
                        </p>
                        <p className="text-xs text-yellow-600 mt-1">
                          Ocultado el {new Date(escrutinioData.gpsHiddenAt!).toLocaleString()}
                        </p>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <div className="flex justify-between">
                              <span className="text-sm text-gray-600">Latitud:</span>
                              <span className="text-sm font-mono text-gray-900">
                                {escrutinioData.initialGps.latitude.toFixed(6)}
                              </span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-sm text-gray-600">Longitud:</span>
                              <span className="text-sm font-mono text-gray-900">
                                {escrutinioData.initialGps.longitude.toFixed(6)}
                              </span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-sm text-gray-600">Precisión:</span>
                              <span className="text-sm font-mono text-gray-900">
                                ±{escrutinioData.initialGps.accuracy.toFixed(0)}m
                              </span>
                            </div>
                          </div>
                        </div>
                        
                        <div className="flex flex-col items-center gap-2">
                          <Button
                            variant="secondary"
                            size="sm"
                            onClick={() => window.open(getGoogleMapsUrl(escrutinioData.initialGps!.latitude, escrutinioData.initialGps!.longitude), '_blank')}
                            className="flex items-center gap-2"
                          >
                            <ExternalLink className="h-4 w-4" />
                            Ver en Google Maps
                          </Button>
                          {user?.role === 'ADMIN' && (
                            escrutinioData.gpsHidden ? (
                              <Button
                                variant="secondary"
                                size="sm"
                                onClick={handleShowGps}
                                disabled={isUpdatingGps}
                                className="flex items-center gap-2"
                              >
                                Mostrar Ubicación
                              </Button>
                            ) : (
                              <Button
                                variant="secondary"
                                size="sm"
                                onClick={() => setShowHideModal(true)}
                                disabled={isUpdatingGps}
                                className="flex items-center gap-2"
                              >
                                Ocultar Ubicación
                              </Button>
                            )
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* GPS Final */}
                {escrutinioData.finalGps && (
                  <div className="border rounded-lg p-4">
                    <div className="mb-3">
                      <h3 className="text-md font-semibold text-gray-900">📍 Ubicación cuando se cerró el escrutinio</h3>
                    </div>
                    
                    {escrutinioData.gpsHidden ? (
                      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                        <div className="flex items-center gap-2 text-yellow-800">
                          <span className="text-sm font-medium">Ubicación oculta por privacidad</span>
                        </div>
                        <p className="text-sm text-yellow-700 mt-1">
                          Razón: {escrutinioData.gpsHiddenReason}
                        </p>
                        <p className="text-xs text-yellow-600 mt-1">
                          Ocultado el {new Date(escrutinioData.gpsHiddenAt!).toLocaleString()}
                        </p>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <div className="flex justify-between">
                              <span className="text-sm text-gray-600">Latitud:</span>
                              <span className="text-sm font-mono text-gray-900">
                                {escrutinioData.finalGps.latitude.toFixed(6)}
                              </span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-sm text-gray-600">Longitud:</span>
                              <span className="text-sm font-mono text-gray-900">
                                {escrutinioData.finalGps.longitude.toFixed(6)}
                              </span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-sm text-gray-600">Precisión:</span>
                              <span className="text-sm font-mono text-gray-900">
                                ±{escrutinioData.finalGps.accuracy.toFixed(0)}m
                              </span>
                            </div>
                          </div>
                        </div>
                        
                        <div className="flex flex-col items-center gap-2">
                          <Button
                            variant="secondary"
                            size="sm"
                            onClick={() => window.open(getGoogleMapsUrl(escrutinioData.finalGps!.latitude, escrutinioData.finalGps!.longitude), '_blank')}
                            className="flex items-center gap-2"
                          >
                            <ExternalLink className="h-4 w-4" />
                            Ver en Google Maps
                          </Button>
                          {user?.role === 'ADMIN' && (
                            escrutinioData.gpsHidden ? (
                              <Button
                                variant="secondary"
                                size="sm"
                                onClick={handleShowGps}
                                disabled={isUpdatingGps}
                                className="flex items-center gap-2"
                              >
                                Mostrar Ubicación
                              </Button>
                            ) : (
                              <Button
                                variant="secondary"
                                size="sm"
                                onClick={() => setShowHideModal(true)}
                                disabled={isUpdatingGps}
                                className="flex items-center gap-2"
                              >
                                Ocultar Ubicación
                              </Button>
                            )
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        ) : (
          <div className="bg-white rounded-lg shadow-sm border mb-6">
            <div className="p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2 bg-gray-100 rounded-lg">
                  <Navigation className="h-5 w-5 text-gray-600" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-gray-900">Ubicación del Escrutinio</h2>
                  <p className="text-sm text-gray-600">Ubicación GPS no disponible</p>
                </div>
              </div>
              <div className="text-center py-4">
                <p className="text-gray-500">No se pudo capturar la ubicación GPS durante este escrutinio.</p>
              </div>
            </div>
          </div>
        )}

        {/* Resultados de Votos */}
        <div className="bg-white rounded-lg shadow-sm border mb-6">
          <div className="p-6">
            <div className="flex items-center gap-3 mb-6">
              <BarChart3 className="h-6 w-6 text-primary-600" />
              <h2 className="text-xl font-semibold text-gray-900">
                {escrutinioData.electionLevel === 'LEGISLATIVE' ? 'Resultado de Marcas' : 'Resultados del Conteo'}
              </h2>
            </div>
            
            {/* Lista de candidatos/partidos con votos */}
            <div className="space-y-3 mb-6">
              {escrutinioData.electionLevel === 'LEGISLATIVE' ? (
                // Mostrar votos legislativos usando el componente de revisión
                (() => {
                  console.log('📊 Renderizando LegislativeReview con candidates:', escrutinioData.candidates);
                  return <LegislativeReview candidates={escrutinioData.candidates} />;
                })()
              ) : (
                // Mostrar votos presidenciales como antes (ordenados por número)
                escrutinioData.candidates
                  .sort((a: any, b: any) => a.number - b.number)
                  .map((candidate) => (
                  <div 
                    key={candidate.id}
                    className="flex items-center justify-between p-4 rounded-lg border"
                    style={{
                      backgroundColor: candidate.partyColor ? `${candidate.partyColor}15` : '#f9fafb',
                      borderLeftWidth: 4,
                      borderLeftColor: candidate.partyColor || '#e5e7eb'
                    }}
                  >
                    <div className="flex items-center gap-4">
                      <div className="flex-shrink-0">
                        <div 
                          className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-sm"
                          style={{ backgroundColor: candidate.partyColor || '#6b7280' }}
                        >
                          {candidate.number || '?'}
                        </div>
                      </div>
                      <div>
                        <p className="font-medium text-gray-900">{candidate.name}</p>
                        <p className="text-sm text-gray-600">{candidate.party}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-2xl font-bold text-gray-900">{candidate.votes}</p>
                      <p className="text-sm text-gray-500">voto{candidate.votes !== 1 ? 's' : ''}</p>
                    </div>
                  </div>
                ))
              )}
            </div>
            
            {/* Resumen de votos */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <h3 className="text-lg font-semibold text-blue-900 mb-3 flex items-center gap-2">
                <CheckCircle className="h-5 w-5" />
                {escrutinioData.electionLevel === 'LEGISLATIVE' ? 'Resumen de Marcas' : 'Resumen de Votos'}
              </h3>
              <div className="space-y-2">
                {escrutinioData.electionLevel === 'LEGISLATIVE' ? (
                  // Resumen para votos legislativos
                  Object.entries(
                    escrutinioData.candidates.reduce((acc: Record<string, {party: string, votes: number}>, candidate: any) => {
                      const party = candidate.party;
                      if (!acc[party]) {
                        acc[party] = {
                          party: party,
                          votes: 0
                        };
                      }
                      acc[party].votes += candidate.votes;
                      return acc;
                    }, {})
                  ).map(([party, partyData]: [string, any]) => (
                    <div key={party} className="flex justify-between items-center text-sm">
                      <span className="text-blue-700">
                        {party}
                      </span>
                      <span className="font-bold text-blue-900">
                        {partyData.votes} voto{partyData.votes !== 1 ? 's' : ''}
                      </span>
                    </div>
                  ))
                ) : (
                  // Resumen para votos presidenciales
                  escrutinioData.candidates
                    .filter(c => c.votes > 0)
                    .map(c => (
                      <div key={c.id} className="flex justify-between items-center text-sm">
                        <span className="text-blue-700">
                          {c.number}. {c.name} ({c.party})
                        </span>
                        <span className="font-bold text-blue-900">
                          {c.votes} voto{c.votes !== 1 ? 's' : ''}
                        </span>
                      </div>
                    ))
                )}
              </div>
              <div className="mt-3 pt-3 border-t border-blue-200">
                <div className="flex justify-between items-center font-semibold">
                  <span className="text-blue-700">Total:</span>
                  <span className="text-blue-900">
                    {escrutinioData.totalVotes} {escrutinioData.electionLevel === 'LEGISLATIVE' ? 'marca' : 'voto'}{escrutinioData.totalVotes !== 1 ? 's' : ''}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Acta (si existe) */}
        {escrutinioData.actaUrl ? (
          <div className="bg-white rounded-lg shadow-sm border">
            <div className="p-6">
              <div className="flex items-center gap-3 mb-4">
                <Camera className="h-6 w-6 text-primary-600" />
                <h2 className="text-xl font-semibold text-gray-900">Acta Fotográfica</h2>
              </div>
              <div className="bg-gray-50 rounded-lg p-4">
                <img 
                  src={escrutinioData.actaUrl} 
                  alt="Foto del acta electoral"
                  className="w-full h-auto rounded-lg shadow-sm"
                />
              </div>
            </div>
          </div>
        ) : (
          <div className="bg-white rounded-lg shadow-sm border">
            <div className="p-6">
              <div className="flex items-center gap-3 mb-4">
                <Camera className="h-6 w-6 text-gray-400" />
                <h2 className="text-xl font-semibold text-gray-900">Acta Fotográfica</h2>
              </div>
              <div className="bg-gray-50 rounded-lg p-4 text-center">
                <p className="text-gray-500">No se encontró acta fotográfica</p>
                <p className="text-sm text-gray-400 mt-2">Debug: actaUrl = {escrutinioData.actaUrl || 'null'}</p>
              </div>
            </div>
          </div>
        )}

        {/* Timeline de Auditoría */}
        <CheckpointTimeline 
          checkpoints={checkpoints}
          escrutinioStartedAt={escrutinioData.startedAt}
          escrutinioCompletedAt={escrutinioData.completedAt}
          initialGps={escrutinioData.initialGps}
          finalGps={escrutinioData.finalGps}
        />
      </div>

      {/* Modal para ocultar ubicación GPS */}
      {showHideModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
            <div className="text-center">
              <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-yellow-100 mb-4">
                <MapPin className="h-6 w-6 text-yellow-600" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                Ocultar Ubicación GPS
              </h3>
              <p className="text-sm text-gray-600 mb-6">
                Esta acción ocultará las coordenadas GPS de este escrutinio por motivos de privacidad.
              </p>
              
              <div className="mb-6">
                <label htmlFor="hideReason" className="block text-sm font-medium text-gray-700 mb-2">
                  Razón para ocultar la ubicación *
                </label>
                <textarea
                  id="hideReason"
                  value={hideReason}
                  onChange={(e) => setHideReason(e.target.value)}
                  placeholder="Ej: Escrutinio de prueba, ubicación privada, etc."
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  rows={3}
                  required
                />
              </div>
              
              <div className="flex gap-3">
                <button
                  onClick={() => {
                    setShowHideModal(false);
                    setHideReason('');
                  }}
                  className="flex-1 px-4 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleHideGps}
                  disabled={isUpdatingGps || !hideReason.trim()}
                  className="flex-1 px-4 py-2 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 disabled:bg-gray-400 disabled:text-gray-200 disabled:cursor-not-allowed transition-colors"
                >
                  {isUpdatingGps ? 'Ocultando...' : 'Ocultar Ubicación'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
