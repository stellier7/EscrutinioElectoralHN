'use client';

import React, { useState, useEffect } from 'react';
import { useAuth } from '../../components/AuthProvider';
import { 
  Shield, 
  User, 
  Calendar,
  Search,
  Filter,
  Download,
  Eye,
  Clock
} from 'lucide-react';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import BackButton from '../../components/ui/BackButton';

interface AuditLog {
  id: string;
  userId?: string;
  userName?: string;
  action: string;
  description: string;
  timestamp: string;
  ipAddress?: string;
  userAgent?: string;
}

export default function AuditoriaPage() {
  const { user } = useAuth();
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedAction, setSelectedAction] = useState('all');

  // Mock audit logs
  const mockLogs: AuditLog[] = [
    {
      id: '1',
      userId: 'user-1',
      userName: 'admin@escrutinio.com',
      action: 'LOGIN',
      description: 'Inicio de sesión exitoso',
      timestamp: '2024-01-15T10:30:00Z',
      ipAddress: '192.168.1.100',
      userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)'
    },
    {
      id: '2',
      userId: 'user-1',
      userName: 'admin@escrutinio.com',
      action: 'START_ESCRUTINIO',
      description: 'Inició escrutinio en JRV-001 - Presidencial',
      timestamp: '2024-01-15T10:35:00Z',
      ipAddress: '192.168.1.100',
      userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)'
    },
    {
      id: '3',
      userId: 'user-1',
      userName: 'admin@escrutinio.com',
      action: 'SUBMIT_RESULTS',
      description: 'Envió resultados para JRV-001 - Presidencial',
      timestamp: '2024-01-15T10:45:00Z',
      ipAddress: '192.168.1.100',
      userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)'
    },
    {
      id: '4',
      userId: 'user-2',
      userName: 'voluntario@escrutinio.com',
      action: 'LOGIN',
      description: 'Inicio de sesión exitoso',
      timestamp: '2024-01-15T11:00:00Z',
      ipAddress: '192.168.1.101',
      userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 15_0)'
    },
    {
      id: '5',
      userId: 'user-2',
      userName: 'voluntario@escrutinio.com',
      action: 'START_ESCRUTINIO',
      description: 'Inició escrutinio en JRV-002 - Legislativo',
      timestamp: '2024-01-15T11:05:00Z',
      ipAddress: '192.168.1.101',
      userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 15_0)'
    },
    {
      id: '6',
      userId: 'user-2',
      userName: 'voluntario@escrutinio.com',
      action: 'UPLOAD_EVIDENCE',
      description: 'Subió evidencia para JRV-002 - Legislativo',
      timestamp: '2024-01-15T11:15:00Z',
      ipAddress: '192.168.1.101',
      userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 15_0)'
    },
    {
      id: '7',
      userId: 'user-2',
      userName: 'voluntario@escrutinio.com',
      action: 'SUBMIT_RESULTS',
      description: 'Envió resultados para JRV-002 - Legislativo',
      timestamp: '2024-01-15T11:20:00Z',
      ipAddress: '192.168.1.101',
      userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 15_0)'
    },
    {
      id: '8',
      userId: 'user-1',
      userName: 'admin@escrutinio.com',
      action: 'VIEW_RESULTS',
      description: 'Consultó resultados electorales',
      timestamp: '2024-01-15T12:00:00Z',
      ipAddress: '192.168.1.100',
      userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)'
    },
  ];

  useEffect(() => {
    // Simulate API call
    setTimeout(() => {
      setLogs(mockLogs);
      setIsLoading(false);
    }, 1000);
  }, []);

  const actionOptions = [
    { value: 'all', label: 'Todas las acciones' },
    { value: 'LOGIN', label: 'Inicio de sesión' },
    { value: 'LOGOUT', label: 'Cierre de sesión' },
    { value: 'START_ESCRUTINIO', label: 'Inicio de escrutinio' },
    { value: 'SUBMIT_RESULTS', label: 'Envío de resultados' },
    { value: 'UPLOAD_EVIDENCE', label: 'Carga de evidencia' },
    { value: 'VIEW_RESULTS', label: 'Consulta de resultados' },
    { value: 'CORRECTION', label: 'Corrección de datos' },
  ];

  const filteredLogs = logs.filter(log => {
    const matchesSearch = log.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         log.userName?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesAction = selectedAction === 'all' || log.action === selectedAction;
    return matchesSearch && matchesAction;
  });

  const getActionColor = (action: string) => {
    switch (action) {
      case 'LOGIN':
        return 'bg-green-100 text-green-800';
      case 'LOGOUT':
        return 'bg-gray-100 text-gray-800';
      case 'START_ESCRUTINIO':
        return 'bg-blue-100 text-blue-800';
      case 'SUBMIT_RESULTS':
        return 'bg-purple-100 text-purple-800';
      case 'UPLOAD_EVIDENCE':
        return 'bg-orange-100 text-orange-800';
      case 'VIEW_RESULTS':
        return 'bg-indigo-100 text-indigo-800';
      case 'CORRECTION':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getActionLabel = (action: string) => {
    switch (action) {
      case 'LOGIN':
        return 'Inicio de sesión';
      case 'LOGOUT':
        return 'Cierre de sesión';
      case 'START_ESCRUTINIO':
        return 'Inicio de escrutinio';
      case 'SUBMIT_RESULTS':
        return 'Envío de resultados';
      case 'UPLOAD_EVIDENCE':
        return 'Carga de evidencia';
      case 'VIEW_RESULTS':
        return 'Consulta de resultados';
      case 'CORRECTION':
        return 'Corrección de datos';
      default:
        return action;
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString('es-ES', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Cargando auditoría...</p>
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
              <Shield className="h-8 w-8 text-primary-600" />
              <h1 className="ml-3 text-xl font-semibold text-gray-900">
                Auditoría del Sistema
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
        {/* Filters */}
        <div className="bg-white p-6 rounded-lg shadow-sm border mb-8">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Filtros</h2>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Buscar
              </label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  name="search"
                  type="text"
                  placeholder="Buscar por descripción o usuario..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Acción
              </label>
              <select
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                value={selectedAction}
                onChange={(e) => setSelectedAction(e.target.value)}
              >
                {actionOptions.map(option => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-end">
              <Button
                variant="secondary"
                size="md"
                onClick={() => {
                  setSearchTerm('');
                  setSelectedAction('all');
                }}
              >
                Limpiar Filtros
              </Button>
            </div>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <div className="bg-white p-6 rounded-lg shadow-sm border">
            <div className="flex items-center">
              <div className="p-2 bg-green-100 rounded-lg">
                <User className="h-6 w-6 text-green-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Total de Acciones</p>
                <p className="text-2xl font-bold text-gray-900">{logs.length}</p>
              </div>
            </div>
          </div>

          <div className="bg-white p-6 rounded-lg shadow-sm border">
            <div className="flex items-center">
              <div className="p-2 bg-blue-100 rounded-lg">
                <Shield className="h-6 w-6 text-blue-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Usuarios Activos</p>
                <p className="text-2xl font-bold text-gray-900">
                  {new Set(logs.map(log => log.userId)).size}
                </p>
              </div>
            </div>
          </div>

          <div className="bg-white p-6 rounded-sm border">
            <div className="flex items-center">
              <div className="p-2 bg-purple-100 rounded-lg">
                <Calendar className="h-6 w-6 text-purple-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Hoy</p>
                <p className="text-2xl font-bold text-gray-900">
                  {logs.filter(log => {
                    const today = new Date().toDateString();
                    return new Date(log.timestamp).toDateString() === today;
                  }).length}
                </p>
              </div>
            </div>
          </div>

          <div className="bg-white p-6 rounded-lg shadow-sm border">
            <div className="flex items-center">
              <div className="p-2 bg-orange-100 rounded-lg">
                <Eye className="h-6 w-6 text-orange-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Resultados Filtrados</p>
                <p className="text-2xl font-bold text-gray-900">{filteredLogs.length}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Audit Logs Table */}
        <div className="bg-white rounded-lg shadow-sm border overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center">
            <h3 className="text-lg font-semibold text-gray-900">
              Registro de Auditoría
            </h3>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => {
                // Export functionality would go here
                alert('Función de exportación próximamente');
              }}
            >
              <Download className="h-4 w-4 mr-2" />
              Exportar
            </Button>
          </div>
          
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Usuario
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Acción
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Descripción
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Fecha/Hora
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    IP
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredLogs.map((log) => (
                  <tr key={log.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">
                        {log.userName}
                      </div>
                      <div className="text-sm text-gray-500">
                        {log.userId}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getActionColor(log.action)}`}>
                        {getActionLabel(log.action)}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm text-gray-900">
                        {log.description}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">
                        {formatDate(log.timestamp)}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-500">
                        {log.ipAddress}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {filteredLogs.length === 0 && (
            <div className="text-center py-12">
              <Shield className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-500">No se encontraron registros con los filtros aplicados</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
} 