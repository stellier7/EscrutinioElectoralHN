'use client';

import React, { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Textarea from '@/components/ui/Textarea';
import { CheckCircle, XCircle, Clock, Calendar, User } from 'lucide-react';
import type { ApiResponse } from '@/types';

interface ConfirmationData {
  id: string;
  eventName: string;
  eventDate: string;
  eventType: string;
  status: string;
  firstName: string;
  lastName: string;
}

export default function ConfirmPage() {
  const router = useRouter();
  const params = useParams();
  const token = params?.token as string;

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [confirmation, setConfirmation] = useState<ConfirmationData | null>(null);
  const [status, setStatus] = useState<'confirmed' | 'declined' | 'maybe'>('confirmed');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (token) {
      fetchConfirmation();
    }
  }, [token]);

  const fetchConfirmation = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/confirm/${token}`);
      const result: ApiResponse<ConfirmationData> = await response.json();

      if (result.success && result.data) {
        setConfirmation(result.data);
        setStatus(result.data.status as 'confirmed' | 'declined' | 'maybe' || 'confirmed');
      } else {
        setError(result.error || 'No se pudo cargar la información de confirmación');
      }
    } catch (error: any) {
      setError('Error al cargar la información');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!confirmation) return;

    try {
      setSubmitting(true);
      setError(null);

      const response = await fetch(`/api/confirm/${token}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          status,
          notes: notes.trim() || undefined,
        }),
      });

      const result: ApiResponse = await response.json();

      if (result.success) {
        setSuccess(true);
        setTimeout(() => {
          router.push('/');
        }, 3000);
      } else {
        setError(result.error || 'Error al confirmar asistencia');
      }
    } catch (error: any) {
      setError('Error al confirmar asistencia');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-primary-50 to-primary-100 flex items-center justify-center p-4">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Cargando...</p>
        </div>
      </div>
    );
  }

  if (error && !confirmation) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-primary-50 to-primary-100 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-lg border border-gray-200 p-8 max-w-md w-full text-center">
          <div className="mx-auto h-16 w-16 bg-red-100 rounded-full flex items-center justify-center mb-4">
            <XCircle className="h-8 w-8 text-red-600" />
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Error</h2>
          <p className="text-gray-600 mb-6">{error}</p>
          <Button onClick={() => router.push('/')}>Volver al inicio</Button>
        </div>
      </div>
    );
  }

  if (success) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-primary-50 to-primary-100 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-lg border border-gray-200 p-8 max-w-md w-full text-center">
          <div className="mx-auto h-16 w-16 bg-green-100 rounded-full flex items-center justify-center mb-4">
            <CheckCircle className="h-8 w-8 text-green-600" />
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">¡Confirmación registrada!</h2>
          <p className="text-gray-600 mb-6">
            {status === 'confirmed' 
              ? '¡Gracias por confirmar tu asistencia! Te esperamos en el evento.'
              : status === 'declined'
              ? 'Lamentamos que no puedas asistir. Gracias por avisarnos.'
              : 'Hemos registrado tu respuesta. Te confirmaremos más detalles pronto.'}
          </p>
          <p className="text-sm text-gray-500">Redirigiendo al inicio...</p>
        </div>
      </div>
    );
  }

  if (!confirmation) return null;

  const eventDate = new Date(confirmation.eventDate);

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-50 to-primary-100 py-8 px-4 safe-top safe-bottom">
      <div className="w-full max-w-2xl mx-auto">
        <div className="bg-white rounded-2xl shadow-lg border border-gray-200 p-6 md:p-8">
          {/* Header */}
          <div className="text-center mb-8">
            <div className="mx-auto h-12 w-12 bg-primary-600 rounded-full flex items-center justify-center mb-3">
              <Calendar className="h-6 w-6 text-white" />
            </div>
            <h1 className="text-3xl font-bold text-gray-900">Confirmar Asistencia</h1>
            <p className="mt-2 text-gray-600">Confirma tu participación en el evento</p>
          </div>

          {/* Event Info */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 mb-6">
            <h2 className="text-xl font-semibold text-blue-900 mb-4">{confirmation.eventName}</h2>
            
            <div className="space-y-3">
              <div className="flex items-start">
                <Calendar className="h-5 w-5 text-blue-600 mr-3 mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-blue-900">Fecha y Hora</p>
                  <p className="text-blue-800">
                    {eventDate.toLocaleDateString('es-HN', {
                      weekday: 'long',
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </p>
                </div>
              </div>

              <div className="flex items-start">
                <User className="h-5 w-5 text-blue-600 mr-3 mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-blue-900">Invitado</p>
                  <p className="text-blue-800">{confirmation.firstName} {confirmation.lastName}</p>
                </div>
              </div>

              {confirmation.status !== 'pending' && (
                <div className="flex items-start">
                  <Clock className="h-5 w-5 text-blue-600 mr-3 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium text-blue-900">Estado Actual</p>
                    <p className="text-blue-800 capitalize">
                      {confirmation.status === 'confirmed' ? 'Confirmado' :
                       confirmation.status === 'declined' ? 'Declinado' :
                       'Pendiente'}
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Form */}
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
              <p className="text-sm text-red-800">{error}</p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-3">
                ¿Asistirás al evento?
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <button
                  type="button"
                  onClick={() => setStatus('confirmed')}
                  className={`p-4 rounded-lg border-2 transition-all ${
                    status === 'confirmed'
                      ? 'border-green-500 bg-green-50 text-green-900'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <CheckCircle className={`h-6 w-6 mx-auto mb-2 ${
                    status === 'confirmed' ? 'text-green-600' : 'text-gray-400'
                  }`} />
                  <p className="font-medium">Sí, asistiré</p>
                </button>

                <button
                  type="button"
                  onClick={() => setStatus('maybe')}
                  className={`p-4 rounded-lg border-2 transition-all ${
                    status === 'maybe'
                      ? 'border-yellow-500 bg-yellow-50 text-yellow-900'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <Clock className={`h-6 w-6 mx-auto mb-2 ${
                    status === 'maybe' ? 'text-yellow-600' : 'text-gray-400'
                  }`} />
                  <p className="font-medium">Tal vez</p>
                </button>

                <button
                  type="button"
                  onClick={() => setStatus('declined')}
                  className={`p-4 rounded-lg border-2 transition-all ${
                    status === 'declined'
                      ? 'border-red-500 bg-red-50 text-red-900'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <XCircle className={`h-6 w-6 mx-auto mb-2 ${
                    status === 'declined' ? 'text-red-600' : 'text-gray-400'
                  }`} />
                  <p className="font-medium">No asistiré</p>
                </button>
              </div>
            </div>

            <Textarea
              label="Comentarios (Opcional)"
              name="notes"
              placeholder="Comparte cualquier información adicional..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={4}
            />

            <Button
              type="submit"
              variant="primary"
              size="lg"
              loading={submitting}
              disabled={submitting}
              className="w-full"
            >
              Confirmar
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}


