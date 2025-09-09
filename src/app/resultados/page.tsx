'use client';

import React, { useState, useEffect } from 'react';
import { 
  Vote, 
  BarChart3, 
  TrendingUp, 
  MapPin,
  CheckCircle,
  Clock,
  AlertCircle,
  Eye,
  Calendar
} from 'lucide-react';
import { MesaSearchInput } from '@/components/MesaSearchInput';
import BackButton from '@/components/ui/BackButton';

interface ResultSummary {
  level: string;
  totalMesas: number;
  completedMesas: number;
  totalVotes: number;
  candidates: CandidateResult[];
}

interface CandidateResult {
  name: string;
  party: string;
  votes: number;
  percentage: number;
}

interface MesaOption {
  id: string;
  number: string;
  location: string;
  department: string;
  displayName: string;
}

interface RecentMesa {
  id: string;
  mesaNumber: string;
  mesaName: string;
  department: string;
  completedAt: string;
  electionLevel: string;
}

interface LocationData {
  location: string;
  department: string;
  total: number;
  completed: number;
  pending: number;
  completionPercentage: number;
  status: 'completed' | 'partial' | 'pending';
}

type ResultsResponse = Record<'PRESIDENTIAL' | 'LEGISLATIVE' | 'MUNICIPAL', ResultSummary>;

