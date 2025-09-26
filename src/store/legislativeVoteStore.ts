import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { z } from 'zod';
import axios from 'axios';
import { AuditClient } from '@/lib/audit-client';

export type LegislativeVoteDelta = {
  partyId: string;
  casillaNumber: number;
  delta: number; // +1 or -1
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
  casillaNumber: z.number().int().min(1).max(100),
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
  counts: Record<string, number>; // partyId_casillaNumber -> count
  pendingVotes: LegislativeVoteDelta[]; // Votos pendientes de sincronización
  lastSyncAt?: number;
  context?: { gps?: { latitude: number; longitude: number; accuracy?: number }; deviceId?: string };
};

type Actions = {
  increment: (partyId: string, casillaNumber: number, meta: { escrutinioId: string; userId?: string; mesaId?: string; gps?: { latitude: number; longitude: number; accuracy?: number }; deviceId?: string }) => void;
  decrement: (partyId: string, casillaNumber: number, meta: { escrutinioId: string; userId?: string; mesaId?: string; gps?: { latitude: number; longitude: number; accuracy?: number }; deviceId?: string }) => void;
  syncPendingVotes: () => Promise<void>;
  setCounts: (counts: Record<string, number>) => void;
  clear: () => void;
  loadFromServer: (escrutinioId: string) => Promise<void>;
  getPartyCount: (partyId: string) => number;
  getCasillaCount: (partyId: string, casillaNumber: number) => number;
};

// Configuración optimizada para sincronización silenciosa (igual que presidencial)
const SYNC_INTERVAL_MS = 3000; // Auto-save cada 3 segundos
const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 1000;

let syncTimer: ReturnType<typeof setInterval> | null = null;

export const useLegislativeVoteStore = create<State & Actions>()(
  persist(
    (set, get) => ({
      counts: {},
      pendingVotes: [],
      lastSyncAt: undefined,
      context: undefined,

      setCounts: (counts) => set({ counts }),

      increment: (partyId, casillaNumber, meta) => {
        const { counts, pendingVotes } = get();
        const key = `${partyId}_${casillaNumber}`;
        const newCount = (counts[key] || 0) + 1;
        const clientBatchId = AuditClient.createBatchId();
        const delta: LegislativeVoteDelta = {
          partyId,
          casillaNumber,
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
        startSilentSync();
      },

      decrement: (partyId, casillaNumber, meta) => {
        const { counts, pendingVotes } = get();
        const key = `${partyId}_${casillaNumber}`;
        const newCount = Math.max(0, (counts[key] || 0) - 1);
        const clientBatchId = AuditClient.createBatchId();
        const delta: LegislativeVoteDelta = {
          partyId,
          casillaNumber,
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
        startSilentSync();
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
          const token = localStorage.getItem('token');
          const response = await axios.get(`/api/escrutinio/${encodeURIComponent(escrutinioId)}/votes`, {
            headers: { 'Authorization': `Bearer ${token}` }
          });
          if (response.data?.success && response.data.data) {
            const serverCounts = response.data.data.reduce((acc: Record<string, number>, vote: any) => {
              // Para votos legislativos, necesitamos mapear candidateId a partyId_casillaNumber
              if (vote.candidate && vote.candidate.electionLevel === 'LEGISLATIVE') {
                const key = `${vote.candidate.party}_${vote.candidate.number}`;
                acc[key] = vote.count;
              }
              return acc;
            }, {});
            set({ counts: serverCounts });
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

      clear: () => set({ 
        counts: {}, 
        pendingVotes: [], 
        lastSyncAt: undefined,
        context: undefined 
      }),
    }),
    {
      name: 'legislative-vote-store-v1',
      partialize: (state) => ({ 
        counts: state.counts, 
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
  const payload = {
    escrutinioId,
    votes: votes.map(v => ({
      partyId: v.partyId,
      casillaNumber: v.casillaNumber,
      delta: v.delta,
      timestamp: v.timestamp,
      clientBatchId: v.clientBatchId,
    })),
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
      const token = localStorage.getItem('token');
      if (!token) {
        console.error('❌ No hay token de autenticación para sincronizar votos');
        return;
      }

      await axios.post(`/api/escrutinio/${encodeURIComponent(escrutinioId)}/legislative-votes`, payload, {
        headers: { 'Authorization': `Bearer ${token}` }
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
      
      if (retries < MAX_RETRIES) {
        // Esperar antes del siguiente intento
        await new Promise(resolve => setTimeout(resolve, RETRY_DELAY_MS * retries));
      } else {
        // Fallo final: restaurar eventos de auditoría para reintento posterior
        AuditClient.restore(auditEvents as any);
        console.error('❌ Error en auto-save legislativo después de reintentos');
      }
    }
  }
}

// Función para iniciar sincronización silenciosa
function startSilentSync() {
  if (syncTimer) return; // Ya está activa
  
  syncTimer = setInterval(async () => {
    const { pendingVotes } = useLegislativeVoteStore.getState();
    if (pendingVotes.length === 0) {
      // No hay votos pendientes, detener timer
      if (syncTimer) {
        clearInterval(syncTimer);
        syncTimer = null;
      }
      return;
    }
    
    await useLegislativeVoteStore.getState().syncPendingVotes();
  }, SYNC_INTERVAL_MS);
}
