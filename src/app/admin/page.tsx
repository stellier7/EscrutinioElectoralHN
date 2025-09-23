'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/components/AuthProvider';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Select from '@/components/ui/Select';
import { ArrowLeft } from 'lucide-react';
// import Toast from '@/components/ui/Toast';
import type { UserListResponse, UserListFilters, UserApprovalRequest, ApiResponse } from '@/types';

interface User {
  id: string;
  email: string;
  name: string;
  role: 'OBSERVER' | 'VOLUNTEER' | 'ORGANIZATION_MEMBER' | 'ADMIN';
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'SUSPENDED';
  phone?: string;
  organization?: string;
  notes?: string;
  approvedAt?: string;
  approvedByName?: string;
  rejectedAt?: string;
  rejectedByName?: string;
  rejectionReason?: string;
  createdAt: string;
  updatedAt: string;
  _count: {
    escrutinios: number;
  };
}

interface UserStats {
  usersByStatus: Record<string, number>;
  usersByRole: Record<string, number>;
  recentUsers: number;
  oldestPendingUsers: User[];
  mostActiveUsers: User[];
  totals: {
    total: number;
    pending: number;
    approved: number;
    rejected: number;
    suspended: number;
  };
}

const ROLE_LABELS = {
  OBSERVER: 'Observador',
  VOLUNTEER: 'Voluntario',
  ORGANIZATION_MEMBER: 'Miembro de Organización',
  ADMIN: 'Administrador',
};

const STATUS_LABELS = {
  PENDING: 'Pendiente',
  APPROVED: 'Aprobado',
  REJECTED: 'Rechazado',
  SUSPENDED: 'Suspendido',
};

const STATUS_COLORS = {
  PENDING: 'bg-yellow-100 text-yellow-800',
  APPROVED: 'bg-green-100 text-green-800',
  REJECTED: 'bg-red-100 text-red-800',
  SUSPENDED: 'bg-gray-100 text-gray-800',
};

