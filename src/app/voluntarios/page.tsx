'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Select from '@/components/ui/Select';
import Textarea from '@/components/ui/Textarea';
import SearchInput from '@/components/ui/SearchInput';
import { Vote, ArrowLeft, CheckCircle } from 'lucide-react';
import type { ApiResponse } from '@/types';

interface SearchResult {
  value: string;
  label: string;
  location: string;
  department: string;
}

export default function VoluntariosPage() {
  const router = useRouter();
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    role: 'VOLUNTEER',
    jrvNumber: '',
    jrvSearch: '',
    comments: '',
  });
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

  const handleTextareaChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
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

    if (!formData.firstName.trim()) {
      newErrors.firstName = 'El nombre es requerido';
    } else if (formData.firstName.length < 2) {
      newErrors.firstName = 'El nombre debe tener al menos 2 caracteres';
    }

    if (!formData.lastName.trim()) {
      newErrors.lastName = 'El apellido es requerido';
    } else if (formData.lastName.length < 2) {
      newErrors.lastName = 'El apellido debe tener al menos 2 caracteres';
    }

    if (!formData.email) {
      newErrors.email = 'El email es requerido';
    } else if (!/\S+@\S+\.\S+/.test(formData.email)) {
      newErrors.email = 'El email no es válido';
    }

    if (!formData.phone) {
      newErrors.phone = 'El teléfono es requerido';
    } else if (formData.phone.length < 8) {
      newErrors.phone = 'El teléfono debe tener al menos 8 caracteres';
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
      const response = await fetch('/api/volunteers/apply', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          firstName: formData.firstName.trim(),
          lastName: formData.lastName.trim(),
          email: formData.email.trim(),
          phone: formData.phone.trim(),
          role: formData.role,
          jrvNumber: formData.jrvNumber || undefined,
          comments: formData.comments.trim() || undefined,
        }),
      });

      const result: ApiResponse = await response.json();

      if (result.success) {
        setIsSuccess(true);
        // Reset form after 3 seconds
        setTimeout(() => {
          setIsSuccess(false);
          setFormData({
            firstName: '',
            lastName: '',
            email: '',
            phone: '',
            role: 'VOLUNTEER',
            jrvNumber: '',
            jrvSearch: '',
            comments: '',
          });
          setSelectedJRV(null);
        }, 3000);
      } else {
        setErrors({ general: result.error || 'Error al enviar la solicitud' });
      }
    } catch (error: any) {
      setErrors({ general: 'Error de conexión. Por favor intenta de nuevo.' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const roleOptions = [
    { value: 'VOLUNTEER', label: 'Voluntario' },
    { value: 'OBSERVER', label: 'Observador' },
  ];

  if (isSuccess) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-primary-50 to-primary-100 flex items-center justify-center p-4">
        <div className="w-full max-w-md bg-white rounded-2xl shadow-lg border border-gray-200 p-8 text-center">
          <div className="mx-auto h-16 w-16 bg-green-100 rounded-full flex items-center justify-center mb-4">
            <CheckCircle className="h-8 w-8 text-green-600" />
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">
            ¡Solicitud Enviada!
          </h2>
          <p className="text-gray-600 mb-6">
            Tu solicitud ha sido enviada exitosamente. Nos pondremos en contacto contigo pronto.
          </p>
          <Button
            onClick={() => router.push('/')}
            className="w-full"
          >
            Volver al inicio
          </Button>
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
            Únete como Voluntario u Observador
          </h1>
          <p className="mt-2 text-gray-600">
            Ayuda a garantizar elecciones transparentes en Honduras
          </p>
        </div>

        {/* Información sobre requisitos */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
          <h3 className="text-lg font-semibold text-blue-900 mb-3">
            Requisitos para ser Voluntario u Observador
          </h3>
          <div className="space-y-2 text-blue-800">
            <p className="flex items-start">
              <span className="font-semibold mr-2">•</span>
              <span>Asistir a 2 reuniones informativas</span>
            </p>
            <p className="flex items-start">
              <span className="font-semibold mr-2">•</span>
              <span>Participar en un entrenamiento en persona</span>
            </p>
            <p className="mt-4 text-sm text-blue-700">
              Las mejores aplicaciones serán entrenadas como observadores, mientras que los demás pueden apoyar como voluntarios en caso de necesidad.
            </p>
          </div>
        </div>

        {/* Form */}
        <div className="bg-white rounded-2xl shadow-lg border border-gray-200 p-6 md:p-8">
          <form onSubmit={handleSubmit} className="space-y-4">
            {errors.general && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                <p className="text-sm text-red-800">{errors.general}</p>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Input
                label="Nombre"
                name="firstName"
                type="text"
                placeholder="Tu nombre"
                value={formData.firstName}
                onChange={handleInputChange}
                error={errors.firstName}
                required
              />
              <Input
                label="Apellido"
                name="lastName"
                type="text"
                placeholder="Tu apellido"
                value={formData.lastName}
                onChange={handleInputChange}
                error={errors.lastName}
                required
              />
            </div>

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

            <Input
              label="Número de teléfono"
              name="phone"
              type="tel"
              placeholder="12345678"
              value={formData.phone}
              onChange={handleInputChange}
              error={errors.phone}
              required
            />

            <Select
              label="¿Deseas ser Voluntario u Observador?"
              name="role"
              options={roleOptions}
              value={formData.role}
              onChange={handleInputChange}
              required
            />

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                JRV donde votas (Opcional)
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

            <Textarea
              label="Comentarios (Opcional)"
              name="comments"
              placeholder="Cuéntanos por qué te interesa ser voluntario u observador..."
              value={formData.comments}
              onChange={handleTextareaChange}
              rows={4}
            />

            <Button
              type="submit"
              variant="primary"
              size="lg"
              loading={isSubmitting}
              disabled={isSubmitting}
              className="w-full"
            >
              Enviar Solicitud
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}

