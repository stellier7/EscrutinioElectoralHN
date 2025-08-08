'use client';

import React, { useState, useEffect } from 'react';
import { 
  Vote, 
  BarChart3, 
  TrendingUp, 
  MapPin,
  CheckCircle,
  Clock,
  AlertCircle
} from 'lucide-react';

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

type ResultsResponse = Record<'PRESIDENTIAL' | 'LEGISLATIVE' | 'MUNICIPAL', ResultSummary>;

export default function ResultadosPage() {
  const [activeLevel, setActiveLevel] = useState<'PRESIDENTIAL' | 'LEGISLATIVE' | 'MUNICIPAL'>('PRESIDENTIAL');
  const [isLoading, setIsLoading] = useState(true);
  const [results, setResults] = useState<ResultsResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showEvidence, setShowEvidence] = useState(false);
  const [evidence, setEvidence] = useState<Array<{ escrutinioId: string; mesaNumber: string; url: string; completedAt: string }>>([]);
  const [selectedMesa, setSelectedMesa] = useState<string>('');

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
              <input
                className="border px-2 py-1 rounded text-sm"
                placeholder="Filtrar por mesa (ej. JRV-001)"
                value={selectedMesa}
                onChange={(e) => setSelectedMesa(e.target.value)}
              />
              <button
                onClick={loadEvidence}
                className="text-sm px-3 py-1 bg-primary-600 text-white rounded"
              >
                Ver evidencia
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
            
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center">
                  <MapPin className="h-5 w-5 text-gray-400 mr-2" />
                  <span className="text-sm text-gray-700">Escuela Central</span>
                </div>
                <span className="text-sm font-medium text-green-600">Completada</span>
              </div>
              
              <div className="flex items-center justify-between">
                <div className="flex items-center">
                  <MapPin className="h-5 w-5 text-gray-400 mr-2" />
                  <span className="text-sm text-gray-700">Colegio San José</span>
                </div>
                <span className="text-sm font-medium text-green-600">Completada</span>
              </div>
              
              <div className="flex items-center justify-between">
                <div className="flex items-center">
                  <MapPin className="h-5 w-5 text-gray-400 mr-2" />
                  <span className="text-sm text-gray-700">Centro Comunal</span>
                </div>
                <span className="text-sm font-medium text-gray-500">Pendiente</span>
              </div>
              
              <div className="flex items-center justify-between">
                <div className="flex items-center">
                  <MapPin className="h-5 w-5 text-gray-400 mr-2" />
                  <span className="text-sm text-gray-700">Universidad Local</span>
                </div>
                <span className="text-sm font-medium text-gray-500">Pendiente</span>
              </div>
              
              <div className="flex items-center justify-between">
                <div className="flex items-center">
                  <MapPin className="h-5 w-5 text-gray-400 mr-2" />
                  <span className="text-sm text-gray-700">Club Deportivo</span>
                </div>
                <span className="text-sm font-medium text-gray-500">Pendiente</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
} 