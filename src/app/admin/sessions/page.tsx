'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/components/AuthProvider';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import { ArrowLeft, Plus, Play, Square, Eye, Calendar, Users, Vote, CheckCircle } from 'lucide-react';
import type { EscrutinioSessionResponse, EscrutinioSessionRequest, ApiResponse } from '@/types';

export default function SessionsPage() {
  const { user, isLoading, token } = useAuth();
  const router = useRouter();
  const [sessions, setSessions] = useState<EscrutinioSessionResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createForm, setCreateForm] = useState<EscrutinioSessionRequest>({
    name: '',
    description: '',
    activateImmediately: false
  });

  // Verificar permisos de admin
  useEffect(() => {
    if (!isLoading && (!user || user.role !== 'ADMIN' || user.status !== 'APPROVED')) {
      window.location.href = '/';
    }
  }, [user, isLoading]);

  // Cargar sesiones
  useEffect(() => {
    if (user?.role === 'ADMIN' && token) {
      fetchSessions();
    }
  }, [user, token]);

  const fetchSessions = async () => {
    if (!token) return;
    
    try {
      setLoading(true);
      const response = await fetch('/api/admin/sessions', {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });
      const result: ApiResponse<EscrutinioSessionResponse[]> = await response.json();

      if (result.success && result.data) {
        setSessions(result.data);
      } else {
        setToast({ message: result.error || 'Error al cargar sesiones', type: 'error' });
      }
    } catch (error) {
      console.error('Error fetching sessions:', error);
      setToast({ message: 'Error de conexión', type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const handleCreateSession = async () => {
    if (!token) return;
    
    if (!createForm.name.trim()) {
      setToast({ message: 'El nombre de la sesión es requerido', type: 'error' });
      return;
    }

    try {
      setActionLoading('create');
      
      const response = await fetch('/api/admin/sessions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify(createForm),
      });

      const result: ApiResponse<EscrutinioSessionResponse> = await response.json();

      if (result.success) {
        setToast({ 
          message: `Sesión "${result.data?.name}" creada exitosamente`, 
          type: 'success' 
        });
        setShowCreateModal(false);
        setCreateForm({ name: '', description: '', activateImmediately: false });
        fetchSessions();
      } else {
        setToast({ 
          message: result.error || 'Error al crear sesión', 
          type: 'error' 
        });
      }
    } catch (error) {
      console.error('Error creating session:', error);
      setToast({ message: 'Error de conexión', type: 'error' });
    } finally {
      setActionLoading(null);
    }
  };

  const handleActivateSession = async (sessionId: string) => {
    if (!token) return;
    
    try {
      setActionLoading(sessionId);
      
      const response = await fetch(`/api/admin/sessions/${sessionId}/activate`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      const result: ApiResponse = await response.json();

      if (result.success) {
        setToast({ 
          message: result.message || 'Sesión activada exitosamente', 
          type: 'success' 
        });
        fetchSessions();
      } else {
        setToast({ 
          message: result.error || 'Error al activar sesión', 
          type: 'error' 
        });
      }
    } catch (error) {
      console.error('Error activating session:', error);
      setToast({ message: 'Error de conexión', type: 'error' });
    } finally {
      setActionLoading(null);
    }
  };

  const handleCloseSession = async (sessionId: string) => {
    if (!token) return;
    
    if (!confirm('¿Está seguro de que desea cerrar esta sesión? Esta acción no se puede deshacer.')) {
      return;
    }
    
    try {
      setActionLoading(sessionId);
      
      const response = await fetch(`/api/admin/sessions/${sessionId}/close`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      const result: ApiResponse = await response.json();

      if (result.success) {
        setToast({ 
          message: result.message || 'Sesión cerrada exitosamente', 
          type: 'success' 
        });
        fetchSessions();
      } else {
        setToast({ 
          message: result.error || 'Error al cerrar sesión', 
          type: 'error' 
        });
      }
    } catch (error) {
      console.error('Error closing session:', error);
      setToast({ message: 'Error de conexión', type: 'error' });
    } finally {
      setActionLoading(null);
    }
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

  const getStatusColor = (session: EscrutinioSessionResponse) => {
    if (session.isActive) return 'bg-green-100 text-green-800 border-green-200';
    if (session.isClosed) return 'bg-gray-100 text-gray-800 border-gray-200';
    return 'bg-yellow-100 text-yellow-800 border-yellow-200';
  };

  const getStatusText = (session: EscrutinioSessionResponse) => {
    if (session.isActive) return 'Activa';
    if (session.isClosed) return 'Cerrada';
    return 'Inactiva';
  };

  if (isLoading || loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Cargando sesiones...</p>
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
                  onClick={() => router.push('/admin')}
                  className="flex items-center gap-2 lg:hidden"
                >
                  <ArrowLeft className="h-4 w-4" />
                  <span className="hidden sm:inline">Regresar</span>
                </Button>
                <div>
                  <h1 className="text-3xl font-bold text-gray-900">Gestión de Sesiones</h1>
                  <p className="mt-2 text-gray-600">Administra sesiones de escrutinio</p>
                </div>
              </div>
              <div className="flex items-center gap-4">
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => router.push('/admin')}
                  className="hidden lg:flex items-center gap-2"
                >
                  <ArrowLeft className="h-4 w-4" />
                  Regresar al Admin
                </Button>
                <Button
                  onClick={() => setShowCreateModal(true)}
                  className="flex items-center gap-2"
                >
                  <Plus className="h-4 w-4" />
                  Nueva Sesión
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Contenido */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {sessions.length === 0 ? (
          <div className="text-center py-12">
            <Calendar className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No hay sesiones</h3>
            <p className="text-gray-600 mb-6">Crea tu primera sesión de escrutinio</p>
            <Button onClick={() => setShowCreateModal(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Crear Primera Sesión
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {sessions.map((session) => (
              <div key={session.id} className="bg-white rounded-lg shadow border border-gray-200 overflow-hidden">
                <div className="p-6">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex-1">
                      <h3 className="text-lg font-semibold text-gray-900 mb-1">
                        {session.name}
                      </h3>
                      {session.description && (
                        <p className="text-sm text-gray-600 mb-2">{session.description}</p>
                      )}
                    </div>
                    <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full border ${getStatusColor(session)}`}>
                      {getStatusText(session)}
                    </span>
                  </div>

                  {/* Estadísticas */}
                  {session.stats && (
                    <div className="grid grid-cols-2 gap-4 mb-4">
                      <div className="text-center">
                        <div className="flex items-center justify-center mb-1">
                          <Vote className="h-4 w-4 text-blue-500 mr-1" />
                          <span className="text-2xl font-bold text-gray-900">{session.stats.totalEscrutinios}</span>
                        </div>
                        <p className="text-xs text-gray-500">Escrutinios</p>
                      </div>
                      <div className="text-center">
                        <div className="flex items-center justify-center mb-1">
                          <Users className="h-4 w-4 text-green-500 mr-1" />
                          <span className="text-2xl font-bold text-gray-900">{session.stats.uniqueUsers}</span>
                        </div>
                        <p className="text-xs text-gray-500">Usuarios</p>
                      </div>
                    </div>
                  )}

                  <div className="text-sm text-gray-500 mb-4">
                    <p>Creada: {formatDate(session.createdAt)}</p>
                    {session.closedAt && (
                      <p>Cerrada: {formatDate(session.closedAt)}</p>
                    )}
                  </div>

                  {/* Acciones */}
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => router.push(`/admin/sessions/${session.id}`)}
                      className="flex-1"
                    >
                      <Eye className="h-4 w-4 mr-1" />
                      Ver
                    </Button>
                    
                    {!session.isActive && !session.isClosed && (
                      <Button
                        size="sm"
                        variant="success"
                        onClick={() => handleActivateSession(session.id)}
                        disabled={actionLoading === session.id}
                        className="flex-1"
                      >
                        {actionLoading === session.id ? (
                          '...'
                        ) : (
                          <>
                            <Play className="h-4 w-4 mr-1" />
                            Activar
                          </>
                        )}
                      </Button>
                    )}
                    
                    {session.isActive && (
                      <Button
                        size="sm"
                        variant="danger"
                        onClick={() => handleCloseSession(session.id)}
                        disabled={actionLoading === session.id}
                        className="flex-1"
                      >
                        {actionLoading === session.id ? (
                          '...'
                        ) : (
                          <>
                            <Square className="h-4 w-4 mr-1" />
                            Cerrar
                          </>
                        )}
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Modal de Creación */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md mx-4">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Crear Nueva Sesión</h2>
            
            <div className="space-y-4">
              <Input
                label="Nombre de la sesión"
                name="name"
                placeholder="Ej: Test 01, Elecciones Nov 2025"
                value={createForm.name}
                onChange={(e) => setCreateForm(prev => ({ ...prev, name: e.target.value }))}
                required
              />
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Descripción (opcional)
                </label>
                <textarea
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  rows={3}
                  placeholder="Descripción de la sesión..."
                  value={createForm.description}
                  onChange={(e) => setCreateForm(prev => ({ ...prev, description: e.target.value }))}
                />
              </div>
              
              <div className="flex items-center">
                <input
                  type="checkbox"
                  id="activateImmediately"
                  checked={createForm.activateImmediately}
                  onChange={(e) => setCreateForm(prev => ({ ...prev, activateImmediately: e.target.checked }))}
                  className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                />
                <label htmlFor="activateImmediately" className="ml-2 text-sm text-gray-700">
                  Activar inmediatamente
                </label>
              </div>
            </div>
            
            <div className="flex gap-3 mt-6">
              <Button
                variant="secondary"
                onClick={() => setShowCreateModal(false)}
                className="flex-1"
              >
                Cancelar
              </Button>
              <Button
                onClick={handleCreateSession}
                disabled={actionLoading === 'create' || !createForm.name.trim()}
                className="flex-1"
              >
                {actionLoading === 'create' ? 'Creando...' : 'Crear Sesión'}
              </Button>
            </div>
          </div>
        </div>
      )}

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
