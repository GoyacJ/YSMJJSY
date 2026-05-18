import { expect, test } from '@playwright/test'

test('creates a key, configures profile, chats, designs, and re-enters', async ({ page }, testInfo) => {
  const runId = Date.now()
  const key = `e2e-${testInfo.project.name}-${runId}`
  const forwardedIp = `e2e-${testInfo.project.name}-${runId}`
  const generatedImageUrl = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw=='
  let sleepCompleted = false
  let workVisibility: 'private' | 'public' = 'private'
  let rollbackRestored = false
  let memoryGovernanceApproved = false

  await page.setExtraHTTPHeaders({ 'x-forwarded-for': forwardedIp })

  await page.route('**/api/chat/stream', async (route) => {
    const body = route.request().postDataJSON()

    if (body.intent === 'image') {
      await route.fulfill({
        contentType: 'text/event-stream',
        body: [
          `data: ${JSON.stringify({
            type: 'message',
            reply: '画好了。',
            message: {
              role: 'assistant',
              content: '画好了。',
              parts: [
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
    if (route.request().url().includes('memory_governance')) {
      memoryGovernanceApproved = true
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
    rollbackRestored = true
    await route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({ restored: true, snapshotId: 'snapshot_1' }),
    })
  })

  async function clickChatTool(name: string) {
    const visibleTool = page.getByRole('button', { name }).first()

    if (await visibleTool.count()) {
      await visibleTool.click()
      return
    }

    await page.getByRole('button', { name: '添加附件' }).click()
    await page.getByRole('button', { name }).click()
  }

  await page.goto('/')
  await page.waitForLoadState('networkidle')

  await page.getByPlaceholder('输入钥匙').fill(key)
  const createResponse = page.waitForResponse(response =>
    response.url().includes('/api/keys') && response.request().method() === 'POST',
  )
  await page.getByRole('button', { name: '创建钥匙' }).click()
  expect((await createResponse).ok()).toBe(true)

  await expect(page).toHaveURL('/setup')
  await expect(page.getByLabel('星信设定')).toBeVisible()
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
  await expect(page.getByRole('button', { name: '打开星AI' })).toBeVisible()
  await page.getByRole('button', { name: '打开星AI' }).click()
  await expect(page.getByLabel('星AI')).toBeVisible()
  await expect(page.getByText('决策收件箱')).toBeVisible()
  await expect(page.getByText('任务中心')).toBeVisible()
  await expect(page.getByText('睡眠整理')).toBeVisible()
  await expect(page.getByText('审计事件')).toBeVisible()
  await expect(page.getByText('Provider failed')).toBeVisible()
  await page.getByRole('button', { name: '执行' }).click()
  await expect.poll(() => memoryGovernanceApproved).toBe(true)
  await page.getByRole('button', { name: '生成设计预览' }).click()
  await expect(page.getByLabel('设计预览')).toBeVisible()
  await expect(page.getByText('银河信笺')).toBeVisible()
  await page.getByRole('button', { name: '放弃' }).click()
  await page.getByRole('button', { name: '回滚提案' }).click()
  await expect.poll(() => rollbackRestored).toBe(true)
  await page.getByRole('button', { name: '让智能体思考' }).click()
  await expect(page.getByText('整理完成。')).toBeVisible()
  await expect(page.getByText('短句回信')).toBeVisible()
  await expect(page.getByText('承接短句偏好')).toBeVisible()
  await page.getByRole('button', { name: '关闭面板' }).click()
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
  await page.getByRole('button', { name: '打开星信设置' }).click()
  const settingsDialog = page.getByRole('dialog', { name: '星信设置' })
  await expect(settingsDialog).toBeVisible()
  await expect(settingsDialog.getByText('星AI')).toHaveCount(0)
  await expect(settingsDialog.getByText('智能体核心')).toHaveCount(0)
  await page.getByRole('button', { name: '关闭设置' }).click()
  await page.getByRole('button', { name: '打开记忆星球' }).click()
  const planetDialog = page.getByRole('dialog', { name: '记忆星球' })
  await expect(planetDialog).toBeVisible()
  await expect(planetDialog.getByText('星AI')).toHaveCount(0)
  await expect(planetDialog.getByText('智能体核心')).toHaveCount(0)
  await expect(page.getByRole('button', { name: '查看进化提案：调整页面' })).toBeVisible()
  await page.getByRole('button', { name: '查看进化提案：调整页面' }).click()
  await expect(planetDialog.getByText('让页面更像星空。', { exact: true }).first()).toBeVisible()
  await expect(page.getByRole('button', { name: '查看记忆：用户喜欢短句。' })).toBeVisible()
  await page.getByRole('button', { name: '查看记忆：用户喜欢短句。' }).click()
  await expect(planetDialog.getByText('重要性')).toBeVisible()
  await expect(planetDialog.getByText('来源 conversation_1')).toBeVisible()
  await expect(planetDialog.getByText('最近治理动作 confirm · 用户明确表达。')).toBeVisible()
  await planetDialog.getByRole('button', { name: '归档记忆' }).click()
  await planetDialog.getByRole('button', { name: '查看星球时间线' }).click()
  await expect(planetDialog.getByText('2026-05-17')).toBeVisible()
  await expect(planetDialog.getByText('形成记忆')).toBeVisible()
  await expect(planetDialog.getByText('高信号')).toBeVisible()
  await planetDialog.getByRole('button', { name: '查看智能体作品' }).click()
  await expect(planetDialog.getByText('月光图')).toBeVisible()
  await expect(planetDialog.locator('.memory-planet-panel__work-preview[alt="月光图"]')).toBeVisible()
  await planetDialog.getByRole('button', { name: '查看作品：月光图' }).click()
  await expect(planetDialog.locator('.memory-planet-panel__detail img[alt="月光图"]')).toBeVisible()
  await planetDialog.getByRole('button', { name: '公开作品' }).click()
  const planetBox = await page.locator('.memory-planet-panel').boundingBox()
  const dockBox = await page.locator('.star-chat__dock').boundingBox()
  expect(planetBox).not.toBeNull()
  expect(dockBox).not.toBeNull()
  expect(planetBox!.y + planetBox!.height).toBeLessThan(dockBox!.y)
  await page.getByRole('button', { name: '关闭记忆星球' }).click()
  await expect(page.getByText('这封信里的星光')).toHaveCount(0)
  await expect(page.locator('.star-orbit-group').first()).toBeVisible()

  await clickChatTool('画一张')
  await page.getByLabel('和星信说话').fill('画一张月光星空')
  await page.getByLabel('和星信说话').press('Enter')
  await expect(page.getByText('画好了。')).toBeVisible()
  await expect(page.locator('.star-orbit-stage img[alt="生成的图片"]')).toBeVisible()
  await expect(page.locator('.generated-asset')).toHaveCount(0)

  await page.request.post('/api/design/commit', {
    data: {
      prompt: '把页面改成银河和月光',
      schema: {
        version: 1,
        theme: 'moon-note',
        palette: 'midnight',
        title: '银河信笺',
        subtitle: '把这一页改成更像星空的样子。',
        sections: [
          { type: 'letter', layout: 'star-trail', text: '这是一段由测试保存的设计。' },
          { type: 'star-scene', density: 0.8, caption: '保存后，这片星空会留在这把钥匙里。' },
        ],
      },
    },
  })
  const worksResponse = await page.request.get('/api/agent/works')
  const worksBody = await worksResponse.json()
  const committedDesignWork = worksBody.works.find((work: { type: string }) => work.type === 'page_design')
  expect(committedDesignWork).toBeTruthy()
  await page.request.put(`/api/agent/works/${committedDesignWork.id}`, {
    data: { visibility: 'public' },
  })

  await page.getByRole('button', { name: '打开星信设置' }).click()
  await expect(page.getByRole('dialog', { name: '星信设置' })).toBeVisible()
  await expect(page.getByRole('textbox', { name: '称呼' })).toHaveValue('月光')
  await expect(page.getByRole('combobox', { name: 'MBTI' })).toHaveValue('INFJ')
  await page.getByRole('button', { name: '关闭设置' }).click()

  await page.reload()
  await page.waitForLoadState('networkidle')
  await page.goto('/')
  await page.waitForLoadState('networkidle')
  await expect(page.getByText('公开星球')).toBeVisible()
  await expect(page.getByText('月光 / INFJ').first()).toBeVisible()
  await expect(page.getByText('银河信笺').first()).toBeVisible()
  await expect(page.getByText('把页面改成银河和月光').first()).toBeVisible()
  await page.getByPlaceholder('输入钥匙').fill(key)
  await expect(page.getByPlaceholder('输入钥匙')).toHaveValue(key)
  const unlockResponse = page.waitForResponse(response =>
    response.url().includes('/api/unlock') && response.request().method() === 'POST',
  )
  await page.getByRole('button', { name: '进入' }).click()
  expect((await unlockResponse).ok()).toBe(true)
  await expect(page).toHaveURL('/chat')
  await expect(page.getByLabel('星信设定')).toHaveCount(0)
  await expect(page.getByLabel('信件正文')).toHaveCount(0)
  await expect(page.getByRole('complementary', { name: '星信' })).toBeVisible()

  await page.goBack()
  await expect(page).toHaveURL('/')
})
