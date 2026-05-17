import { expect, test } from '@playwright/test'

test('creates a key, configures profile, chats, designs, and re-enters', async ({ page }, testInfo) => {
  const runId = Date.now()
  const key = `e2e-${testInfo.project.name}-${runId}`
  const forwardedIp = `e2e-${testInfo.project.name}-${runId}`
  const generatedImageUrl = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw=='
  let sleepCompleted = false
  let workVisibility: 'private' | 'public' = 'private'

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
            { type: 'letter', layout: 'star-trail', text: '这是一段由设计模式生成的预览。' },
            { type: 'star-scene', density: 0.8, caption: '保存后，这片星空会留在这把钥匙里。' },
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
              type: 'tone',
              title: '更短',
              summary: '回复更短。',
              payload: { tone: '更短' },
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
              status: 'accepted',
              createdAt: '2026-05-17T00:01:00.000Z',
              updatedAt: '2026-05-17T00:01:00.000Z',
            },
          ],
        },
        sleep: {
          lastSleepAt: sleepCompleted ? '2026-05-17T00:10:00.000Z' : null,
          nextSleepAt: '2026-05-17T12:00:00.000Z',
          latestRun: sleepCompleted
            ? {
                id: 'sleep_1',
                status: 'completed',
                summary: '整理完成。',
                startedAt: '2026-05-17T00:10:00.000Z',
                completedAt: '2026-05-17T00:10:00.000Z',
                error: null,
              }
            : null,
        },
      }),
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
            visibility: workVisibility,
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
  await page.getByRole('button', { name: '关闭面板' }).click()
  await expect(page.getByText('这里会慢慢写下只属于这把钥匙的内容。')).toHaveCount(0)
  await expect(page.locator('.star-chat__dock')).toHaveAttribute('data-mode', 'chat')
  await expect(page.getByPlaceholder('把想说的话交给这片星空')).toBeVisible()
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
  await expect(planetDialog.getByText('星AI')).toBeVisible()
  await expect(planetDialog.getByText('智能体核心')).toHaveCount(0)
  await expect(planetDialog.getByText('克制、温柔、安静')).toBeVisible()
  await expect(planetDialog.getByText('用户在聊天里确认想要短句回应。')).toBeVisible()
  await expect(planetDialog.getByText('回复更短。')).toBeVisible()
  await planetDialog.getByRole('button', { name: '让智能体思考' }).click()
  await expect(planetDialog.getByText('整理完成。')).toBeVisible()
  await expect(page.getByRole('button', { name: '查看记忆：用户喜欢短句。' })).toBeVisible()
  await page.getByRole('button', { name: '查看记忆：用户喜欢短句。' }).click()
  await expect(planetDialog.getByText('重要性')).toBeVisible()
  await planetDialog.getByRole('button', { name: '归档记忆' }).click()
  await planetDialog.getByRole('button', { name: '查看星球时间线' }).click()
  await expect(planetDialog.getByText('形成记忆')).toBeVisible()
  await planetDialog.getByRole('button', { name: '查看智能体作品' }).click()
  await expect(planetDialog.getByText('月光图')).toBeVisible()
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

  await clickChatTool('设计模式')
  await page.getByPlaceholder('请输入你的创意想法').fill('把页面改成银河和月光')
  await page.getByRole('button', { name: '发送' }).click()
  await expect(page.getByText('银河信笺')).toBeVisible()
  await page.getByRole('button', { name: '保存这个设计' }).click()
  await expect(page.getByText('保存后，这片星空会留在这把钥匙里。')).toBeVisible()

  await page.getByRole('button', { name: '打开星信设置' }).click()
  await expect(page.getByRole('dialog', { name: '星信设置' })).toBeVisible()
  await expect(page.getByRole('textbox', { name: '称呼' })).toHaveValue('月光')
  await expect(page.getByRole('combobox', { name: 'MBTI' })).toHaveValue('INFJ')
  await page.getByRole('button', { name: '关闭设置' }).click()

  await page.reload()
  await page.waitForLoadState('networkidle')
  await page.goto('/')
  await page.waitForLoadState('networkidle')
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
