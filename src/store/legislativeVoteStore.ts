import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { z } from 'zod';
import axios from 'axios';
import { AuditClient } from '@/lib/audit-client';

export type LegislativeVoteDelta = {
  partyId: string;
  casillaNumber: number;
  delta: number; // +1 o -1
  timestamp: number;
  clientBatchId: string;
  escrutinioId: string;
  userId?: string;
  mesaId?: string;
  gps?: { latitude: number; longitude: number; accuracy?: number };
  deviceId?: string;
};

const LegislativeVoteDeltaSchema = z.object({
  partyId: z.string().min(1),
  casillaNumber: z.number().int().min(0).max(100), // Permitir 0 para blanco/nulo
  delta: z.number().int().min(-1000).max(1000),
  timestamp: z.number(),
  clientBatchId: z.string().min(1),
});

const LegislativeVotePayloadSchema = z.object({
  escrutinioId: z.string().min(1),
  votes: z.array(LegislativeVoteDeltaSchema),
  gps: z
    .object({
      latitude: z.number(),
      longitude: z.number(),
      accuracy: z.number().optional(),
    })
    .optional(),
  deviceId: z.string().optional(),
  audit: z.any().array().optional(),
});

type State = {
  counts: Record<string, number>; // partyId_casillaNumber -> conteo
  blankCount: number; // Contador de votos en blanco
  nullCount: number; // Contador de votos nulos
  pendingVotes: LegislativeVoteDelta[]; // Votos pendientes de sincronización
  lastSyncAt?: number;
  context?: { gps?: { latitude: number; longitude: number; accuracy?: number }; deviceId?: string };
};

type Actions = {
  increment: (partyId: string, casillaNumber: number, meta: { escrutinioId: string; userId?: string; mesaId?: string; gps?: { latitude: number; longitude: number; accuracy?: number }; deviceId?: string }) => void;
  decrement: (partyId: string, casillaNumber: number, meta: { escrutinioId: string; userId?: string; mesaId?: string; gps?: { latitude: number; longitude: number; accuracy?: number }; deviceId?: string }) => void;
  incrementBlank: (meta: { escrutinioId: string; userId?: string; mesaId?: string; gps?: { latitude: number; longitude: number; accuracy?: number }; deviceId?: string }) => void;
  incrementNull: (meta: { escrutinioId: string; userId?: string; mesaId?: string; gps?: { latitude: number; longitude: number; accuracy?: number }; deviceId?: string }) => void;
  decrementBlank: (meta: { escrutinioId: string; userId?: string; mesaId?: string; gps?: { latitude: number; longitude: number; accuracy?: number }; deviceId?: string }) => void;
  decrementNull: (meta: { escrutinioId: string; userId?: string; mesaId?: string; gps?: { latitude: number; longitude: number; accuracy?: number }; deviceId?: string }) => void;
  syncPendingVotes: () => Promise<void>;
  setCounts: (counts: Record<string, number>) => void;
  clear: () => void;
  loadFromServer: (escrutinioId: string) => Promise<void>;
  getPartyCount: (partyId: string) => number;
  getCasillaCount: (partyId: string, casillaNumber: number) => number;
  pauseSync: () => void;
  resumeSync: () => void;
  isSyncPaused: () => boolean;
};

// Configuración optimizada para sincronización silenciosa (igual que presidencial)
const SYNC_INTERVAL_MS = 3000; // Auto-save cada 3 segundos
const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 1000;

let syncTimer: ReturnType<typeof setInterval> | null = null;
let isSyncPausedFlag = false;
let isSyncing = false; // Control de contrapresión
let debounceSyncTimer: ReturnType<typeof setTimeout> | null = null;

