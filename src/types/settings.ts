export interface ScoringWeights {
  scopeFit: number;
  countryFit: number;
  agencyHistory: number;
  valueSize: number;
  timeToPrepare: number;
}

export type DataSourceHealth = "OK" | "DEGRADED" | "DOWN" | "NOT_CONFIGURED";

export interface DataSourceStatus {
  id: string;
  name: string;
  kind: "API" | "EMAIL" | "STORAGE" | "AI";
  health: DataSourceHealth;
  lastSyncAt?: string;
  detail: string;
}

export interface TeaSettings {
  keywords: string[];
  countries: string[];
  agencies: string[];
  weights: ScoringWeights;
  minPreparationDays: number;
  /** Margin percentage under which the costing tab shows a warning. */
  marginWarningPct: number;
  /** Display only: managed by the backend. */
  dataSources: DataSourceStatus[];
}
