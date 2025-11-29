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
    
    const shareUrl = `${window.location.origin}/informacion`;
    
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
      className="modal-overlay"
      onClick={handleOverlayClick}
      style={{ zIndex: 1000 }}
    >
      <div className="modal-container" style={{ maxWidth: '600px' }}>
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 bg-red-100 rounded-full flex items-center justify-center">
              <Heart className="h-5 w-5 text-red-600" />
            </div>
            <h3 className="text-xl font-bold text-gray-900">
              Apoya Nuestro Proyecto
            </h3>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-full transition-colors"
            aria-label="Cerrar"
          >
            <X className="h-5 w-5 text-gray-500" />
          </button>
        </div>

        {/* Modal Sections */}
        <div className="space-y-4">
          {/* Sección Donaciones */}
          <div className="bg-primary-50 border border-primary-200 rounded-lg p-4">
            <p className="text-sm text-gray-700 mb-4">
              Escrutinio Transparente es un proyecto ciudadano sin fines de lucro. Tu apoyo es esencial 
              para mantener y mejorar la plataforma, garantizando que siga siendo accesible para todos 
              los hondureños.
            </p>
            
            <div className="bg-white border border-gray-300 rounded-lg p-4 mb-4">
              <h4 className="font-semibold text-gray-900 mb-3 text-sm">Información de Donación Bancaria</h4>
              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">
                    Banco
                  </label>
                  <div className="bg-gray-50 border border-gray-300 rounded-lg p-3 text-center text-gray-900 font-semibold text-sm">
                    BANPAÍS
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">
                    Número de Cuenta
                  </label>
                  <div className="bg-gray-50 border border-gray-300 rounded-lg p-3">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-gray-900 font-mono font-semibold text-sm flex-1 text-center">015990026572</p>
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
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">
                    Nombre de la Cuenta
                  </label>
                  <div className="bg-gray-50 border border-gray-300 rounded-lg p-3 text-center">
                    <p className="text-gray-900 font-semibold text-sm">ASOCIACIÓN BEQUER HONDURAS</p>
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">
                    Tipo de Cuenta
                  </label>
                  <div className="bg-gray-50 border border-gray-300 rounded-lg p-3 text-center">
                    <p className="text-gray-900 font-medium text-sm">Cuenta de cheques</p>
                  </div>
                </div>
                <p className="text-xs text-gray-600 mt-3 text-center">
                  Aceptamos transferencias banco a banco y transferencias ACH
                </p>
              </div>
            </div>

            <button
              onClick={handleViewMore}
              className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors text-sm font-medium"
            >
              Más Información
              <ArrowRight className="h-4 w-4" />
            </button>
          </div>

          {/* Sección Compartir Noticia */}
          <div className="bg-blue-50 border-l-4 border-blue-500 rounded-lg p-4">
            <h4 className="text-lg font-semibold text-gray-900 mb-3 flex items-center gap-2">
              <span>📰</span>
              Compartir Noticia
            </h4>
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => scrollToSection('news-video')}
                className="flex items-center justify-center gap-2 px-4 py-2.5 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors text-sm font-medium text-gray-700"
              >
                <Play className="h-4 w-4" />
                Ver Video
              </button>
              <button
                onClick={() => handleShare('news')}
                className="flex items-center justify-center gap-2 px-4 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
              >
                <Share2 className="h-4 w-4" />
                Compartir
              </button>
            </div>
          </div>

          {/* Sección Compartir Demo */}
          <div className="bg-purple-50 border-l-4 border-purple-500 rounded-lg p-4">
            <h4 className="text-lg font-semibold text-gray-900 mb-3 flex items-center gap-2">
              <span>🎬</span>
              Compartir Demo
            </h4>
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => scrollToSection('demo-video')}
                className="flex items-center justify-center gap-2 px-4 py-2.5 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors text-sm font-medium text-gray-700"
              >
                <Play className="h-4 w-4" />
                Ver Demo
              </button>
              <button
                onClick={() => handleShare('demo')}
                className="flex items-center justify-center gap-2 px-4 py-2.5 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors text-sm font-medium"
              >
                <Share2 className="h-4 w-4" />
                Compartir
              </button>
            </div>
          </div>
        </div>

        {/* Footer con botón cerrar */}
        <div className="mt-6 pt-4 border-t">
          <button
            onClick={onClose}
            className="w-full px-4 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300 transition-colors text-sm font-medium"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
}
