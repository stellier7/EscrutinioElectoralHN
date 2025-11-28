import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { z } from 'zod';
import axios from 'axios';
import { AuditClient } from '@/lib/audit-client';

export type CandidateDisplay = {
  id: string;
  name: string;
  party: string;
  partyColor?: string;
  number?: string | number;
};

export type VoteDelta = {
  candidateId: string;
  delta: number; // +1 o -1
  timestamp: number;
  clientBatchId: string;
  escrutinioId: string;
  userId?: string;
  mesaId?: string;
  gps?: { latitude: number; longitude: number; accuracy?: number };
  deviceId?: string;
};

const VoteDeltaSchema = z.object({
  candidateId: z.string().min(1),
  delta: z.number().int().min(-1000).max(1000),
  timestamp: z.number(),
  clientBatchId: z.string().min(1),
});

const VotePayloadSchema = z.object({
  escrutinioId: z.string().min(1),
  votes: z.array(VoteDeltaSchema),
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
  counts: Record<string, number>;
  pendingVotes: VoteDelta[]; // Votos pendientes de sincronización
  lastSyncAt?: number;
  context?: { gps?: { latitude: number; longitude: number; accuracy?: number }; deviceId?: string };
};

type Actions = {
  increment: (candidateId: string, meta: { escrutinioId: string; userId?: string; mesaId?: string; gps?: { latitude: number; longitude: number; accuracy?: number }; deviceId?: string }) => void;
  decrement: (candidateId: string, meta: { escrutinioId: string; userId?: string; mesaId?: string; gps?: { latitude: number; longitude: number; accuracy?: number }; deviceId?: string }) => void;
  syncPendingVotes: () => Promise<void>;
  setCounts: (counts: Record<string, number>) => void;
  clear: () => void;
  loadFromServer: (escrutinioId: string) => Promise<void>;
  pauseSync: () => void;
  resumeSync: () => void;
  isSyncPaused: () => boolean;
};

// Configuración optimizada para sincronización silenciosa
const SYNC_INTERVAL_MS = 3000; // Auto-save cada 3 segundos
const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 1000;

let syncTimer: ReturnType<typeof setInterval> | null = null;
let isSyncPausedFlag = false;
let isSyncing = false; // Control de contrapresión
let debounceSyncTimer: ReturnType<typeof setTimeout> | null = null;

export const useVoteStore = create<State & Actions>()(
  persist(
    (set, get) => ({
      counts: {},
      pendingVotes: [],
      lastSyncAt: undefined,
      context: undefined,

      setCounts: (counts) => set({ counts }),

      increment: (candidateId, meta) => {
        const { counts, pendingVotes } = get();
        const newCount = (counts[candidateId] || 0) + 1;
        const clientBatchId = AuditClient.createBatchId();
        const delta: VoteDelta = {
          candidateId,
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
          event: 'vote_increment',
          userId: meta.userId,
          mesaId: meta.mesaId,
          escrutinioId: meta.escrutinioId,
          candidateId,
          delta: +1,
          timestamp: delta.timestamp,
          gps: meta.gps,
          deviceId: meta.deviceId,
          clientBatchId,
        });

        // Actualizar estado inmediatamente (conteo instantáneo)
        set({
          counts: { ...counts, [candidateId]: newCount },
          pendingVotes: [...pendingVotes, delta],
          context: { gps: meta.gps, deviceId: meta.deviceId },
        });

        // Auto-save cada 3 segundos (solo si no está pausado)
        if (!isSyncPausedFlag) {
          startSilentSync();
          triggerImmediateSync();
        }
      },

      decrement: (candidateId, meta) => {
        const { counts, pendingVotes } = get();
        const newCount = Math.max(0, (counts[candidateId] || 0) - 1);
        const clientBatchId = AuditClient.createBatchId();
        const delta: VoteDelta = {
          candidateId,
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
          event: 'vote_decrement',
          userId: meta.userId,
          mesaId: meta.mesaId,
          escrutinioId: meta.escrutinioId,
          candidateId,
          delta: -1,
          timestamp: delta.timestamp,
          gps: meta.gps,
          deviceId: meta.deviceId,
          clientBatchId,
        });

        // Actualizar estado inmediatamente (conteo instantáneo)
        set({
          counts: { ...counts, [candidateId]: newCount },
          pendingVotes: [...pendingVotes, delta],
          context: { gps: meta.gps, deviceId: meta.deviceId },
        });

        // Auto-save cada 3 segundos (solo si no está pausado)
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
        }, {} as Record<string, VoteDelta[]>);

        // Sincronizar cada escrutinio
        for (const [escrutinioId, votes] of Object.entries(votesByEscrutinio)) {
          await syncVotesForEscrutinio(escrutinioId, votes, context);
        }
      },

      loadFromServer: async (escrutinioId: string) => {
        try {
          const token = localStorage.getItem('auth-token');
          const response = await axios.get(`/api/escrutinio/${encodeURIComponent(escrutinioId)}/votes`, {
            headers: {
              'Authorization': `Bearer ${token}`
            }
          });
          if (response.data?.success && response.data.data) {
            console.log('📊 [STORE PRESIDENCIAL] Votos cargados del servidor:', response.data.data);
            const serverCounts = response.data.data.reduce((acc: Record<string, number>, vote: any) => {
              // Mapear candidatos especiales de vuelta a BLANK_VOTE y NULL_VOTE
              let candidateId = vote.candidateId;
              if (vote.candidate) {
                if (vote.candidate.name === 'Voto en Blanco' || vote.candidate.party === 'BLANK') {
                  candidateId = 'BLANK_VOTE';
                } else if (vote.candidate.name === 'Voto Nulo' || vote.candidate.party === 'NULL') {
                  candidateId = 'NULL_VOTE';
                }
              }
              acc[candidateId] = vote.count;
              return acc;
            }, {});
            console.log('📊 [STORE PRESIDENCIAL] Conteos procesados:', serverCounts);
            
            // Solo actualizar si los counts realmente cambiaron
            const currentCounts = get().counts;
            const hasChanges = Object.keys(serverCounts).some(key => 
              serverCounts[key] !== currentCounts[key]
            ) || Object.keys(currentCounts).some(key => 
              !(key in serverCounts)
            );

            if (hasChanges) {
              set({ counts: serverCounts, pendingVotes: [] });
            } else {
              // Solo limpiar pendingVotes si no hay cambios en counts
              set({ pendingVotes: [] });
            }
          }
        } catch (error) {
          console.warn('No se pudieron cargar votos del servidor:', error);
        }
      },

      clear: () => set({ 
        counts: {}, 
        pendingVotes: [], 
        lastSyncAt: undefined,
        context: undefined 
      }),

      pauseSync: () => {
        isSyncPausedFlag = true;
        console.log('⏸️ [STORE VOTOS] Auto-sync pausado');
      },

      resumeSync: () => {
        isSyncPausedFlag = false;
        console.log('▶️ [STORE VOTOS] Auto-sync reanudado');
        // Reanudar sync si hay votos pendientes
        const { pendingVotes } = get();
        if (pendingVotes.length > 0) {
          startSilentSync();
        }
      },

      isSyncPaused: () => isSyncPausedFlag,
    }),
    {
      name: 'vote-store-v2',
      partialize: (state) => ({ 
        counts: state.counts, 
        pendingVotes: state.pendingVotes,
        lastSyncAt: state.lastSyncAt,
        context: state.context
      }),
    }
  )
);

