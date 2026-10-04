import { NextRequest } from 'next/server';
import { POST } from '../apps/cms/src/app/cms-api/[...path]/route';
jest.mock('next/headers', () => ({
  cookies: async () => ({ get: () => undefined }),
}));
afterEach(() => jest.restoreAllMocks());
test('anonymous recovery BFF checks origin and never needs an existing staff session', async () => {
  const fetch = jest
    .spyOn(globalThis, 'fetch')
    .mockResolvedValue(
      Response.json({ message: 'Generic recovery response' }, { status: 202 }),
    );
  const url = 'http://localhost:3001/cms-api/auth/forgot-password/';
  const context = {
    params: Promise.resolve({ path: ['auth', 'forgot-password'] }),
  };
  const forbidden = await POST(
    new NextRequest(url, {
      method: 'POST',
      headers: { origin: 'https://other.example' },
    }),
    context,
  );
  expect(forbidden.status).toBe(403);
  expect(fetch).not.toHaveBeenCalled();
  const response = await POST(
    new NextRequest(url, {
      method: 'POST',
      headers: {
        origin: 'http://localhost:3001',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ email: 'staff@example.test' }),
    }),
    context,
  );
  expect(response.status).toBe(202);
  expect(response.headers.get('Cache-Control')).toBe('no-store');
  expect(fetch).toHaveBeenCalledWith(
    expect.stringContaining('/api/v1/admin/auth/forgot-password'),
    expect.objectContaining({ cache: 'no-store' }),
  );
});
test('recovery pages provide accessible forms, password limits and sign-in links', async () => {
  const { renderToStaticMarkup } = await import('react-dom/server');
  const { default: Forgot } =
    await import('../apps/cms/src/app/forgot-password/page');
  const { default: Reset, metadata } =
    await import('../apps/cms/src/app/reset-password/page');
  const forgot = renderToStaticMarkup(Forgot()),
    reset = renderToStaticMarkup(Reset());
  expect(forgot).toContain('Send recovery link');
  expect(forgot).toContain('type="email"');
  expect(forgot).toMatch(/href="\/login\/?"/);
  expect(reset).toContain('minLength="12"');
  expect(reset).toContain('Authenticator code');
  expect(reset).toContain('disabled=""');
  expect(metadata.referrer).toBe('no-referrer');
});
