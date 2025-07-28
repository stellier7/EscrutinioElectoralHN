'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/components/AuthProvider';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Select from '@/components/ui/Select';
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
        await login({
          email: formData.email,
          password: formData.password,
          deviceId: '', // Will be generated in the hook
        });
      } else {
        await register({
          email: formData.email,
          password: formData.password,
          name: formData.name,
          role: formData.role as any,
          deviceId: '', // Will be generated in the hook
        });
      }
      
      router.push('/dashboard');
    } catch (error: any) {
      setErrors({ general: error.message });
    }
  };

  const roleOptions = [
    { value: 'VOLUNTEER', label: 'Voluntario' },
    { value: 'ORGANIZATION_MEMBER', label: 'Miembro de Organización' },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-50 to-primary-100 flex items-center justify-center p-4">
      <div className="max-w-md w-full space-y-8">
        {/* Header */}
        <div className="text-center">
          <div className="mx-auto h-16 w-16 bg-primary-600 rounded-full flex items-center justify-center mb-4">
            <Vote className="h-8 w-8 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-gray-900">
            Escrutinio Transparente
          </h1>
          <p className="mt-2 text-gray-600">
            Sistema de registro y transmisión de resultados electorales
          </p>
        </div>

        {/* Features */}
        <div className="grid grid-cols-3 gap-4 text-center">
          <div className="flex flex-col items-center space-y-2">
            <Shield className="h-6 w-6 text-primary-600" />
            <span className="text-xs text-gray-600">Seguro</span>
          </div>
          <div className="flex flex-col items-center space-y-2">
            <MapPin className="h-6 w-6 text-primary-600" />
            <span className="text-xs text-gray-600">Geolocalizado</span>
          </div>
          <div className="flex flex-col items-center space-y-2">
            <Vote className="h-6 w-6 text-primary-600" />
            <span className="text-xs text-gray-600">Auditable</span>
          </div>
        </div>

        {/* Form */}
        <div className="card">
          <div className="mb-6">
            <div className="flex rounded-lg bg-gray-100 p-1">
              <button
                type="button"
                className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-colors ${
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
                className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-colors ${
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
            {errors.general && (
              <div className="error-container">
                <p className="error-message">{errors.general}</p>
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
                className="absolute right-3 top-9 text-gray-400 hover:text-gray-600"
                onClick={() => setShowPassword(!showPassword)}
              >
                {showPassword ? (
                  <EyeOff className="h-5 w-5" />
                ) : (
                  <Eye className="h-5 w-5" />
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

          <div className="mt-6 text-center">
            <p className="text-sm text-gray-600">
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