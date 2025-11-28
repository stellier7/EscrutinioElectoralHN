'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/components/AuthProvider';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Select from '@/components/ui/Select';
import { ArrowLeft, Download, Users } from 'lucide-react';
import type { ApiResponse, PaginatedResponse } from '@/types';

interface Volunteer {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  organization: string | null; // JRV está almacenado aquí
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'SUSPENDED';
  createdAt: string;
}

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

export default function AdminVolunteersPage() {
  const { user, isLoading, token } = useAuth();
  const router = useRouter();
  const [volunteers, setVolunteers] = useState<Volunteer[]>([]);
  const [loading, setLoading] = useState(true);
  const [pagination, setPagination] = useState({
    total: 0,
    page: 1,
    limit: 20,
    totalPages: 0,
  });
  
  const [filters, setFilters] = useState({
    status: '',
    search: '',
    jrvNumber: '',
    page: 1,
    limit: 20,
  });

  const [exportType, setExportType] = useState<'full' | 'emails' | 'phones'>('full');

  useEffect(() => {
    if (!isLoading && (!user || user.role !== 'ADMIN' || user.status !== 'APPROVED')) {
      window.location.href = '/';
    }
  }, [user, isLoading]);

  useEffect(() => {
    if (user?.role === 'ADMIN' && token) {
      fetchVolunteers();
    }
  }, [user, token, filters]);

  const fetchVolunteers = async () => {
    if (!token) return;
    
    try {
      setLoading(true);
      const params = new URLSearchParams();
      
      if (filters.status) params.append('status', filters.status);
      if (filters.search) params.append('search', filters.search);
      if (filters.jrvNumber) params.append('jrvNumber', filters.jrvNumber);
      params.append('page', filters.page.toString());
      params.append('limit', filters.limit.toString());

      const response = await fetch(`/api/admin/volunteers?${params}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });
      const result: ApiResponse<PaginatedResponse<Volunteer>> = await response.json();

      if (result.success && result.data) {
        setVolunteers(result.data.data);
        setPagination({
          total: result.data.total,
          page: result.data.page,
          limit: result.data.limit,
          totalPages: result.data.totalPages,
        });
      }
    } catch (error) {
      console.error('Error fetching volunteers:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleExport = async (type: 'full' | 'emails' | 'phones' = exportType) => {
    if (!token) return;
    
    try {
      const response = await fetch(`/api/admin/volunteers/export?type=${type}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        
        const typeNames = {
          full: 'complete',
          emails: 'emails',
          phones: 'phones',
        };
        a.download = `volunteers-${typeNames[type]}-${new Date().toISOString().split('T')[0]}.csv`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
      }
    } catch (error) {
      console.error('Error exporting:', error);
      alert('Error al exportar los voluntarios');
    }
  };

  const handleFilterChange = (key: string, value: any) => {
    setFilters(prev => ({
      ...prev,
      [key]: value,
      page: 1,
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
          <p className="mt-4 text-gray-600">Cargando...</p>
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
                  <h1 className="text-3xl font-bold text-gray-900">Gestión de Voluntarios</h1>
                  <p className="mt-2 text-gray-600">Gestiona todos los voluntarios registrados</p>
                </div>
              </div>
              <div className="flex gap-2">
                <div className="flex items-center gap-2">
                  <div className="w-40">
                    <Select
                      name="exportType"
                      value={exportType}
                      onChange={(e) => setExportType(e.target.value as 'full' | 'emails' | 'phones')}
                      options={[
                        { value: 'full', label: 'Completo' },
                        { value: 'emails', label: 'Solo Emails' },
                        { value: 'phones', label: 'Solo Teléfonos' },
                      ]}
                    />
                  </div>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => handleExport()}
                    className="flex items-center gap-2"
                  >
                    <Download className="h-4 w-4" />
                    Exportar CSV
                  </Button>
                </div>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => router.push('/admin')}
                  className="hidden lg:flex items-center gap-2"
                >
                  <ArrowLeft className="h-4 w-4" />
                  Regresar
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Estadísticas */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <div className="flex items-center mb-4">
            <Users className="h-6 w-6 text-blue-600 mr-2" />
            <h2 className="text-lg font-semibold text-gray-900">
              Total de Voluntarios: {pagination.total}
            </h2>
          </div>
        </div>

        {/* Filtros */}
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Filtros</h2>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Select
              label="Status"
              name="status"
              value={filters.status}
              onChange={(e) => handleFilterChange('status', e.target.value || '')}
              options={[
                { value: '', label: 'Todos los status' },
                { value: 'APPROVED', label: 'Aprobado' },
                { value: 'PENDING', label: 'Pendiente' },
                { value: 'REJECTED', label: 'Rechazado' },
                { value: 'SUSPENDED', label: 'Suspendido' },
              ]}
            />
            
            <Input
              label="Buscar"
              name="search"
              placeholder="Nombre, email o teléfono..."
              value={filters.search}
              onChange={(e) => handleFilterChange('search', e.target.value)}
            />
            
            <Input
              label="JRV"
              name="jrvNumber"
              placeholder="Número de JRV..."
              value={filters.jrvNumber}
              onChange={(e) => handleFilterChange('jrvNumber', e.target.value)}
            />
            
            <div className="flex items-end">
              <Button
                onClick={fetchVolunteers}
                className="w-full"
              >
                Buscar
              </Button>
            </div>
          </div>
        </div>

        {/* Lista de voluntarios */}
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900">
              Voluntarios ({pagination.total})
            </h2>
          </div>
          
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Nombre
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Contacto
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    JRV
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Fecha de Registro
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {volunteers.map((volunteer) => (
                  <tr key={volunteer.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">
                        {volunteer.name}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">{volunteer.email}</div>
                      {volunteer.phone && (
                        <div className="text-sm text-gray-500">{volunteer.phone}</div>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${STATUS_COLORS[volunteer.status]}`}>
                        {STATUS_LABELS[volunteer.status]}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {volunteer.organization || '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {new Date(volunteer.createdAt).toLocaleDateString('es-HN', {
                        year: 'numeric',
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
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
    </div>
  );
}

