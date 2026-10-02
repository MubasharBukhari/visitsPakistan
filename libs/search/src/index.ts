import type { DependencyProbe } from '@visitspakistan/domain';
export function createSearchProbe(
  url: string,
  timeoutMs: number,
): DependencyProbe {
  return {
    name: 'opensearch',
    required: false,
    async check() {
      const response = await fetch(new URL('/_cluster/health', url), {
        signal: AbortSignal.timeout(timeoutMs),
      });
      if (!response.ok) throw new Error('Search unavailable');
      const body = (await response.json()) as { status?: string };
      if (!['green', 'yellow'].includes(body.status ?? ''))
        throw new Error('Search unhealthy');
    },
    close: async () => {},
  };
}
