import type { DependencyProbe } from '@visitspakistan/domain';
export function stubProbe(
  name: string,
  required: boolean,
  available = true,
): DependencyProbe {
  return {
    name,
    required,
    async check() {
      if (!available) throw new Error('Private credential must not leak');
    },
    close: async () => {},
  };
}
