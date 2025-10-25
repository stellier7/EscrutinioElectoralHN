'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/components/AuthProvider';
import Button from '@/components/ui/Button';
import { ArrowLeft, Users, Vote, CheckCircle, Clock, MapPin, Calendar, Eye, Download } from 'lucide-react';
import type { SessionDetailsResponse, ApiResponse } from '@/types';

interface SessionDetailsPageProps {
  params: {
    id: string;
  };
}

export default function SessionDetailsPage({ params }: SessionDetailsPageProps) {
  const { user, isLoading, token } = useAuth();
  const router = useRouter();
  const [session, setSession] = useState<SessionDetailsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  // Verificar permisos de admin
  useEffect(() => {
    if (!isLoading && (!user || user.role !== 'ADMIN' || user.status !== 'APPROVED')) {
      window.location.href = '/';
    }
  }, [user, isLoading]);

  // Cargar detalles de la sesión
  useEffect(() => {
    if (user?.role === 'ADMIN' && token && params.id) {
      fetchSessionDetails();
    }
  }, [user, token, params.id]);

  const fetchSessionDetails = async () => {
    if (!token) return;
    
    try {
      setLoading(true);
      const response = await fetch(`/api/admin/sessions/${params.id}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });
      const result: ApiResponse<SessionDetailsResponse> = await response.json();

      if (result.success && result.data) {
        setSession(result.data);
      } else {
        setToast({ message: result.error || 'Error al cargar detalles de la sesión', type: 'error' });
        router.push('/admin/sessions');
      }
    } catch (error) {
      console.error('Error fetching session details:', error);
      setToast({ message: 'Error de conexión', type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('es-ES', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'COMPLETED': return 'bg-green-100 text-green-800';
      case 'IN_PROGRESS': return 'bg-blue-100 text-blue-800';
      case 'PENDING': return 'bg-yellow-100 text-yellow-800';
      case 'FAILED': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'COMPLETED': return 'Completado';
      case 'IN_PROGRESS': return 'En Progreso';
      case 'PENDING': return 'Pendiente';
      case 'FAILED': return 'Fallido';
      default: return status;
    }
  };

  const getElectionLevelText = (level: string) => {
    switch (level) {
      case 'PRESIDENTIAL': return 'Presidencial';
      case 'LEGISLATIVE': return 'Legislativo';
      case 'MUNICIPAL': return 'Municipal';
      default: return level;
    }
  };

  if (isLoading || loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Cargando detalles de la sesión...</p>
        </div>
      </div>
    );
  }

  if (!user || user.role !== 'ADMIN') {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-4">Acceso Denegado</h1>
          <p className="text-gray-600">No tienes permisos para acceder a esta página.</p>
        </div>
      </div>
    );
  }

  if (!session) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-4">Sesión no encontrada</h1>
          <p className="text-gray-600">La sesión solicitada no existe.</p>
          <Button onClick={() => router.push('/admin/sessions')} className="mt-4">
            Volver a Sesiones
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="py-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => router.push('/admin/sessions')}
                  className="flex items-center gap-2"
                >
                  <ArrowLeft className="h-4 w-4" />
                  <span className="hidden sm:inline">Regresar</span>
                </Button>
                <div>
                  <h1 className="text-3xl font-bold text-gray-900">{session.name}</h1>
                  <p className="mt-2 text-gray-600">
                    {session.description || 'Sin descripción'}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-4">
                <span className={`inline-flex px-3 py-1 text-sm font-semibold rounded-full ${
                  session.isActive ? 'bg-green-100 text-green-800' : 
                  session.isClosed ? 'bg-gray-100 text-gray-800' : 
                  'bg-yellow-100 text-yellow-800'
                }`}>
                  {session.isActive ? 'Activa' : session.isClosed ? 'Cerrada' : 'Inactiva'}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Estadísticas */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center">
              <div className="p-2 bg-blue-100 rounded-lg">
                <Vote className="w-6 h-6 text-blue-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-500">Total Escrutinios</p>
                <p className="text-2xl font-semibold text-gray-900">{session.stats?.totalEscrutinios || 0}</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center">
              <div className="p-2 bg-green-100 rounded-lg">
                <CheckCircle className="w-6 h-6 text-green-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-500">Completados</p>
                <p className="text-2xl font-semibold text-gray-900">{session.stats?.completedEscrutinios || 0}</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center">
              <div className="p-2 bg-purple-100 rounded-lg">
                <Users className="w-6 h-6 text-purple-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-500">Usuarios Únicos</p>
                <p className="text-2xl font-semibold text-gray-900">{session.stats?.uniqueUsers || 0}</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center">
              <div className="p-2 bg-orange-100 rounded-lg">
                <Vote className="w-6 h-6 text-orange-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-500">Total Votos</p>
                <p className="text-2xl font-semibold text-gray-900">{session.stats?.totalVotes || 0}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Información de la sesión */}
        <div className="bg-white rounded-lg shadow mb-8">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900">Información de la Sesión</h2>
          </div>
          <div className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <h3 className="text-sm font-medium text-gray-500 mb-2">Fechas</h3>
                <div className="space-y-1">
                  <p className="text-sm text-gray-900">
                    <Calendar className="inline w-4 h-4 mr-2" />
                    Creada: {formatDate(session.createdAt)}
                  </p>
                  {session.closedAt && (
                    <p className="text-sm text-gray-900">
                      <Calendar className="inline w-4 h-4 mr-2" />
                      Cerrada: {formatDate(session.closedAt)}
                    </p>
                  )}
                </div>
              </div>
              <div>
                <h3 className="text-sm font-medium text-gray-500 mb-2">Estado</h3>
                <div className="space-y-1">
                  <p className="text-sm text-gray-900">
                    Estado: {session.isActive ? 'Activa' : session.isClosed ? 'Cerrada' : 'Inactiva'}
                  </p>
                  {session.closedBy && (
                    <p className="text-sm text-gray-900">
                      Cerrada por: {session.closedBy}
                    </p>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Resultados */}
        {session.results && session.results.length > 0 && (
          <div className="bg-white rounded-lg shadow mb-8">
            <div className="px-6 py-4 border-b border-gray-200">
              <h2 className="text-lg font-semibold text-gray-900">Resultados</h2>
            </div>
            <div className="p-6">
              <div className="space-y-4">
                {session.results.map((result, index) => (
                  <div key={index} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                    <div className="flex items-center">
                      <span className="text-lg font-bold text-gray-900 mr-4">#{index + 1}</span>
                      <div>
                        <p className="font-medium text-gray-900">{result.candidate.name}</p>
                        <p className="text-sm text-gray-600">{result.candidate.party}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-2xl font-bold text-gray-900">{result.totalVotes}</p>
                      <p className="text-sm text-gray-500">votos</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Lista de Escrutinios */}
        <div className="bg-white rounded-lg shadow">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900">Escrutinios ({session.escrutinios.length})</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Usuario
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    JRV
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Nivel
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Estado
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Fecha
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Acciones
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {session.escrutinios.map((escrutinio) => (
                  <tr key={escrutinio.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div>
                        <div className="text-sm font-medium text-gray-900">{escrutinio.user.name}</div>
                        <div className="text-sm text-gray-500">{escrutinio.user.email}</div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div>
                        <div className="text-sm font-medium text-gray-900">JRV {escrutinio.mesa.number}</div>
                        <div className="text-sm text-gray-500">{escrutinio.mesa.location}</div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {getElectionLevelText(escrutinio.electionLevel)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(escrutinio.status)}`}>
                        {getStatusText(escrutinio.status)}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {formatDate(escrutinio.createdAt)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => router.push(`/revisar/${escrutinio.id}`)}
                      >
                        <Eye className="h-4 w-4 mr-1" />
                        Ver
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Toast */}
      {toast && (
        <div className={`fixed bottom-4 right-4 p-4 rounded-lg shadow-lg z-50 ${
          toast.type === 'success' ? 'bg-green-500 text-white' : 'bg-red-500 text-white'
        }`}>
          <div className="flex items-center justify-between">
            <span>{toast.message}</span>
            <button
              onClick={() => setToast(null)}
              className="ml-4 text-white hover:text-gray-200"
            >
              ×
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
