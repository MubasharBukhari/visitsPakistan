import { GET as webHealth } from '../apps/web/src/app/health/route';
import { GET as webReady } from '../apps/web/src/app/ready/route';
import { GET as cmsHealth } from '../apps/cms/src/app/health/route';
import { GET as cmsReady } from '../apps/cms/src/app/ready/route';
afterEach(() => jest.restoreAllMocks());
test.each([
  ['web', webHealth],
  ['cms', cmsHealth],
] as const)(
  '%s liveness is uncached and independent of the API',
  async (service, handler) => {
    const response = handler();
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ status: 'ok', service });
    expect(response.headers.get('cache-control')).toBe('no-store');
  },
);
test.each([
  ['web', webReady],
  ['cms', cmsReady],
] as const)(
  '%s readiness fails safely when the API is unavailable',
  async (service, handler) => {
    jest
      .spyOn(globalThis, 'fetch')
      .mockRejectedValue(new Error('private upstream details'));
    const response = await handler();
    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ status: 'unavailable', service });
    expect(response.headers.get('cache-control')).toBe('no-store');
  },
);
test.each([
  ['web', webReady],
  ['cms', cmsReady],
] as const)(
  '%s rejects failed API readiness and recovers when API is ready',
  async (service, handler) => {
    const fetch = jest
      .spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(new Response(null, { status: 503 }))
      .mockResolvedValueOnce(Response.json({ status: 'ok' }));
    expect((await handler()).status).toBe(503);
    const ready = await handler();
    expect(ready.status).toBe(200);
    expect(await ready.json()).toEqual({ status: 'ok', service });
    expect(fetch).toHaveBeenCalledTimes(2);
  },
);
