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

export default function ResultadosPage() {
  const [activeLevel, setActiveLevel] = useState('PRESIDENTIAL');
  const [isLoading, setIsLoading] = useState(true);

  // Mock data - in real app this would come from API
  const mockResults: Record<string, ResultSummary> = {
    PRESIDENTIAL: {
      level: 'Presidencial',
      totalMesas: 5,
      completedMesas: 2,
      totalVotes: 1250,
      candidates: [
        { name: 'Juan Pérez', party: 'Partido A', votes: 450, percentage: 36 },
        { name: 'María García', party: 'Partido B', votes: 380, percentage: 30.4 },
        { name: 'Carlos López', party: 'Partido C', votes: 420, percentage: 33.6 },
      ]
    },
    LEGISLATIVE: {
      level: 'Legislativo',
      totalMesas: 5,
      completedMesas: 1,
      totalVotes: 800,
      candidates: [
        { name: 'Ana Rodríguez', party: 'Partido A', votes: 280, percentage: 35 },
        { name: 'Pedro Martínez', party: 'Partido B', votes: 320, percentage: 40 },
        { name: 'Laura González', party: 'Partido C', votes: 200, percentage: 25 },
      ]
    },
    MUNICIPAL: {
      level: 'Municipal',
      totalMesas: 5,
      completedMesas: 0,
      totalVotes: 0,
      candidates: [
        { name: 'Roberto Silva', party: 'Partido A', votes: 0, percentage: 0 },
        { name: 'Carmen Díaz', party: 'Partido B', votes: 0, percentage: 0 },
        { name: 'Miguel Torres', party: 'Partido C', votes: 0, percentage: 0 },
      ]
    }
  };

  useEffect(() => {
    // Simulate loading
    setTimeout(() => setIsLoading(false), 1000);
  }, []);

  const currentResults = mockResults[activeLevel];
  const completionPercentage = (currentResults.completedMesas / currentResults.totalMesas) * 100;

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
              {Object.keys(mockResults).map((level) => (
                <button
                  key={level}
                  onClick={() => setActiveLevel(level)}
                  className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                    activeLevel === level
                      ? 'bg-primary-600 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  {mockResults[level].level}
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