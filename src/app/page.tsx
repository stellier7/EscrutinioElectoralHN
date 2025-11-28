'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../components/AuthProvider';
import Button from '../components/ui/Button';
import Input from '../components/ui/Input';
import { Eye, EyeOff, Vote, Shield, MapPin } from 'lucide-react';

export default function HomePage() {
  const [showPassword, setShowPassword] = useState(false);
  const [formData, setFormData] = useState({
    email: '',
    password: '',
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  
  const { login, isLoading } = useAuth();
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

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) return;

    try {
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
    } catch (error: any) {
      setErrors({ general: error.message });
    }
  };

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

        {/* Voluntarios Button */}
        <div className="text-center">
          <Button
            onClick={() => router.push('/voluntarios')}
            variant="primary"
            size="lg"
            className="w-full max-w-sm mx-auto"
          >
            <Vote className="h-5 w-5 mr-2" />
            Únete como Voluntario
          </Button>
        </div>

        {/* Form - iPhone-sized card */}
        <div className="bg-white rounded-2xl shadow-lg border border-gray-200 p-6 max-w-sm mx-auto">
          <div className="mb-4">
            <h2 className="text-xl font-semibold text-gray-900 text-center">Iniciar Sesión</h2>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {errors.general && (
              <div className={`alert-card ${
                errors.general.includes('✅') || errors.general.includes('🎉') 
                  ? 'alert-card-success' 
                  : 'alert-card-error'
              }`}>
                <div className="alert-card-content">
                  <p className="alert-card-message">{errors.general}</p>
                </div>
              </div>
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

            <div className="w-full">
              <label htmlFor="password" className={`block text-sm font-medium mb-1 ${errors.password ? 'text-danger-700' : 'text-gray-700'}`}>
                Contraseña
                <span className="text-danger-500 ml-1">*</span>
              </label>
              <div className="relative">
                <input
                  id="password"
                  name="password"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Tu contraseña"
                  value={formData.password}
                  onChange={handleInputChange}
                  required
                  className={`block w-full px-3 py-2 pr-10 border rounded-md shadow-sm transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 ${
                    errors.password
                      ? 'border-danger-300 focus:border-danger-500 focus:ring-danger-500'
                      : 'border-gray-300 focus:border-primary-500 focus:ring-primary-500'
                  }`}
                  aria-invalid={errors.password ? 'true' : 'false'}
                  aria-describedby={errors.password ? 'password-error' : undefined}
                />
                <button
                  type="button"
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 touch-target flex items-center justify-center w-6 h-6"
                  onClick={() => setShowPassword(!showPassword)}
                  aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                >
                  {showPassword ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </button>
              </div>
              {errors.password && (
                <p id="password-error" className="mt-1 text-sm text-danger-600">
                  {errors.password}
                </p>
              )}
            </div>

            <Button
              type="submit"
              variant="primary"
              size="lg"
              loading={isLoading}
              disabled={isLoading}
            >
              Iniciar Sesión
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