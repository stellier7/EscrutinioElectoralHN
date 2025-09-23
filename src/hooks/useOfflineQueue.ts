'use client';

import { useState, useEffect } from 'react';
import { offlineQueue, type OfflineQueueStatus } from '@/lib/offline-queue';

// Hook simple para usar el sistema offline en componentes
export function useOfflineQueue() {
  const [status, setStatus] = useState<OfflineQueueStatus>({
    isOnline: true,
    pendingItems: 0,
    isProcessing: false,
  });

  // Actualizar estado cada segundo cuando hay items pendientes
  useEffect(() => {
    const updateStatus = () => {
      setStatus(offlineQueue.getStatus());
    };

    // Actualizar inmediatamente
    updateStatus();

    // Actualizar periódicamente si hay items pendientes
    const interval = setInterval(() => {
      const currentStatus = offlineQueue.getStatus();
      setStatus(currentStatus);
      
      // Solo actualizar cada segundo si hay items pendientes
      if (currentStatus.pendingItems === 0) {
        clearInterval(interval);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [status.pendingItems]);

  // Función simple para agregar items
  const addToQueue = (action: string, data: any): string => {
    return offlineQueue.addToQueue(action, data);
  };

  // Función para procesar cola manualmente
  const processQueue = async (): Promise<void> => {
    await offlineQueue.processQueue();
    setStatus(offlineQueue.getStatus());
  };

  // Función para limpiar cola
  const clearQueue = (): void => {
    offlineQueue.clearQueue();
    setStatus(offlineQueue.getStatus());
  };

  return {
    // Estado
    isOnline: status.isOnline,
    pendingItems: status.pendingItems,
    isProcessing: status.isProcessing,
    
    // Acciones
    addToQueue,
    processQueue,
    clearQueue,
    
    // Utilidades
    hasOfflineItems: status.pendingItems > 0,
    isOfflineMode: !status.isOnline && status.pendingItems > 0,
  };
}
