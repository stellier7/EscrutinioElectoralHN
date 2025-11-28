'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/components/AuthProvider';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import SearchInput from '@/components/ui/SearchInput';
import { InfoTooltip } from '@/components/ui/InfoTooltip';
import { Vote, ArrowLeft, CheckCircle, Eye, EyeOff } from 'lucide-react';
import type { ApiResponse } from '@/types';

interface SearchResult {
  value: string;
  label: string;
  location: string;
  department: string;
}

export default function VoluntariosPage() {
  const router = useRouter();
  const { register, isLoading } = useAuth();
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    phone: '',
    jrvNumber: '',
    jrvSearch: '',
    acceptTerms: false,
  });
  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [selectedJRV, setSelectedJRV] = useState<SearchResult | null>(null);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: '' }));
    }
  };

  const handleJRVSelect = (result: SearchResult) => {
    setSelectedJRV(result);
    setFormData(prev => ({ ...prev, jrvNumber: result.value, jrvSearch: result.label }));
  };

  const handleJRVChange = (value: string) => {
    setFormData(prev => ({ ...prev, jrvSearch: value }));
    if (!value) {
      setSelectedJRV(null);
      setFormData(prev => ({ ...prev, jrvNumber: '' }));
    }
  };

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!formData.name.trim()) {
      newErrors.name = 'El nombre completo es requerido';
    } else if (formData.name.length < 2) {
      newErrors.name = 'El nombre debe tener al menos 2 caracteres';
    }

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

    if (formData.phone && formData.phone.length > 0 && formData.phone.length < 8) {
      newErrors.phone = 'El teléfono debe tener al menos 8 caracteres';
    }

    if (!formData.acceptTerms) {
      newErrors.acceptTerms = 'Debes aceptar los términos y condiciones';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) return;

    setIsSubmitting(true);
    setErrors({});

    try {
      const response = await register({
        name: formData.name.trim(),
        email: formData.email.trim(),
        password: formData.password,
        phone: formData.phone.trim() || undefined,
        jrvNumber: formData.jrvNumber || undefined,
      });

      // Usuario queda autenticado automáticamente
      setIsSuccess(true);
      
      // Redirigir al dashboard después de 2 segundos
      setTimeout(() => {
        router.push('/dashboard');
      }, 2000);
    } catch (error: any) {
      setErrors({ general: error.message || 'Error al crear la cuenta. Por favor intenta de nuevo.' });
      setIsSubmitting(false);
    }
  };

  if (isSuccess) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-primary-50 to-primary-100 flex items-center justify-center p-4">
        <div className="w-full max-w-md bg-white rounded-2xl shadow-lg border border-gray-200 p-8 text-center">
          <div className="mx-auto h-16 w-16 bg-green-100 rounded-full flex items-center justify-center mb-4">
            <CheckCircle className="h-8 w-8 text-green-600" />
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">
            ¡Cuenta Creada Exitosamente!
          </h2>
          <p className="text-gray-600 mb-6">
            Tu cuenta ha sido creada y está lista para usar. Serás redirigido al dashboard...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-50 to-primary-100 py-8 px-4 safe-top safe-bottom">
      <div className="w-full max-w-2xl mx-auto space-y-6">
        {/* Header */}
        <div className="text-center">
          <Button
            variant="secondary"
            size="sm"
            onClick={() => router.push('/')}
            className="mb-4"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Volver
          </Button>
          <div className="mx-auto h-12 w-12 bg-primary-600 rounded-full flex items-center justify-center mb-3">
            <Vote className="h-6 w-6 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-gray-900">
            Únete como Voluntario
          </h1>
          <p className="mt-2 text-gray-600">
            Ayuda a garantizar elecciones transparentes en Honduras
          </p>
        </div>

        {/* Form */}
        <div className="bg-white rounded-2xl shadow-lg border border-gray-200 p-6 md:p-8">
          <form onSubmit={handleSubmit} className="space-y-4">
            {errors.general && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                <p className="text-sm text-red-800">{errors.general}</p>
              </div>
            )}

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

            <Input
              label="Correo electrónico"
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
                  placeholder="Mínimo 6 caracteres"
                  value={formData.password}
                  onChange={(e) => {
                    setFormData(prev => ({ ...prev, password: e.target.value }));
                    if (errors.password) {
                      setErrors(prev => ({ ...prev, password: '' }));
                    }
                  }}
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

            <Input
              label="Número de teléfono (Opcional)"
              name="phone"
              type="tel"
              placeholder="+504 9999-9999"
              value={formData.phone}
              onChange={handleInputChange}
              error={errors.phone}
            />

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1 flex items-center gap-2">
                JRV donde votas (Opcional)
                <InfoTooltip text="Aquí puedes poner el nombre del lugar donde votas o el número del JRV" />
              </label>
              <SearchInput
                value={formData.jrvSearch}
                onChange={handleJRVChange}
                onSelect={handleJRVSelect}
                placeholder="Buscar JRV..."
              />
              {selectedJRV && (
                <p className="mt-1 text-xs text-gray-500">
                  Seleccionado: {selectedJRV.label}
                </p>
              )}
            </div>

            <div className="flex items-start">
              <div className="flex items-center h-5">
                <input
                  id="acceptTerms"
                  name="acceptTerms"
                  type="checkbox"
                  checked={formData.acceptTerms}
                  onChange={(e) => {
                    setFormData(prev => ({ ...prev, acceptTerms: e.target.checked }));
                    if (errors.acceptTerms) {
                      setErrors(prev => ({ ...prev, acceptTerms: '' }));
                    }
                  }}
                  className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
                />
              </div>
              <div className="ml-3 text-sm">
                <label htmlFor="acceptTerms" className={`font-medium ${errors.acceptTerms ? 'text-danger-700' : 'text-gray-700'}`}>
                  Acepto términos y condiciones
                  <span className="text-danger-500 ml-1">*</span>
                </label>
                {errors.acceptTerms && (
                  <p className="mt-1 text-sm text-danger-600">
                    {errors.acceptTerms}
                  </p>
                )}
              </div>
            </div>

            <Button
              type="submit"
              variant="primary"
              size="lg"
              loading={isSubmitting || isLoading}
              disabled={isSubmitting || isLoading}
              className="w-full"
            >
              Crear cuenta
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}

