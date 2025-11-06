const config = require("./config");

// Metrics stored in memory
const requests = {};

// Middleware to track requests
function requestTracker(req, res, next) {
  const endpoint = `[${req.method}] ${req.path}`;
  requests[endpoint] = (requests[endpoint] || 0) + 1;
  next();
}

function httpMetrics() {
  const metrics = [];
  Object.keys(requests).forEach((endpoint) => {
    metrics.push(
      createMetric("requests", requests[endpoint], "1", "sum", "asInt", {
        endpoint,
      })
    );
  });
  return metrics;
}

function systemMetrics() {
  return [];
}
function userMetrics() {
  return [];
}
function purchaseMetrics() {
  return [];
}
function authMetrics() {
  return [];
}

function createMetric(
  metricName,
  metricValue,
  metricUnit,
  metricType,
  valueType,
  attributes
) {
  attributes = { ...attributes, source: config.source };

  const metric = {
    name: metricName,
    unit: metricUnit,
    [metricType]: {
      dataPoints: [
        {
          [valueType]: metricValue,
          timeUnixNano: Date.now() * 1000000,
          attributes: [],
        },
      ],
    },
  };

  Object.keys(attributes).forEach((key) => {
    metric[metricType].dataPoints[0].attributes.push({
      key: key,
      value: { stringValue: attributes[key] },
    });
  });

  if (metricType === "sum") {
    metric[metricType].aggregationTemporality =
      "AGGREGATION_TEMPORALITY_CUMULATIVE";
    metric[metricType].isMonotonic = true;
  }

  return metric;
}

class MetricBuilder {
  constructor() {
    this.metrics = [];
  }

  add(metricArray) {
    if (Array.isArray(metricArray)) {
      this.metrics.push(...metricArray);
    }
  }

  async sendToGrafana() {
    const body = {
      resourceMetrics: [
        {
          scopeMetrics: [
            {
              metrics: this.metrics,
            },
          ],
        },
      ],
    };

    fetch(`${config.url}`, {
      method: "POST",
      body: JSON.stringify(body),
      headers: {
        Authorization: `Bearer ${config.apiKey}`,
        "Content-Type": "application/json",
      },
    })
      .then((response) => {
        if (!response.ok) {
          throw new Error(`HTTP status: ${response.status}`);
        }
      })
      .catch((error) => {
        console.error("Error pushing metrics:", error);
      });
  }
}

function sendMetricsPeriodically(period) {
  setInterval(() => {
    try {
      const metricsBuilder = new MetricBuilder();
      metricsBuilder.add(httpMetrics());
      metricsBuilder.add(systemMetrics());
      metricsBuilder.add(userMetrics());
      metricsBuilder.add(purchaseMetrics());
      metricsBuilder.add(authMetrics());
      metricsBuilder.sendToGrafana();
    } catch (error) {
      console.error("Error sending metrics:", error);
    }
  }, period);
}

module.exports = { requestTracker, sendMetricsPeriodically };
