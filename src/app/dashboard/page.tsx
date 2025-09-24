'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../components/AuthProvider';
import Button from '../../components/ui/Button';
import { 
  Vote, 
  Shield, 
  MapPin, 
  Camera, 
  BarChart3, 
  Settings, 
  LogOut,
  User,
  Calendar,
  CheckCircle,
  AlertCircle,
  Menu,
  X,
  Crown,
  Clock
} from 'lucide-react';

interface DashboardStats {
  totalMesas: number;
  completedEscrutinios: number;
  pendingEscrutinios: number;
  recentActivity: Array<{
    id: string;
    mesaNumber: string;
    mesaName: string;
    department: string;
    electionLevel: string;
    completedAt: string;
  }>;
  statsByLevel: Array<{
    level: string;
    completed: number;
    pending: number;
    total: number;
  }>;
}

export default function DashboardPage() {
  const { user, logout, isLoading } = useAuth();
  const router = useRouter();
  const [activeTab, setActiveTab] = useState('overview');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [statsLoading, setStatsLoading] = useState(true);

  useEffect(() => {
    if (!isLoading && !user) {
      router.push('/');
    }
  }, [user, isLoading, router]);

  // Cargar estadísticas del dashboard
  useEffect(() => {
    const loadStats = async () => {
      try {
        setStatsLoading(true);
        const resp = await fetch('/api/dashboard/stats', { cache: 'no-store' });
        const json = await resp.json();
        if (json?.success) {
          setStats(json.data);
        }
      } catch (e) {
        console.error('Error loading dashboard stats:', e);
      } finally {
        setStatsLoading(false);
      }
    };
    loadStats();
  }, []);

  const handleLogout = async () => {
    await logout();
    router.push('/');
  };

  // Función para obtener el color del estado
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'APPROVED': return 'text-green-600 bg-green-50 border-green-200';
      case 'PENDING': return 'text-yellow-600 bg-yellow-50 border-yellow-200';
      case 'REJECTED': return 'text-red-600 bg-red-50 border-red-200';
      case 'SUSPENDED': return 'text-gray-600 bg-gray-50 border-gray-200';
      default: return 'text-gray-600 bg-gray-50 border-gray-200';
    }
  };

  // Función para obtener el icono del estado
  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'APPROVED': return <CheckCircle className="h-4 w-4" />;
      case 'PENDING': return <Clock className="h-4 w-4" />;
      case 'REJECTED': return <AlertCircle className="h-4 w-4" />;
      case 'SUSPENDED': return <AlertCircle className="h-4 w-4" />;
      default: return <Clock className="h-4 w-4" />;
    }
  };

  // Función para obtener el texto del estado
  const getStatusText = (status: string) => {
    switch (status) {
      case 'APPROVED': return 'Aprobado';
      case 'PENDING': return 'Pendiente';
      case 'REJECTED': return 'Rechazado';
      case 'SUSPENDED': return 'Suspendido';
      default: return 'Desconocido';
    }
  };

  // Función para obtener el color del rol
  const getRoleColor = (role: string) => {
    switch (role) {
      case 'OBSERVER': return 'text-blue-600 bg-blue-50 border-blue-200';
      case 'VOLUNTEER': return 'text-purple-600 bg-purple-50 border-purple-200';
      case 'ADMIN': return 'text-red-600 bg-red-50 border-red-200';
      default: return 'text-gray-600 bg-gray-50 border-gray-200';
    }
  };

  // Función para obtener el icono del rol
  const getRoleIcon = (role: string) => {
    switch (role) {
      case 'OBSERVER': return <User className="h-4 w-4" />;
      case 'VOLUNTEER': return <User className="h-4 w-4" />;
      case 'ADMIN': return <Crown className="h-4 w-4" />;
      default: return <User className="h-4 w-4" />;
    }
  };

  // Función para obtener el texto del rol
  const getRoleText = (role: string) => {
    switch (role) {
      case 'OBSERVER': return 'Observador';
      case 'VOLUNTEER': return 'Voluntario';
      case 'ADMIN': return 'Administrador';
      default: return 'Usuario';
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Cargando...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  // Opciones del menú basadas en el rol del usuario
  const menuItems = [
    { id: 'overview', label: 'Resumen', icon: BarChart3 },
    { id: 'escrutinio', label: 'Nuevo Escrutinio', icon: Vote },
    { id: 'review', label: 'Revisar Escrutinios', icon: CheckCircle },
    // Solo admins pueden ver estas secciones
    ...(user?.role === 'ADMIN' ? [
      { id: 'results', label: 'Resultados', icon: CheckCircle },
      { id: 'evidence', label: 'Evidencia', icon: Camera },
      { id: 'audit', label: 'Auditoría', icon: Shield },
    ] : []),
    { id: 'profile', label: 'Perfil', icon: User },
  ];

  const renderOverview = () => (
    <div className="space-y-4">
      {/* iPhone-sized cards */}
      <div className="grid grid-cols-1 gap-4">
        <div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-200">
          <div className="flex items-center">
            <div className="p-2 bg-green-100 rounded-lg">
              <CheckCircle className="h-5 w-5 text-green-600" />
            </div>
            <div className="ml-3">
              <p className="text-sm font-medium text-gray-600">Escrutinios Completados</p>
              <p className="text-xl font-bold text-gray-900">
                {statsLoading ? '...' : stats?.completedEscrutinios || 0}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-200">
          <div className="flex items-center">
            <div className="p-2 bg-blue-100 rounded-lg">
              <AlertCircle className="h-5 w-5 text-blue-600" />
            </div>
            <div className="ml-3">
              <p className="text-sm font-medium text-gray-600">Pendientes</p>
              <p className="text-xl font-bold text-gray-900">
                {statsLoading ? '...' : stats?.pendingEscrutinios || 0}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-200">
          <div className="flex items-center">
            <div className="p-2 bg-purple-100 rounded-lg">
              <MapPin className="h-5 w-5 text-purple-600" />
            </div>
            <div className="ml-3">
              <p className="text-sm font-medium text-gray-600">Total de Mesas</p>
              <p className="text-xl font-bold text-gray-900">
                {statsLoading ? '...' : stats?.totalMesas || 0}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Botones de Acción Rápida */}
      <div className="grid grid-cols-2 gap-3">
        <Button 
          variant="primary" 
          size="lg"
          onClick={() => router.push('/escrutinio')}
          className="w-full"
        >
          <Vote className="h-4 w-4 mr-2" />
          Nuevo Escrutinio
        </Button>
        <Button 
          variant="secondary" 
          size="lg"
          onClick={() => setActiveTab('review')}
          className="w-full"
        >
          <CheckCircle className="h-4 w-4 mr-2" />
          Revisar Escrutinios
        </Button>
      </div>

      {/* Mostrar escrutinios completados recientes (para todos los usuarios) */}
      {stats?.recentActivity && stats.recentActivity.length > 0 && (
        <div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-200">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-lg font-semibold text-gray-900">Mis Escrutinios Recientes</h3>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setActiveTab('review')}
              className="text-xs text-blue-600 hover:text-blue-700"
            >
              Ver todos
            </Button>
          </div>
          <div className="space-y-2">
            {stats.recentActivity.slice(0, 3).map((activity) => (
              <div key={activity.id} className="flex items-center justify-between p-2 bg-gray-50 rounded-lg">
                <div className="flex items-center gap-2">
                  <CheckCircle className="h-3 w-3 text-green-600" />
                  <div>
                    <p className="text-xs font-medium text-gray-900">{activity.mesaNumber}</p>
                    <p className="text-xs text-gray-500">{activity.electionLevel}</p>
                  </div>
                </div>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => router.push(`/revisar/${activity.id}`)}
                  className="text-xs text-blue-600 hover:text-blue-700"
                >
                  Ver
                </Button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Solo admins pueden ver la actividad reciente */}
      {user.role === 'ADMIN' && (
        <div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900 mb-3">Actividad Reciente</h3>
        {statsLoading ? (
          <div className="text-center py-6 text-gray-500">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600 mx-auto"></div>
            <p className="text-sm mt-2">Cargando actividad...</p>
          </div>
        ) : stats?.recentActivity && stats.recentActivity.length > 0 ? (
          <div className="space-y-3">
            {stats.recentActivity.map((activity) => (
              <div key={activity.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-green-100 rounded-lg">
                    <CheckCircle className="h-4 w-4 text-green-600" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-900">{activity.mesaNumber}</p>
                    <p className="text-xs text-gray-600">{activity.mesaName}</p>
                    <p className="text-xs text-gray-500">{activity.department}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="text-right">
                    <p className="text-xs text-gray-500">
                      {new Date(activity.completedAt).toLocaleDateString()}
                    </p>
                    <p className="text-xs text-green-600 font-medium">{activity.electionLevel}</p>
                  </div>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => router.push(`/revisar/${activity.id}`)}
                    className="text-xs"
                  >
                    Revisar
                  </Button>
                </div>
              </div>
            ))}
            <div className="pt-3 border-t">
              <Button 
                variant="primary" 
                size="lg"
                onClick={() => router.push('/escrutinio')}
                className="w-full"
              >
                <Vote className="h-4 w-4 mr-2" />
                Nuevo Escrutinio
              </Button>
            </div>
          </div>
        ) : (
          <div className="text-center py-6 text-gray-500">
            <Vote className="h-10 w-10 mx-auto mb-3 text-gray-300" />
            <p className="text-sm">No has completado ningún escrutinio aún</p>
            <p className="text-xs text-gray-400 mb-4">Comienza un nuevo escrutinio para ver tu actividad aquí</p>
            <Button 
              variant="primary" 
              size="lg"
              onClick={() => router.push('/escrutinio')}
            >
              <Vote className="h-4 w-4 mr-2" />
              Nuevo Escrutinio
            </Button>
          </div>
        )}
        </div>
      )}

      {/* Sección para Admins - Ver Todos los Escrutinios */}
      {user.role === 'ADMIN' && (
        <div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900 mb-3 flex items-center gap-2">
            <Crown className="h-5 w-5 text-purple-600" />
            Todos los Escrutinios (Admin)
          </h3>
          <p className="text-sm text-gray-600 mb-4">
            Como administrador, puedes revisar todos los escrutinios completados por todos los usuarios.
          </p>
          <Button 
            variant="secondary" 
            size="lg"
            onClick={() => router.push('/admin')}
            className="w-full"
          >
            <BarChart3 className="h-4 w-4 mr-2" />
            Ver Panel de Administración
          </Button>
        </div>
      )}
    </div>
  );

  const renderNewEscrutinio = () => (
    <div className="space-y-4">
      <div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-200">
        <h3 className="text-lg font-semibold text-gray-900 mb-3">Iniciar Nuevo Escrutinio</h3>
        <p className="text-gray-600 mb-4 text-sm">
          Accede al sistema de escrutinio electoral con búsqueda inteligente de JRVs y vista dinámica de diputados.
        </p>
        
        <div className="space-y-4">
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="flex items-center mb-2">
              <Vote className="h-5 w-5 text-blue-600 mr-2" />
              <h4 className="font-medium text-blue-900">Funcionalidades Disponibles</h4>
            </div>
            <ul className="text-sm text-blue-800 space-y-1">
              <li>• Búsqueda inteligente de JRVs (18,298 disponibles)</li>
              <li>• Escrutinio presidencial y legislativo</li>
              <li>• Vista dinámica de diputados por departamento</li>
              <li>• Animaciones y feedback visual</li>
            </ul>
          </div>

          <Button 
            variant="primary" 
            size="lg"
            onClick={() => router.push('/escrutinio')}
            className="w-full"
          >
            <Vote className="h-4 w-4 mr-2" />
            Ir a Escrutinio
          </Button>
        </div>
      </div>
    </div>
  );

  const renderReview = () => (
    <div className="space-y-4">
      <div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-200">
        <h3 className="text-lg font-semibold text-gray-900 mb-3">Mis Escrutinios Completados</h3>
        {statsLoading ? (
          <div className="text-center py-6 text-gray-500">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600 mx-auto"></div>
            <p className="text-sm mt-2">Cargando escrutinios...</p>
          </div>
        ) : stats?.recentActivity && stats.recentActivity.length > 0 ? (
          <div className="space-y-3">
            {stats.recentActivity.map((activity) => (
              <div key={activity.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-green-100 rounded-lg">
                    <CheckCircle className="h-4 w-4 text-green-600" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-900">{activity.mesaNumber}</p>
                    <p className="text-xs text-gray-600">{activity.mesaName}</p>
                    <p className="text-xs text-gray-500">{activity.department}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="text-right">
                    <p className="text-xs text-gray-500">
                      {new Date(activity.completedAt).toLocaleDateString()}
                    </p>
                    <p className="text-xs text-green-600 font-medium">{activity.electionLevel}</p>
                  </div>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => router.push(`/revisar/${activity.id}`)}
                    className="text-xs"
                  >
                    Revisar
                  </Button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-6 text-gray-500">
            <Vote className="h-10 w-10 mx-auto mb-3 text-gray-300" />
            <p className="text-sm">No has completado ningún escrutinio aún</p>
            <p className="text-xs text-gray-400 mb-4">Comienza un nuevo escrutinio para ver tu actividad aquí</p>
            <Button 
              variant="primary" 
              size="lg"
              onClick={() => router.push('/escrutinio')}
            >
              <Vote className="h-4 w-4 mr-2" />
              Nuevo Escrutinio
            </Button>
          </div>
        )}
      </div>
    </div>
  );

  const renderContent = () => {
    switch (activeTab) {
      case 'overview':
        return renderOverview();
      case 'escrutinio':
        return renderNewEscrutinio();
      case 'review':
        return renderReview();
      case 'results':
        return (
          <div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-200">
            <h3 className="text-lg font-semibold text-gray-900 mb-3">Resultados Electorales</h3>
            <p className="text-gray-600 mb-4 text-sm">
              Visualiza los resultados en tiempo real de todas las mesas electorales.
            </p>
            <Button 
              variant="primary" 
              size="lg"
              onClick={() => router.push('/resultados')}
            >
              Ver Resultados Públicos
            </Button>
          </div>
        );
      case 'audit':
        return (
          <div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-200">
            <h3 className="text-lg font-semibold text-gray-900 mb-3">Auditoría del Sistema</h3>
            <p className="text-gray-600 mb-4 text-sm">
              Revisa todos los logs de actividad y auditoría del sistema electoral.
            </p>
            <Button 
              variant="primary" 
              size="lg"
              onClick={() => router.push('/auditoria')}
            >
              Ver Auditoría Completa
            </Button>
          </div>
        );
      default:
        return (
          <div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-200">
            <h3 className="text-lg font-semibold text-gray-900 mb-3">
              {menuItems.find(item => item.id === activeTab)?.label}
            </h3>
            <p className="text-gray-600 text-sm">Esta funcionalidad estará disponible próximamente.</p>
          </div>
        );
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Mobile Header */}
      <header className="bg-white shadow-sm border-b lg:hidden">
        <div className="px-4 py-3">
          <div className="flex justify-between items-center">
            <div className="flex items-center">
              <Vote className="h-6 w-6 text-primary-600" />
              <h1 className="ml-2 text-lg font-semibold text-gray-900">
                Escrutinio
              </h1>
            </div>
            
            <div className="flex items-center space-x-3">
              {/* Status Indicator */}
              <div className={`flex items-center gap-2 px-3 py-1 rounded-full border text-sm font-medium ${getStatusColor(user.status)}`}>
                {getStatusIcon(user.status)}
                {getStatusText(user.status)}
              </div>
              {user.role === 'ADMIN' && (
                <Button
                  variant="primary"
                  size="sm"
                  onClick={() => router.push('/admin')}
                  className="hidden sm:flex"
                >
                  <Crown className="h-4 w-4 mr-1" />
                  Admin
                </Button>
              )}
              <button
                onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                className="p-2 rounded-lg hover:bg-gray-100 touch-target"
              >
                {isMobileMenuOpen ? (
                  <X className="h-5 w-5 text-gray-600" />
                ) : (
                  <Menu className="h-5 w-5 text-gray-600" />
                )}
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Desktop Header */}
      <header className="bg-white shadow-sm border-b hidden lg:block">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center">
              <Vote className="h-8 w-8 text-primary-600" />
              <h1 className="ml-3 text-xl font-semibold text-gray-900">
                Escrutinio Transparente
              </h1>
            </div>
            
            <div className="flex items-center space-x-4">
              {/* Status Indicator */}
              <div className={`flex items-center gap-2 px-3 py-1 rounded-full border text-sm font-medium ${getStatusColor(user.status)}`}>
                {getStatusIcon(user.status)}
                {getStatusText(user.status)}
              </div>
              {/* Role Indicator */}
              <div className={`flex items-center gap-2 px-3 py-1 rounded-full border text-sm font-medium ${getRoleColor(user.role)}`}>
                {getRoleIcon(user.role)}
                {getRoleText(user.role)}
              </div>
              {user.role === 'ADMIN' && (
                <Button
                  variant="primary"
                  size="sm"
                  onClick={() => router.push('/admin')}
                >
                  <Crown className="h-4 w-4 mr-2" />
                  Admin
                </Button>
              )}
              <Button
                variant="secondary"
                size="sm"
                onClick={handleLogout}
              >
                <LogOut className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      </header>

      <div className="flex">
        {/* Mobile Menu Overlay */}
        {isMobileMenuOpen && (
          <div className="fixed inset-0 z-40 lg:hidden">
            <div className="fixed inset-0 bg-gray-600 bg-opacity-75" onClick={() => setIsMobileMenuOpen(false)}></div>
            <div className="fixed inset-y-0 left-0 w-64 bg-white shadow-lg">
              <div className="flex items-center justify-between p-4 border-b">
                <h2 className="text-lg font-semibold text-gray-900">Menú</h2>
                <button
                  onClick={() => setIsMobileMenuOpen(false)}
                  className="p-2 rounded-lg hover:bg-gray-100 touch-target"
                >
                  <X className="h-5 w-5 text-gray-600" />
                </button>
              </div>
              <nav className="p-4 space-y-2">
                {menuItems.map((item) => {
                  const Icon = item.icon;
                  return (
                    <button
                      key={item.id}
                      onClick={() => {
                        setActiveTab(item.id);
                        setIsMobileMenuOpen(false);
                      }}
                      className={`w-full flex items-center px-4 py-3 text-sm font-medium rounded-lg transition-colors touch-target ${
                        activeTab === item.id
                          ? 'bg-primary-50 text-primary-700 border border-primary-200'
                          : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                      }`}
                    >
                      <Icon className="h-5 w-5 mr-3" />
                      {item.label}
                    </button>
                  );
                })}
                {user.role === 'ADMIN' && (
                  <button
                    onClick={() => {
                      router.push('/admin');
                      setIsMobileMenuOpen(false);
                    }}
                    className="w-full flex items-center px-4 py-3 text-sm font-medium rounded-lg transition-colors text-purple-600 hover:text-purple-700 hover:bg-purple-50 touch-target"
                  >
                    <Crown className="h-5 w-5 mr-3" />
                    Panel de Administración
                  </button>
                )}
                <div className="pt-4 border-t">
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={handleLogout}
                  >
                    <LogOut className="h-4 w-4 mr-2" />
                    Cerrar Sesión
                  </Button>
                </div>
              </nav>
            </div>
          </div>
        )}

        {/* Desktop Sidebar */}
        <div className="hidden lg:block w-64 flex-shrink-0">
          <div className="p-6">
            <nav className="space-y-2">
              {menuItems.map((item) => {
                const Icon = item.icon;
                return (
                  <button
                    key={item.id}
                    onClick={() => setActiveTab(item.id)}
                    className={`w-full flex items-center px-4 py-3 text-sm font-medium rounded-lg transition-colors ${
                      activeTab === item.id
                        ? 'bg-primary-50 text-primary-700 border border-primary-200'
                        : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                    }`}
                  >
                    <Icon className="h-5 w-5 mr-3" />
                    {item.label}
                  </button>
                );
              })}
              {user.role === 'ADMIN' && (
                <button
                  onClick={() => router.push('/admin')}
                  className="w-full flex items-center px-4 py-3 text-sm font-medium rounded-lg transition-colors text-purple-600 hover:text-purple-700 hover:bg-purple-50 border border-purple-200"
                >
                  <Crown className="h-5 w-5 mr-3" />
                  Panel de Administración
                </button>
              )}
            </nav>
          </div>
        </div>

        {/* Main Content */}
        <div className="flex-1 p-4 lg:p-8">
          <div className="max-w-2xl mx-auto">
            {/* Status Card */}
            <div className="bg-white overflow-hidden shadow rounded-lg mb-6">
              <div className="px-4 py-5 sm:p-6">
                <div className="flex items-center">
                  <div className="flex-shrink-0">
                    <div className={`p-3 rounded-full ${getStatusColor(user.status)}`}>
                      {getStatusIcon(user.status)}
                    </div>
                  </div>
                  <div className="ml-5 w-0 flex-1">
                    <dl>
                      <dt className="text-sm font-medium text-gray-500 truncate">
                        Estado de tu cuenta
                      </dt>
                      <dd className="text-lg font-medium text-gray-900">
                        {getStatusText(user.status)}
                      </dd>
                    </dl>
                  </div>
                </div>
                {user.status === 'PENDING' && (
                  <div className="mt-4 p-4 bg-yellow-50 border border-yellow-200 rounded-md">
                    <div className="flex">
                      <div className="flex-shrink-0">
                        <Clock className="h-5 w-5 text-yellow-400" />
                      </div>
                      <div className="ml-3">
                        <h3 className="text-sm font-medium text-yellow-800">
                          Cuenta pendiente de aprobación
                        </h3>
                        <div className="mt-2 text-sm text-yellow-700">
                          <p>Tu cuenta está siendo revisada por un administrador. Recibirás una notificación cuando sea aprobada.</p>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
                {user.status === 'APPROVED' && (
                  <div className="mt-4 p-4 bg-green-50 border border-green-200 rounded-md">
                    <div className="flex">
                      <div className="flex-shrink-0">
                        <CheckCircle className="h-5 w-5 text-green-400" />
                      </div>
                      <div className="ml-3">
                        <h3 className="text-sm font-medium text-green-800">
                          Cuenta aprobada
                        </h3>
                        <div className="mt-2 text-sm text-green-700">
                          <p>Tu cuenta ha sido aprobada. Puedes acceder a todas las funcionalidades del sistema.</p>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
            {renderContent()}
          </div>
        </div>
      </div>
    </div>
  );
} 