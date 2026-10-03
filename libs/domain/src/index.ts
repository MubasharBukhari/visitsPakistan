/** Framework-free platform and canonical graph contracts. */
export type DependencyState = 'up' | 'down';
export interface DependencyProbe {
  readonly name: string;
  readonly required: boolean;
  check(): Promise<void>;
  close(): Promise<void>;
}

export * from './knowledge-graph';
export * from './editorial';

export * from './destinations';

export * from './discovery';