export const useLegislativeVoteStore = create<State & Actions>()(
  persist(
    (set, get) => ({
      counts: {},
      blankCount: 0,
      nullCount: 0,
      pendingVotes: [],
      lastSyncAt: undefined,
      context: undefined,

      setCounts: (counts) => set({ counts }),

      increment: (partyId, casillaNumber, meta) => {
        // Validate casillaNumber is a valid number
        const validCasillaNumber = typeof casillaNumber === 'number' && !isNaN(casillaNumber) && isFinite(casillaNumber) 
          ? casillaNumber 
          : parseInt(String(casillaNumber || '0'), 10);
        
        if (isNaN(validCasillaNumber) || !isFinite(validCasillaNumber)) {
          console.error('❌ [STORE] Invalid casillaNumber in increment:', casillaNumber, 'partyId:', partyId);
          return;
        }

        const { counts, pendingVotes } = get();
        const key = `${partyId}_${validCasillaNumber}`;
        const newCount = (counts[key] || 0) + 1;
        const clientBatchId = AuditClient.createBatchId();
        const delta: LegislativeVoteDelta = {
          partyId,
          casillaNumber: validCasillaNumber,
          delta: +1,
          timestamp: Date.now(),
          clientBatchId,
          escrutinioId: meta.escrutinioId,
          userId: meta.userId,
          mesaId: meta.mesaId,
          gps: meta.gps,
          deviceId: meta.deviceId,
        };

        // Log simple para auditoría
        AuditClient.log({
          event: 'legislative_vote_increment',
          userId: meta.userId,
          mesaId: meta.mesaId,
          escrutinioId: meta.escrutinioId,
          candidateId: `${partyId}_${casillaNumber}`, // Combinar partyId y casillaNumber
          delta: +1,
          timestamp: delta.timestamp,
          gps: meta.gps,
          deviceId: meta.deviceId,
          clientBatchId,
        });

        // Actualizar estado inmediatamente (conteo instantáneo)
        set({
          counts: { ...counts, [key]: newCount },
          pendingVotes: [...pendingVotes, delta],
          context: { gps: meta.gps, deviceId: meta.deviceId },
        });

        // Auto-save cada 3 segundos
        if (!isSyncPausedFlag) {
          startSilentSync();
          triggerImmediateSync();
        }
      },

      decrement: (partyId, casillaNumber, meta) => {
        // Validate casillaNumber is a valid number
        const validCasillaNumber = typeof casillaNumber === 'number' && !isNaN(casillaNumber) && isFinite(casillaNumber) 
          ? casillaNumber 
          : parseInt(String(casillaNumber || '0'), 10);
        
        if (isNaN(validCasillaNumber) || !isFinite(validCasillaNumber)) {
          console.error('❌ [STORE] Invalid casillaNumber in decrement:', casillaNumber, 'partyId:', partyId);
          return;
        }

        const { counts, pendingVotes } = get();
        const key = `${partyId}_${validCasillaNumber}`;
        const newCount = Math.max(0, (counts[key] || 0) - 1);
        const clientBatchId = AuditClient.createBatchId();
        const delta: LegislativeVoteDelta = {
          partyId,
          casillaNumber: validCasillaNumber,
          delta: -1,
          timestamp: Date.now(),
          clientBatchId,
          escrutinioId: meta.escrutinioId,
          userId: meta.userId,
          mesaId: meta.mesaId,
          gps: meta.gps,
          deviceId: meta.deviceId,
        };

        // Log simple para auditoría
        AuditClient.log({
          event: 'legislative_vote_decrement',
          userId: meta.userId,
          mesaId: meta.mesaId,
          escrutinioId: meta.escrutinioId,
          candidateId: `${partyId}_${casillaNumber}`, // Combinar partyId y casillaNumber
          delta: -1,
          timestamp: delta.timestamp,
          gps: meta.gps,
          deviceId: meta.deviceId,
          clientBatchId,
        });

        // Actualizar estado inmediatamente (conteo instantáneo)
        set({
          counts: { ...counts, [key]: newCount },
          pendingVotes: [...pendingVotes, delta],
          context: { gps: meta.gps, deviceId: meta.deviceId },
        });

        // Auto-save cada 3 segundos
        if (!isSyncPausedFlag) {
          startSilentSync();
          triggerImmediateSync();
        }
      },

      incrementBlank: (meta) => {
        const { blankCount, pendingVotes } = get();
        const newCount = blankCount + 1;
        const clientBatchId = AuditClient.createBatchId();
        const delta: LegislativeVoteDelta = {
          partyId: 'BLANK',
          casillaNumber: 0, // casillaNumber 0 para blanco/nulo
          delta: +1,
          timestamp: Date.now(),
          clientBatchId,
          escrutinioId: meta.escrutinioId,
          userId: meta.userId,
          mesaId: meta.mesaId,
          gps: meta.gps,
          deviceId: meta.deviceId,
        };

        // Log para auditoría
        AuditClient.log({
          event: 'legislative_blank_increment',
          userId: meta.userId,
          mesaId: meta.mesaId,
          escrutinioId: meta.escrutinioId,
          candidateId: 'BLANK_0',
          delta: +1,
          timestamp: delta.timestamp,
          gps: meta.gps,
          deviceId: meta.deviceId,
          clientBatchId,
        });

        set({
          blankCount: newCount,
          pendingVotes: [...pendingVotes, delta],
          context: { gps: meta.gps, deviceId: meta.deviceId },
        });

        if (!isSyncPausedFlag) {
          startSilentSync();
          triggerImmediateSync();
        }
      },

      incrementNull: (meta) => {
        const { nullCount, pendingVotes } = get();
        const newCount = nullCount + 1;
        const clientBatchId = AuditClient.createBatchId();
        const delta: LegislativeVoteDelta = {
          partyId: 'NULL',
          casillaNumber: 0, // casillaNumber 0 para blanco/nulo
          delta: +1,
          timestamp: Date.now(),
          clientBatchId,
          escrutinioId: meta.escrutinioId,
          userId: meta.userId,
          mesaId: meta.mesaId,
          gps: meta.gps,
          deviceId: meta.deviceId,
        };

        // Log para auditoría
        AuditClient.log({
          event: 'legislative_null_increment',
          userId: meta.userId,
          mesaId: meta.mesaId,
          escrutinioId: meta.escrutinioId,
          candidateId: 'NULL_0',
          delta: +1,
          timestamp: delta.timestamp,
          gps: meta.gps,
          deviceId: meta.deviceId,
          clientBatchId,
        });

        set({
          nullCount: newCount,
          pendingVotes: [...pendingVotes, delta],
          context: { gps: meta.gps, deviceId: meta.deviceId },
        });

        if (!isSyncPausedFlag) {
          startSilentSync();
          triggerImmediateSync();
        }
      },

      decrementBlank: (meta) => {
        const { blankCount, pendingVotes } = get();
        const newCount = Math.max(0, blankCount - 1);
        const clientBatchId = AuditClient.createBatchId();
        const delta: LegislativeVoteDelta = {
          partyId: 'BLANK',
          casillaNumber: 0,
          delta: -1,
          timestamp: Date.now(),
          clientBatchId,
          escrutinioId: meta.escrutinioId,
          userId: meta.userId,
          mesaId: meta.mesaId,
          gps: meta.gps,
          deviceId: meta.deviceId,
        };

        AuditClient.log({
          event: 'legislative_blank_decrement',
          userId: meta.userId,
          mesaId: meta.mesaId,
          escrutinioId: meta.escrutinioId,
          candidateId: 'BLANK_0',
          delta: -1,
          timestamp: delta.timestamp,
          gps: meta.gps,
          deviceId: meta.deviceId,
          clientBatchId,
        });

        set({
          blankCount: newCount,
          pendingVotes: [...pendingVotes, delta],
          context: { gps: meta.gps, deviceId: meta.deviceId },
        });

        if (!isSyncPausedFlag) {
          startSilentSync();
          triggerImmediateSync();
        }
      },

      decrementNull: (meta) => {
        const { nullCount, pendingVotes } = get();
        const newCount = Math.max(0, nullCount - 1);
        const clientBatchId = AuditClient.createBatchId();
        const delta: LegislativeVoteDelta = {
          partyId: 'NULL',
          casillaNumber: 0,
          delta: -1,
          timestamp: Date.now(),
          clientBatchId,
          escrutinioId: meta.escrutinioId,
          userId: meta.userId,
          mesaId: meta.mesaId,
          gps: meta.gps,
          deviceId: meta.deviceId,
        };

        AuditClient.log({
          event: 'legislative_null_decrement',
          userId: meta.userId,
          mesaId: meta.mesaId,
          escrutinioId: meta.escrutinioId,
          candidateId: 'NULL_0',
          delta: -1,
          timestamp: delta.timestamp,
          gps: meta.gps,
          deviceId: meta.deviceId,
          clientBatchId,
        });

        set({
          nullCount: newCount,
          pendingVotes: [...pendingVotes, delta],
          context: { gps: meta.gps, deviceId: meta.deviceId },
        });

        if (!isSyncPausedFlag) {
          startSilentSync();
          triggerImmediateSync();
        }
      },

      syncPendingVotes: async () => {
        const { pendingVotes, context } = get();
        if (pendingVotes.length === 0) return;

        // Agrupar votos por escrutinio
        const votesByEscrutinio = pendingVotes.reduce((acc, vote) => {
          if (!acc[vote.escrutinioId]) {
            acc[vote.escrutinioId] = [];
          }
          acc[vote.escrutinioId].push(vote);
          return acc;
        }, {} as Record<string, LegislativeVoteDelta[]>);

        // Sincronizar cada escrutinio
        for (const [escrutinioId, votes] of Object.entries(votesByEscrutinio)) {
          await syncLegislativeVotesForEscrutinio(escrutinioId, votes, context);
        }
      },

      loadFromServer: async (escrutinioId: string) => {
        try {
          const token = localStorage.getItem('auth-token');
          const response = await axios.get(`/api/escrutinio/${encodeURIComponent(escrutinioId)}/votes`, {
            headers: { 'Authorization': `Bearer ${token}` }
          });
          if (response.data?.success && response.data.data) {
            const serverCounts = response.data.data.reduce((acc: Record<string, number>, vote: any) => {
              // Para votos legislativos, necesitamos mapear candidateId a partyId_casillaNumber
              if (vote.candidate && vote.candidate.electionLevel === 'LEGISLATIVE') {
                // Manejar votos blanco/nulo (party BLANK o NULL, number 999 o 998)
                if (vote.candidate.party === 'BLANK' || vote.candidate.party === 'NULL') {
                  // Estos se manejan por separado con blankCount y nullCount
                  return acc;
                }
                const key = `${vote.candidate.party}_${vote.candidate.number}`;
                acc[key] = vote.count;
              }
              return acc;
            }, {});
            
            // Cargar votos blanco/nulo
            let blankCount = 0;
            let nullCount = 0;
            response.data.data.forEach((vote: any) => {
              if (vote.candidate && vote.candidate.electionLevel === 'LEGISLATIVE') {
                if (vote.candidate.party === 'BLANK') {
                  blankCount = vote.count;
                } else if (vote.candidate.party === 'NULL') {
                  nullCount = vote.count;
                }
              }
            });
            
            // Solo actualizar si los counts realmente cambiaron
            const currentCounts = get().counts;
            const hasChanges = Object.keys(serverCounts).some(key => 
              serverCounts[key] !== currentCounts[key]
            ) || Object.keys(currentCounts).some(key => 
              !(key in serverCounts)
            ) || get().blankCount !== blankCount || get().nullCount !== nullCount;

            if (hasChanges) {
              set({ 
                counts: serverCounts, 
                blankCount,
                nullCount,
                pendingVotes: [] 
              });
            } else {
              // Solo limpiar pendingVotes si no hay cambios en counts
              set({ pendingVotes: [] });
            }
          }
        } catch (error) {
          console.warn('No se pudieron cargar votos legislativos del servidor:', error);
        }
      },

      getPartyCount: (partyId: string) => {
        const { counts } = get();
        return Object.entries(counts)
          .filter(([key]) => key.startsWith(`${partyId}_`))
          .reduce((sum, [, count]) => sum + count, 0);
      },

      getCasillaCount: (partyId: string, casillaNumber: number) => {
        const { counts } = get();
        const key = `${partyId}_${casillaNumber}`;
        return counts[key] || 0;
      },

      pauseSync: () => {
        isSyncPausedFlag = true;
        console.log('⏸️ [STORE VOTOS LEGISLATIVOS] Auto-sync pausado');
      },

      resumeSync: () => {
        isSyncPausedFlag = false;
        console.log('▶️ [STORE VOTOS LEGISLATIVOS] Auto-sync reanudado');
        // Reanudar sync si hay votos pendientes
        const { pendingVotes } = get();
        if (pendingVotes.length > 0) {
          startSilentSync();
        }
      },

      isSyncPaused: () => isSyncPausedFlag,

      clear: () => set({ 
        counts: {}, 
        blankCount: 0,
        nullCount: 0,
        pendingVotes: [], 
        lastSyncAt: undefined,
        context: undefined 
      }),
    }),
    {
      name: 'legislative-vote-store-v1',
      partialize: (state) => ({ 
        counts: state.counts,
        blankCount: state.blankCount,
        nullCount: state.nullCount,
        pendingVotes: state.pendingVotes,
        lastSyncAt: state.lastSyncAt,
        context: state.context
      }),
    }
  )
);

