import { describe, expect, it } from 'vitest'
import { buildMediaTaskResponse } from './media/tasks/[id].get'
import type { MediaTaskRecord } from '../db/sqlite'

describe('media task api', () => {
  it('returns the current key media task status', () => {
    const task: MediaTaskRecord = {
      id: 'media_task_1',
      keyId: 'key_1',
      type: 'music',
      providerTaskId: null,
      status: 'succeeded',
      prompt: '温柔的歌',
      resultUrl: 'https://example.com/song.mp3',
      error: null,
      createdAt: '2026-05-19T00:00:00.000Z',
      updatedAt: '2026-05-19T00:01:00.000Z',
    }

    expect(buildMediaTaskResponse({
      keyId: 'key_1',
      taskId: 'media_task_1',
      mediaTasks: {
        getMediaTaskByKey: () => task,
      },
    })).toEqual({
      task: {
        id: 'media_task_1',
        type: 'music',
        providerTaskId: null,
        status: 'succeeded',
        resultUrl: 'https://example.com/song.mp3',
        error: null,
        updatedAt: '2026-05-19T00:01:00.000Z',
      },
    })
  })
})