// Función para sincronizar votos de un escrutinio específico (auto-save silencioso)
async function syncVotesForEscrutinio(
  escrutinioId: string, 
  votes: VoteDelta[], 
  context?: { gps?: { latitude: number; longitude: number; accuracy?: number }; deviceId?: string }
) {
  const auditEvents = AuditClient.drain();
  const payload = {
    escrutinioId,
    votes: votes.map(v => ({
      candidateId: v.candidateId,
      delta: v.delta,
      timestamp: v.timestamp,
      clientBatchId: v.clientBatchId,
    })),
    audit: auditEvents,
    gps: context?.gps,
    deviceId: context?.deviceId,
  };

  const parsed = VotePayloadSchema.safeParse(payload);
  if (!parsed.success) {
    console.error('❌ Error de validación en votos:', parsed.error);
    AuditClient.restore(auditEvents as any);
    return;
  }

  let retries = 0;
  while (retries < MAX_RETRIES) {
    try {
      await axios.post(`/api/escrutinio/${encodeURIComponent(escrutinioId)}/votes`, payload);
      
      // Éxito: remover votos sincronizados del estado
      const { pendingVotes } = useVoteStore.getState();
      const syncedVoteIds = new Set(votes.map(v => v.clientBatchId));
      const remainingVotes = pendingVotes.filter(v => !syncedVoteIds.has(v.clientBatchId));
      
      useVoteStore.setState({ 
        pendingVotes: remainingVotes,
        lastSyncAt: Date.now()
      });
      
      return; // Éxito, salir del loop de reintentos
    } catch (error: any) {
      retries++;
      
      if (retries < MAX_RETRIES) {
        // Esperar antes del siguiente intento
        await new Promise(resolve => setTimeout(resolve, RETRY_DELAY_MS * retries));
      } else {
        // Fallo final: restaurar eventos de auditoría para reintento posterior
        AuditClient.restore(auditEvents as any);
        console.error('❌ Error en auto-save después de reintentos');
      }
    }
  }
}

// Función para sincronizar inmediatamente con debounce
function triggerImmediateSync() {
  // Si está pausado, no hacer nada
  if (isSyncPausedFlag) {
    console.log('⏸️ Sync pausado, no se dispara sync inmediato');
    return;
  }

  // Cancelar cualquier sync pendiente
  if (debounceSyncTimer) {
    clearTimeout(debounceSyncTimer);
  }

  // Programar nuevo sync después de 500ms
  debounceSyncTimer = setTimeout(async () => {
    const { pendingVotes } = useVoteStore.getState();
    if (pendingVotes.length === 0) return;

    // Verificar backpressure
    if (isSyncing) {
      console.log('⏸️ Sync anterior en progreso, reintentando en 1s...');
      setTimeout(triggerImmediateSync, 1000);
      return;
    }

    console.log('🚀 [IMMEDIATE SYNC] Sincronizando votos inmediatamente');
    isSyncing = true;
    try {
      await useVoteStore.getState().syncPendingVotes();
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
      console.log('⏸️ Sync anterior aún en progreso, saltando este ciclo...');
      return;
    }

    const { pendingVotes } = useVoteStore.getState();
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
      await useVoteStore.getState().syncPendingVotes();
    } finally {
      isSyncing = false;
    }
  }, SYNC_INTERVAL_MS);
}

