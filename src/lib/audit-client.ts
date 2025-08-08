/* Client-side audit aggregator for vote interactions */
import { v4 as uuidv4 } from 'uuid';

export type ClientAuditEvent = {
  id: string;
  event: string;
  userId?: string;
  mesaId?: string;
  escrutinioId?: string;
  candidateId?: string;
  delta?: number;
  timestamp: number;
  gps?: { latitude: number; longitude: number; accuracy?: number };
  deviceId?: string;
  clientBatchId: string;
  metadata?: Record<string, any>;
};

const AUDIT_STORAGE_KEY = 'audit-events-buffer-v1';

function safeRead(): ClientAuditEvent[] {
  try {
    const raw = localStorage.getItem(AUDIT_STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as ClientAuditEvent[];
  } catch {
    return [];
  }
}

function safeWrite(events: ClientAuditEvent[]) {
  try {
    localStorage.setItem(AUDIT_STORAGE_KEY, JSON.stringify(events));
  } catch {
    // ignore
  }
}

export const AuditClient = {
  createBatchId(): string {
    return uuidv4();
  },
  log(event: Omit<ClientAuditEvent, 'id'>): ClientAuditEvent {
    const withId: ClientAuditEvent = { ...event, id: uuidv4() };
    const buf = safeRead();
    buf.push(withId);
    safeWrite(buf);
    return withId;
  },
  drain(): ClientAuditEvent[] {
    const buf = safeRead();
    safeWrite([]);
    return buf;
  },
  peek(): ClientAuditEvent[] {
    return safeRead();
  },
  restore(events: ClientAuditEvent[]): void {
    const buf = safeRead();
    safeWrite([...events, ...buf]);
  },
};

