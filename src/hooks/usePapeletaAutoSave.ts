import { useCallback, useEffect, useRef } from 'react';
import axios from 'axios';

interface AutoSaveConfig {
  interval: number; // milisegundos
  maxRetries: number;
  retryDelay: number;
}

interface PapeletaVote {
  partyId: string;
  casillaNumber: number;
  timestamp: number;
}

interface AutoSaveState {
  isAutoSaving: boolean;
  lastSaveTime: number | null;
  pendingVotes: PapeletaVote[];
  error: string | null;
}

export function usePapeletaAutoSave(
  papeletaId: string | null,
  votesBuffer: PapeletaVote[],
  config: AutoSaveConfig = {
    interval: 5000, // 5 segundos
    maxRetries: 3,
    retryDelay: 1000
  }
) {
  const stateRef = useRef<AutoSaveState>({
    isAutoSaving: false,
    lastSaveTime: null,
    pendingVotes: [],
    error: null
  });

  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  // Función para guardar votos pendientes
  const savePendingVotes = useCallback(async (votes: PapeletaVote[]): Promise<boolean> => {
    if (!papeletaId || votes.length === 0) return true;

    let retries = 0;
    while (retries < config.maxRetries) {
      try {
        console.log(`🔄 [AUTO-SAVE] Guardando ${votes.length} votos en papeleta ${papeletaId}`);
        
        // Enviar todos los votos pendientes al servidor
        const response = await axios.post(`/api/papeleta/${papeletaId}/votes-batch`, {
          votes: votes
        });

        if (response.data?.success) {
          console.log('✅ [AUTO-SAVE] Votos guardados exitosamente');
          stateRef.current.lastSaveTime = Date.now();
          stateRef.current.pendingVotes = [];
          stateRef.current.error = null;
          return true;
        } else {
          throw new Error(response.data?.error || 'Error del servidor');
        }
      } catch (error: any) {
        retries++;
        console.error(`❌ [AUTO-SAVE] Intento ${retries} falló:`, error.message);
        
        if (retries < config.maxRetries) {
          // Esperar antes del siguiente intento
          await new Promise(resolve => setTimeout(resolve, config.retryDelay * retries));
        } else {
          // Fallo final
          stateRef.current.error = error.message;
          console.error('❌ [AUTO-SAVE] Fallo después de todos los reintentos');
          return false;
        }
      }
    }
    return false;
  }, [papeletaId, config.maxRetries, config.retryDelay]);

  // Función para iniciar auto-save
  const startAutoSave = useCallback(() => {
    if (intervalRef.current) return; // Ya está activo

    console.log('🚀 [AUTO-SAVE] Iniciando auto-save para papeleta:', papeletaId);
    
    intervalRef.current = setInterval(async () => {
      const currentVotes = votesBuffer;
      const pendingVotes = stateRef.current.pendingVotes;
      
      // Si hay votos nuevos que no se han guardado
      if (currentVotes.length > 0 && currentVotes.length !== pendingVotes.length) {
        stateRef.current.isAutoSaving = true;
        stateRef.current.pendingVotes = [...currentVotes];
        
        await savePendingVotes(currentVotes);
        
        stateRef.current.isAutoSaving = false;
      }
    }, config.interval);
  }, [papeletaId, votesBuffer, config.interval, savePendingVotes]);

  // Función para detener auto-save
  const stopAutoSave = useCallback(() => {
    if (intervalRef.current) {
      console.log('🛑 [AUTO-SAVE] Deteniendo auto-save');
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  // Función para forzar guardado inmediato
  const forceSave = useCallback(async (): Promise<boolean> => {
    if (!papeletaId || votesBuffer.length === 0) return true;

    stateRef.current.isAutoSaving = true;
    const success = await savePendingVotes(votesBuffer);
    stateRef.current.isAutoSaving = false;
    
    return success;
  }, [papeletaId, votesBuffer, savePendingVotes]);

  // Efecto para manejar el ciclo de vida del auto-save
  useEffect(() => {
    if (papeletaId && votesBuffer.length > 0) {
      startAutoSave();
    } else {
      stopAutoSave();
    }

    // Cleanup al desmontar
    return () => {
      stopAutoSave();
    };
  }, [papeletaId, votesBuffer.length, startAutoSave, stopAutoSave]);

  return {
    isAutoSaving: stateRef.current.isAutoSaving,
    lastSaveTime: stateRef.current.lastSaveTime,
    error: stateRef.current.error,
    forceSave,
    startAutoSave,
    stopAutoSave
  };
}
