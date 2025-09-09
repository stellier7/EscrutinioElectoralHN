import { useState, useCallback } from 'react';
import axios from 'axios';

export interface PapeletaVote {
  partyId: string;
  casillaNumber: number;
  timestamp: number;
}

export interface PapeletaState {
  id: string | null;
  status: 'OPEN' | 'CLOSED' | 'ANULADA' | null;
  votesBuffer: PapeletaVote[];
  createdAt: Date | null;
}

export interface UsePapeletaReturn {
  papeleta: PapeletaState;
  isLoading: boolean;
  error: string | null;
  startPapeleta: (escrutinioId: string, userId: string) => Promise<boolean>;
  addVoteToBuffer: (partyId: string, casillaNumber: number, userId: string) => Promise<boolean>;
  removeVoteFromBuffer: (partyId: string, casillaNumber: number) => void;
  closePapeleta: (userId: string) => Promise<boolean>;
  anularPapeleta: (userId: string, reason?: string) => Promise<boolean>;
  resetPapeleta: () => void;
  isCasillaSelected: (partyId: string, casillaNumber: number) => boolean;
  getCasillaVoteCount: (partyId: string, casillaNumber: number) => number;
}

export function usePapeleta(): UsePapeletaReturn {
  const [papeleta, setPapeleta] = useState<PapeletaState>({
    id: null,
    status: null,
    votesBuffer: [],
    createdAt: null
  });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const startPapeleta = useCallback(async (escrutinioId: string, userId: string): Promise<boolean> => {
    try {
      setIsLoading(true);
      setError(null);

      const response = await axios.post('/api/papeleta/start', {
        escrutinioId,
        userId
      });

      if (response.data?.success) {
        setPapeleta({
          id: response.data.data.papeletaId,
          status: 'OPEN',
          votesBuffer: [],
          createdAt: new Date(response.data.data.createdAt)
        });
        return true;
      } else {
        setError(response.data?.error || 'Error al iniciar papeleta');
        return false;
      }
    } catch (err: any) {
      console.error('Error starting papeleta:', err);
      setError(err?.response?.data?.error || 'Error al iniciar papeleta');
      return false;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const addVoteToBuffer = useCallback(async (partyId: string, casillaNumber: number, userId: string): Promise<boolean> => {
    if (!papeleta.id || papeleta.status !== 'OPEN') {
      setError('No hay papeleta abierta');
      return false;
    }

    try {
      setIsLoading(true);
      setError(null);

      const response = await axios.post(`/api/papeleta/${papeleta.id}/vote`, {
        partyId,
        casillaNumber,
        userId
      });

      if (response.data?.success) {
        const newVote: PapeletaVote = {
          partyId,
          casillaNumber,
          timestamp: Date.now()
        };

        setPapeleta(prev => ({
          ...prev,
          votesBuffer: [...prev.votesBuffer, newVote]
        }));
        return true;
      } else {
        setError(response.data?.error || 'Error al agregar voto');
        return false;
      }
    } catch (err: any) {
      console.error('Error adding vote to papeleta:', err);
      setError(err?.response?.data?.error || 'Error al agregar voto');
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [papeleta.id, papeleta.status]);

  const closePapeleta = useCallback(async (userId: string): Promise<boolean> => {
    if (!papeleta.id || papeleta.status !== 'OPEN') {
      setError('No hay papeleta abierta');
      return false;
    }

    try {
      setIsLoading(true);
      setError(null);

      const response = await axios.post(`/api/papeleta/${papeleta.id}/close`, {
        userId
      });

      if (response.data?.success) {
        setPapeleta(prev => ({
          ...prev,
          status: 'CLOSED'
        }));
        return true;
      } else {
        setError(response.data?.error || 'Error al cerrar papeleta');
        return false;
      }
    } catch (err: any) {
      console.error('Error closing papeleta:', err);
      setError(err?.response?.data?.error || 'Error al cerrar papeleta');
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [papeleta.id, papeleta.status]);

  const anularPapeleta = useCallback(async (userId: string, reason?: string): Promise<boolean> => {
    if (!papeleta.id || papeleta.status !== 'OPEN') {
      setError('No hay papeleta abierta');
      return false;
    }

    try {
      setIsLoading(true);
      setError(null);

      const response = await axios.post(`/api/papeleta/${papeleta.id}/anular`, {
        userId,
        reason
      });

      if (response.data?.success) {
        setPapeleta(prev => ({
          ...prev,
          status: 'ANULADA'
        }));
        return true;
      } else {
        setError(response.data?.error || 'Error al anular papeleta');
        return false;
      }
    } catch (err: any) {
      console.error('Error anulando papeleta:', err);
      setError(err?.response?.data?.error || 'Error al anular papeleta');
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [papeleta.id, papeleta.status]);

  const removeVoteFromBuffer = useCallback((partyId: string, casillaNumber: number) => {
    setPapeleta(prev => ({
      ...prev,
      votesBuffer: prev.votesBuffer.filter(vote => 
        !(vote.partyId === partyId && vote.casillaNumber === casillaNumber)
      )
    }));
  }, []);

  const isCasillaSelected = useCallback((partyId: string, casillaNumber: number): boolean => {
    return papeleta.votesBuffer.some(vote => 
      vote.partyId === partyId && vote.casillaNumber === casillaNumber
    );
  }, [papeleta.votesBuffer]);

  const getCasillaVoteCount = useCallback((partyId: string, casillaNumber: number): number => {
    return papeleta.votesBuffer.filter(vote => 
      vote.partyId === partyId && vote.casillaNumber === casillaNumber
    ).length;
  }, [papeleta.votesBuffer]);

  const resetPapeleta = useCallback(() => {
    setPapeleta({
      id: null,
      status: null,
      votesBuffer: [],
      createdAt: null
    });
    setError(null);
  }, []);

  return {
    papeleta,
    isLoading,
    error,
    startPapeleta,
    addVoteToBuffer,
    removeVoteFromBuffer,
    closePapeleta,
    anularPapeleta,
    resetPapeleta,
    isCasillaSelected,
    getCasillaVoteCount
  };
}
