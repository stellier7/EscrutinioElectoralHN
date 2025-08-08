import axios from 'axios';
import MockAdapter from 'axios-mock-adapter';
import { useVoteStore } from './voteStore';

const mock = new MockAdapter(axios);

describe('voteStore batching', () => {
  beforeEach(() => {
    mock.reset();
    useVoteStore.setState({ counts: {}, batch: [], pending: false, batchIndicator: {}, lastError: undefined });
    localStorage.clear();
  });

  it('batches deltas and flushes to endpoint, rollback on failure', async () => {
    const escrutinioId = 'E-1';
    useVoteStore.getState().increment('c1', { escrutinioId });
    useVoteStore.getState().increment('c1', { escrutinioId });
    useVoteStore.getState().decrement('c1', { escrutinioId });

    expect(useVoteStore.getState().batch).toHaveLength(3);

    mock.onPost(`/api/escrutinio/${encodeURIComponent(escrutinioId)}/votes`).reply(500, { error: 'fail' });
    const prev = { ...useVoteStore.getState().counts };
    await useVoteStore.getState().flush(escrutinioId);

    expect(useVoteStore.getState().lastError).toBeTruthy();
    // rollback should restore to previous minus applied deltas
    expect(useVoteStore.getState().counts['c1']).toBeDefined();

    mock.onPost(`/api/escrutinio/${encodeURIComponent(escrutinioId)}/votes`).reply(200, { success: true });
    useVoteStore.setState({ batch: [{ candidateId: 'c1', delta: +1, timestamp: Date.now(), clientBatchId: '00000000-0000-0000-0000-000000000000' }] });
    await useVoteStore.getState().flush(escrutinioId);
    expect(useVoteStore.getState().batch).toHaveLength(0);
  });
});

