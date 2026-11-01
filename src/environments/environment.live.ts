/**
 * Live build: talks to the api-gateway of order-microservices.
 * `ng serve --configuration live` proxies /api to http://localhost:8080 (see proxy.conf.json).
 */
export const environment = {
  demo: false,
  apiUrl: '',
  demoLatencyMs: 0,
  paymentDelayMs: 0,
  pollMs: 2000,
};
