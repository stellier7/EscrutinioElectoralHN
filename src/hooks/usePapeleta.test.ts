import { renderHook, act } from '@testing-library/react';
import { usePapeleta } from './usePapeleta';
import axios from 'axios';

// Mock axios
jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('usePapeleta', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('should initialize with empty papeleta state', () => {
    const { result } = renderHook(() => usePapeleta());
    
    expect(result.current.papeleta).toEqual({
      id: null,
      status: null,
      votesBuffer: [],
      createdAt: null
    });
    expect(result.current.isLoading).toBe(false);
    expect(result.current.error).toBe(null);
  });

  test('should start papeleta successfully', async () => {
    const mockResponse = {
      data: {
        success: true,
        data: {
          papeletaId: 'papeleta-123',
          status: 'OPEN',
          createdAt: '2023-01-01T00:00:00Z'
        }
      }
    };
    
    mockedAxios.post.mockResolvedValueOnce(mockResponse);

    const { result } = renderHook(() => usePapeleta());

    let success: boolean;
    await act(async () => {
      success = await result.current.startPapeleta('escrutinio-123', 'user-123');
    });

    expect(success).toBe(true);
    expect(result.current.papeleta.id).toBe('papeleta-123');
    expect(result.current.papeleta.status).toBe('OPEN');
    expect(mockedAxios.post).toHaveBeenCalledWith('/api/papeleta/start', {
      escrutinioId: 'escrutinio-123',
      userId: 'user-123'
    });
  });

  test('should add vote to buffer successfully', async () => {
    const mockResponse = {
      data: {
        success: true,
        data: {
          papeletaId: 'papeleta-123',
          voteCount: 1,
          lastVote: {
            partyId: 'pdc',
            casillaNumber: 1,
            timestamp: 1234567890
          }
        }
      }
    };
    
    mockedAxios.post.mockResolvedValueOnce(mockResponse);

    const { result } = renderHook(() => usePapeleta());

    // First set up a papeleta
    await act(async () => {
      result.current.papeleta.id = 'papeleta-123';
      result.current.papeleta.status = 'OPEN';
    });

    let success: boolean;
    await act(async () => {
      success = await result.current.addVoteToBuffer('pdc', 1, 'user-123');
    });

    expect(success).toBe(true);
    expect(result.current.papeleta.votesBuffer).toHaveLength(1);
    expect(result.current.papeleta.votesBuffer[0]).toMatchObject({
      partyId: 'pdc',
      casillaNumber: 1
    });
    expect(typeof result.current.papeleta.votesBuffer[0].timestamp).toBe('number');
  });

  test('should close papeleta successfully', async () => {
    const mockResponse = {
      data: {
        success: true,
        data: {
          papeletaId: 'papeleta-123',
          status: 'CLOSED',
          votesApplied: 2,
          closedAt: '2023-01-01T00:00:00Z'
        }
      }
    };
    
    mockedAxios.post.mockResolvedValueOnce(mockResponse);

    const { result } = renderHook(() => usePapeleta());

    // First set up a papeleta with votes
    await act(async () => {
      result.current.papeleta.id = 'papeleta-123';
      result.current.papeleta.status = 'OPEN';
      result.current.papeleta.votesBuffer = [
        { partyId: 'pdc', casillaNumber: 1, timestamp: 1234567890 },
        { partyId: 'libre', casillaNumber: 9, timestamp: 1234567891 }
      ];
    });

    let success: boolean;
    await act(async () => {
      success = await result.current.closePapeleta('user-123');
    });

    expect(success).toBe(true);
    expect(result.current.papeleta.status).toBe('CLOSED');
    expect(mockedAxios.post).toHaveBeenCalledWith('/api/papeleta/papeleta-123/close', {
      userId: 'user-123'
    });
  });

  test('should anular papeleta successfully', async () => {
    const mockResponse = {
      data: {
        success: true,
        data: {
          papeletaId: 'papeleta-123',
          status: 'ANULADA',
          votesDiscarded: 1,
          anuladaAt: '2023-01-01T00:00:00Z',
          reason: 'Error en papeleta'
        }
      }
    };
    
    mockedAxios.post.mockResolvedValueOnce(mockResponse);

    const { result } = renderHook(() => usePapeleta());

    // First set up a papeleta
    await act(async () => {
      result.current.papeleta.id = 'papeleta-123';
      result.current.papeleta.status = 'OPEN';
      result.current.papeleta.votesBuffer = [
        { partyId: 'pdc', casillaNumber: 1, timestamp: 1234567890 }
      ];
    });

    let success: boolean;
    await act(async () => {
      success = await result.current.anularPapeleta('user-123', 'Error en papeleta');
    });

    expect(success).toBe(true);
    expect(result.current.papeleta.status).toBe('ANULADA');
    expect(mockedAxios.post).toHaveBeenCalledWith('/api/papeleta/papeleta-123/anular', {
      userId: 'user-123',
      reason: 'Error en papeleta'
    });
  });

  test('should handle errors gracefully', async () => {
    const mockError = {
      response: {
        data: {
          error: 'Error del servidor'
        }
      }
    };
    
    mockedAxios.post.mockRejectedValueOnce(mockError);

    const { result } = renderHook(() => usePapeleta());

    let success: boolean;
    await act(async () => {
      success = await result.current.startPapeleta('escrutinio-123', 'user-123');
    });

    expect(success).toBe(false);
    expect(result.current.error).toBe('Error del servidor');
  });

  test('should reset papeleta state', () => {
    const { result } = renderHook(() => usePapeleta());

    // First set some state
    act(() => {
      result.current.papeleta.id = 'papeleta-123';
      result.current.papeleta.status = 'OPEN';
      result.current.papeleta.votesBuffer = [
        { partyId: 'pdc', casillaNumber: 1, timestamp: 1234567890 }
      ];
      result.current.error = 'Some error';
    });

    // Then reset
    act(() => {
      result.current.resetPapeleta();
    });

    expect(result.current.papeleta).toEqual({
      id: null,
      status: null,
      votesBuffer: [],
      createdAt: null
    });
    expect(result.current.error).toBe(null);
  });
});
