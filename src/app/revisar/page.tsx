'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../components/AuthProvider';
import axios from 'axios';
import { 
  ArrowLeft, 
  Calendar, 
  Clock,
  CheckCircle,
  Eye,
  ChevronDown,
  ChevronRight,
  User,
  MapPin,
  BarChart3
} from 'lucide-react';
import Button from '../../components/ui/Button';
import BackButton from '../../components/ui/BackButton';

interface Escrutinio {
  id: string;
  mesaNumber: string;
  mesaName: string;
  department: string;
  electionLevel: string;
  completedAt: string;
  user: {
    id: string;
    name: string;
    email: string;
  };
}

interface Session {
  id: string;
  name: string;
  description?: string;
  isActive: boolean;
  isClosed: boolean;
  startedAt: string;
  closedAt: string | null;
  escrutinios: Escrutinio[];
  stats: {
    total: number;
    completed: number;
  };
}

export default function RevisarPage() {
  const { user, isLoading } = useAuth();
  const router = useRouter();
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedSessions, setExpandedSessions] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!isLoading && !user) {
      router.push('/');
    }
  }, [user, isLoading, router]);

  useEffect(() => {
    if (user) {
      loadSessions();
    }
  }, [user]);

  const loadSessions = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const token = localStorage.getItem('auth-token');
      const response = await axios.get('/api/revisar/sessions', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      if (response.data.success) {
        console.log('📊 Sessions loaded:', response.data.data.sessions);
        setSessions(response.data.data.sessions);
        
        // Auto-expand the first session (most recent)
        if (response.data.data.sessions.length > 0) {
          setExpandedSessions(new Set([response.data.data.sessions[0].id]));
        }
      } else {
        throw new Error(response.data.error || 'Error al cargar las sesiones');
      }
    } catch (err) {
      console.error('Error loading sessions:', err);
      setError(err instanceof Error ? err.message : 'Error desconocido');
    } finally {
      setLoading(false);
    }
  };

  const toggleSession = (sessionId: string) => {
    setExpandedSessions(prev => {
      const newSet = new Set(prev);
      if (newSet.has(sessionId)) {
        newSet.delete(sessionId);
      } else {
        newSet.add(sessionId);
      }
      return newSet;
    });
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('es-ES', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getSessionStatusBadge = (session: Session) => {
    if (session.isActive) {
      return (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
          <div className="w-1.5 h-1.5 bg-green-400 rounded-full mr-1.5"></div>
          Activa
        </span>
      );
    } else if (session.isClosed) {
      return (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
          <CheckCircle className="w-3 h-3 mr-1" />
          Cerrada
        </span>
      );
    }
    return null;
  };

  const getElectionLevelBadge = (level: string) => {
    const colors = {
      'PRESIDENTIAL': 'bg-blue-100 text-blue-800',
      'LEGISLATIVE': 'bg-purple-100 text-purple-800',
      'MUNICIPAL': 'bg-orange-100 text-orange-800'
    };
    
    const labels = {
      'PRESIDENTIAL': 'Presidencial',
      'LEGISLATIVE': 'Legislativo',
      'MUNICIPAL': 'Municipal'
    };

    return (
      <span className={`inline-flex items-center px-2 py-1 rounded text-xs font-medium ${colors[level as keyof typeof colors] || 'bg-gray-100 text-gray-800'}`}>
        {labels[level as keyof typeof labels] || level}
      </span>
    );
  };

  if (isLoading || loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600 mx-auto"></div>
          <p className="text-sm text-gray-600 mt-2">Cargando historial...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="text-red-500 mb-4">
            <Calendar className="h-12 w-12 mx-auto" />
          </div>
          <h2 className="text-lg font-semibold text-gray-900 mb-2">Error al cargar el historial</h2>
          <p className="text-gray-600 mb-4">{error}</p>
          <Button onClick={loadSessions}>
            Reintentar
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <BackButton onClick={() => router.push('/dashboard')} />
          <div className="mt-4">
            <h1 className="text-3xl font-bold text-gray-900">Historial de Escrutinios</h1>
            <p className="text-gray-600 mt-2">Revisa todos los escrutinios organizados por sesión</p>
          </div>
        </div>

        {/* Sessions List */}
        {sessions.length === 0 ? (
          <div className="text-center py-12">
            <Calendar className="h-12 w-12 text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No hay sesiones disponibles</h3>
            <p className="text-gray-600">No se han encontrado sesiones de escrutinio.</p>
          </div>
        ) : (
          <div className="space-y-6">
            {sessions.map((session) => (
              <div key={session.id} className="bg-white rounded-lg shadow-sm border border-gray-200">
                {/* Session Header */}
                <div 
                  className="p-6 cursor-pointer hover:bg-gray-50 transition-colors"
                  onClick={() => toggleSession(session.id)}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-4">
                      {expandedSessions.has(session.id) ? (
                        <ChevronDown className="h-5 w-5 text-gray-400" />
                      ) : (
                        <ChevronRight className="h-5 w-5 text-gray-400" />
                      )}
                      <div>
                        <h3 className="text-lg font-semibold text-gray-900">{session.name}</h3>
                        {session.description && (
                          <p className="text-sm text-gray-600 mt-1">{session.description}</p>
                        )}
                        <div className="flex items-center space-x-4 mt-2">
                          <div className="flex items-center text-sm text-gray-500">
                            <Clock className="h-4 w-4 mr-1" />
                            Iniciada: {formatDate(session.startedAt)}
                          </div>
                          {session.closedAt && (
                            <div className="flex items-center text-sm text-gray-500">
                              <CheckCircle className="h-4 w-4 mr-1" />
                              Cerrada: {formatDate(session.closedAt)}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center space-x-3">
                      {getSessionStatusBadge(session)}
                      <div className="text-right">
                        <div className="text-sm font-medium text-gray-900">
                          {session.stats.completed} escrutinios
                        </div>
                        <div className="text-xs text-gray-500">completados</div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Session Content */}
                {expandedSessions.has(session.id) && (
                  <div className="border-t border-gray-200">
                    {session.escrutinios.length === 0 ? (
                      <div className="p-6 text-center text-gray-500">
                        <BarChart3 className="h-8 w-8 mx-auto mb-2 text-gray-300" />
                        <p>No hay escrutinios completados en esta sesión</p>
                      </div>
                    ) : (
                      <div className="p-6">
                        <div className="space-y-3">
                          {session.escrutinios.map((escrutinio) => (
                            <div key={escrutinio.id} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                              <div className="flex items-center space-x-4">
                                <div className="flex-shrink-0">
                                  <div className="w-10 h-10 bg-primary-100 rounded-lg flex items-center justify-center">
                                    <BarChart3 className="h-5 w-5 text-primary-600" />
                                  </div>
                                </div>
                                <div>
                                  <div className="flex items-center space-x-2">
                                    <p className="text-sm font-medium text-gray-900">
                                      JRV {escrutinio.mesaNumber}
                                    </p>
                                    {getElectionLevelBadge(escrutinio.electionLevel)}
                                  </div>
                                  <p className="text-sm text-gray-600">{escrutinio.mesaName}</p>
                                  <div className="flex items-center space-x-4 mt-1">
                                    <div className="flex items-center text-xs text-gray-500">
                                      <MapPin className="h-3 w-3 mr-1" />
                                      {escrutinio.department}
                                    </div>
                                    <div className="flex items-center text-xs text-gray-500">
                                      <User className="h-3 w-3 mr-1" />
                                      {escrutinio.user.name}
                                    </div>
                                    <div className="flex items-center text-xs text-gray-500">
                                      <Clock className="h-3 w-3 mr-1" />
                                      {formatDate(escrutinio.completedAt)}
                                    </div>
                                  </div>
                                </div>
                              </div>
                              <Button
                                variant="secondary"
                                size="sm"
                                onClick={() => router.push(`/revisar/${escrutinio.id}`)}
                              >
                                <Eye className="h-4 w-4 mr-1" />
                                Ver Detalles
                              </Button>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
