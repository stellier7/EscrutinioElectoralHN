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
  X
} from 'lucide-react';

export default function DashboardPage() {
  const { user, logout, isLoading } = useAuth();
  const router = useRouter();
  const [activeTab, setActiveTab] = useState('overview');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  useEffect(() => {
    if (!isLoading && !user) {
      router.push('/');
    }
  }, [user, isLoading, router]);

  const handleLogout = async () => {
    await logout();
    router.push('/');
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

  const menuItems = [
    { id: 'overview', label: 'Resumen', icon: BarChart3 },
    { id: 'escrutinio', label: 'Nuevo Escrutinio', icon: Vote },
    { id: 'results', label: 'Resultados', icon: CheckCircle },
    { id: 'evidence', label: 'Evidencia', icon: Camera },
    { id: 'audit', label: 'Auditoría', icon: Shield },
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
              <p className="text-xl font-bold text-gray-900">0</p>
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
              <p className="text-xl font-bold text-gray-900">0</p>
            </div>
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-200">
          <div className="flex items-center">
            <div className="p-2 bg-purple-100 rounded-lg">
              <MapPin className="h-5 w-5 text-purple-600" />
            </div>
            <div className="ml-3">
              <p className="text-sm font-medium text-gray-600">Mesas Asignadas</p>
              <p className="text-xl font-bold text-gray-900">0</p>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-200">
        <h3 className="text-lg font-semibold text-gray-900 mb-3">Actividad Reciente</h3>
        <div className="text-center py-6 text-gray-500">
          <Vote className="h-10 w-10 mx-auto mb-3 text-gray-300" />
          <p className="text-sm">No hay actividad reciente</p>
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
      </div>
    </div>
  );

  const renderNewEscrutinio = () => (
    <div className="space-y-4">
      <div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-200">
        <h3 className="text-lg font-semibold text-gray-900 mb-3">Iniciar Nuevo Escrutinio</h3>
        <p className="text-gray-600 mb-4 text-sm">
          Selecciona una mesa y nivel electoral para comenzar el proceso de escrutinio.
        </p>
        
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Mesa Electoral (JRV)
            </label>
            <select className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm">
              <option value="">Seleccionar mesa...</option>
              <option value="JRV-001">JRV-001 - Escuela Central</option>
              <option value="JRV-002">JRV-002 - Colegio San José</option>
              <option value="JRV-003">JRV-003 - Centro Comunal</option>
              <option value="JRV-004">JRV-004 - Universidad Local</option>
              <option value="JRV-005">JRV-005 - Club Deportivo</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Nivel Electoral
            </label>
            <select className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm">
              <option value="">Seleccionar nivel...</option>
              <option value="PRESIDENTIAL">Presidencial</option>
              <option value="LEGISLATIVE">Legislativo</option>
              <option value="MUNICIPAL">Municipal</option>
            </select>
          </div>

          <Button 
            variant="primary" 
            size="lg"
            onClick={() => router.push('/escrutinio')}
          >
            Iniciar Escrutinio
          </Button>
        </div>
      </div>
    </div>
  );

  const renderContent = () => {
    switch (activeTab) {
      case 'overview':
        return renderOverview();
      case 'escrutinio':
        return renderNewEscrutinio();
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
              <div className="flex items-center space-x-2">
                <User className="h-4 w-4 text-gray-400" />
                <span className="text-sm text-gray-700">{user.name}</span>
              </div>
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
              <div className="flex items-center space-x-2">
                <User className="h-5 w-5 text-gray-400" />
                <span className="text-sm text-gray-700">{user.name}</span>
              </div>
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
            </nav>
          </div>
        </div>

        {/* Main Content */}
        <div className="flex-1 p-4 lg:p-8">
          <div className="max-w-2xl mx-auto">
            {renderContent()}
          </div>
        </div>
      </div>
    </div>
  );
} 