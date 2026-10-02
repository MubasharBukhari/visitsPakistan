import { createClient } from 'redis';
import type { DependencyProbe } from '@visitspakistan/domain';
export function createCacheProbe(
  url: string,
  timeoutMs: number,
): DependencyProbe {
  const client = createClient({
    url,
    disableOfflineQueue: true,
    socket: { connectTimeout: timeoutMs, reconnectStrategy: false },
  });
  client.on('error', () => {
    /* Health reports only safe dependency states. */
  });
  return {
    name: 'redis',
    required: false,
    async check() {
      if (!client.isOpen) await client.connect();
      if (
        (await client
          .withAbortSignal(AbortSignal.timeout(timeoutMs))
          .ping()) !== 'PONG'
      )
        throw new Error('Cache unavailable');
    },
    async close() {
      if (client.isOpen) client.destroy();
    },
  };
}