export default function ResultadosPage() {
  const [activeLevel, setActiveLevel] = useState<'PRESIDENTIAL' | 'LEGISLATIVE' | 'MUNICIPAL'>('PRESIDENTIAL');
  const [isLoading, setIsLoading] = useState(true);
  const [results, setResults] = useState<ResultsResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showEvidence, setShowEvidence] = useState(false);
  const [evidence, setEvidence] = useState<Array<{ escrutinioId: string; mesaNumber: string; url: string; completedAt: string }>>([]);
  const [selectedMesa, setSelectedMesa] = useState<string>('');
  const [selectedMesaOption, setSelectedMesaOption] = useState<MesaOption | null>(null);
  const [recentMesas, setRecentMesas] = useState<RecentMesa[]>([]);
  const [showRecentMesas, setShowRecentMesas] = useState(false);
  const [mesaVotes, setMesaVotes] = useState<any>(null);
  const [showMesaVotes, setShowMesaVotes] = useState(false);
  const [locationData, setLocationData] = useState<LocationData[]>([]);
  const [showAllRecentMesas, setShowAllRecentMesas] = useState(false);

  useEffect(() => {
    const load = async () => {
      try {
        setIsLoading(true);
        setError(null);
        const resp = await fetch('/api/results', { cache: 'no-store' });
        const json = await resp.json();
        if (json?.success && json?.data) {
          setResults(json.data as ResultsResponse);
        } else {
          setError(json?.error || 'No se pudieron cargar los resultados');
        }
      } catch (e: any) {
        setError(e?.message || 'Error cargando resultados');
      } finally {
        setIsLoading(false);
      }
    };
    load();
  }, []);

  // Cargar datos de ubicación cuando cambia el nivel
  useEffect(() => {
    const loadLocationData = async () => {
      try {
        const resp = await fetch(`/api/mesas/by-location?level=${activeLevel}`, { cache: 'no-store' });
        const json = await resp.json();
        if (json?.success) {
          setLocationData(json.data);
        }
      } catch (e) {
        console.error('Error loading location data:', e);
      }
    };
    loadLocationData();
  }, [activeLevel]);

  // Cargar mesas recientes
  const loadRecentMesas = async () => {
    try {
      const resp = await fetch(`/api/mesas/recent?level=${activeLevel}&limit=10`, { cache: 'no-store' });
      const json = await resp.json();
      if (json?.success) {
        setRecentMesas(json.data);
        setShowRecentMesas(true);
      }
    } catch (e) {
      console.error('Error loading recent mesas:', e);
    }
  };

  // Cargar votos de mesa específica
  const loadMesaVotes = async (mesaId: string) => {
    try {
      const resp = await fetch(`/api/mesas/${mesaId}/votes`, { cache: 'no-store' });
      const json = await resp.json();
      if (json?.success) {
        setMesaVotes(json.data);
        setShowMesaVotes(true);
      }
    } catch (e) {
      console.error('Error loading mesa votes:', e);
    }
  };

  const loadEvidence = async () => {
    try {
      const params = new URLSearchParams();
      if (selectedMesa) params.set('mesaNumber', selectedMesa);
      params.set('level', activeLevel);
      const resp = await fetch(`/api/evidence?${params.toString()}`, { cache: 'no-store' });
      const json = await resp.json();
      if (json?.success) setEvidence(json.data);
      setShowEvidence(true);
    } catch {}
  };

  const currentResults = results ? results[activeLevel] : null;
  const completionPercentage = currentResults && currentResults.totalMesas > 0
    ? (currentResults.completedMesas / currentResults.totalMesas) * 100
    : 0;

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Cargando resultados...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <AlertCircle className="h-8 w-8 text-danger-600 mx-auto" />
          <p className="mt-4 text-gray-600">{error}</p>
        </div>
      </div>
    );
  }

  if (!currentResults) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <p className="mt-4 text-gray-600">No hay resultados disponibles todavía.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center">
              <BackButton className="mr-4" />
              <Vote className="h-8 w-8 text-primary-600" />
              <h1 className="ml-3 text-xl font-semibold text-gray-900">
                Resultados Electorales
              </h1>
            </div>
            
            <div className="flex items-center space-x-2">
              <Clock className="h-5 w-5 text-gray-400" />
              <span className="text-sm text-gray-700">
                Última actualización: {new Date().toLocaleTimeString()}
              </span>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Progress Overview */}
        <div className="mb-8">
          <div className="bg-white p-6 rounded-lg shadow-sm border">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Progreso General</h2>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="text-center">
                <div className="text-3xl font-bold text-primary-600">{currentResults.totalMesas}</div>
                <div className="text-sm text-gray-600">Total de Mesas</div>
              </div>
              
              <div className="text-center">
                <div className="text-3xl font-bold text-green-600">{currentResults.completedMesas}</div>
                <div className="text-sm text-gray-600">Mesas Completadas</div>
              </div>
              
              <div className="text-center">
                <div className="text-3xl font-bold text-blue-600">{currentResults.totalVotes}</div>
                <div className="text-sm text-gray-600">Total de Votos</div>
              </div>
            </div>

            <div className="mt-6">
              <div className="flex justify-between text-sm text-gray-600 mb-2">
                <span>Progreso de transmisión</span>
                <span>{completionPercentage.toFixed(1)}%</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div 
                  className="bg-primary-600 h-2 rounded-full transition-all duration-300"
                  style={{ width: `${completionPercentage}%` }}
                ></div>
              </div>
            </div>
          </div>
        </div>

        {/* Level Selection */}
        <div className="mb-8">
          <div className="bg-white p-6 rounded-lg shadow-sm border">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Nivel Electoral</h2>
            
            <div className="flex space-x-4">
              {(['PRESIDENTIAL','LEGISLATIVE','MUNICIPAL'] as const).map((level) => (
                <button
                  key={level}
                  onClick={() => setActiveLevel(level)}
                  className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                    activeLevel === level
                      ? 'bg-primary-600 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  {results ? results[level].level : level}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Results Table */}
        <div className="bg-white rounded-lg shadow-sm border overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200">
            <h3 className="text-lg font-semibold text-gray-900">
              Resultados - {currentResults.level}
            </h3>
            <div className="mt-2 flex items-center space-x-3">
              <div className="flex-1">
                <MesaSearchInput
                  value={selectedMesa}
                  onChange={setSelectedMesa}
                  onSelect={setSelectedMesaOption}
                  placeholder="Buscar mesa (ej. 001, colegio, departamento...)"
                  className="w-full"
                />
              </div>
              <button
                onClick={loadEvidence}
                className="text-sm px-3 py-2 bg-primary-600 text-white rounded hover:bg-primary-700 transition-colors"
              >
                Ver evidencia
              </button>
              <button
                onClick={loadRecentMesas}
                className="text-sm px-3 py-2 bg-gray-600 text-white rounded hover:bg-gray-700 transition-colors"
              >
                Mesas recientes
              </button>
            </div>
          </div>
          
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Candidato
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Partido
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Votos
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Porcentaje
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {currentResults.candidates.map((candidate, index) => (
                  <tr key={index} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <div className="flex-shrink-0 h-10 w-10">
                          <div className="h-10 w-10 rounded-full bg-primary-100 flex items-center justify-center">
                            <span className="text-sm font-medium text-primary-600">
                              {candidate.name.split(' ').map(n => n[0]).join('')}
                            </span>
                          </div>
                        </div>
                        <div className="ml-4">
                          <div className="text-sm font-medium text-gray-900">
                            {candidate.name}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">{candidate.party}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">
                        {candidate.votes.toLocaleString()}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <div className="text-sm font-medium text-gray-900 mr-2">
                          {candidate.percentage.toFixed(1)}%
                        </div>
                        <div className="flex-1 bg-gray-200 rounded-full h-2 w-20">
                          <div 
                            className="bg-primary-600 h-2 rounded-full"
                            style={{ width: `${candidate.percentage}%` }}
                          ></div>
                        </div>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {showEvidence && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4" onClick={() => setShowEvidence(false)}>
            <div className="bg-white rounded-lg shadow-lg max-w-4xl w-full p-4" onClick={(e) => e.stopPropagation()}>
              <div className="flex items-center justify-between mb-3">
                <h4 className="text-lg font-semibold">Evidencia fotográfica</h4>
                <button className="text-sm text-gray-600" onClick={() => setShowEvidence(false)}>Cerrar</button>
              </div>
              {evidence.length === 0 ? (
                <p className="text-sm text-gray-600">No hay evidencia para los filtros seleccionados.</p>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 max-h-[70vh] overflow-auto">
                  {evidence.map((img) => (
                    <div key={img.escrutinioId} className="border rounded overflow-hidden">
                      <img src={img.url} alt={img.mesaNumber} className="w-full h-40 object-cover" />
                      <div className="p-2 text-xs text-gray-700 flex justify-between">
                        <span>{img.mesaNumber}</span>
                        <span>{new Date(img.completedAt).toLocaleString()}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Modal de Mesas Recientes */}
        {showRecentMesas && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4" onClick={() => setShowRecentMesas(false)}>
            <div className="bg-white rounded-lg shadow-lg max-w-2xl w-full p-4" onClick={(e) => e.stopPropagation()}>
              <div className="flex items-center justify-between mb-4">
                <h4 className="text-lg font-semibold">Mesas Más Recientes</h4>
                <button className="text-sm text-gray-600" onClick={() => setShowRecentMesas(false)}>Cerrar</button>
              </div>
              <div className="space-y-2 max-h-[60vh] overflow-auto">
                {recentMesas.map((mesa) => (
                  <div key={mesa.id} className="flex items-center justify-between p-3 border rounded-lg hover:bg-gray-50">
                    <div className="flex items-center gap-3">
                      <MapPin className="h-4 w-4 text-gray-400" />
                      <div>
                        <div className="font-medium text-gray-900">{mesa.mesaNumber}</div>
                        <div className="text-sm text-gray-600">{mesa.mesaName}</div>
                        <div className="text-xs text-gray-500">{mesa.department}</div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="text-right">
                        <div className="text-xs text-gray-500">
                          {new Date(mesa.completedAt).toLocaleString()}
                        </div>
                        <div className="text-xs text-green-600 font-medium">Completada</div>
                      </div>
                      <button
                        onClick={() => loadMesaVotes(mesa.id)}
                        className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                        title="Ver votos de esta mesa"
                      >
                        <Eye className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Modal de Votos de Mesa Específica */}
        {showMesaVotes && mesaVotes && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4" onClick={() => setShowMesaVotes(false)}>
            <div className="bg-white rounded-lg shadow-lg max-w-4xl w-full p-4" onClick={(e) => e.stopPropagation()}>
              <div className="flex items-center justify-between mb-4">
                <h4 className="text-lg font-semibold">Votos por Mesa</h4>
                <button className="text-sm text-gray-600" onClick={() => setShowMesaVotes(false)}>Cerrar</button>
              </div>
              <div className="space-y-6 max-h-[70vh] overflow-auto">
                {Object.entries(mesaVotes).map(([level, data]: [string, any]) => (
                  <div key={level} className="border rounded-lg p-4">
                    <div className="flex items-center justify-between mb-3">
                      <h5 className="font-semibold text-gray-900">{data.level}</h5>
                      <div className="text-sm text-gray-600">
                        {data.mesaNumber} - {data.mesaName}
                      </div>
                    </div>
                    <div className="space-y-2">
                      {data.candidates.map((candidate: CandidateResult, index: number) => (
                        <div key={index} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                          <div className="flex items-center gap-3">
                            <div className="w-6 h-6 bg-primary-100 rounded-full flex items-center justify-center text-xs font-medium text-primary-600">
                              {index + 1}
                            </div>
                            <div>
                              <div className="font-medium text-gray-900">{candidate.name}</div>
                              <div className="text-sm text-gray-600">{candidate.party}</div>
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="font-medium text-gray-900">{candidate.votes.toLocaleString()}</div>
                            <div className="text-sm text-gray-600">{candidate.percentage.toFixed(1)}%</div>
                          </div>
                        </div>
                      ))}
                    </div>
                    <div className="mt-3 pt-3 border-t text-sm text-gray-600">
                      Total de votos: {data.totalVotes.toLocaleString()}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Mesas Recientes */}
        <div className="mt-8">
          <div className="bg-white p-6 rounded-lg shadow-sm border">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">Mesas Más Recientes</h3>
              <button
                onClick={loadRecentMesas}
                className="text-sm px-3 py-2 bg-primary-600 text-white rounded hover:bg-primary-700 transition-colors"
              >
                Actualizar
              </button>
            </div>
            
            {recentMesas.length > 0 ? (
              <div className="space-y-3">
                {(showAllRecentMesas ? recentMesas : recentMesas.slice(0, 5)).map((mesa) => (
                  <div key={mesa.id} className="flex items-center justify-between p-3 border rounded-lg hover:bg-gray-50">
                    <div className="flex items-center gap-3">
                      <MapPin className="h-4 w-4 text-gray-400" />
                      <div>
                        <div className="font-medium text-gray-900">{mesa.mesaNumber}</div>
                        <div className="text-sm text-gray-600">{mesa.mesaName}</div>
                        <div className="text-xs text-gray-500">{mesa.department}</div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="text-right">
                        <div className="text-xs text-gray-500">
                          {new Date(mesa.completedAt).toLocaleString()}
                        </div>
                        <div className="text-xs text-green-600 font-medium">Completada</div>
                      </div>
                      <button
                        onClick={() => loadMesaVotes(mesa.id)}
                        className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                        title="Ver votos de esta mesa"
                      >
                        <Eye className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                ))}
                {recentMesas.length > 5 && (
                  <button
                    onClick={() => setShowAllRecentMesas(!showAllRecentMesas)}
                    className="w-full py-2 text-sm text-primary-600 hover:text-primary-700 font-medium"
                  >
                    {showAllRecentMesas ? 'Ver menos' : `Ver todas (${recentMesas.length})`}
                  </button>
                )}
              </div>
            ) : (
              <div className="text-center py-6 text-gray-500">
                <Calendar className="h-10 w-10 mx-auto mb-3 text-gray-300" />
                <p className="text-sm">No hay mesas completadas recientemente</p>
                <p className="text-xs text-gray-400">Los escrutinios completados aparecerán aquí</p>
              </div>
            )}
          </div>
        </div>

        {/* Status Indicators */}
        <div className="mt-8 grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-white p-6 rounded-lg shadow-sm border">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Estado de Transmisión</h3>
            
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center">
                  <CheckCircle className="h-5 w-5 text-green-600 mr-2" />
                  <span className="text-sm text-gray-700">Completadas</span>
                </div>
                <span className="text-sm font-medium text-gray-900">{currentResults.completedMesas}</span>
              </div>
              
              <div className="flex items-center justify-between">
                <div className="flex items-center">
                  <Clock className="h-5 w-5 text-yellow-600 mr-2" />
                  <span className="text-sm text-gray-700">En proceso</span>
                </div>
                <span className="text-sm font-medium text-gray-900">0</span>
              </div>
              
              <div className="flex items-center justify-between">
                <div className="flex items-center">
                  <AlertCircle className="h-5 w-5 text-red-600 mr-2" />
                  <span className="text-sm text-gray-700">Pendientes</span>
                </div>
                <span className="text-sm font-medium text-gray-900">
                  {currentResults.totalMesas - currentResults.completedMesas}
                </span>
              </div>
            </div>
          </div>

          <div className="bg-white p-6 rounded-lg shadow-sm border">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Mesas por Ubicación</h3>
            
            {locationData.length > 0 ? (
              <div className="space-y-3">
                {locationData.slice(0, 5).map((location, index) => (
                  <div key={index} className="flex items-center justify-between">
                    <div className="flex items-center">
                      <MapPin className="h-5 w-5 text-gray-400 mr-2" />
                      <div>
                        <span className="text-sm text-gray-700">{location.location}</span>
                        <div className="text-xs text-gray-500">{location.department}</div>
                      </div>
                    </div>
                    <div className="text-right">
                      <span className={`text-sm font-medium ${
                        location.status === 'completed' ? 'text-green-600' :
                        location.status === 'partial' ? 'text-yellow-600' : 'text-gray-500'
                      }`}>
                        {location.completed}/{location.total}
                      </span>
                      <div className="w-16 bg-gray-200 rounded-full h-1 mt-1">
                        <div 
                          className={`h-1 rounded-full transition-all duration-500 ${
                            location.status === 'completed' ? 'bg-green-600' :
                            location.status === 'partial' ? 'bg-yellow-600' : 'bg-gray-400'
                          }`}
                          style={{ width: `${location.completionPercentage}%` }}
                        ></div>
                      </div>
                    </div>
                  </div>
                ))}
                {locationData.length > 5 && (
                  <div className="text-center pt-2">
                    <span className="text-xs text-gray-500">
                      Y {locationData.length - 5} ubicaciones más...
                    </span>
                  </div>
                )}
              </div>
            ) : (
              <div className="text-center py-4 text-gray-500">
                <MapPin className="h-8 w-8 mx-auto mb-2 text-gray-300" />
                <p className="text-sm">Cargando ubicaciones...</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
} 