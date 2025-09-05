'use client';

import React, { useState, useEffect, Suspense } from 'react';
import axios from 'axios';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '../../components/AuthProvider';
import { useGeolocation } from '../../hooks/useGeolocation';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import VoteList from '@/components/VoteList';
import DiputadosEscrutinio from '@/components/DiputadosEscrutinio';
import VoteFooter from '@/components/VoteFooter';
import { useVoteStore } from '@/store/voteStore';
import { 
  Vote, 
  MapPin, 
  Camera, 
  CheckCircle,
  ArrowLeft,
  AlertCircle,
  Loader2,
  Settings,
  Smartphone
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
  
  const [currentStep, setCurrentStep] = useState(1);
  const [selectedMesa, setSelectedMesa] = useState('');
  const [selectedLevel, setSelectedLevel] = useState('');
  const [escrutinioId, setEscrutinioId] = useState<string | null>(null);
  const [isStarting, setIsStarting] = useState(false);
  const voteStore = useVoteStore();
  const [actaImage, setActaImage] = useState<File | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showInstructions, setShowInstructions] = useState(false);
  
  // Usar el hook de geolocalización
  const { 
    location, 
    isLoading, 
    error, 
    permissionStatus,
    getCurrentLocation, 
    showLocationInstructions 
  } = useGeolocation();

  const mesas: Mesa[] = [
    { id: '1', number: 'JRV-001', location: 'Escuela Central', address: 'Av. Principal 123' },
    { id: '2', number: 'JRV-002', location: 'Colegio San José', address: 'Jr. Lima 456' },
    { id: '3', number: 'JRV-003', location: 'Centro Comunal', address: 'Plaza Mayor s/n' },
    { id: '4', number: 'JRV-004', location: 'Universidad Local', address: 'Av. Universidad 789' },
    { id: '5', number: 'JRV-005', location: 'Club Deportivo', address: 'Jr. Deporte 321' },
  ];

  const [candidates, setCandidates] = useState<Candidate[]>([]);
  useEffect(() => {
    const load = async () => {
      if (!selectedLevel) { setCandidates([]); return; }
      try {
        const resp = await axios.get('/api/candidates', { params: { level: selectedLevel } });
        if (resp.data?.success) setCandidates(resp.data.data);
      } catch {}
    };
    load();
  }, [selectedLevel]);

  // Map party acronyms to display names
  const mapPartyToDisplayName = (party: string): string => {
    const key = party.trim().toLowerCase();
    switch (key) {
      case 'pdc':
      case 'demócrata cristiano':
      case 'democrata cristiano':
        return 'Demócrata Cristiano';
      case 'libre':
        return 'Libre';
      case 'pinu-sd':
      case 'pinu':
        return 'PINU-SD';
      case 'plh':
      case 'liberal':
        return 'Liberal';
      case 'pnh':
      case 'nacional':
        return 'Nacional';
      default:
        return party;
    }
  };

  const filteredCandidates = candidates
    .filter((c) => c.electionLevel === 'PRESIDENTIAL')
    .sort((a, b) => {
      // Force exact order by candidate number
      return a.number - b.number;
    });

  const getPartyColor = (party: string) => {
    const key = party.trim().toLowerCase();
    switch (key) {
      case 'pdc':
      case 'demócrata cristiano':
      case 'democrata cristiano':
        return '#16a34a'; // green
      case 'libre':
      case 'partido libertad y refundación (libre)':
        return '#dc2626'; // red
      case 'pinu-sd':
      case 'pinu':
      case 'partido innovación y unidad social demócrata (pinu-sd)':
        return '#7c3aed'; // purple
      case 'plh':
      case 'liberal':
      case 'partido liberal de honduras':
        return '#ef4444'; // red
      case 'pnh':
      case 'nacional':
      case 'partido nacional de honduras':
        return '#2563eb'; // blue
      default:
        return '#10b981';
    }
  };

  const handleGetLocation = async () => {
    const result = await getCurrentLocation();
    if (!result) return;
    try {
      setIsStarting(true);
      const resp = await axios.post('/api/escrutinio/start', {
        mesaNumber: selectedMesa,
        electionLevel: selectedLevel,
        gps: { latitude: result.lat, longitude: result.lng, accuracy: result.accuracy },
      });
      if (resp.data?.success && resp.data?.data?.escrutinioId) {
        // Reset any previous counts/batch when starting a brand new escrutinio
        voteStore.clear();
        setEscrutinioId(resp.data.data.escrutinioId);
        setCurrentStep(2);
      } else {
        alert(resp.data?.error || 'No se pudo iniciar el escrutinio');
      }
    } catch (e: any) {
      alert(e?.response?.data?.error || 'Error al iniciar el escrutinio');
    } finally {
      setIsStarting(false);
    }
  };

  // counts are managed by store now

  const handleActaUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setActaImage(file);
    }
  };

  const computeSHA256Hex = async (file: File): Promise<string> => {
    const buf = await file.arrayBuffer();
    const digest = await crypto.subtle.digest('SHA-256', buf);
    const byteArray = Array.from(new Uint8Array(digest));
    return byteArray.map((b) => b.toString(16).padStart(2, '0')).join('');
  };

  const toDataUrl = (file: File): Promise<string> =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });

  const uploadEvidenceIfNeeded = async (): Promise<void> => {
    if (!actaImage || !escrutinioId) return;
    try {
      const presign = await axios.post('/api/upload/presign', {
        escrutinioId,
        fileName: actaImage.name,
        contentType: actaImage.type || 'image/jpeg',
      });
      if (presign.data?.success) {
        const { uploadUrl, publicUrl } = presign.data.data as { uploadUrl: string; publicUrl: string };
        await fetch(uploadUrl, {
          method: 'PUT',
          headers: { 'Content-Type': actaImage.type || 'image/jpeg' },
          body: actaImage,
        });
        const hash = await computeSHA256Hex(actaImage);
        await axios.post(`/api/escrutinio/${encodeURIComponent(escrutinioId)}/evidence`, { publicUrl, hash });
        return;
      }
    } catch {
      // fallback below
    }
    try {
      const dataUrl = await toDataUrl(actaImage);
      const hash = await computeSHA256Hex(actaImage);
      await axios.post(`/api/escrutinio/${encodeURIComponent(escrutinioId)}/evidence`, { publicUrl: dataUrl, hash });
    } catch {}
  };

  const handleSubmit = async () => {
    if (!location || !selectedMesa || !selectedLevel) {
      alert('Por favor completa todos los campos requeridos');
      return;
    }

    setIsSubmitting(true);

    try {
      await uploadEvidenceIfNeeded();
      // Marcar escrutinio como completado para que aparezca en resultados
      if (escrutinioId) {
        try {
          await axios.post(`/api/escrutinio/${encodeURIComponent(escrutinioId)}/complete`, {
            gps: { latitude: location.lat, longitude: location.lng, accuracy: location.accuracy },
          });
        } catch (e) {
          // Continuar aunque falle el marcado como completo
        }
      }

      alert('Escrutinio enviado exitosamente!');
      // Clear local counts/batch after completing and sending the escrutinio
      voteStore.clear();
      router.push('/resultados');
    } catch (error) {
      alert('Error al enviar el escrutinio');
    } finally {
      setIsSubmitting(false);
    }
  };

  const totalVotes = Object.keys(voteStore.counts).reduce((sum, k) => sum + (voteStore.counts[k] || 0), 0);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header - Mobile optimized */}
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-14 lg:h-16">
            <div className="flex items-center">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => router.push('/dashboard')}
              >
                <ArrowLeft className="h-4 w-4 mr-1 lg:mr-2" />
                <span className="hidden sm:inline">Volver</span>
              </Button>
              <h1 className="ml-2 lg:ml-4 text-lg lg:text-xl font-semibold text-gray-900">
                <span className="hidden sm:inline">Nuevo Escrutinio</span>
                <span className="sm:hidden">Escrutinio</span>
              </h1>
            </div>
            
            <div className="flex items-center space-x-2">
              <MapPin className="h-4 w-4 lg:h-5 lg:w-5 text-gray-400" />
              <span className="text-xs lg:text-sm text-gray-700 hidden sm:block">
                {user?.name}
              </span>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-4 lg:py-8">
        {/* Progress Steps - Mobile optimized */}
        <div className="mb-6 lg:mb-8">
          <div className="flex items-center justify-center space-x-2 lg:space-x-4">
            <div className={`flex items-center ${currentStep >= 1 ? 'text-primary-600' : 'text-gray-400'}`}>
              <div className={`w-6 h-6 lg:w-8 lg:h-8 rounded-full flex items-center justify-center border-2 text-xs lg:text-sm ${
                currentStep >= 1 ? 'border-primary-600 bg-primary-600 text-white' : 'border-gray-300'
              }`}>
                1
              </div>
              <span className="ml-1 lg:ml-2 text-xs lg:text-sm font-medium hidden sm:block">Configuración</span>
            </div>
            
            <div className={`w-8 lg:w-16 h-0.5 ${currentStep >= 2 ? 'bg-primary-600' : 'bg-gray-300'}`}></div>
            
            <div className={`flex items-center ${currentStep >= 2 ? 'text-primary-600' : 'text-gray-400'}`}>
              <div className={`w-6 h-6 lg:w-8 lg:h-8 rounded-full flex items-center justify-center border-2 text-xs lg:text-sm ${
                currentStep >= 2 ? 'border-primary-600 bg-primary-600 text-white' : 'border-gray-300'
              }`}>
                2
              </div>
              <span className="ml-1 lg:ml-2 text-xs lg:text-sm font-medium hidden sm:block">Conteo</span>
            </div>
            
            <div className={`w-8 lg:w-16 h-0.5 ${currentStep >= 3 ? 'bg-primary-600' : 'bg-gray-300'}`}></div>
            
            <div className={`flex items-center ${currentStep >= 3 ? 'text-primary-600' : 'text-gray-400'}`}>
              <div className={`w-6 h-6 lg:w-8 lg:h-8 rounded-full flex items-center justify-center border-2 text-xs lg:text-sm ${
                currentStep >= 3 ? 'border-primary-600 bg-primary-600 text-white' : 'border-gray-300'
              }`}>
                3
              </div>
              <span className="ml-1 lg:ml-2 text-xs lg:text-sm font-medium hidden sm:block">Evidencia</span>
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
                  onClick={handleGetLocation}
                  disabled={!selectedMesa || !selectedLevel || isLoading || isStarting}
                  loading={isLoading || isStarting}
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                      <span className="hidden sm:inline">Obteniendo ubicación...</span>
                      <span className="sm:hidden">Obteniendo GPS...</span>
                    </>
                  ) : (
                    <>
                      <MapPin className="h-5 w-5 mr-2" />
                      <span className="hidden sm:inline">Obtener Ubicación y Continuar</span>
                      <span className="sm:hidden">Obtener GPS y Continuar</span>
                    </>
                  )}
                </Button>
                
                {/* Mobile-specific instructions */}
                <div className="mt-3 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                  <div className="flex items-start">
                    <MapPin className="h-4 w-4 text-blue-600 mt-0.5 flex-shrink-0" />
                    <div className="ml-2">
                      <p className="text-xs text-blue-800 font-medium">Consejos para móviles:</p>
                      <ul className="text-xs text-blue-700 mt-1 space-y-1">
                        <li>• Asegúrate de tener GPS habilitado</li>
                        <li>• Permite acceso a ubicación cuando se solicite</li>
                        <li>• Si falla, intenta salir al exterior</li>
                      </ul>
                    </div>
                  </div>
                </div>
                
                {/* Permission status indicator */}
                {permissionStatus === 'denied' && (
                  <div className="mt-3 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                    <div className="flex items-start">
                      <Settings className="h-4 w-4 text-yellow-600 mt-0.5 flex-shrink-0" />
                      <div className="ml-2">
                        <p className="text-xs text-yellow-800 font-medium">Permisos de ubicación denegados</p>
                        <button
                          onClick={() => setShowInstructions(!showInstructions)}
                          className="text-xs text-yellow-700 underline mt-1"
                        >
                          Ver instrucciones para habilitar
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {error && (
                <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-md">
                  <div className="flex">
                    <AlertCircle className="h-5 w-5 text-red-400" />
                    <div className="ml-3">
                      <p className="text-sm text-red-800">{error.userFriendlyMessage}</p>
                      {error.code === 1 && (
                        <button
                          onClick={() => setShowInstructions(!showInstructions)}
                          className="text-xs text-red-700 underline mt-1"
                        >
                          Ver instrucciones detalladas
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {showInstructions && (
                <div className="mt-4 p-4 bg-gray-50 border border-gray-200 rounded-md">
                  <div className="flex items-start">
                    <Smartphone className="h-4 w-4 text-gray-600 mt-0.5 flex-shrink-0" />
                    <div className="ml-2">
                      <p className="text-xs text-gray-800 font-medium mb-2">Instrucciones para habilitar ubicación:</p>
                      <pre className="text-xs text-gray-700 whitespace-pre-line">{showLocationInstructions()}</pre>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Step 2: Vote Counting */}
        {currentStep === 2 && selectedLevel !== 'LEGISLATIVE' && (
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
            {/* Show different UI based on election level */}
            {selectedLevel === 'LEGISLATIVE' ? (
              <DiputadosEscrutinio />
            ) : (
              <div className="space-y-4">
                <VoteList
                  escrutinioId={escrutinioId || 'escrutinio-temp'}
                  candidates={filteredCandidates.map((c) => ({
                    id: c.id,
                    name: c.name,
                    party: mapPartyToDisplayName(c.party),
                    number: c.number,
                    partyColor: getPartyColor(c.party),
                  }))}
                  userId={user?.id}
                  mesaId={selectedMesa}
                  gps={location ? { latitude: location.lat, longitude: location.lng, accuracy: location.accuracy } : null}
                  deviceId={typeof window !== 'undefined' ? localStorage.getItem('device-id') || undefined : undefined}
                />
              </div>
            )}
            </div>
          </div>
        )}

        {currentStep === 2 && selectedLevel !== 'LEGISLATIVE' && (
          <VoteFooter
            escrutinioId={escrutinioId || 'escrutinio-temp'}
            onContinue={() => setCurrentStep(3)}
          />
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