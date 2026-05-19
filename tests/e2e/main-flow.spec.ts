import { expect, test } from '@playwright/test'

test('creates a key, configures profile, chats, designs, and re-enters', async ({ page }, testInfo) => {
  const runId = Date.now()
  const key = `e2e-${testInfo.project.name}-${runId}`
  const forwardedIp = `e2e-${testInfo.project.name}-${runId}`
  const generatedImageUrl = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw=='
  const generatedMusicUrl = 'data:audio/mpeg;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAESsAACJWAAACABAAZGF0YQAAAAA='
  let sleepCompleted = false
  let workVisibility: 'private' | 'public' = 'private'
  let memoryGovernanceApproved = false
  let plainChatSeen = false
  let imageGenerationRequests = 0
  let musicGenerationRequests = 0
  let chatToolApprovalRequested = false

  await page.setExtraHTTPHeaders({ 'x-forwarded-for': forwardedIp })

  await page.route('**/api/chat/stream', async (route) => {
    const body = route.request().postDataJSON()
    expect(body.intent).toBeUndefined()

    if (body.message === '这封信是真的吗？') {
      plainChatSeen = true
    }

    if (body.message === '这段回忆像一张照片，可以处理吗？') {
      await route.fulfill({
        contentType: 'text/event-stream',
        body: [
          `data: ${JSON.stringify({
            type: 'tool-confirmation',
            taskId: 'task_image_suggestion',
            inboxItemId: 'task_approval:task_image_suggestion',
            title: '生成图片建议',
            summary: '建议生成图片前需要确认。',
          })}`,
          'data: [DONE]',
          '',
        ].join('\n\n'),
      })
      return
    }

    if (body.message === '生成一张月光星空图片') {
      imageGenerationRequests += 1
      await route.fulfill({
        contentType: 'text/event-stream',
        body: [
          `data: ${JSON.stringify({ type: 'tool-status', text: '正在生成图片。' })}`,
          `data: ${JSON.stringify({
            type: 'message',
            reply: '画好了。',
            message: {
              role: 'assistant',
              content: '画好了。',
              parts: [
                { type: 'status', text: '正在生成图片。' },
                { type: 'text', text: '画好了。' },
                { type: 'image', url: generatedImageUrl },
              ],
            },
          })}`,
          'data: [DONE]',
          '',
        ].join('\n\n'),
      })
      return
    }

    if (body.message === '制作一个音乐') {
      musicGenerationRequests += 1
      await route.fulfill({
        contentType: 'text/event-stream',
        body: [
          `data: ${JSON.stringify({ type: 'tool-status', text: '正在生成音乐。' })}`,
          `data: ${JSON.stringify({
            type: 'message',
            reply: '音乐做好了。',
            message: {
              role: 'assistant',
              content: '音乐做好了。',
              parts: [
                { type: 'status', text: '正在生成音乐。' },
                { type: 'text', text: '音乐做好了。' },
                { type: 'music', url: generatedMusicUrl },
              ],
            },
          })}`,
          'data: [DONE]',
          '',
        ].join('\n\n'),
      })
      return
    }

    await route.fulfill({
      contentType: 'text/event-stream',
      body: [
        'data: {"type":"delta","text":"这句我会记得。"}',
        'data: {"type":"message","reply":"这句我会记得。","message":{"role":"assistant","content":"这句我会记得。","parts":[{"type":"text","text":"这句我会记得。"}]}}',
        'data: [DONE]',
        '',
      ].join('\n\n'),
    })
  })

  await page.route('**/api/design/preview', async (route) => {
    await route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({
        schema: {
          version: 1,
          theme: 'moon-note',
          palette: 'midnight',
          title: '银河信笺',
          subtitle: '把这一页改成更像星空的样子。',
          sections: [
            { type: 'letter', layout: 'star-trail', text: '这是一段由设计预览生成的内容。' },
            { type: 'star-scene', density: 0.8, caption: '保存后，这片星空会留在这把钥匙里。' },
          ],
        },
      }),
    })
  })

  await page.route('**/api/agent/design-proposals/*', async (route) => {
    await route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({
        schema: {
          version: 1,
          theme: 'moon-note',
          palette: 'midnight',
          title: '银河信笺',
          subtitle: '把这一页改成更像星空的样子。',
          sections: [
            { type: 'letter', layout: 'star-trail', text: '这是一段由设计提案生成的预览。' },
          ],
        },
      }),
    })
  })

  await page.route('**/api/agent/core', async (route) => {
    await route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({
        profile: {
          keyId: 'key_1',
          assistantName: '月光',
          mbti: 'INFJ',
          configured: true,
          tone: '克制、温柔、安静',
          relationshipRole: '记忆星球守护者',
          learningMode: '辅助学习',
          contentStrategy: {
            replyLength: 'balanced',
            structure: 'plain',
            initiative: 'low',
          },
        },
        memoryCounts: {
          total: 1,
          active: 1,
          archived: 0,
          rejected: 0,
        },
        memories: [
          {
            id: 'memory_1',
            type: 'preference',
            content: '用户喜欢短句。',
            importance: 0.9,
            confidence: 0.92,
            sourceConversationId: 'conversation_1',
            sourceExcerpt: '用户说自己喜欢短句。',
            governanceEvents: [
              {
                id: 'event_1',
                action: 'confirm',
                reason: '用户明确表达。',
                createdAt: '2026-05-17T00:02:00.000Z',
              },
            ],
            createdAt: '2026-05-17T00:00:00.000Z',
          },
        ],
        latestReflections: [
          {
            id: 'reflection_1',
            summary: '用户在聊天里确认想要短句回应。',
            createdAt: '2026-05-17T00:00:00.000Z',
          },
        ],
        proposals: {
          pending: [
            {
              id: 'proposal_1',
              type: 'page_design',
              title: '调整页面',
              summary: '让页面更像星空。',
              payload: { instruction: '更像星空' },
              status: 'pending',
              createdAt: '2026-05-17T00:00:00.000Z',
              updatedAt: '2026-05-17T00:00:00.000Z',
            },
          ],
          history: [
            {
              id: 'proposal_2',
              type: 'relationship_role',
              title: '守护者',
              summary: '关系定位为守护者。',
              payload: { relationshipRole: '守护者' },
              status: 'applied',
              createdAt: '2026-05-17T00:01:00.000Z',
              updatedAt: '2026-05-17T00:01:00.000Z',
            },
          ],
        },
        snapshots: [
          {
            id: 'snapshot_1',
            proposalId: 'proposal_2',
            createdAt: '2026-05-17T00:01:30.000Z',
          },
        ],
        sleep: {
          lastSleepAt: sleepCompleted ? '2026-05-17T00:10:00.000Z' : null,
          nextSleepAt: '2026-05-17T12:00:00.000Z',
          latestRun: sleepCompleted
            ? {
                id: 'sleep_1',
                status: 'completed',
                summary: '整理完成。',
                memoryActions: [{ memoryId: 'memory_1', action: 'confirm', reason: '用户明确表达。' }],
                workIdeas: [{ type: 'letter', title: '短句回信', summary: '写一封短回信。' }],
                nextConversationHints: ['承接短句偏好'],
                startedAt: '2026-05-17T00:10:00.000Z',
                completedAt: '2026-05-17T00:10:00.000Z',
                error: null,
              }
            : null,
        },
      }),
    })
  })

  await page.route('**/api/agents/current/os', async (route) => {
    await route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({
        agent: {
          id: 'agent_1',
          status: 'active',
          ownerType: 'key',
          ownerId: 'key_1',
          domain: 'star',
        },
        inbox: [
          {
            id: 'memory_governance:memory_1:archive',
            type: 'memory_governance',
            title: '记忆治理',
            summary: '过期。',
            action: 'execute',
            createdAt: '2026-05-17T00:00:00.000Z',
          },
          {
            id: 'proposal:proposal_1',
            type: 'proposal',
            title: '调整页面',
            summary: '让页面更像星空。',
            action: 'approve',
            createdAt: '2026-05-17T00:00:00.000Z',
          },
        ],
        tasks: [
          {
            id: 'task_1',
            type: 'sleep',
            status: 'completed',
            title: '睡眠整理',
            summary: '整理完成。',
            createdAt: '2026-05-17T00:00:00.000Z',
            updatedAt: '2026-05-17T00:01:00.000Z',
          },
        ],
        events: [
          {
            id: 'event_1',
            type: 'provider.failed',
            title: 'Provider failed',
            summary: '模型失败。',
            createdAt: '2026-05-17T00:00:00.000Z',
          },
        ],
        records: [
          {
            id: 'event_1',
            type: '失败',
            title: '模型调用失败',
            summary: '模型失败。',
            status: '失败',
            createdAt: '2026-05-17T00:00:00.000Z',
          },
        ],
      }),
    })
  })

  await page.route('**/api/agents/current/events', async (route) => {
    await route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({
        events: [
          {
            id: 'event_1',
            type: 'provider.failed',
            title: 'Provider failed',
            summary: '模型失败。',
            createdAt: '2026-05-17T00:00:00.000Z',
          },
        ],
      }),
    })
  })

  await page.route('**/api/agents/current/inbox/*/approve', async (route) => {
    const requestUrl = decodeURIComponent(route.request().url())

    if (requestUrl.includes('memory_governance')) {
      memoryGovernanceApproved = true
    }
    if (requestUrl.includes('task_approval:task_image_suggestion')) {
      chatToolApprovalRequested = true
    }
    await route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({ ok: true }),
    })
  })

  await page.route('**/api/agents/current/inbox/*/reject', async (route) => {
    await route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({ ok: true }),
    })
  })

  await page.route('**/api/agent/sleep', async (route) => {
    sleepCompleted = true
    await route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({
        run: { id: 'sleep_1', status: 'completed', summary: '整理完成。' },
        proposals: [],
      }),
    })
  })

  await page.route('**/api/agent/memories/*', async (route) => {
    await route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({ id: 'memory_1', status: 'archived', importance: 0.9 }),
    })
  })

  await page.route('**/api/agent/works', async (route) => {
    await route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({
        works: [
          {
            id: 'work_1',
            type: 'image',
            title: '月光图',
            summary: '一张月光星空。',
            previewUrl: generatedImageUrl,
            visibility: workVisibility,
            sourceConversationId: 'conversation_1',
            payload: {
              disclosure: {
                aiGenerated: true,
                explicitLabel: 'AI 生成',
                generatedAt: '2026-05-17T00:00:00.000Z',
              },
            },
            createdAt: '2026-05-17T00:00:00.000Z',
          },
        ],
      }),
    })
  })

  await page.route('**/api/agent/timeline', async (route) => {
    await route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({
        items: [
          {
            id: 't1',
            type: 'memory',
            title: '形成记忆',
            summary: '用户喜欢短句。',
            createdAt: '2026-05-17T00:00:00.000Z',
            targetId: 'memory_1',
            targetType: 'memory',
            importance: 'high',
          },
        ],
        groups: [
          {
            date: '2026-05-17',
            items: [
              {
                id: 't1',
                type: 'memory',
                title: '形成记忆',
                summary: '用户喜欢短句。',
                createdAt: '2026-05-17T00:00:00.000Z',
                targetId: 'memory_1',
                targetType: 'memory',
                importance: 'high',
              },
            ],
          },
        ],
      }),
    })
  })

  await page.route('**/api/agent/works/*', async (route) => {
    const body = route.request().postDataJSON()
    workVisibility = body.visibility
    await route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({ id: 'work_1', visibility: workVisibility }),
    })
  })

  await page.route('**/api/agent/proposals/*', async (route) => {
    await route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({ id: 'proposal_1', status: 'accepted' }),
    })
  })

  await page.route('**/api/agent/snapshots/*/restore', async (route) => {
    await route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({ restored: true, snapshotId: 'snapshot_1' }),
    })
  })

  await page.goto('/')
  await page.waitForLoadState('networkidle')

  await page.getByPlaceholder('输入星球钥匙').fill(key)
  const createResponse = page.waitForResponse(response =>
    response.url().includes('/api/keys') && response.request().method() === 'POST',
  )
  await page.getByRole('button', { name: '创建钥匙' }).click()
  expect((await createResponse).ok()).toBe(true)

  await expect(page).toHaveURL('/setup')
  await expect(page.getByLabel('星信设定')).toBeVisible()
  await expect(page.locator('option[value="public"]')).toHaveCount(0)
  await page.getByRole('textbox', { name: '称呼' }).fill('月光')
  await page.getByRole('combobox', { name: 'MBTI' }).selectOption('INFJ')
  await page.getByRole('button', { name: '保存设定' }).click()

  await expect(page).toHaveURL('/chat')
  await expect(page.getByLabel('信件正文')).toHaveCount(0)
  await expect(page.getByLabel('钥匙页面')).toHaveCount(0)
  await expect(page.getByRole('complementary', { name: '星信' })).toBeVisible()
  await expect(page.locator('.chat-theater')).toBeVisible()
  await expect(page.locator('.chat-theater__atmosphere')).toBeVisible()
  await expect(page.locator('.star-orbit-stage')).toBeVisible()
  await expect(page.getByRole('button', { name: '星球', exact: true })).toBeVisible()
  await page.getByRole('button', { name: '星球', exact: true }).click()
  const starDialog = page.getByRole('dialog', { name: '星球', exact: true })
  await expect(starDialog).toBeVisible()
  await expect(starDialog.getByRole('button', { name: '查看记忆', exact: true })).toBeVisible()
  await expect(starDialog.getByRole('button', { name: '查看作品', exact: true })).toBeVisible()
  await expect(starDialog.getByRole('button', { name: '查看边界', exact: true })).toBeVisible()
  await expect(starDialog.getByRole('button', { name: '查看记录', exact: true })).toBeVisible()
  await expect(starDialog.getByText('任务中心')).toHaveCount(0)
  await expect(starDialog.getByText('审计事件')).toHaveCount(0)

  await expect(starDialog.getByRole('dialog', { name: '记忆星球' })).toBeVisible()
  await expect(starDialog.getByRole('button', { name: '查看进化提案：调整页面' })).toBeVisible()
  await starDialog.getByRole('button', { name: '查看记忆：用户喜欢短句。' }).click()
  await expect(starDialog.getByText('重要性')).toBeVisible()
  await expect(starDialog.getByText('来源 对话 conversation_1')).toBeVisible()
  await expect(starDialog.getByText('最近记录 确认 · 用户明确表达。')).toBeVisible()
  await starDialog.getByRole('button', { name: '归档记忆' }).click()

  await starDialog.getByRole('button', { name: '查看作品', exact: true }).click()
  await expect(starDialog.getByRole('button', { name: '查看星球时间线' })).toHaveCount(0)
  await expect(starDialog.getByRole('button', { name: '查看智能体作品' })).toHaveCount(0)
  await expect(starDialog.getByText('月光图')).toBeVisible()
  await expect(starDialog.getByText('私密').first()).toBeVisible()
  await expect(starDialog.getByText('AI 生成').first()).toBeVisible()
  expect(workVisibility).toBe('private')
  await starDialog.getByRole('button', { name: '查看作品：月光图' }).click()
  await expect(starDialog.locator('.star-works-panel__detail img[alt="月光图"]')).toBeVisible()
  await starDialog.getByRole('button', { name: '公开作品' }).click()
  await expect.poll(() => workVisibility).toBe('public')

  const loadBoundaryResponse = page.waitForResponse(response =>
    response.url().includes('/api/key/profile') && response.request().method() === 'GET',
  )
  await starDialog.getByRole('button', { name: '查看边界', exact: true }).click()
  expect((await loadBoundaryResponse).ok()).toBe(true)
  const boundaryDialog = starDialog.getByRole('dialog', { name: '星信设置' })
  await expect(boundaryDialog).toBeVisible()
  await boundaryDialog.getByRole('combobox', { name: '记忆写入方式' }).selectOption('auto')
  await boundaryDialog.getByRole('textbox', { name: '不允许记住的内容' }).fill('家庭住址')
  await expect(boundaryDialog.getByRole('combobox', { name: '记忆写入方式' })).toHaveValue('auto')
  const saveBoundaryResponse = page.waitForResponse(response =>
    response.url().includes('/api/key/profile') && response.request().method() === 'PUT',
  )
  await boundaryDialog.getByRole('button', { name: '保存设置' }).click()
  expect((await saveBoundaryResponse).ok()).toBe(true)

  await starDialog.getByRole('button', { name: '查看记录', exact: true }).click()
  await expect(starDialog.getByText('模型调用失败')).toBeVisible()
  await expect(starDialog.getByText('失败 · 失败 · 2026-05-17 00:00:00')).toBeVisible()
  await expect(starDialog.getByText('provider.failed')).toHaveCount(0)
  await expect(starDialog.getByText('当前状态')).toHaveCount(0)
  await expect(starDialog.getByText('最近反思')).toHaveCount(0)
  await expect(starDialog.getByText('进化历史')).toHaveCount(0)

  await page.getByRole('button', { name: '执行' }).click()
  await expect.poll(() => memoryGovernanceApproved).toBe(true)
  await page.getByRole('button', { name: '生成页面预览' }).click()
  await expect(page.getByLabel('设计预览')).toBeVisible()
  await expect(page.getByText('银河信笺')).toBeVisible()
  await page.getByRole('button', { name: '放弃' }).click()
  await page.getByRole('button', { name: '关闭星球' }).click()
  await page.reload()
  await page.waitForLoadState('networkidle')
  await page.getByRole('button', { name: '星球', exact: true }).click()
  const reloadedStarDialog = page.getByRole('dialog', { name: '星球', exact: true })
  const reloadBoundaryResponse = page.waitForResponse(response =>
    response.url().includes('/api/key/profile') && response.request().method() === 'GET',
  )
  await reloadedStarDialog.getByRole('button', { name: '查看边界', exact: true }).click()
  expect((await reloadBoundaryResponse).ok()).toBe(true)
  await expect(reloadedStarDialog.getByRole('combobox', { name: '记忆写入方式' })).toHaveValue('auto')
  await expect(reloadedStarDialog.getByRole('textbox', { name: '不允许记住的内容' })).toHaveValue('家庭住址')
  await page.getByRole('button', { name: '关闭星球' }).click()
  await expect(page.getByText('这里会慢慢写下只属于这把钥匙的内容。')).toHaveCount(0)
  await expect(page.locator('.star-chat__dock')).not.toHaveAttribute('data-mode', /.+/)
  await expect(page.getByPlaceholder('把想说的话交给这片星空')).toBeVisible()
  await expect(page.getByRole('button', { name: '设计模式' })).toHaveCount(0)
  await expect(page.getByText('完全访问权限')).toHaveCount(0)
  await page.getByRole('button', { name: '添加附件' }).click()
  await expect(page.getByRole('menuitem', { name: '上传图片' })).toBeVisible()
  await expect(page.getByRole('menuitem', { name: '上传音频' })).toBeVisible()
  await expect(page.getByRole('menuitem', { name: '上传视频' })).toBeVisible()
  await page.mouse.click(20, 20)
  await expect(page.getByRole('menuitem', { name: '上传视频' })).toHaveCount(0)

  await page.getByLabel('和星信说话').fill('这封信是真的吗？')
  await page.getByLabel('和星信说话').press('Enter')
  await expect(page.getByText('这句我会记得。')).toBeVisible()
  expect(plainChatSeen).toBe(true)
  await page.getByRole('button', { name: '星球', exact: true }).click()
  const timelineStarDialog = page.getByRole('dialog', { name: '星球', exact: true })
  await timelineStarDialog.getByRole('button', { name: '查看记忆', exact: true }).click()
  await expect(timelineStarDialog.getByRole('button', { name: '查看星球时间线' })).toHaveCount(0)
  await expect(timelineStarDialog.getByRole('button', { name: '查看智能体作品' })).toHaveCount(0)
  const planetBox = await page.locator('.memory-planet-panel').boundingBox()
  const dockBox = await page.locator('.star-chat__dock').boundingBox()
  expect(planetBox).not.toBeNull()
  expect(dockBox).not.toBeNull()
  expect(planetBox!.y + planetBox!.height).toBeLessThan(dockBox!.y)
  await page.getByRole('button', { name: '关闭星球' }).click()
  await expect(page.getByText('这封信里的星光')).toHaveCount(0)
  await expect(page.locator('.star-orbit-group').first()).toBeVisible()

  await page.getByLabel('和星信说话').fill('生成一张月光星空图片')
  await page.getByLabel('和星信说话').press('Enter')
  await expect(page.getByText('正在生成图片。')).toBeVisible()
  await expect(page.getByText('画好了。')).toBeVisible()
  await expect(page.locator('.star-orbit-stage img[alt="生成的图片"]')).toBeVisible()
  expect(imageGenerationRequests).toBe(1)
  await expect(page.locator('.generated-asset')).toHaveCount(0)

  await page.getByLabel('和星信说话').fill('制作一个音乐')
  await page.getByLabel('和星信说话').press('Enter')
  await expect(page.getByText('正在生成音乐。')).toBeVisible()
  await expect(page.getByText('音乐做好了。')).toBeVisible()
  await expect(page.locator('.star-orbit-stage .star-audio-player[data-kind="music"]')).toBeVisible()
  await expect(page.locator('.star-orbit-stage audio[data-kind="music"]')).toHaveAttribute('src', generatedMusicUrl)
  expect(musicGenerationRequests).toBe(1)

  await page.getByLabel('和星信说话').fill('这段回忆像一张照片，可以处理吗？')
  await page.getByLabel('和星信说话').press('Enter')
  await expect(page.getByText('生成图片建议')).toBeVisible()
  await expect(page.getByText('建议生成图片前需要确认。')).toBeVisible()
  expect(imageGenerationRequests).toBe(1)
  await page.getByRole('button', { name: '批准工具请求' }).click()
  expect(chatToolApprovalRequested).toBe(true)

  await page.reload()
  await page.waitForLoadState('networkidle')
  await page.goto('/')
  await page.waitForLoadState('networkidle')
  await expect(page.getByText('公开星球')).toBeVisible()
  await page.getByPlaceholder('输入星球钥匙').fill(key)
  await expect(page.getByPlaceholder('输入星球钥匙')).toHaveValue(key)
  const unlockResponse = page.waitForResponse(response =>
    response.url().includes('/api/unlock') && response.request().method() === 'POST',
  )
  await page.getByRole('button', { name: '进入星球' }).click()
  expect((await unlockResponse).ok()).toBe(true)
  await expect(page).toHaveURL('/chat')
  await expect(page.getByLabel('星信设定')).toHaveCount(0)
  await expect(page.getByLabel('信件正文')).toHaveCount(0)
  await expect(page.getByRole('complementary', { name: '星信' })).toBeVisible()

  await page.goBack()
  await expect(page).toHaveURL('/')
})
