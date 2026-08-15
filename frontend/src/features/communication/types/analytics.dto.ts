/**
 * Wire shape for `GET /communication/delivery-logs/analytics`.
 *
 * Query is documented as exactly `organizationId` and `branchId`. The
 * response example is the schema generator's placeholder, but
 * `docs/communication-module-ui-spec.md` (§9) states the endpoint's full,
 * flat payload: six counters and three rates and nothing else — no date
 * range, no channel breakdown, no time series. Everything this module's
 * analytics screen cannot show is a documented absence, not an oversight.
 */

export interface DeliveryAnalyticsQuery {
  organizationId?: string;
  branchId?: string;
}

export interface DeliveryAnalyticsMetrics {
  deliveryRate?: number;
  failureRate?: number;
  bounceRate?: number;
}

export interface DeliveryAnalyticsDto {
  total?: number;
  sent?: number;
  delivered?: number;
  failed?: number;
  bounced?: number;
  metrics?: DeliveryAnalyticsMetrics;
}
