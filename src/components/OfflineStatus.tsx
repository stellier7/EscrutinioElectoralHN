'use client';

import React from 'react';
import { useOfflineQueue } from '@/hooks/useOfflineQueue';

// Componente simple para mostrar el estado offline
export function OfflineStatus() {
  const { isOnline, pendingItems, isProcessing, processQueue, clearQueue } = useOfflineQueue();

  // No mostrar nada si todo está bien
  if (isOnline && pendingItems === 0) {
    return null;
  }

  return (
    <div className="fixed bottom-4 left-4 right-4 z-50 md:left-auto md:right-4 md:max-w-sm">
      {!isOnline ? (
        // Sin conexión
        <div className="bg-red-500 text-white p-4 rounded-lg shadow-lg">
          <div className="flex items-center">
            <div className="w-3 h-3 bg-red-200 rounded-full mr-3 animate-pulse"></div>
            <div className="flex-1">
              <p className="font-semibold">Sin conexión a internet</p>
              <p className="text-sm opacity-90">
                {pendingItems > 0 
                  ? `${pendingItems} acciones guardadas para cuando regrese la conexión`
                  : 'Tus datos se guardarán automáticamente'
                }
              </p>
            </div>
          </div>
        </div>
      ) : pendingItems > 0 ? (
        // Con conexión pero hay items pendientes
        <div className="bg-yellow-500 text-white p-4 rounded-lg shadow-lg">
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <div className="w-3 h-3 bg-yellow-200 rounded-full mr-3">
                {isProcessing && (
                  <div className="w-3 h-3 bg-yellow-200 rounded-full animate-ping"></div>
                )}
              </div>
              <div>
                <p className="font-semibold">
                  {isProcessing ? 'Sincronizando...' : 'Pendiente de sincronizar'}
                </p>
                <p className="text-sm opacity-90">
                  {pendingItems} {pendingItems === 1 ? 'acción' : 'acciones'} pendientes
                </p>
              </div>
            </div>
            
            <div className="flex space-x-2">
              <button
                onClick={processQueue}
                disabled={isProcessing}
                className="px-3 py-1 bg-yellow-600 rounded text-sm hover:bg-yellow-700 disabled:opacity-50"
              >
                {isProcessing ? '...' : 'Sincronizar'}
              </button>
              
              <button
                onClick={clearQueue}
                disabled={isProcessing}
                className="px-3 py-1 bg-yellow-600 rounded text-sm hover:bg-yellow-700 disabled:opacity-50"
              >
                Limpiar
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
