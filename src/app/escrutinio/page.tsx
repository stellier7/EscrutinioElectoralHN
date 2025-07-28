'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/components/AuthProvider';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import { 
  Vote, 
  MapPin, 
  Camera, 
  CheckCircle,
  ArrowLeft,
  AlertCircle,
  Loader2
} from 'lucide-react';

interface Mesa {
  id: string;
  number: string;
  location: string;
  address?: string;
}

interface Candidate {
  id: string;
  name: string;
  party: string;
  number: number;
  electionLevel: string;
}

function EscrutinioPageContent() {
  const { user } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  
  const [isLoading, setIsLoading] = useState(false);
  const [currentStep, setCurrentStep] = useState(1);
  const [selectedMesa, setSelectedMesa] = useState('');
  const [selectedLevel, setSelectedLevel] = useState('');
  const [location, setLocation] = useState<{lat: number, lng: number} | null>(null);
  const [locationError, setLocationError] = useState('');
  const [votes, setVotes] = useState<Record<string, number>>({});
  const [actaImage, setActaImage] = useState<File | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const mesas: Mesa[] = [
    { id: '1', number: 'JRV-001', location: 'Escuela Central', address: 'Av. Principal 123' },
    { id: '2', number: 'JRV-002', location: 'Colegio San José', address: 'Jr. Lima 456' },
    { id: '3', number: 'JRV-003', location: 'Centro Comunal', address: 'Plaza Mayor s/n' },
    { id: '4', number: 'JRV-004', location: 'Universidad Local', address: 'Av. Universidad 789' },
    { id: '5', number: 'JRV-005', location: 'Club Deportivo', address: 'Jr. Deporte 321' },
  ];

  const candidates: Candidate[] = [
    { id: '1', name: 'Juan Pérez', party: 'Partido A', number: 1, electionLevel: 'PRESIDENTIAL' },
    { id: '2', name: 'María García', party: 'Partido B', number: 2, electionLevel: 'PRESIDENTIAL' },
    { id: '3', name: 'Carlos López', party: 'Partido C', number: 3, electionLevel: 'PRESIDENTIAL' },
    { id: '4', name: 'Ana Rodríguez', party: 'Partido A', number: 101, electionLevel: 'LEGISLATIVE' },
    { id: '5', name: 'Pedro Martínez', party: 'Partido B', number: 102, electionLevel: 'LEGISLATIVE' },
    { id: '6', name: 'Laura González', party: 'Partido C', number: 103, electionLevel: 'LEGISLATIVE' },
    { id: '7', name: 'Roberto Silva', party: 'Partido A', number: 201, electionLevel: 'MUNICIPAL' },
    { id: '8', name: 'Carmen Díaz', party: 'Partido B', number: 202, electionLevel: 'MUNICIPAL' },
    { id: '9', name: 'Miguel Torres', party: 'Partido C', number: 203, electionLevel: 'MUNICIPAL' },
  ];

  const filteredCandidates = candidates.filter(c => c.electionLevel === selectedLevel);

  const getCurrentLocation = () => {
    setIsLoading(true);
    setLocationError('');

    if (!navigator.geolocation) {
      setLocationError('Geolocalización no está disponible en este dispositivo');
      setIsLoading(false);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setLocation({
          lat: position.coords.latitude,
          lng: position.coords.longitude
        });
        setIsLoading(false);
        setCurrentStep(2);
      },
      (error) => {
        setLocationError('Error al obtener ubicación: ' + error.message);
        setIsLoading(false);
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 60000
      }
    );
  };

  const handleVoteChange = (candidateId: string, value: string) => {
    const numValue = parseInt(value) || 0;
    setVotes(prev => ({
      ...prev,
      [candidateId]: numValue
    }));
  };

  const handleActaUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setActaImage(file);
    }
  };

  const handleSubmit = async () => {
    if (!location || !selectedMesa || !selectedLevel) {
      alert('Por favor completa todos los campos requeridos');
      return;
    }

    setIsSubmitting(true);

    try {
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      alert('Escrutinio enviado exitosamente!');
      router.push('/dashboard');
    } catch (error) {
      alert('Error al enviar el escrutinio');
    } finally {
      setIsSubmitting(false);
    }
  };

  const totalVotes = Object.values(votes).reduce((sum, vote) => sum + vote, 0);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => router.push('/dashboard')}
              >
                <ArrowLeft className="h-4 w-4 mr-2" />
                Volver
              </Button>
              <h1 className="ml-4 text-xl font-semibold text-gray-900">
                Nuevo Escrutinio
              </h1>
            </div>
            
            <div className="flex items-center space-x-2">
              <MapPin className="h-5 w-5 text-gray-400" />
              <span className="text-sm text-gray-700">
                {user?.name}
              </span>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Progress Steps */}
        <div className="mb-8">
          <div className="flex items-center justify-center space-x-4">
            <div className={`flex items-center ${currentStep >= 1 ? 'text-primary-600' : 'text-gray-400'}`}>
              <div className={`w-8 h-8 rounded-full flex items-center justify-center border-2 ${
                currentStep >= 1 ? 'border-primary-600 bg-primary-600 text-white' : 'border-gray-300'
              }`}>
                1
              </div>
              <span className="ml-2 text-sm font-medium">Configuración</span>
            </div>
            
            <div className={`w-16 h-0.5 ${currentStep >= 2 ? 'bg-primary-600' : 'bg-gray-300'}`}></div>
            
            <div className={`flex items-center ${currentStep >= 2 ? 'text-primary-600' : 'text-gray-400'}`}>
              <div className={`w-8 h-8 rounded-full flex items-center justify-center border-2 ${
                currentStep >= 2 ? 'border-primary-600 bg-primary-600 text-white' : 'border-gray-300'
              }`}>
                2
              </div>
              <span className="ml-2 text-sm font-medium">Conteo</span>
            </div>
            
            <div className={`w-16 h-0.5 ${currentStep >= 3 ? 'bg-primary-600' : 'bg-gray-300'}`}></div>
            
            <div className={`flex items-center ${currentStep >= 3 ? 'text-primary-600' : 'text-gray-400'}`}>
              <div className={`w-8 h-8 rounded-full flex items-center justify-center border-2 ${
                currentStep >= 3 ? 'border-primary-600 bg-primary-600 text-white' : 'border-gray-300'
              }`}>
                3
              </div>
              <span className="ml-2 text-sm font-medium">Evidencia</span>
            </div>
          </div>
        </div>

        {/* Step 1: Configuration */}
        {currentStep === 1 && (
          <div className="bg-white p-6 rounded-lg shadow-sm border">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Configuración del Escrutinio</h2>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Mesa Electoral (JRV)
                </label>
                <select 
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                  value={selectedMesa}
                  onChange={(e) => setSelectedMesa(e.target.value)}
                >
                  <option value="">Seleccionar mesa...</option>
                  {mesas.map(mesa => (
                    <option key={mesa.id} value={mesa.number}>
                      {mesa.number} - {mesa.location}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Nivel Electoral
                </label>
                <select 
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                  value={selectedLevel}
                  onChange={(e) => setSelectedLevel(e.target.value)}
                >
                  <option value="">Seleccionar nivel...</option>
                  <option value="PRESIDENTIAL">Presidencial</option>
                  <option value="LEGISLATIVE">Legislativo</option>
                  <option value="MUNICIPAL">Municipal</option>
                </select>
              </div>

              <div className="pt-4">
                <Button
                  variant="primary"
                  size="lg"
                  onClick={getCurrentLocation}
                  disabled={!selectedMesa || !selectedLevel || isLoading}
                  loading={isLoading}
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                      Obteniendo ubicación...
                    </>
                  ) : (
                    <>
                      <MapPin className="h-5 w-5 mr-2" />
                      Obtener Ubicación y Continuar
                    </>
                  )}
                </Button>
              </div>

              {locationError && (
                <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-md">
                  <div className="flex">
                    <AlertCircle className="h-5 w-5 text-red-400" />
                    <div className="ml-3">
                      <p className="text-sm text-red-800">{locationError}</p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Step 2: Vote Counting */}
        {currentStep === 2 && (
          <div className="bg-white p-6 rounded-lg shadow-sm border">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Conteo de Votos</h2>
            
            {location && (
              <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-md">
                <div className="flex items-center">
                  <CheckCircle className="h-5 w-5 text-green-600" />
                  <div className="ml-3">
                    <p className="text-sm font-medium text-green-800">Ubicación verificada</p>
                    <p className="text-sm text-green-700">
                      Lat: {location.lat.toFixed(6)}, Lng: {location.lng.toFixed(6)}
                    </p>
                  </div>
                </div>
              </div>
            )}

            <div className="space-y-4">
              {filteredCandidates.map(candidate => (
                <div key={candidate.id} className="flex items-center space-x-4 p-4 border border-gray-200 rounded-lg">
                  <div className="flex-1">
                    <h3 className="font-medium text-gray-900">{candidate.name}</h3>
                    <p className="text-sm text-gray-600">{candidate.party} - Número {candidate.number}</p>
                  </div>
                  <div className="w-32">
                    <Input
                      name={`votes-${candidate.id}`}
                      type="number"
                      placeholder="0"
                      value={votes[candidate.id]?.toString() || ''}
                      onChange={(e) => handleVoteChange(candidate.id, e.target.value)}
                    />
                  </div>
                </div>
              ))}

              <div className="pt-4 border-t border-gray-200">
                <div className="flex justify-between items-center">
                  <span className="text-lg font-medium text-gray-900">Total de votos:</span>
                  <span className="text-2xl font-bold text-primary-600">{totalVotes}</span>
                </div>
              </div>

              <div className="pt-4">
                <Button
                  variant="primary"
                  size="lg"
                  onClick={() => setCurrentStep(3)}
                  disabled={totalVotes === 0}
                >
                  Continuar a Evidencia
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Step 3: Evidence Upload */}
        {currentStep === 3 && (
          <div className="bg-white p-6 rounded-lg shadow-sm border">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Carga de Evidencia</h2>
            
            <div className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Foto del Acta Firmada
                </label>
                <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center">
                  <Camera className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleActaUpload}
                    className="hidden"
                    id="acta-upload"
                  />
                  <label htmlFor="acta-upload" className="cursor-pointer">
                    <span className="text-primary-600 hover:text-primary-500 font-medium">
                      Seleccionar imagen
                    </span>
                    <span className="text-gray-500"> o arrastrar aquí</span>
                  </label>
                  <p className="text-sm text-gray-500 mt-2">
                    PNG, JPG hasta 10MB
                  </p>
                </div>
                {actaImage && (
                  <div className="mt-4 p-4 bg-green-50 border border-green-200 rounded-md">
                    <div className="flex items-center">
                      <CheckCircle className="h-5 w-5 text-green-600" />
                      <span className="ml-2 text-sm text-green-800">
                        {actaImage.name} seleccionada
                      </span>
                    </div>
                  </div>
                )}
              </div>

              <div className="pt-4">
                <Button
                  variant="primary"
                  size="lg"
                  onClick={handleSubmit}
                  disabled={!actaImage || isSubmitting}
                  loading={isSubmitting}
                >
                  {isSubmitting ? 'Enviando...' : 'Enviar Escrutinio'}
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default function EscrutinioPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Cargando...</p>
        </div>
      </div>
    }>
      <EscrutinioPageContent />
    </Suspense>
  );
} 