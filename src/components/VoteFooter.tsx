"use client";
import React, { useMemo } from 'react';
import Button from '@/components/ui/Button';
import { useVoteStore } from '@/store/voteStore';

type Props = {
  escrutinioId: string;
  ballotsUsed?: number;
  onContinue: () => void;
};

export function VoteFooter({ escrutinioId, ballotsUsed, onContinue }: Props) {
  const { counts, syncPendingVotes } = useVoteStore((s) => ({ 
    counts: s.counts, 
    syncPendingVotes: s.syncPendingVotes 
  }));

  const total = useMemo(() => Object.values(counts).reduce((a, b) => a + (b || 0), 0), [counts]);
  const isOver = ballotsUsed !== undefined && total > ballotsUsed;

  const handleContinue = async () => {
    // Sincronizar votos pendientes antes de continuar
    await syncPendingVotes();
    onContinue();
  };

  return (
    <div className="sticky bottom-0 left-0 right-0 bg-white border-t p-3">
      <div className="max-w-4xl mx-auto flex items-center justify-between">
        <div>
          <div className="text-sm text-gray-600">Total de votos</div>
          <div className="text-2xl font-bold tabular-nums">{total}</div>
          {isOver && (
            <div className="text-xs text-amber-600">Advertencia: total supera papeletas usadas</div>
          )}
        </div>
        <div>
          <Button
            variant={isOver ? 'secondary' : 'primary'}
            size="lg"
            onClick={handleContinue}
            disabled={total === 0 || isOver}
          >
            Continuar a Evidencia
          </Button>
        </div>
      </div>
    </div>
  );
}

export default VoteFooter;