export default function AdminDashboard() {
  const { user, isLoading, token } = useAuth();
  const router = useRouter();
  const [users, setUsers] = useState<User[]>([]);
  const [stats, setStats] = useState<UserStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  
  // Filtros
  const [filters, setFilters] = useState<UserListFilters>({
    status: 'PENDING',
    role: undefined,
    search: '',
    page: 1,
    limit: 20,
  });
  
  const [pagination, setPagination] = useState({
    total: 0,
    page: 1,
    limit: 20,
    totalPages: 0,
  });

  // Verificar permisos de admin
  useEffect(() => {
    if (!isLoading && (!user || user.role !== 'ADMIN' || user.status !== 'APPROVED')) {
      window.location.href = '/';
    }
  }, [user, isLoading]);

  // Cargar datos
  useEffect(() => {
    if (user?.role === 'ADMIN' && token) {
      fetchUsers();
      fetchStats();
    }
  }, [user, token, filters]);

  const fetchUsers = async () => {
    if (!token) {
      console.error('No token available for fetchUsers');
      return;
    }
    
    try {
      setLoading(true);
      const params = new URLSearchParams();
      
      if (filters.status) params.append('status', filters.status);
      if (filters.role) params.append('role', filters.role);
      if (filters.search) params.append('search', filters.search);
      params.append('page', (filters.page || 1).toString());
      params.append('limit', (filters.limit || 20).toString());

      const response = await fetch(`/api/admin/users?${params}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });
      const result: ApiResponse<UserListResponse> = await response.json();

      if (result.success && result.data) {
        setUsers(result.data.users);
        setPagination({
          total: result.data.total,
          page: result.data.page,
          limit: result.data.limit,
          totalPages: result.data.totalPages,
        });
      } else {
        setToast({ message: result.error || 'Error al cargar usuarios', type: 'error' });
      }
    } catch (error) {
      console.error('Error fetching users:', error);
      setToast({ message: 'Error de conexión', type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const fetchStats = async () => {
    if (!token) {
      console.error('No token available for fetchStats');
      return;
    }
    
    try {
      const response = await fetch('/api/admin/stats', {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });
      const result: ApiResponse<UserStats> = await response.json();

      if (result.success && result.data) {
        setStats(result.data);
      }
    } catch (error) {
      console.error('Error fetching stats:', error);
    }
  };

  const handleUserAction = async (userId: string, action: 'APPROVE' | 'REJECT' | 'SUSPEND', rejectionReason?: string) => {
    if (!token) {
      console.error('No token available for handleUserAction');
      setToast({ message: 'Error de autenticación', type: 'error' });
      return;
    }
    
    try {
      setActionLoading(userId);
      
      const requestData: UserApprovalRequest = {
        userId,
        action,
        rejectionReason,
      };

      const response = await fetch('/api/admin/users', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify(requestData),
      });

      const result: ApiResponse = await response.json();

      if (result.success) {
        setToast({ 
          message: `Usuario ${action.toLowerCase()}do exitosamente`, 
          type: 'success' 
        });
        fetchUsers(); // Recargar lista
        fetchStats(); // Recargar estadísticas
      } else {
        setToast({ 
          message: result.error || 'Error al procesar solicitud', 
          type: 'error' 
        });
      }
    } catch (error) {
      console.error('Error updating user:', error);
      setToast({ message: 'Error de conexión', type: 'error' });
    } finally {
      setActionLoading(null);
    }
  };

  const handleFilterChange = (key: keyof UserListFilters, value: any) => {
    setFilters(prev => ({
      ...prev,
      [key]: value,
      page: 1, // Reset to first page when filters change
    }));
  };

  const handlePageChange = (newPage: number) => {
    setFilters(prev => ({
      ...prev,
      page: newPage,
    }));
  };

  if (isLoading || loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Cargando dashboard...</p>
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
                  onClick={() => router.push('/dashboard')}
                  className="flex items-center gap-2 lg:hidden"
                >
                  <ArrowLeft className="h-4 w-4" />
                  <span className="hidden sm:inline">Regresar</span>
                </Button>
                <div>
                  <h1 className="text-3xl font-bold text-gray-900">Dashboard de Administración</h1>
                  <p className="mt-2 text-gray-600">Gestiona usuarios y monitorea el sistema</p>
                </div>
              </div>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => router.push('/dashboard')}
                className="hidden lg:flex items-center gap-2"
              >
                <ArrowLeft className="h-4 w-4" />
                Regresar al Dashboard
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Estadísticas */}
      {stats && (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            <div className="bg-white rounded-lg shadow p-6">
              <div className="flex items-center">
                <div className="p-2 bg-blue-100 rounded-lg">
                  <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z" />
                  </svg>
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-500">Total Usuarios</p>
                  <p className="text-2xl font-semibold text-gray-900">{stats.totals.total}</p>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-lg shadow p-6">
              <div className="flex items-center">
                <div className="p-2 bg-yellow-100 rounded-lg">
                  <svg className="w-6 h-6 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-500">Pendientes</p>
                  <p className="text-2xl font-semibold text-gray-900">{stats.totals.pending}</p>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-lg shadow p-6">
              <div className="flex items-center">
                <div className="p-2 bg-green-100 rounded-lg">
                  <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-500">Aprobados</p>
                  <p className="text-2xl font-semibold text-gray-900">{stats.totals.approved}</p>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-lg shadow p-6">
              <div className="flex items-center">
                <div className="p-2 bg-purple-100 rounded-lg">
                  <svg className="w-6 h-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-500">Nuevos (7 días)</p>
                  <p className="text-2xl font-semibold text-gray-900">{stats.recentUsers}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Filtros */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-6">
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Filtros</h2>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Select
              label="Estado"
              name="status"
              value={filters.status || ''}
              onChange={(e) => handleFilterChange('status', e.target.value || undefined)}
              options={[
                { value: '', label: 'Todos los estados' },
                { value: 'PENDING', label: 'Pendiente' },
                { value: 'APPROVED', label: 'Aprobado' },
                { value: 'REJECTED', label: 'Rechazado' },
                { value: 'SUSPENDED', label: 'Suspendido' },
              ]}
            />
            
            <Select
              label="Rol"
              name="role"
              value={filters.role || ''}
              onChange={(e) => handleFilterChange('role', e.target.value || undefined)}
              options={[
                { value: '', label: 'Todos los roles' },
                { value: 'OBSERVER', label: 'Observador' },
                { value: 'VOLUNTEER', label: 'Voluntario' },
                { value: 'ORGANIZATION_MEMBER', label: 'Miembro de Organización' },
                { value: 'ADMIN', label: 'Administrador' },
              ]}
            />
            
            <Input
              label="Buscar"
              name="search"
              placeholder="Nombre, email o organización..."
              value={filters.search || ''}
              onChange={(e) => handleFilterChange('search', e.target.value)}
            />
            
            <div className="flex items-end">
              <Button
                onClick={fetchUsers}
                className="w-full"
              >
                Buscar
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Lista de usuarios */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-8">
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900">
              Usuarios ({pagination.total})
            </h2>
          </div>
          
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Usuario
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Rol
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Estado
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Escrutinios
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
                {users.map((user) => (
                  <tr key={user.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div>
                        <div className="text-sm font-medium text-gray-900">{user.name}</div>
                        <div className="text-sm text-gray-500">{user.email}</div>
                        {user.organization && (
                          <div className="text-xs text-gray-400">{user.organization}</div>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="text-sm text-gray-900">
                        {ROLE_LABELS[user.role]}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${STATUS_COLORS[user.status]}`}>
                        {STATUS_LABELS[user.status]}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {user._count.escrutinios}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {new Date(user.createdAt).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      {user.status === 'PENDING' && (
                        <div className="flex space-x-2">
                          <Button
                            size="sm"
                            variant="success"
                            onClick={() => handleUserAction(user.id, 'APPROVE')}
                            disabled={actionLoading === user.id}
                          >
                            {actionLoading === user.id ? '...' : 'Aprobar'}
                          </Button>
                          <Button
                            size="sm"
                            variant="danger"
                            onClick={() => {
                              const reason = prompt('Razón del rechazo:');
                              if (reason) {
                                handleUserAction(user.id, 'REJECT', reason);
                              }
                            }}
                            disabled={actionLoading === user.id}
                          >
                            Rechazar
                          </Button>
                        </div>
                      )}
                      
                      {user.status === 'APPROVED' && (
                        <Button
                          size="sm"
                          variant="danger"
                          onClick={() => {
                            const reason = prompt('Razón de la suspensión:');
                            if (reason) {
                              handleUserAction(user.id, 'SUSPEND', reason);
                            }
                          }}
                          disabled={actionLoading === user.id}
                        >
                          Suspender
                        </Button>
                      )}
                      
                      {user.status === 'SUSPENDED' && (
                        <Button
                          size="sm"
                          variant="success"
                          onClick={() => handleUserAction(user.id, 'APPROVE')}
                          disabled={actionLoading === user.id}
                        >
                          Reaprobar
                        </Button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          
          {/* Paginación */}
          {pagination.totalPages > 1 && (
            <div className="px-6 py-4 border-t border-gray-200">
              <div className="flex items-center justify-between">
                <div className="text-sm text-gray-700">
                  Mostrando {((pagination.page - 1) * pagination.limit) + 1} a{' '}
                  {Math.min(pagination.page * pagination.limit, pagination.total)} de{' '}
                  {pagination.total} resultados
                </div>
                <div className="flex space-x-2">
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => handlePageChange(pagination.page - 1)}
                    disabled={pagination.page === 1}
                  >
                    Anterior
                  </Button>
                  <span className="px-3 py-1 text-sm text-gray-700">
                    Página {pagination.page} de {pagination.totalPages}
                  </span>
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => handlePageChange(pagination.page + 1)}
                    disabled={pagination.page === pagination.totalPages}
                  >
                    Siguiente
                  </Button>
                </div>
              </div>
            </div>
          )}
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
