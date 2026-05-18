import { describe, expect, it, vi } from 'vitest'
import { createDefaultDesignSchema } from '../services/design-schema'
import {
  buildDesignCommitResponse,
  buildDesignProposalSnapshot,
  buildWorkFromCommittedDesign,
  getNextDesignVersion,
} from './design/commit.post'
import { restoreAgentSnapshotAction } from './agent/snapshots/[id]/restore.post'
import { parseDesignProposalInstruction } from './agent/design-proposals/[id].post'
import { parsePreviewInstruction } from './design/preview.post'

describe('design api helpers', () => {
  it('calculates the next persisted design version', () => {
    expect(getNextDesignVersion(undefined)).toBe(1)
    expect(getNextDesignVersion({ version: 4 })).toBe(5)
  })

  it('validates preview instructions', () => {
    expect(parsePreviewInstruction({ instruction: '让页面更像星空' })).toBe('让页面更像星空')
    expect(() => parsePreviewInstruction({ instruction: '' })).toThrow()
  })

  it('extracts page design proposal instructions', () => {
    expect(parseDesignProposalInstruction(JSON.stringify({ instruction: '更像星空' }))).toBe('更像星空')
    expect(() => parseDesignProposalInstruction('{}')).toThrow()
  })

  it('builds commit response', () => {
    expect(buildDesignCommitResponse(2)).toEqual({ ok: true, version: 2 })
  })

  it('maps committed design to a private page design work', () => {
    expect(buildWorkFromCommittedDesign({
      keyId: 'key_1',
      version: 2,
      schema: createDefaultDesignSchema(),
      prompt: '更像星空',
      now: '2026-05-17T00:00:00.000Z',
    })).toMatchObject({
      type: 'page_design',
      visibility: 'private',
      sourceDesignVersion: 2,
    })
  })

  it('builds a snapshot for committed design proposals', () => {
    const schema = createDefaultDesignSchema()

    expect(buildDesignProposalSnapshot({
      id: 'snap_1',
      keyId: 'key_1',
      proposalId: 'proposal_1',
      profile: { assistantName: '月光', mbti: 'INTJ' },
      schema,
      version: 2,
      now: '2026-05-18T00:00:00.000Z',
    })).toEqual({
      id: 'snap_1',
      keyId: 'key_1',
      proposalId: 'proposal_1',
      profileJson: JSON.stringify({
        assistantName: '月光',
        mbti: 'INTJ',
        acceptedProposal: {
          type: 'page_design',
          payload: {
            version: 2,
            schema,
          },
        },
      }),
      createdAt: '2026-05-18T00:00:00.000Z',
    })
  })

  it('keeps default schema parseable for GET fallback', () => {
    expect(createDefaultDesignSchema().sections.length).toBeGreaterThan(0)
  })

  it('restores a page design snapshot by creating a new design version', () => {
    const addKeyDesign = vi.fn()
    const schema = {
      ...createDefaultDesignSchema(),
      title: '旧页面',
    }
    const result = restoreAgentSnapshotAction({
      keyId: 'key_1',
      snapshotId: 'snapshot_1',
      now: '2026-05-18T00:00:00.000Z',
      snapshots: {
        getSnapshotByKey: () => ({
          id: 'snapshot_1',
          keyId: 'key_1',
          proposalId: 'proposal_1',
          profileJson: JSON.stringify({
            acceptedProposal: {
              type: 'page_design',
              payload: {
                version: 2,
                schema,
              },
            },
          }),
          createdAt: '2026-05-18T00:00:00.000Z',
        }),
      },
      states: { updateAgentState: vi.fn() },
      designs: {
        getLatestDesign: () => ({ keyId: 'key_1', version: 3 }),
        addKeyDesign,
      },
    } as any)

    expect(result.restored).toBe(true)
    expect(addKeyDesign).toHaveBeenCalledWith(expect.objectContaining({
      keyId: 'key_1',
      version: 4,
    }))
  })
})
