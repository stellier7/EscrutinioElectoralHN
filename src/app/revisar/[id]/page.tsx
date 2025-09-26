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
  BarChart3
} from 'lucide-react';
import Button from '../../../components/ui/Button';
import LegislativeReview from '../../../components/LegislativeReview';

interface EscrutinioData {
  id: string;
  mesaNumber: string;
  mesaName: string;
  department: string;
  electionLevel: string;
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
  gps?: {
    latitude: number;
    longitude: number;
    accuracy: number;
  };
  user: {
    id: string;
    name: string;
    email: string;
  };
}

export default function RevisarEscrutinioPage() {
  const { user, isLoading } = useAuth();
  const router = useRouter();
  const params = useParams();
  const escrutinioId = params.id as string;
  
  const [escrutinioData, setEscrutinioData] = useState<EscrutinioData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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
      
      const response = await axios.get(`/api/escrutinio/${escrutinioId}/review`);
      
      if (response.data.success) {
        console.log('📊 Datos del escrutinio cargados:', response.data.data);
        console.log('📊 Candidatos:', response.data.data.candidates);
        console.log('📊 Total de votos:', response.data.data.totalVotes);
        console.log('📸 Acta URL recibida:', response.data.data.actaUrl);
        setEscrutinioData(response.data.data);
      } else {
        throw new Error(response.data.error || 'Error al cargar el escrutinio');
      }
    } catch (err) {
      console.error('Error loading escrutinio:', err);
      setError(err instanceof Error ? err.message : 'Error desconocido');
    } finally {
      setLoading(false);
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
                // Mostrar votos presidenciales como antes
                escrutinioData.candidates.map((candidate) => (
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
      </div>
    </div>
  );
}
