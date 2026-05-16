import { expect, test } from '@playwright/test'

test('creates a key, configures profile, chats, designs, and re-enters', async ({ page }, testInfo) => {
  const runId = Date.now()
  const key = `e2e-${testInfo.project.name}-${runId}`
  const forwardedIp = `e2e-${testInfo.project.name}-${runId}`
  const generatedImageUrl = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw=='

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
  await expect(page.getByLabel('钥匙页面')).toBeVisible()
  await expect(page.getByRole('complementary', { name: '星信' })).toBeVisible()
  await expect(page.locator('.chat-theater')).toBeVisible()
  await expect(page.locator('.chat-theater__atmosphere')).toBeVisible()
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
  await expect(page.getByText('这封信里的星光')).toHaveCount(0)
  await expect(page.locator('.star-chat__thread')).toHaveCSS('border-top-width', '0px')

  await page.getByRole('button', { name: '画一张' }).click()
  await page.getByLabel('和星信说话').fill('画一张月光星空')
  await page.getByLabel('和星信说话').press('Enter')
  await expect(page.getByText('画好了。')).toBeVisible()
  await expect(page.locator('.star-chat__messages img[alt="生成的图片"]')).toBeVisible()
  await expect(page.locator('.generated-asset')).toHaveCount(0)

  await page.getByRole('button', { name: '设计模式' }).click()
  await page.getByPlaceholder('请输入你的创意想法').fill('把页面改成银河和月光')
  await page.getByRole('button', { name: '发送' }).click()
  await expect(page.getByText('银河信笺')).toBeVisible()
  await page.getByRole('button', { name: '保存这个设计' }).click()
  await expect(page.getByText('保存后，这片星空会留在这把钥匙里。')).toBeVisible()

  await page.getByRole('button', { name: '打开记忆星图' }).click()
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
