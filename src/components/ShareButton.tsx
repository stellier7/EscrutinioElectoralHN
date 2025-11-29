'use client';

import React, { useState } from 'react';
import { Share2, Check } from 'lucide-react';

interface ShareButtonProps {
  videoType: 'demo' | 'news';
  videoUrl: string;
}

export default function ShareButton({ videoType, videoUrl }: ShareButtonProps) {
  const [copied, setCopied] = useState(false);

  const handleShare = async () => {
    const videoTitle = videoType === 'demo'
      ? 'Demo de Escrutinio Transparente'
      : 'Escrutinio Transparente en las Noticias';

    const shareData = {
      title: videoTitle,
      text: `Mira este video: ${videoTitle}`,
      url: videoUrl,
    };

    try {
      // Intentar usar la Web Share API nativa (funciona en iOS y Android)
      if (navigator.share && navigator.canShare && navigator.canShare(shareData)) {
        await navigator.share(shareData);
      } else {
        // Fallback: copiar al portapapeles
        await navigator.clipboard.writeText(videoUrl);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }
    } catch (err) {
      // Si el usuario cancela o hay error, intentar copiar
      if (err instanceof Error && err.name !== 'AbortError') {
        try {
          await navigator.clipboard.writeText(videoUrl);
          setCopied(true);
          setTimeout(() => setCopied(false), 2000);
        } catch (clipboardErr) {
          console.error('Error al copiar:', clipboardErr);
        }
      }
    }
  };

  return (
    <button
      onClick={handleShare}
      className="absolute bottom-4 right-4 bg-black/70 hover:bg-black/90 text-white p-3 rounded-full shadow-lg transition-all duration-200 z-10 flex items-center justify-center group"
      aria-label="Compartir video"
      style={{
        backdropFilter: 'blur(4px)',
      }}
    >
      {copied ? (
        <Check className="h-5 w-5 group-hover:scale-110 transition-transform" />
      ) : (
        <Share2 className="h-5 w-5 group-hover:scale-110 transition-transform" />
      )}
    </button>
  );
}

