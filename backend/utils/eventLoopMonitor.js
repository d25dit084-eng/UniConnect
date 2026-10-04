const { monitorEventLoopDelay } = require('perf_hooks');

const histogram = monitorEventLoopDelay({ resolution: 10 });
histogram.enable();

const getEventLoopStats = () => {
  const p50 = histogram.percentile(50) / 1e6;
  const p95 = histogram.percentile(95) / 1e6;
  const p99 = histogram.percentile(99) / 1e6;
  const max = histogram.max / 1e6;
  const mean = histogram.mean / 1e6;

  return {
    p50LagMs: Number(p50.toFixed(2)),
    p95LagMs: Number(p95.toFixed(2)),
    p99LagMs: Number(p99.toFixed(2)),
    maxLagMs: Number(max.toFixed(2)),
    meanLagMs: Number(mean.toFixed(2)),
  };
};

module.exports = {
  histogram,
  getEventLoopStats,
};
