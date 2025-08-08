import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { z } from 'zod';
import axios from 'axios';
import { AuditClient } from '@/lib/audit-client';
import { notifyError } from '@/components/ui/Toast';

export type CandidateDisplay = {
  id: string;
  name: string;
  party: string;
  partyColor?: string;
  number?: string | number;
};

export type VoteDelta = {
  candidateId: string;
  delta: number; // +1 or -1
  timestamp: number;
  clientBatchId: string;
};

export type VoteBatchPayload = {
  escrutinioId: string;
  votes: VoteDelta[];
  gps?: { latitude: number; longitude: number; accuracy?: number };
  deviceId?: string;
  audit?: any[];
};

const VoteBatchSchema = z.object({
  escrutinioId: z.string().min(1),
  votes: z.array(
    z.object({
      candidateId: z.string().min(1),
      delta: z.number().int().min(-1000).max(1000),
      timestamp: z.number(),
      clientBatchId: z.string().uuid(),
    })
  ),
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
  pending: boolean;
  lastError?: string;
  batch: VoteDelta[];
  lastFlushedAt?: number;
  batchIndicator: Record<string, boolean>;
  context?: { gps?: { latitude: number; longitude: number; accuracy?: number }; deviceId?: string };
};

type Actions = {
  increment: (candidateId: string, meta: { escrutinioId: string; userId?: string; mesaId?: string; gps?: { latitude: number; longitude: number; accuracy?: number }; deviceId?: string }) => void;
  decrement: (candidateId: string, meta: { escrutinioId: string; userId?: string; mesaId?: string; gps?: { latitude: number; longitude: number; accuracy?: number }; deviceId?: string }) => void;
  flush: (escrutinioId: string) => Promise<void>;
  setCounts: (counts: Record<string, number>) => void;
  clear: () => void;
  reconcileFailure: (deltas: VoteDelta[]) => void;
};

const MAX_EVENTS = 20;
const IDLE_MS = 3000;

let idleTimer: ReturnType<typeof setTimeout> | null = null;

export const useVoteStore = create<State & Actions>()(
  persist(
    (set, get) => ({
      counts: {},
      pending: false,
      batch: [],
      batchIndicator: {},

      setCounts: (counts) => set({ counts }),

      increment: (candidateId, meta) => {
        const { counts, batch } = get();
        const newCount = (counts[candidateId] || 0) + 1;
        const clientBatchId = AuditClient.createBatchId();
        const delta: VoteDelta = {
          candidateId,
          delta: +1,
          timestamp: Date.now(),
          clientBatchId,
        };

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

        set({
          counts: { ...counts, [candidateId]: newCount },
          batch: [...batch, delta],
          batchIndicator: { ...get().batchIndicator, [candidateId]: true },
          context: { gps: meta.gps, deviceId: meta.deviceId },
          lastError: undefined,
        });

        scheduleFlush(meta.escrutinioId);
      },

      decrement: (candidateId, meta) => {
        const { counts, batch } = get();
        const newCount = Math.max(0, (counts[candidateId] || 0) - 1);
        const clientBatchId = AuditClient.createBatchId();
        const delta: VoteDelta = {
          candidateId,
          delta: -1,
          timestamp: Date.now(),
          clientBatchId,
        };

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

        set({
          counts: { ...counts, [candidateId]: newCount },
          batch: [...batch, delta],
          batchIndicator: { ...get().batchIndicator, [candidateId]: true },
          context: { gps: meta.gps, deviceId: meta.deviceId },
          lastError: undefined,
        });

        scheduleFlush(meta.escrutinioId);
      },

      flush: async (escrutinioId: string) => {
        const { batch } = get();
        if (batch.length === 0) return;

        const auditEvents = AuditClient.drain();
        const payload: VoteBatchPayload = {
          escrutinioId,
          votes: batch,
          audit: auditEvents,
          gps: get().context?.gps,
          deviceId: get().context?.deviceId,
        };

        const parsed = VoteBatchSchema.safeParse(payload);
        if (!parsed.success) {
          set({ lastError: 'Error de validación en lote de votos' });
          // restore audit events so they are not lost
          AuditClient.restore(auditEvents as any);
          return;
        }

        try {
          set({ pending: true });
          await axios.post(`/api/escrutinio/${encodeURIComponent(escrutinioId)}/votes`, payload);
          set({ batch: [], lastFlushedAt: Date.now(), pending: false, batchIndicator: {} });
        } catch (error: any) {
          // rollback visual: revert deltas
          get().reconcileFailure(batch);
          set({ lastError: error?.response?.data?.error || 'Error al enviar votos', pending: false });
          // restore audit + batch so it can retry later
          AuditClient.restore(auditEvents as any);
          notifyError('No se pudieron sincronizar los votos. Reintentaremos en breve.');
        }
      },

      reconcileFailure: (deltas) => {
        const current = { ...get().counts };
        for (const d of deltas) {
          current[d.candidateId] = Math.max(0, (current[d.candidateId] || 0) - d.delta);
        }
        set({ counts: current });
      },

      clear: () => set({ counts: {}, batch: [], pending: false, lastError: undefined, batchIndicator: {} }),
    }),
    {
      name: 'vote-store-v1',
      partialize: (state) => ({ counts: state.counts, batch: state.batch }),
    }
  )
);

function scheduleFlush(escrutinioId: string) {
  const { batch } = useVoteStore.getState();
  if (batch.length >= MAX_EVENTS) {
    useVoteStore.getState().flush(escrutinioId);
    return;
  }
  if (idleTimer) clearTimeout(idleTimer);
  idleTimer = setTimeout(() => {
    useVoteStore.getState().flush(escrutinioId);
  }, IDLE_MS);
}

