'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../components/AuthProvider';
import Button from '../components/ui/Button';
import Input from '../components/ui/Input';
import Select from '../components/ui/Select';
import { Eye, EyeOff, Vote, Shield, MapPin } from 'lucide-react';

export default function HomePage() {
  const [isLogin, setIsLogin] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    name: '',
    role: '',
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  
  const { login, register, isLoading } = useAuth();
  const router = useRouter();

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    // Clear error when user starts typing
    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: '' }));
    }
  };

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!formData.email) {
      newErrors.email = 'El email es requerido';
    } else if (!/\S+@\S+\.\S+/.test(formData.email)) {
      newErrors.email = 'El email no es válido';
    }

    if (!formData.password) {
      newErrors.password = 'La contraseña es requerida';
    } else if (formData.password.length < 6) {
      newErrors.password = 'La contraseña debe tener al menos 6 caracteres';
    }

    if (!isLogin) {
      if (!formData.name) {
        newErrors.name = 'El nombre es requerido';
      } else if (formData.name.length < 2) {
        newErrors.name = 'El nombre debe tener al menos 2 caracteres';
      }

      if (!formData.role) {
        newErrors.role = 'El rol es requerido';
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) return;

    try {
      if (isLogin) {
        const response = await login({
          email: formData.email,
          password: formData.password,
        });
        
        // Solo redirigir si el usuario está aprobado
        if (response.user.status === 'APPROVED') {
          router.push('/dashboard');
        } else {
          setErrors({ general: '✅ Inicio de sesión exitoso. Tu cuenta está pendiente de aprobación por un administrador. Recibirás una notificación cuando sea aprobada.' });
        }
      } else {
        const response = await register({
          email: formData.email,
          password: formData.password,
          name: formData.name,
          role: formData.role as any,
        });
        
        // Solo redirigir si el usuario está aprobado
        if (response.user.status === 'APPROVED') {
          router.push('/dashboard');
        } else {
          setErrors({ general: '🎉 ¡Registro exitoso! Te has registrado como ' + (formData.role === 'OBSERVER' ? 'Observador' : 'Voluntario') + '. Tu cuenta está pendiente de aprobación por un administrador.' });
        }
      }
    } catch (error: any) {
      setErrors({ general: error.message });
    }
  };

  const roleOptions = [
    { value: 'OBSERVER', label: 'Observador' },
    { value: 'VOLUNTEER', label: 'Voluntario' },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-50 to-primary-100 flex items-center justify-center p-4 safe-top safe-bottom">
      <div className="w-full max-w-sm mx-auto space-y-6">
        {/* Header */}
        <div className="text-center">
          <div className="mx-auto h-12 w-12 bg-primary-600 rounded-full flex items-center justify-center mb-3">
            <Vote className="h-6 w-6 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900">
            Escrutinio Transparente
          </h1>
          <p className="mt-1 text-sm text-gray-600">
            Sistema de registro y transmisión de resultados electorales
          </p>
        </div>

        {/* Features - Smaller and more compact */}
        <div className="grid grid-cols-3 gap-3 text-center">
          <div className="flex flex-col items-center space-y-1">
            <Shield className="h-5 w-5 text-primary-600" />
            <span className="text-xs text-gray-600">Seguro</span>
          </div>
          <div className="flex flex-col items-center space-y-1">
            <MapPin className="h-5 w-5 text-primary-600" />
            <span className="text-xs text-gray-600">Geolocalizado</span>
          </div>
          <div className="flex flex-col items-center space-y-1">
            <Vote className="h-5 w-5 text-primary-600" />
            <span className="text-xs text-gray-600">Auditable</span>
          </div>
        </div>

        {/* Form - iPhone-sized card */}
        <div className="bg-white rounded-2xl shadow-lg border border-gray-200 p-6 max-w-sm mx-auto">
          <div className="mb-4">
            <div className="flex rounded-lg bg-gray-100 p-1">
              <button
                type="button"
                className={`flex-1 py-2 px-3 rounded-md text-sm font-medium transition-colors touch-target ${
                  isLogin
                    ? 'bg-white text-gray-900 shadow-sm'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
                onClick={() => {
                  setIsLogin(true);
                  setErrors({});
                }}
              >
                Iniciar Sesión
              </button>
              <button
                type="button"
                className={`flex-1 py-2 px-3 rounded-md text-sm font-medium transition-colors touch-target ${
                  !isLogin
                    ? 'bg-white text-gray-900 shadow-sm'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
                onClick={() => {
                  setIsLogin(false);
                  setErrors({});
                }}
              >
                Registrarse
              </button>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {!isLogin && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-4">
                <div className="flex">
                  <div className="flex-shrink-0">
                    <Shield className="h-4 w-4 text-blue-400" />
                  </div>
                  <div className="ml-2">
                    <h3 className="text-xs font-medium text-blue-800">
                      Información Importante
                    </h3>
                    <div className="mt-1 text-xs text-blue-700">
                      <p>• <strong>Observador:</strong> Personal entrenado con prioridad alta</p>
                      <p>• <strong>Voluntario:</strong> Ciudadanos generales con prioridad baja</p>
                      <p>• Tu cuenta será revisada por un administrador antes de ser activada</p>
                    </div>
                  </div>
                </div>
              </div>
            )}
            
            {errors.general && (
              <div className="error-container">
                <p className="error-message text-sm">{errors.general}</p>
              </div>
            )}

            {!isLogin && (
              <Input
                label="Nombre completo"
                name="name"
                type="text"
                placeholder="Tu nombre completo"
                value={formData.name}
                onChange={handleInputChange}
                error={errors.name}
                required
              />
            )}

            <Input
              label="Email"
              name="email"
              type="email"
              placeholder="tu@email.com"
              value={formData.email}
              onChange={handleInputChange}
              error={errors.email}
              required
            />

            <div className="relative">
              <Input
                label="Contraseña"
                name="password"
                type={showPassword ? 'text' : 'password'}
                placeholder="Tu contraseña"
                value={formData.password}
                onChange={handleInputChange}
                error={errors.password}
                required
              />
              <button
                type="button"
                className="absolute right-3 top-9 text-gray-400 hover:text-gray-600 touch-target"
                onClick={() => setShowPassword(!showPassword)}
              >
                {showPassword ? (
                  <EyeOff className="h-4 w-4" />
                ) : (
                  <Eye className="h-4 w-4" />
                )}
              </button>
            </div>

            {!isLogin && (
              <Select
                label="Rol"
                name="role"
                options={roleOptions}
                value={formData.role}
                onChange={handleInputChange}
                error={errors.role}
                required
              />
            )}

            <Button
              type="submit"
              variant="primary"
              size="lg"
              loading={isLoading}
              disabled={isLoading}
            >
              {isLogin ? 'Iniciar Sesión' : 'Registrarse'}
            </Button>
          </form>

          <div className="mt-4 text-center">
            <p className="text-xs text-gray-600">
              Al usar este sistema, aceptas nuestros términos de uso y política de privacidad.
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="text-center">
          <p className="text-xs text-gray-500">
            © 2024 Escrutinio Transparente. Todos los derechos reservados.
          </p>
        </div>
      </div>
    </div>
  );
} 