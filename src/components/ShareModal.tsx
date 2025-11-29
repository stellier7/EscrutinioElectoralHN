'use client';

import React, { useState, useEffect } from 'react';
import { X, Twitter, Facebook, MessageCircle, Linkedin, Instagram, Copy, Check } from 'lucide-react';

interface ShareModalProps {
  videoType: 'demo' | 'news';
  onClose: () => void;
}

export default function ShareModal({ videoType, onClose }: ShareModalProps) {
  const [copied, setCopied] = useState(false);
  const [shareUrl, setShareUrl] = useState('');

  useEffect(() => {
    // Generar URL completa de la página de información
    if (typeof window !== 'undefined') {
      setShareUrl(`${window.location.origin}/informacion`);
    }
  }, []);

  const videoTitle = videoType === 'demo' 
    ? 'Demo de Escrutinio Transparente' 
    : 'Escrutinio Transparente en las Noticias';

  const shareText = `Mira este video de ${videoType === 'demo' ? 'la demostración del sistema' : 'las noticias'}: ${shareUrl}`;

  const handleShare = (platform: string) => {
    const encodedUrl = encodeURIComponent(shareUrl);
    const encodedText = encodeURIComponent(`Mira este video: ${videoTitle}`);

    let shareWindowUrl = '';

    switch (platform) {
      case 'twitter':
        shareWindowUrl = `https://twitter.com/intent/tweet?url=${encodedUrl}&text=${encodedText}`;
        break;
      case 'facebook':
        shareWindowUrl = `https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}`;
        break;
      case 'whatsapp':
        shareWindowUrl = `https://api.whatsapp.com/send?text=${encodeURIComponent(shareText)}`;
        break;
      case 'linkedin':
        shareWindowUrl = `https://www.linkedin.com/sharing/share-offsite/?url=${encodedUrl}`;
        break;
      default:
        return;
    }

    if (shareWindowUrl) {
      window.open(shareWindowUrl, '_blank', 'width=600,height=400');
    }
  };

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Error al copiar:', err);
      // Fallback para navegadores que no soportan clipboard API
      const textArea = document.createElement('textarea');
      textArea.value = shareUrl;
      textArea.style.position = 'fixed';
      textArea.style.opacity = '0';
      document.body.appendChild(textArea);
      textArea.select();
      try {
        document.execCommand('copy');
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      } catch (err) {
        console.error('Error al copiar con fallback:', err);
      }
      document.body.removeChild(textArea);
    }
  };

  const handleOverlayClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  const handleInstagramInfo = () => {
    alert('Para compartir en Instagram, copia el enlace y pégalo en tu publicación o historia. El enlace ya está copiado.');
    handleCopyLink();
  };

  return (
    <div 
      className="modal-overlay"
      onClick={handleOverlayClick}
      style={{ zIndex: 1001 }}
    >
      <div className="modal-container" style={{ maxWidth: '500px' }}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg sm:text-xl font-semibold text-gray-900">
            Compartir {videoType === 'demo' ? 'Demo' : 'Noticia'}
          </h3>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-full transition-colors"
            aria-label="Cerrar"
          >
            <X className="h-5 w-5 text-gray-500" />
          </button>
        </div>

        <div className="mb-6">
          <p className="text-sm text-gray-600 text-center">
            Comparte este video en tus redes sociales
          </p>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-6">
          <button
            onClick={() => handleShare('twitter')}
            className="flex flex-col items-center justify-center p-4 border border-gray-200 rounded-lg hover:bg-blue-50 hover:border-blue-300 transition-colors"
            aria-label="Compartir en Twitter"
          >
            <div className="p-3 bg-blue-100 rounded-full mb-2">
              <Twitter className="h-6 w-6 text-blue-600" />
            </div>
            <span className="text-xs font-medium text-gray-700">Twitter</span>
          </button>

          <button
            onClick={() => handleShare('facebook')}
            className="flex flex-col items-center justify-center p-4 border border-gray-200 rounded-lg hover:bg-blue-50 hover:border-blue-300 transition-colors"
            aria-label="Compartir en Facebook"
          >
            <div className="p-3 bg-blue-100 rounded-full mb-2">
              <Facebook className="h-6 w-6 text-blue-600" />
            </div>
            <span className="text-xs font-medium text-gray-700">Facebook</span>
          </button>

          <button
            onClick={() => handleShare('whatsapp')}
            className="flex flex-col items-center justify-center p-4 border border-gray-200 rounded-lg hover:bg-green-50 hover:border-green-300 transition-colors"
            aria-label="Compartir en WhatsApp"
          >
            <div className="p-3 bg-green-100 rounded-full mb-2">
              <MessageCircle className="h-6 w-6 text-green-600" />
            </div>
            <span className="text-xs font-medium text-gray-700">WhatsApp</span>
          </button>

          <button
            onClick={() => handleShare('linkedin')}
            className="flex flex-col items-center justify-center p-4 border border-gray-200 rounded-lg hover:bg-blue-50 hover:border-blue-300 transition-colors"
            aria-label="Compartir en LinkedIn"
          >
            <div className="p-3 bg-blue-100 rounded-full mb-2">
              <Linkedin className="h-6 w-6 text-blue-600" />
            </div>
            <span className="text-xs font-medium text-gray-700">LinkedIn</span>
          </button>

          <button
            onClick={handleInstagramInfo}
            className="flex flex-col items-center justify-center p-4 border border-gray-200 rounded-lg hover:bg-pink-50 hover:border-pink-300 transition-colors"
            aria-label="Información sobre compartir en Instagram"
          >
            <div className="p-3 bg-pink-100 rounded-full mb-2">
              <Instagram className="h-6 w-6 text-pink-600" />
            </div>
            <span className="text-xs font-medium text-gray-700">Instagram</span>
          </button>

          <button
            onClick={handleCopyLink}
            className="flex flex-col items-center justify-center p-4 border border-gray-200 rounded-lg hover:bg-gray-50 hover:border-gray-300 transition-colors"
            aria-label="Copiar enlace"
          >
            <div className="p-3 bg-gray-100 rounded-full mb-2">
              {copied ? (
                <Check className="h-6 w-6 text-green-600" />
              ) : (
                <Copy className="h-6 w-6 text-gray-600" />
              )}
            </div>
            <span className="text-xs font-medium text-gray-700">
              {copied ? '¡Copiado!' : 'Copiar'}
            </span>
          </button>
        </div>

        <div className="border-t pt-4">
          <div className="bg-gray-50 rounded-lg p-3">
            <p className="text-xs text-gray-600 mb-2">Enlace a compartir:</p>
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={shareUrl}
                readOnly
                className="flex-1 text-xs p-2 bg-white border border-gray-300 rounded truncate"
              />
              <button
                onClick={handleCopyLink}
                className="p-2 bg-primary-600 text-white rounded hover:bg-primary-700 transition-colors"
                aria-label="Copiar enlace"
              >
                {copied ? (
                  <Check className="h-4 w-4" />
                ) : (
                  <Copy className="h-4 w-4" />
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

