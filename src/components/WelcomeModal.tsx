'use client';

import React, { useState, useEffect } from 'react';
import { X, Share2, Check, Vote } from 'lucide-react';
import Button from './ui/Button';

interface WelcomeModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function WelcomeModal({ isOpen, onClose }: WelcomeModalProps) {
  const [copied, setCopied] = useState(false);

  // Prevenir scroll del body cuando el modal está abierto
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
      // Manejar tecla ESC para cerrar
      const handleEscape = (e: KeyboardEvent) => {
        if (e.key === 'Escape') {
          onClose();
        }
      };
      document.addEventListener('keydown', handleEscape);
      return () => {
        document.body.style.overflow = 'unset';
        document.removeEventListener('keydown', handleEscape);
      };
    } else {
      document.body.style.overflow = 'unset';
    }
  }, [isOpen, onClose]);

  const handleOverlayClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  const handleShare = async () => {
    if (typeof window === 'undefined' || typeof navigator === 'undefined') return;

    const shareUrl = window.location.origin;
    const shareText = '¡Únete al Escrutinio Transparente! Ayuda a garantizar elecciones transparentes en Honduras.';
    const shareTitle = 'Escrutinio Transparente';

    const shareData = {
      title: shareTitle,
      text: shareText,
      url: shareUrl,
    };

    try {
      // Intentar usar la Web Share API nativa (funciona en iOS y Android)
      if (navigator.share && navigator.canShare && navigator.canShare(shareData)) {
        await navigator.share(shareData);
        return;
      }
      // Fallback: copiar al portapapeles
      if (navigator.clipboard) {
        await navigator.clipboard.writeText(shareUrl);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }
    } catch (err) {
      // Si el usuario cancela, no hacer nada
      if (err instanceof Error && err.name === 'AbortError') {
        return;
      }
      // Si hay otro error, intentar copiar
      try {
        if (navigator.clipboard) {
          await navigator.clipboard.writeText(shareUrl);
          setCopied(true);
          setTimeout(() => setCopied(false), 2000);
        }
      } catch (clipboardErr) {
        console.error('Error al copiar:', clipboardErr);
      }
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[1000] p-3 sm:p-4 animate-in fade-in duration-200"
      onClick={handleOverlayClick}
    >
      <div
        className="bg-white rounded-lg shadow-xl w-full max-w-lg max-h-[90vh] flex flex-col animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="welcome-modal-title"
      >
        {/* Header - Sticky */}
        <div className="flex items-center justify-between px-4 py-3 sm:px-6 sm:py-4 border-b border-gray-200 flex-shrink-0">
          <div className="flex items-center gap-2 sm:gap-3">
            <div className="h-8 w-8 sm:h-10 sm:w-10 bg-primary-100 rounded-full flex items-center justify-center flex-shrink-0">
              <Vote className="h-4 w-4 sm:h-5 sm:w-5 text-primary-600" />
            </div>
            <h2
              id="welcome-modal-title"
              className="text-base sm:text-xl font-bold text-gray-900"
            >
              ¡Bienvenido!
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 sm:p-2 hover:bg-gray-100 rounded-full transition-colors flex-shrink-0 touch-target"
            aria-label="Cerrar modal"
          >
            <X className="h-5 w-5 text-gray-500" />
          </button>
        </div>

        {/* Content - Optimizado para móviles sin scroll */}
        <div className="overflow-y-auto flex-1 px-4 py-4 sm:px-6 sm:py-6">
          <div className="space-y-3 sm:space-y-4">
            {/* Título principal */}
            <div className="text-center">
              <h3 className="text-lg sm:text-2xl font-bold text-gray-900 mb-2">
                ¡Gracias por unirte al Escrutinio Transparente!
              </h3>
            </div>

            {/* Mensaje principal */}
            <div className="space-y-3 text-sm sm:text-base text-gray-700 leading-relaxed">
              <p>
                Gracias por tu apoyo. Necesitamos más voluntarios — compartí esta herramienta con tu familia y amigos.
              </p>

              {/* Sección de derechos */}
              <div className="bg-primary-50 border-l-4 border-primary-500 rounded-lg p-3 sm:p-4 mt-4">
                <p className="font-semibold text-gray-900 mb-2">
                  Como ciudadano tenés derecho a observar el proceso electoral:
                </p>
                <ul className="space-y-2 text-gray-700">
                  <li className="flex items-start gap-2">
                    <span className="text-lg flex-shrink-0">📸</span>
                    <span>Tomá foto del acta</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-lg flex-shrink-0">🔍</span>
                    <span>Compará resultados entre la urna y el CNE</span>
                  </li>
                </ul>
              </div>

              {/* Información sobre prácticas */}
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 sm:p-4 mt-4">
                <p className="text-gray-700">
                  <strong>Podés practicar ahora.</strong> Reiniciaremos los datos varias veces hoy.
                </p>
                <p className="text-gray-700 mt-2">
                  <strong>Mañana domingo 30</strong> cerraremos las pruebas alrededor de las 3–4 p.m. para iniciar el escrutinio real.
                </p>
              </div>

              {/* Nota sobre correo */}
              <p className="text-gray-600 italic mt-4">
                Te enviaremos más información a tu correo.
              </p>

              {/* Mensaje final */}
              <p className="text-center font-semibold text-primary-700 mt-4 text-base sm:text-lg">
                ¡Tu participación hace la diferencia! 💙🤍💙
              </p>
            </div>
          </div>
        </div>

        {/* Footer con botones - Sticky */}
        <div className="px-4 py-3 sm:px-6 sm:py-4 border-t border-gray-200 flex-shrink-0 space-y-2 sm:space-y-0 sm:flex sm:gap-3">
          <Button
            variant="primary"
            size="lg"
            onClick={handleShare}
            className="w-full sm:flex-1 flex items-center justify-center gap-2"
          >
            {copied ? (
              <>
                <Check className="h-4 w-4" />
                ¡Copiado!
              </>
            ) : (
              <>
                <Share2 className="h-4 w-4" />
                Compartir
              </>
            )}
          </Button>
          <Button
            variant="secondary"
            size="lg"
            onClick={onClose}
            className="w-full sm:flex-1"
          >
            Cerrar
          </Button>
        </div>
      </div>
    </div>
  );
}

