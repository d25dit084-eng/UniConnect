/**
 * Web Vitals reporter for development.
 * Records CLS, INP, LCP, FCP, TTFB to console in a structured format.
 * Also stores running baseline in sessionStorage so you can compare across navigations.
 */

const STORAGE_KEY = 'uniconnect_web_vitals_baseline';

const BUDGETS = {
  CLS: 0.05, // Cumulative Layout Shift   < 0.05  (good)
  INP: 200, // Interaction to Next Paint  < 200ms (good)
  LCP: 2500, // Largest Contentful Paint   < 2500ms (good)
  FCP: 1800, // First Contentful Paint     < 1800ms (good)
  TTFB: 800, // Time to First Byte         < 800ms (good)
};

function rate(name, value) {
  const budget = BUDGETS[name];
  if (budget == null) return '❓';
  if (name === 'CLS') {
    return value < 0.05 ? '✅' : value < 0.1 ? '⚠️' : '❌';
  }
  return value < budget ? '✅' : value < budget * 1.5 ? '⚠️' : '❌';
}

function persist(metric) {
  try {
    const stored = JSON.parse(sessionStorage.getItem(STORAGE_KEY) || '{}');
    stored[metric.name] = {
      value: metric.value,
      rating: metric.rating,
      id: metric.id,
      entries: metric.entries?.length,
    };
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(stored));
  } catch (_) {}
}

function report(metric) {
  const { name, value } = metric;
  const display = name === 'CLS' ? value.toFixed(4) : `${Math.round(value)} ms`;
  const icon = rate(name, value);
  const budget =
    BUDGETS[name] != null
      ? name === 'CLS'
        ? ` (budget < ${BUDGETS[name]})`
        : ` (budget < ${BUDGETS[name]}ms)`
      : '';
  console.log(`[WebVitals] ${icon} ${name}: ${display}${budget}`);
  persist(metric);
}

export function initWebVitals() {
  if (!import.meta.env.DEV) return; // Only in dev mode

  import('web-vitals')
    .then(({ onCLS, onINP, onLCP, onFCP, onTTFB }) => {
      onCLS(report);
      onINP(report);
      onLCP(report);
      onFCP(report);
      onTTFB(report);
      console.log(
        '[WebVitals] Monitoring active. Metrics will be logged to console and stored in sessionStorage under "uniconnect_web_vitals_baseline".'
      );
    })
    .catch((err) => {
      console.warn('[WebVitals] Failed to load web-vitals library:', err.message);
    });
}

export function getBaselineReport() {
  try {
    return JSON.parse(sessionStorage.getItem(STORAGE_KEY) || '{}');
  } catch (_) {
    return {};
  }
}

export default initWebVitals;
