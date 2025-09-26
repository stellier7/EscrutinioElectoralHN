import { useState, useCallback, useEffect } from 'react';
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
  loadPapeletaFromServer: (papeletaId: string) => Promise<boolean>;
  addVoteToBuffer: (partyId: string, casillaNumber: number, userId: string, voteLimit?: number) => Promise<boolean>;
  removeVoteFromBuffer: (partyId: string, casillaNumber: number) => void;
  closePapeleta: (userId: string) => Promise<boolean>;
  anularPapeleta: (userId: string, reason?: string) => Promise<boolean>;
  resetPapeleta: () => void;
  isCasillaSelected: (partyId: string, casillaNumber: number) => boolean;
  getCasillaVoteCount: (partyId: string, casillaNumber: number) => number;
  isVoteLimitReached: (voteLimit: number) => boolean;
  getTotalVotesInBuffer: () => number;
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

  // Cargar estado desde localStorage al inicializar
  useEffect(() => {
    const loadPapeletaFromStorage = () => {
      try {
        const stored = localStorage.getItem('papeleta-state');
        if (stored) {
          const parsed = JSON.parse(stored);
          console.log('📱 Cargando papeleta desde localStorage:', parsed);
          setPapeleta({
            ...parsed,
            createdAt: parsed.createdAt ? new Date(parsed.createdAt) : null
          });
        } else {
          console.log('📱 No hay papeleta en localStorage');
        }
      } catch (error) {
        console.error('❌ Error loading papeleta from storage:', error);
      }
    };

    loadPapeletaFromStorage();
  }, []);

  // Guardar estado en localStorage cuando cambie
  useEffect(() => {
    const savePapeletaToStorage = () => {
      try {
        if (papeleta.id && papeleta.status) {
          console.log('💾 Guardando papeleta en localStorage:', {
            id: papeleta.id,
            status: papeleta.status,
            votesCount: papeleta.votesBuffer.length
          });
          localStorage.setItem('papeleta-state', JSON.stringify(papeleta));
        } else {
          console.log('🗑️ Limpiando papeleta de localStorage');
          localStorage.removeItem('papeleta-state');
        }
      } catch (error) {
        console.error('❌ Error saving papeleta to storage:', error);
      }
    };

    savePapeletaToStorage();
  }, [papeleta]);

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

  const loadPapeletaFromServer = useCallback(async (papeletaId: string): Promise<boolean> => {
    try {
      setIsLoading(true);
      setError(null);

      const response = await axios.get(`/api/papeleta/${papeletaId}/status`);

      if (response.data?.success) {
        const data = response.data.data;
        setPapeleta({
          id: data.id,
          status: data.status,
          votesBuffer: data.votesBuffer || [],
          createdAt: new Date(data.createdAt)
        });
        return true;
      } else {
        setError(response.data?.error || 'Error al cargar papeleta');
        return false;
      }
    } catch (err: any) {
      console.error('Error loading papeleta from server:', err);
      setError(err?.response?.data?.error || 'Error al cargar papeleta');
      return false;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const addVoteToBuffer = useCallback(async (partyId: string, casillaNumber: number, userId: string, voteLimit?: number): Promise<boolean> => {
    if (!papeleta.id || papeleta.status !== 'OPEN') {
      setError('No hay papeleta abierta');
      return false;
    }

    // Verificar límite de marcas si se proporciona
    if (voteLimit && papeleta.votesBuffer.length >= voteLimit) {
      setError(`Límite de marcas alcanzado (${voteLimit}). Debe cerrar la papeleta para continuar.`);
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
        setError(response.data?.error || 'Error al agregar marca');
        return false;
      }
    } catch (err: any) {
      console.error('Error adding mark to papeleta:', err);
      setError(err?.response?.data?.error || 'Error al agregar marca');
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [papeleta.id, papeleta.status, papeleta.votesBuffer.length]);

  const closePapeleta = useCallback(async (userId: string): Promise<boolean> => {
    if (!papeleta.id || papeleta.status !== 'OPEN') {
      setError('No hay papeleta abierta');
      return false;
    }

    try {
      setIsLoading(true);
      setError(null);

      console.log('🔒 Cerrando papeleta:', papeleta.id, 'con', papeleta.votesBuffer.length, 'votos');
      console.log('🔒 VotesBuffer completo:', papeleta.votesBuffer);

      const response = await axios.post(`/api/papeleta/${papeleta.id}/close`, {
        userId,
        votesBuffer: papeleta.votesBuffer
      });

      if (response.data?.success) {
        setPapeleta(prev => ({
          ...prev,
          status: 'CLOSED'
        }));
        console.log('✅ Papeleta cerrada exitosamente');
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
    localStorage.removeItem('papeleta-state');
  }, []);

  const isVoteLimitReached = useCallback((voteLimit: number): boolean => {
    return papeleta.votesBuffer.length >= voteLimit;
  }, [papeleta.votesBuffer.length]);

  const getTotalVotesInBuffer = useCallback((): number => {
    return papeleta.votesBuffer.length;
  }, [papeleta.votesBuffer.length]);

  return {
    papeleta,
    isLoading,
    error,
    startPapeleta,
    loadPapeletaFromServer,
    addVoteToBuffer,
    removeVoteFromBuffer,
    closePapeleta,
    anularPapeleta,
    resetPapeleta,
    isCasillaSelected,
    getCasillaVoteCount,
    isVoteLimitReached,
    getTotalVotesInBuffer
  };
}
