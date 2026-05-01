import { test, expect } from '@playwright/test';

const USER_ID = 'u1';

const createCv = async (page, overrides = {}) => {
  return page.evaluate(async ({ userId, payload }) => {
    const res = await fetch('/api/cvs', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-user-id': userId
      },
      body: JSON.stringify(payload)
    });
    const json = await res.json();
    return json.data;
  }, {
    userId: USER_ID,
    payload: {
      title: 'E2E CV',
      content_json: { html: '<h2>CV Editor</h2><p>Seed content</p>' },
      ...overrides
    }
  });
};

test.beforeEach(async ({ page }) => {
  await page.goto('/');
});

test('shows My CVs heading and status tabs', async ({ page }) => {
  await page.getByRole('button', { name: 'My CVs' }).click();
  await expect(page.getByRole('heading', { name: 'My CVs' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Active' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Archived' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Deleted' })).toBeVisible();
});

test('shows duplicate action when list has rows', async ({ page }) => {
  await createCv(page, { title: 'Duplicate Target' });
  await page.getByRole('button', { name: 'My CVs' }).click();
  await expect(page.getByRole('button', { name: 'Duplicate' }).first()).toBeVisible();
});

test('switching to deleted tab shows restore action for deleted CV', async ({ page }) => {
  const created = await createCv(page, { title: 'Delete then restore' });

  await page.evaluate(async ({ id, userId }) => {
    await fetch(`/api/cvs/${id}/delete`, { method: 'POST', headers: { 'x-user-id': userId } });
  }, { id: created.id, userId: USER_ID });

  await page.getByRole('button', { name: 'My CVs' }).click();
  await page.getByRole('button', { name: 'Deleted' }).click();
  await expect(page.getByRole('button', { name: 'Restore' }).first()).toBeVisible();
});

test('editor save status is visible for a valid CV id', async ({ page }) => {
  const created = await createCv(page, { title: 'Editor CV' });
  await page.goto(`/?id=${created.id}`);
  await expect(page.locator('.editor-toolbar small')).toContainText('Saved');
});

test('autosave keeps status visible after editing', async ({ page }) => {
  const created = await createCv(page, { title: 'Autosave CV' });
  await page.goto(`/?id=${created.id}`);

  const doc = page.locator('.cv-document');
  const status = page.locator('.editor-toolbar small');

  await doc.click();
  await page.keyboard.type(' Autosave smoke text');

  await expect(status).toContainText(/Saved|Saving…/);
  await page.waitForTimeout(7600);
  await expect(status).toContainText('Saved');
});

test('snapshot modal opens from editor', async ({ page }) => {
  const created = await createCv(page, { title: 'Snapshot CV' });
  await page.goto(`/?id=${created.id}`);
  await page.getByRole('button', { name: 'Snapshots' }).click();
  await expect(page.getByRole('heading', { name: 'Snapshots' })).toBeVisible();
});

test('unsaved navigation shows confirmation dialog', async ({ page }) => {
  const created = await createCv(page, { title: 'Confirm Nav CV' });
  await page.goto(`/?id=${created.id}`);

  const dialogPromise = page.waitForEvent('dialog');
  await page.locator('.cv-document').click();
  await page.keyboard.type(' unsaved text');
  await page.getByRole('button', { name: 'My CVs' }).click();

  const dialog = await dialogPromise;
  expect(dialog.message()).toContain('You have unsaved changes');
  await dialog.accept();
});

test('My CVs page keeps empty-state CTA visible when list is empty', async ({ page }) => {
  await page.getByRole('button', { name: 'My CVs' }).click();
  await expect(page.getByRole('button', { name: 'Create your first CV' }).first()).toBeVisible();
});
