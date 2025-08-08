"use client";
import React from 'react';
import VoteCard from '@/components/VoteCard';
import { useVoteStore } from '@/store/voteStore';

export type VoteListItem = {
  id: string;
  name: string;
  party: string;
  partyColor?: string;
  number?: string | number;
};

type Props = {
  escrutinioId: string;
  candidates: VoteListItem[];
  userId?: string;
  mesaId?: string;
  gps?: { latitude: number; longitude: number; accuracy?: number } | null;
  deviceId?: string;
};

export function VoteList({ escrutinioId, candidates, userId, mesaId, gps, deviceId }: Props) {
  const { counts, increment, decrement, pending, batchIndicator } = useVoteStore((s) => ({
    counts: s.counts,
    increment: s.increment,
    decrement: s.decrement,
    pending: s.pending,
    batchIndicator: s.batchIndicator,
  }));

  return (
    <div className="space-y-3">
      {candidates.map((c) => (
        <VoteCard
          key={c.id}
          id={c.id}
          name={c.name}
          party={c.party}
          partyColor={c.partyColor}
          number={c.number}
          count={counts[c.id] || 0}
          isPending={!!batchIndicator[c.id] || pending}
          onIncrement={() =>
            increment(c.id, { escrutinioId, userId, mesaId, gps: gps || undefined, deviceId })
          }
          onDecrement={() =>
            decrement(c.id, { escrutinioId, userId, mesaId, gps: gps || undefined, deviceId })
          }
        />
      ))}
    </div>
  );
}

export default VoteList;

