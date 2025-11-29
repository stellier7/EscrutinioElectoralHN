'use client';

import React, { useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { Heart, X, Play, Share2, ArrowRight, Copy, Check } from 'lucide-react';

interface DonationModalProps {
  onClose: () => void;
}

export default function DonationModal({ onClose }: DonationModalProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [accountCopied, setAccountCopied] = useState(false);

  const handleOverlayClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  const scrollToSection = (sectionId: string) => {
    // Si no estamos en la página de información, redirigir primero
    if (pathname !== '/informacion') {
      router.push(`/informacion#${sectionId}`);
      onClose();
      return;
    }

    // Si ya estamos en la página, hacer scroll
    const element = document.getElementById(sectionId);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'start' });
      onClose();
    }
  };

  const handleViewMore = () => {
    onClose();
    router.push('/informacion#donaciones');
  };

  const handleShare = async (videoType: 'demo' | 'news') => {
    if (typeof window === 'undefined' || typeof navigator === 'undefined') return;
    
    // URLs de YouTube de los videos
    const demoVideoUrl = 'https://www.youtube.com/watch?v=n1O4qAL7BVY';
    const newsVideoUrl = 'https://www.youtube.com/watch?v=L_imdBQ0A6c';
    
    const shareUrl = videoType === 'demo' ? demoVideoUrl : newsVideoUrl;
    
    const videoTitle = videoType === 'demo'
      ? 'Demo de Escrutinio Transparente'
      : 'Escrutinio Transparente en las Noticias';

    const shareData = {
      title: videoTitle,
      text: `Mira este video: ${videoTitle}`,
      url: shareUrl,
    };

    try {
      // Intentar usar la Web Share API nativa (funciona en iOS y Android)
      if (navigator.share) {
        try {
          await navigator.share(shareData);
          return;
        } catch (shareErr) {
          // Si el usuario cancela, no hacer nada
          if (shareErr instanceof Error && shareErr.name === 'AbortError') {
            return;
          }
        }
      }
      // Fallback: copiar al portapapeles
      if (navigator.clipboard) {
        await navigator.clipboard.writeText(shareUrl);
      }
    } catch (err) {
      console.error('Error al compartir:', err);
    }
  };

  const copyAccountNumber = async () => {
    if (typeof window === 'undefined' || typeof navigator === 'undefined') return;
    
    try {
      await navigator.clipboard.writeText('015990026572');
      setAccountCopied(true);
      setTimeout(() => setAccountCopied(false), 2000);
    } catch (err) {
      console.error('Error al copiar:', err);
    }
  };

  return (
    <div 
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[1000] p-3 sm:p-4"
      onClick={handleOverlayClick}
    >
      <div 
        className="bg-white rounded-lg shadow-xl w-full max-w-lg max-h-[90vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header - Sticky */}
        <div className="flex items-center justify-between px-4 py-3 sm:px-6 sm:py-4 border-b border-gray-200 flex-shrink-0">
          <div className="flex items-center gap-2 sm:gap-3">
            <div className="h-8 w-8 sm:h-10 sm:w-10 bg-red-100 rounded-full flex items-center justify-center flex-shrink-0">
              <Heart className="h-4 w-4 sm:h-5 sm:w-5 text-red-600" />
            </div>
            <h3 className="text-base sm:text-xl font-bold text-gray-900">
              Apoya Nuestro Proyecto
            </h3>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 sm:p-2 hover:bg-gray-100 rounded-full transition-colors flex-shrink-0"
            aria-label="Cerrar"
          >
            <X className="h-5 w-5 text-gray-500" />
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="overflow-y-auto flex-1 px-4 py-4 sm:px-6 sm:py-6">
          <div className="space-y-3 sm:space-y-4">
            {/* Sección Donaciones */}
            <div className="bg-primary-50 border border-primary-200 rounded-lg p-3 sm:p-4">
              <p className="text-xs sm:text-sm text-gray-700 mb-3 sm:mb-4 leading-relaxed">
                Escrutinio Transparente es un proyecto ciudadano sin fines de lucro. Tu apoyo es esencial 
                para mantener y mejorar la plataforma, garantizando que siga siendo accesible para todos 
                los hondureños.
              </p>
              
              <div className="bg-white border border-gray-300 rounded-lg p-3 sm:p-4 mb-3 sm:mb-4">
                <h4 className="font-semibold text-gray-900 mb-2 sm:mb-3 text-xs sm:text-sm">Información de Donación Bancaria</h4>
                <div className="space-y-2 sm:space-y-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">
                      Banco
                    </label>
                    <div className="bg-gray-50 border border-gray-300 rounded-lg p-2 sm:p-3 text-center text-gray-900 font-semibold text-xs sm:text-sm">
                      BANPAÍS
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">
                      Número de Cuenta
                    </label>
                    <div className="bg-gray-50 border border-gray-300 rounded-lg p-2 sm:p-3">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-gray-900 font-mono font-semibold text-xs sm:text-sm flex-1 text-center break-all">015990026572</p>
                        <button
                          onClick={copyAccountNumber}
                          className="p-1.5 hover:bg-gray-200 rounded transition-colors flex-shrink-0"
                          aria-label="Copiar número de cuenta"
                          title="Copiar al portapapeles"
                        >
                          {accountCopied ? (
                            <Check className="h-4 w-4 text-green-600" />
                          ) : (
                            <Copy className="h-4 w-4 text-gray-600" />
                          )}
                        </button>
                      </div>
                    </div>
                  </div>
                  <div className="hidden sm:block">
                    <label className="block text-xs font-medium text-gray-700 mb-1">
                      Nombre de la Cuenta
                    </label>
                    <div className="bg-gray-50 border border-gray-300 rounded-lg p-2 sm:p-3 text-center">
                      <p className="text-gray-900 font-semibold text-xs sm:text-sm break-words">ASOCIACIÓN BEQUER HONDURAS</p>
                    </div>
                  </div>
                  <div className="hidden sm:block">
                    <label className="block text-xs font-medium text-gray-700 mb-1">
                      Tipo de Cuenta
                    </label>
                    <div className="bg-gray-50 border border-gray-300 rounded-lg p-2 sm:p-3 text-center">
                      <p className="text-gray-900 font-medium text-xs sm:text-sm">Cuenta de cheques</p>
                    </div>
                  </div>
                  <p className="text-xs text-gray-600 mt-2 sm:mt-3 text-center">
                    Aceptamos transferencias banco a banco y transferencias ACH
                  </p>
              </div>
            </div>

              <button
                onClick={handleViewMore}
                className="w-full inline-flex items-center justify-center gap-2 px-4 py-2 sm:py-2.5 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors text-xs sm:text-sm font-medium"
              >
                Más Información
                <ArrowRight className="h-3 w-3 sm:h-4 sm:w-4" />
              </button>
            </div>

            {/* Sección Compartir Noticia */}
            <div className="bg-blue-50 border-l-4 border-blue-500 rounded-lg p-3 sm:p-4">
              <h4 className="text-sm sm:text-lg font-semibold text-gray-900 mb-2 sm:mb-3 flex items-center gap-2">
                <span>📰</span>
                Compartir Noticia
              </h4>
              <div className="grid grid-cols-2 gap-2 sm:gap-3">
                <button
                  onClick={() => scrollToSection('news-video')}
                  className="flex items-center justify-center gap-1.5 sm:gap-2 px-2 sm:px-4 py-2 sm:py-2.5 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors text-xs sm:text-sm font-medium text-gray-700"
                >
                  <Play className="h-3 w-3 sm:h-4 sm:w-4" />
                  <span className="hidden sm:inline">Ver</span> Video
                </button>
                <button
                  onClick={() => handleShare('news')}
                  className="flex items-center justify-center gap-1.5 sm:gap-2 px-2 sm:px-4 py-2 sm:py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-xs sm:text-sm font-medium"
                >
                  <Share2 className="h-3 w-3 sm:h-4 sm:w-4" />
                  Compartir
                </button>
              </div>
            </div>

            {/* Sección Compartir Demo */}
            <div className="bg-purple-50 border-l-4 border-purple-500 rounded-lg p-3 sm:p-4">
              <h4 className="text-sm sm:text-lg font-semibold text-gray-900 mb-2 sm:mb-3 flex items-center gap-2">
                <span>🎬</span>
                Compartir Demo
              </h4>
              <div className="grid grid-cols-2 gap-2 sm:gap-3">
                <button
                  onClick={() => scrollToSection('demo-video')}
                  className="flex items-center justify-center gap-1.5 sm:gap-2 px-2 sm:px-4 py-2 sm:py-2.5 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors text-xs sm:text-sm font-medium text-gray-700"
                >
                  <Play className="h-3 w-3 sm:h-4 sm:w-4" />
                  <span className="hidden sm:inline">Ver</span> Demo
                </button>
                <button
                  onClick={() => handleShare('demo')}
                  className="flex items-center justify-center gap-1.5 sm:gap-2 px-2 sm:px-4 py-2 sm:py-2.5 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors text-xs sm:text-sm font-medium"
                >
                  <Share2 className="h-3 w-3 sm:h-4 sm:w-4" />
                  Compartir
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Footer con botón cerrar - Sticky */}
        <div className="px-4 py-3 sm:px-6 sm:py-4 border-t border-gray-200 flex-shrink-0">
          <button
            onClick={onClose}
            className="w-full px-4 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300 transition-colors text-xs sm:text-sm font-medium"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
}
