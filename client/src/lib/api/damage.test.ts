import { afterEach, describe, expect, it, vi } from 'vitest';

import { damageApi } from './damage';

describe('damage api', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('posts selected event ids to the damage inspect endpoint', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ channels: [], rows: [] }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    );
    vi.stubGlobal('fetch', fetchMock);

    await expect(damageApi.inspect(['event-1', 'event-2'])).resolves.toEqual({
      channels: [],
      rows: [],
    });

    expect(fetchMock).toHaveBeenCalledWith(
      'http://localhost:8000/api/v1/damage/inspect',
      expect.objectContaining({
        method: 'POST',
        credentials: 'include',
        body: JSON.stringify({ event_ids: ['event-1', 'event-2'] }),
      }),
    );
  });

  it('posts program/version to the damage backfill endpoint', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ damage_task_id: 'task-2', task_kind: 'damage_calculation' }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    );
    vi.stubGlobal('fetch', fetchMock);

    await expect(damageApi.backfill('P1', 'V1')).resolves.toEqual({
      damage_task_id: 'task-2',
      task_kind: 'damage_calculation',
    });

    expect(fetchMock).toHaveBeenCalledWith(
      'http://localhost:8000/api/v1/damage/backfill',
      expect.objectContaining({
        method: 'POST',
        credentials: 'include',
        body: JSON.stringify({ program_id: 'P1', version: 'V1' }),
      }),
    );
  });

  it('posts program/version to the damage calculate endpoint', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ damage_task_id: 'task-1', task_kind: 'damage_calculation' }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    );
    vi.stubGlobal('fetch', fetchMock);

    await expect(damageApi.calculate('P1', 'V1')).resolves.toEqual({
      damage_task_id: 'task-1',
      task_kind: 'damage_calculation',
    });

    expect(fetchMock).toHaveBeenCalledWith(
      'http://localhost:8000/api/v1/damage/calculate',
      expect.objectContaining({
        method: 'POST',
        credentials: 'include',
        body: JSON.stringify({ program_id: 'P1', version: 'V1' }),
      }),
    );
  });
});