// Función para sincronizar votos legislativos de un escrutinio específico (auto-save silencioso)
async function syncLegislativeVotesForEscrutinio(
  escrutinioId: string, 
  votes: LegislativeVoteDelta[], 
  context?: { gps?: { latitude: number; longitude: number; accuracy?: number }; deviceId?: string }
) {
  const auditEvents = AuditClient.drain();
  
  // Filter out votes with invalid casillaNumber before syncing
  const validVotes = votes.filter(v => {
    const casillaNumber = typeof v.casillaNumber === 'number' && !isNaN(v.casillaNumber) && isFinite(v.casillaNumber)
      ? v.casillaNumber
      : parseInt(String(v.casillaNumber || '0'), 10);
    
    const isValid = !isNaN(casillaNumber) && isFinite(casillaNumber) && typeof v.partyId === 'string' && v.partyId.length > 0;
    
    if (!isValid) {
      console.error('❌ [SYNC] Filtering out invalid vote:', {
        partyId: v.partyId,
        casillaNumber: v.casillaNumber,
        originalCasillaNumber: v.casillaNumber
      });
    }
    
    return isValid;
  });

  if (validVotes.length === 0) {
    console.warn('⚠️ [SYNC] No valid votes to sync after filtering');
    AuditClient.restore(auditEvents as any);
    return;
  }

  const payload = {
    escrutinioId,
    votes: validVotes.map(v => {
      // Ensure casillaNumber is a valid number
      const casillaNumber = typeof v.casillaNumber === 'number' && !isNaN(v.casillaNumber) && isFinite(v.casillaNumber)
        ? v.casillaNumber
        : parseInt(String(v.casillaNumber || '0'), 10);
      
      return {
        partyId: v.partyId,
        casillaNumber: casillaNumber,
        delta: v.delta,
        timestamp: v.timestamp,
        clientBatchId: v.clientBatchId,
      };
    }),
    audit: auditEvents,
    gps: context?.gps,
    deviceId: context?.deviceId,
  };

  const parsed = LegislativeVotePayloadSchema.safeParse(payload);
  if (!parsed.success) {
    console.error('❌ Error de validación en votos legislativos:', parsed.error);
    AuditClient.restore(auditEvents as any);
    return;
  }

  let retries = 0;
  while (retries < MAX_RETRIES) {
    try {
      // Obtener token de autenticación
      const token = localStorage.getItem('auth-token');
      if (!token) {
        console.error('❌ No hay token de autenticación para sincronizar votos');
        return;
      }

      const response = await axios.post(`/api/escrutinio/${encodeURIComponent(escrutinioId)}/legislative-votes`, payload, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      console.log('✅ [LEGISLATIVO-SYNC] Votos guardados exitosamente:', {
        votesCount: votes.length,
        escrutinioId,
        response: response.data
      });
      
      // Éxito: remover votos sincronizados del estado
      const { pendingVotes } = useLegislativeVoteStore.getState();
      const syncedVoteIds = new Set(votes.map(v => v.clientBatchId));
      const remainingVotes = pendingVotes.filter(v => !syncedVoteIds.has(v.clientBatchId));
      
      useLegislativeVoteStore.setState({ 
        pendingVotes: remainingVotes,
        lastSyncAt: Date.now()
      });
      
      return; // Éxito, salir del loop de reintentos
    } catch (error: any) {
      retries++;
      
      console.error(`❌ [LEGISLATIVO-SYNC] Error en intento ${retries}/${MAX_RETRIES}:`, {
        message: error?.message,
        response: error?.response?.data,
        status: error?.response?.status,
        escrutinioId
      });
      
      if (retries < MAX_RETRIES) {
        // Esperar antes del siguiente intento
        console.log(`⏳ [LEGISLATIVO-SYNC] Reintentando en ${RETRY_DELAY_MS * retries}ms...`);
        await new Promise(resolve => setTimeout(resolve, RETRY_DELAY_MS * retries));
      } else {
        // Fallo final: restaurar eventos de auditoría para reintento posterior
        AuditClient.restore(auditEvents as any);
        console.error('❌ [LEGISLATIVO-SYNC] Error en auto-save legislativo después de reintentos', {
          lastError: error?.response?.data || error?.message,
          votesCount: votes.length
        });
      }
    }
  }
}

// Función para sincronizar inmediatamente con debounce
function triggerImmediateSync() {
  // Si está pausado, no hacer nada
  if (isSyncPausedFlag) {
    console.log('⏸️ [LEGISLATIVO] Sync pausado, no se dispara sync inmediato');
    return;
  }

  // Cancelar cualquier sync pendiente
  if (debounceSyncTimer) {
    clearTimeout(debounceSyncTimer);
  }

  // Programar nuevo sync después de 500ms
  debounceSyncTimer = setTimeout(async () => {
    const { pendingVotes } = useLegislativeVoteStore.getState();
    if (pendingVotes.length === 0) return;

    // Verificar backpressure
    if (isSyncing) {
      console.log('⏸️ [LEGISLATIVO] Sync anterior en progreso, reintentando en 1s...');
      setTimeout(triggerImmediateSync, 1000);
      return;
    }

    console.log('🚀 [LEGISLATIVO IMMEDIATE SYNC] Sincronizando votos inmediatamente');
    isSyncing = true;
    try {
      await useLegislativeVoteStore.getState().syncPendingVotes();
    } finally {
      isSyncing = false;
    }
  }, 500);
}

// Función para iniciar sincronización silenciosa
function startSilentSync() {
  if (syncTimer || isSyncPausedFlag) return; // Ya está activa o está pausado
  
  syncTimer = setInterval(async () => {
    // Verificar si está pausado antes de sincronizar
    if (isSyncPausedFlag) {
      if (syncTimer) {
        clearInterval(syncTimer);
        syncTimer = null;
      }
      return;
    }

    // Backpressure control: no sincronizar si ya hay un sync en progreso
    if (isSyncing) {
      console.log('⏸️ [LEGISLATIVO] Sync anterior aún en progreso, saltando este ciclo...');
      return;
    }

    const { pendingVotes } = useLegislativeVoteStore.getState();
    if (pendingVotes.length === 0) {
      // No hay votos pendientes, detener timer
      if (syncTimer) {
        clearInterval(syncTimer);
        syncTimer = null;
      }
      return;
    }
    
    isSyncing = true;
    try {
      await useLegislativeVoteStore.getState().syncPendingVotes();
    } finally {
      isSyncing = false;
    }
  }, SYNC_INTERVAL_MS);
}
