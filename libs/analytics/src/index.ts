/** Consent-aware event boundary; no tracking/provider is enabled in Sprint 0. */
export interface AnalyticsEvent {
  readonly id: string;
  readonly name: string;
  readonly occurredAt: string;
  readonly entityId?: string;
}
