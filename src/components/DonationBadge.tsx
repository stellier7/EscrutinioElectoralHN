'use client';

import React, { useState, useEffect, useRef } from 'react';
import { usePathname } from 'next/navigation';
import { Heart } from 'lucide-react';
import DonationModal from './DonationModal';

export default function DonationBadge() {
  const [showModal, setShowModal] = useState(false);
  const [isVisible, setIsVisible] = useState(true);
  const [isScrolling, setIsScrolling] = useState(false);
  const pathname = usePathname();
  const scrollTimerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    // Ocultar badge en rutas de escrutinios y admin
    const shouldHide = 
      pathname?.includes('/escrutinio') || 
      pathname?.startsWith('/admin');
    
    setIsVisible(!shouldHide);
  }, [pathname]);

  useEffect(() => {
    if (!isVisible) return;

    const handleScroll = () => {
      // Mostrar texto al hacer scroll
      setIsScrolling(true);

      // Limpiar timer anterior
      if (scrollTimerRef.current) {
        clearTimeout(scrollTimerRef.current);
      }

      // Cuando termine el scroll (sin movimiento por 1000ms), volver al corazón solo
      scrollTimerRef.current = setTimeout(() => {
        setIsScrolling(false);
      }, 1000);
    };

    window.addEventListener('scroll', handleScroll, { passive: true });

    return () => {
      window.removeEventListener('scroll', handleScroll);
      if (scrollTimerRef.current) {
        clearTimeout(scrollTimerRef.current);
      }
    };
  }, [isVisible]);

  if (!isVisible) return null;

  return (
    <>
      <button
        onClick={() => setShowModal(true)}
        className="fixed top-6 right-6 rounded-full flex items-center justify-center shadow-2xl hover:bg-primary-700 z-50 hover:scale-105 active:scale-95 overflow-hidden bg-primary-600 text-white"
        aria-label="Apoya el proyecto con una donación"
        style={{
          boxShadow: '0 4px 12px rgba(37, 99, 235, 0.3)',
          width: isScrolling ? 'auto' : '44px',
          height: '44px',
          paddingLeft: isScrolling ? '20px' : '0px',
          paddingRight: isScrolling ? '20px' : '0px',
          paddingTop: isScrolling ? '12px' : '0px',
          paddingBottom: isScrolling ? '12px' : '0px',
          gap: isScrolling ? '8px' : '0px',
          transition: isScrolling 
            ? 'all 0.5s cubic-bezier(0.4, 0, 0.2, 1)' 
            : 'all 0.8s cubic-bezier(0.4, 0, 0.2, 1)',
        }}
      >
        <Heart className="h-5 w-5 flex-shrink-0" />
        <span
          className="text-sm font-semibold whitespace-nowrap overflow-hidden"
          style={{
            opacity: isScrolling ? 1 : 0,
            maxWidth: isScrolling ? '200px' : '0px',
            width: isScrolling ? 'auto' : '0px',
            transition: isScrolling
              ? 'opacity 0.4s ease-in-out, max-width 0.5s cubic-bezier(0.4, 0, 0.2, 1), width 0.5s cubic-bezier(0.4, 0, 0.2, 1)'
              : 'opacity 0.6s ease-in-out, max-width 0.8s cubic-bezier(0.4, 0, 0.2, 1), width 0.8s cubic-bezier(0.4, 0, 0.2, 1)',
          }}
        >
          ¡Apoya el Proyecto!
        </span>
      </button>

      {showModal && (
        <DonationModal onClose={() => setShowModal(false)} />
      )}
    </>
  );
}

