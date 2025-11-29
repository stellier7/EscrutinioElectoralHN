'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import Button from '../../components/ui/Button';
import ShareButton from '../../components/ShareButton';
import { ArrowLeft, ArrowUp, Vote, Users, Heart, Info, Shield, MapPin, CheckCircle, Mail, Phone, CreditCard, Wallet, Play, ExternalLink, Copy, Check } from 'lucide-react';

export default function InformacionPage() {
  const router = useRouter();
  const [accountCopied, setAccountCopied] = useState(false);

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const copyAccountNumber = async () => {
    try {
      await navigator.clipboard.writeText('015990026572');
      setAccountCopied(true);
      setTimeout(() => setAccountCopied(false), 2000);
    } catch (err) {
      console.error('Error al copiar:', err);
    }
  };

  // Helper function to extract YouTube video ID from URL
  const getYouTubeVideoId = (url: string): string | null => {
    if (!url) return null;
    const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/;
    const match = url.match(regExp);
    return (match && match[2].length === 11) ? match[2] : null;
  };

  // YouTube video URLs
  const demoVideoUrl = 'https://www.youtube.com/watch?v=n1O4qAL7BVY';
  const newsVideoUrl = 'https://www.youtube.com/watch?v=L_imdBQ0A6c';
  const relatedLinkUrl = ''; // Add a related link here if you have one
  const relatedLinkText = 'Artículo relacionado';

  const demoVideoId = getYouTubeVideoId(demoVideoUrl);
  const newsVideoId = getYouTubeVideoId(newsVideoUrl);

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-50 to-primary-100 py-8 px-4 safe-top safe-bottom">
      <div className="w-full max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <div>
          <div className="mb-4">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => router.push('/')}
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Volver
            </Button>
          </div>
          <div className="text-center">
            <div className="mx-auto h-16 w-16 bg-primary-600 rounded-full flex items-center justify-center mb-4">
              <Info className="h-8 w-8 text-white" />
            </div>
            <h1 className="text-3xl font-bold text-gray-900 mb-2">
              Más Información
            </h1>
            <p className="text-gray-600">
              Conoce más sobre Escrutinio Transparente
            </p>
          </div>
        </div>

        {/* Sección 1: ¿Qué es Escrutinio Transparente? */}
        <div className="bg-white rounded-2xl shadow-lg border border-gray-200 p-6 md:p-8">
          <div className="flex items-center mb-4">
            <div className="h-10 w-10 bg-primary-100 rounded-full flex items-center justify-center mr-3">
              <Vote className="h-6 w-6 text-primary-600" />
            </div>
            <h2 className="text-2xl font-bold text-gray-900">
              ¿Qué es Escrutinio Transparente?
            </h2>
          </div>
          <div className="space-y-4 text-gray-700">
            <p className="text-lg font-semibold text-primary-700">
              Del pueblo, para el pueblo
            </p>
            <p>
              Escrutinio Transparente es una plataforma ciudadana diseñada para garantizar 
              la transparencia y veracidad en los procesos electorales de Honduras. Este 
              sistema nace de la necesidad de contar con un mecanismo confiable, accesible 
              y transparente para el registro y transmisión de resultados electorales.
            </p>
            <p>
              Nuestra misión es empoderar a los ciudadanos hondureños proporcionando una 
              herramienta tecnológica que permita a los voluntarios de las Juntas Receptoras 
              de Votos (JRV) registrar y transmitir los resultados de manera segura, 
              geolocalizada y auditable.
            </p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6">
              <div className="flex flex-col items-center text-center p-4 bg-primary-50 rounded-lg">
                <Shield className="h-8 w-8 text-primary-600 mb-2" />
                <h3 className="font-semibold text-gray-900 mb-1">Seguro</h3>
                <p className="text-sm text-gray-600">
                  Protección de datos y verificación de identidad
                </p>
              </div>
              <div className="flex flex-col items-center text-center p-4 bg-primary-50 rounded-lg">
                <MapPin className="h-8 w-8 text-primary-600 mb-2" />
                <h3 className="font-semibold text-gray-900 mb-1">Geolocalizado</h3>
                <p className="text-sm text-gray-600">
                  Registro preciso de la ubicación de cada JRV
                </p>
              </div>
              <div className="flex flex-col items-center text-center p-4 bg-primary-50 rounded-lg">
                <CheckCircle className="h-8 w-8 text-primary-600 mb-2" />
                <h3 className="font-semibold text-gray-900 mb-1">Auditable</h3>
                <p className="text-sm text-gray-600">
                  Trazabilidad completa de todos los registros
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Sección 2: ¿Cómo Funciona? */}
        <div className="bg-white rounded-2xl shadow-lg border border-gray-200 p-6 md:p-8">
          <div className="flex items-center mb-4">
            <div className="h-10 w-10 bg-blue-100 rounded-full flex items-center justify-center mr-3">
              <Info className="h-6 w-6 text-blue-600" />
            </div>
            <h2 className="text-2xl font-bold text-gray-900">
              ¿Cómo Funciona?
            </h2>
          </div>
          <div className="space-y-4 text-gray-700">
            <p>
              El sistema está diseñado para funcionar de manera simple y eficiente:
            </p>
            <div className="space-y-4 mt-6">
              <div className="flex items-start">
                <div className="flex-shrink-0 h-8 w-8 bg-primary-600 text-white rounded-full flex items-center justify-center font-bold mr-4 mt-1">
                  1
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900 mb-1">Registro de Voluntarios</h3>
                  <p className="text-gray-600">
                    Los ciudadanos se registran como voluntarios y se asignan a su JRV correspondiente. 
                    El proceso es sencillo: solo necesitas registrarte y dirigirte a tu JRV para comenzar.
                  </p>
                </div>
              </div>
              <div className="flex items-start">
                <div className="flex-shrink-0 h-8 w-8 bg-primary-600 text-white rounded-full flex items-center justify-center font-bold mr-4 mt-1">
                  2
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900 mb-1">Proceso Electoral</h3>
                  <p className="text-gray-600">
                    Durante las elecciones, los voluntarios registran los resultados de su JRV utilizando 
                    la plataforma. El sistema captura los votos para presidente, diputados y otros cargos, 
                    junto con la geolocalización precisa de la JRV.
                  </p>
                </div>
              </div>
              <div className="flex items-start">
                <div className="flex-shrink-0 h-8 w-8 bg-primary-600 text-white rounded-full flex items-center justify-center font-bold mr-4 mt-1">
                  3
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900 mb-1">Transmisión y Verificación</h3>
                  <p className="text-gray-600">
                    Los resultados se transmiten en tiempo real a la plataforma, donde pueden ser 
                    verificados y auditados. El sistema permite la revisión de múltiples escrutinios 
                    y mantiene un historial completo de todas las operaciones.
                  </p>
                </div>
              </div>
              <div className="flex items-start">
                <div className="flex-shrink-0 h-8 w-8 bg-primary-600 text-white rounded-full flex items-center justify-center font-bold mr-4 mt-1">
                  4
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900 mb-1">Transparencia Pública</h3>
                  <p className="text-gray-600">
                    Los resultados agregados estarán disponibles públicamente después de los resultados públicos, 
                    permitiendo a todos los ciudadanos verificar y comparar los datos registrados por los voluntarios.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Sección 3: Videos y Medios */}
        <div className="bg-white rounded-2xl shadow-lg border border-gray-200 p-6 md:p-8">
          <div className="flex items-center mb-4">
            <div className="h-10 w-10 bg-purple-100 rounded-full flex items-center justify-center mr-3">
              <Play className="h-6 w-6 text-purple-600" />
            </div>
            <h2 className="text-2xl font-bold text-gray-900">
              Videos y Medios
            </h2>
          </div>
          <div className="space-y-6">
            {/* Demo Video */}
            {demoVideoId ? (
              <div id="demo-video">
                <h3 className="text-lg font-semibold text-gray-900 mb-3">Demo del Sistema</h3>
                <div className="relative w-full" style={{ paddingBottom: '56.25%' }}>
                  <iframe
                    className="absolute top-0 left-0 w-full h-full rounded-lg"
                    src={`https://www.youtube.com/embed/${demoVideoId}`}
                    title="Demo de Escrutinio Transparente"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                  />
                  <ShareButton videoType="demo" />
                </div>
              </div>
            ) : (
              <div className="bg-gray-50 border-2 border-dashed border-gray-300 rounded-lg p-8 text-center">
                <Play className="h-12 w-12 text-gray-400 mx-auto mb-3" />
                <p className="text-gray-600 font-medium mb-2">Demo del Sistema</p>
                <p className="text-sm text-gray-500">
                  Agrega la URL del video de demostración en el código
                </p>
              </div>
            )}

            {/* News Video */}
            {newsVideoId ? (
              <div id="news-video">
                <h3 className="text-lg font-semibold text-gray-900 mb-3">En las Noticias</h3>
                <div className="relative w-full" style={{ paddingBottom: '56.25%' }}>
                  <iframe
                    className="absolute top-0 left-0 w-full h-full rounded-lg"
                    src={`https://www.youtube.com/embed/${newsVideoId}`}
                    title="Escrutinio Transparente en las Noticias"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                  />
                  <ShareButton videoType="news" />
                </div>
              </div>
            ) : (
              <div className="bg-gray-50 border-2 border-dashed border-gray-300 rounded-lg p-8 text-center">
                <Play className="h-12 w-12 text-gray-400 mx-auto mb-3" />
                <p className="text-gray-600 font-medium mb-2">En las Noticias</p>
                <p className="text-sm text-gray-500">
                  Agrega la URL del video de noticias en el código
                </p>
              </div>
            )}

            {/* Related Link - Only show if a link is provided */}
            {relatedLinkUrl && relatedLinkUrl.trim() !== '' && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <ExternalLink className="h-5 w-5 text-blue-600" />
                    <div>
                      <h4 className="font-semibold text-gray-900">{relatedLinkText}</h4>
                      <p className="text-sm text-gray-600">Más información sobre el proyecto</p>
                    </div>
                  </div>
                  <a
                    href={relatedLinkUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium text-sm flex items-center gap-2"
                  >
                    Ver más
                    <ExternalLink className="h-4 w-4" />
                  </a>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Sección 4: Voluntariado */}
        <div className="bg-white rounded-2xl shadow-lg border border-gray-200 p-6 md:p-8">
          <div className="flex items-center mb-4">
            <div className="h-10 w-10 bg-green-100 rounded-full flex items-center justify-center mr-3">
              <Users className="h-6 w-6 text-green-600" />
            </div>
            <h2 className="text-2xl font-bold text-gray-900">
              Voluntariado
            </h2>
          </div>
          <div className="space-y-4 text-gray-700">
            <p>
              Tu participación es fundamental para garantizar elecciones transparentes. Como voluntario 
              en tu Junta Receptora de Votos (JRV), tendrás la responsabilidad de registrar y transmitir 
              los resultados de manera precisa y oportuna.
            </p>
            <div className="bg-green-50 border border-green-200 rounded-lg p-4 mt-4">
              <h3 className="font-semibold text-gray-900 mb-2">¿Cómo ser voluntario en tu JRV?</h3>
              <ul className="list-disc list-inside space-y-2 text-gray-700">
                <li>Regístrate en la plataforma proporcionando tu información personal y el número de tu JRV</li>
                <li>Espera la aprobación de un administrador (esto garantiza la seguridad del sistema)</li>
                <li>Una vez aprobado, podrás acceder al sistema y registrar los resultados de tu JRV</li>
                <li>Durante las elecciones, ingresa los votos de manera precisa y verifica la información</li>
                <li>El sistema te guiará paso a paso durante todo el proceso</li>
              </ul>
            </div>
            <div className="mt-6 text-center">
              <Button
                onClick={() => router.push('/voluntarios')}
                variant="primary"
                size="lg"
                className="w-full md:w-auto"
              >
                <Users className="h-5 w-5 mr-2" />
                Únete como Voluntario
              </Button>
            </div>
          </div>
        </div>

        {/* Sección 5: Donaciones - Con Badge Destacado */}
        <div id="donaciones" className="bg-white rounded-2xl shadow-lg border-2 border-primary-300 p-6 md:p-8 relative overflow-hidden scroll-mt-20">
          <div className="flex items-center mb-4">
            <div className="h-10 w-10 bg-red-100 rounded-full flex items-center justify-center mr-3">
              <Heart className="h-6 w-6 text-red-600" />
            </div>
            <h2 className="text-2xl font-bold text-gray-900">
              Donaciones
            </h2>
          </div>
          
          <div className="space-y-4 text-gray-700">
            <p>
              Escrutinio Transparente es un proyecto ciudadano sin fines de lucro. Tu apoyo es esencial 
              para mantener y mejorar la plataforma, garantizando que siga siendo accesible para todos 
              los hondureños.
            </p>
            
            <div className="bg-primary-50 border border-primary-200 rounded-lg p-6 mt-6">
              <h3 className="font-semibold text-gray-900 mb-4 text-lg">Información de Donación Bancaria</h3>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Banco
                  </label>
                  <div className="bg-white border border-gray-300 rounded-lg p-4 text-center text-gray-900 font-semibold">
                    BANPAÍS
                  </div>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Número de Cuenta
                  </label>
                  <div className="bg-white border border-gray-300 rounded-lg p-4">
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-gray-900 font-mono font-semibold text-lg flex-1 text-center">015990026572</p>
                      <button
                        onClick={copyAccountNumber}
                        className="p-2 hover:bg-gray-100 rounded-lg transition-colors flex-shrink-0"
                        aria-label="Copiar número de cuenta"
                        title="Copiar al portapapeles"
                      >
                        {accountCopied ? (
                          <Check className="h-5 w-5 text-green-600" />
                        ) : (
                          <Copy className="h-5 w-5 text-gray-600" />
                        )}
                      </button>
                    </div>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Nombre de la Cuenta
                  </label>
                  <div className="bg-white border border-gray-300 rounded-lg p-4 text-center">
                    <p className="text-gray-900 font-semibold">ASOCIACIÓN BEQUER HONDURAS</p>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Tipo de Cuenta
                  </label>
                  <div className="bg-white border border-gray-300 rounded-lg p-4 text-center">
                    <p className="text-gray-900 font-medium">Cuenta de cheques</p>
                  </div>
                </div>

                <p className="text-xs text-gray-600 mt-4 text-center">
                  Aceptamos transferencias banco a banco y transferencias ACH
                </p>
              </div>
            </div>

            {/* Métodos de Pago Alternativos */}
            <div className="bg-gradient-to-br from-blue-50 to-purple-50 border border-blue-200 rounded-lg p-6 mt-6">
              <h3 className="font-semibold text-gray-900 mb-4 text-lg flex items-center">
                <CreditCard className="h-5 w-5 mr-2 text-blue-600" />
                Métodos de Pago Alternativos
              </h3>
              <p className="text-gray-700 text-sm leading-relaxed">
                Si necesitas utilizar otro método de pago como tarjetas de crédito, PayPal, activos digitales 
                u otras opciones, por favor contáctanos. Estaremos encantados de ayudarte a encontrar la 
                forma más conveniente para que puedas apoyar nuestro proyecto.
              </p>
            </div>

            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mt-6">
              <h4 className="font-semibold text-gray-900 mb-2 flex items-center">
                <Mail className="h-5 w-5 mr-2 text-blue-600" />
                ¿Necesitas más información sobre cómo donar?
              </h4>
              <p className="text-gray-700 mb-3">
                Contáctanos para obtener más detalles sobre los métodos de pago disponibles, incluyendo 
                opciones tradicionales y alternativas modernas de transferencia.
              </p>
              <div className="mt-4 text-center">
                <a
                  href="mailto:admin@escrutiniohn.org?subject=Consulta sobre Donaciones"
                  className="inline-flex items-center px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors font-medium"
                >
                  <Mail className="h-4 w-4 mr-2" />
                  Enviar Email
                </a>
                <p className="text-xs text-gray-600 mt-2">
                  O escríbenos a:{' '}
                  <a 
                    href="mailto:admin@escrutiniohn.org" 
                    className="text-primary-600 hover:text-primary-700 underline"
                  >
                    admin@escrutiniohn.org
                  </a>
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Footer con botón volver arriba */}
        <div className="text-center space-y-4">
          <button
            onClick={scrollToTop}
            className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300 transition-colors text-sm font-medium"
          >
            <ArrowUp className="h-5 w-5" />
            Volver arriba
          </button>
          <p className="text-xs text-gray-500">
            © 2024 Escrutinio Transparente. Todos los derechos reservados.
          </p>
        </div>
      </div>

    </div>
  );
}

