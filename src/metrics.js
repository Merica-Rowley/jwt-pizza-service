const config = require("./config");

// Metrics stored in memory
const requests = {};

const activeSessions = {}; // { userId: lastSeenTimestamp }
const ACTIVE_TIMEOUT = 5 * 60 * 1000; // 5 minutes

const loginMetrics = {
  success: 0,
  failed: 0,
};

// Middleware to track requests
function requestTracker(req, res, next) {
  // const endpoint = `[${req.method}] ${req.path}`;
  // requests[endpoint] = (requests[endpoint] || 0) + 1;
  const method = req.method;
  const path = req.path;

  const key = `${method} ${path}`; // e.g., "POST /api/user"
  requests[key] = (requests[key] || 0) + 1;

  next();
}

// Middleware to track active users
function trackActiveSession(req, res, next) {
  const authHeader = req.headers["authorization"];
  if (authHeader && authHeader.startsWith("Bearer ")) {
    const token = authHeader.split(" ")[1]; // remove "Bearer " prefix
    activeSessions[token] = Date.now();
  }
  next();
}

// Helper function to call from logout
function removeActiveSession(token) {
  delete activeSessions[token];
}

function recordSuccessfulLogin() {
  loginMetrics.success++;
}

function recordFailedLogin() {
  loginMetrics.failed++;
}

// - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -

function httpMetrics() {
  const metrics = [];
  Object.keys(requests).forEach((key) => {
    const [method, ...pathParts] = key.split(" ");
    const path = pathParts.join(" ");
    metrics.push(
      createMetric("requests", requests[key], "1", "sum", "asInt", {
        endpoint: path,
        method,
      })
    );
  });
  return metrics;
}

function systemMetrics() {
  return [];
}

function userMetrics() {
  return [
    createMetric(
      "active_users",
      Object.keys(activeSessions).length,
      "1",
      "sum",
      "asInt",
      {}
    ),
  ];
}

function purchaseMetrics() {
  return [];
}

function authMetrics() {
  return [
    createMetric(
      "login_success",
      loginMetrics.success,
      "1",
      "sum",
      "asInt",
      {}
    ),
    createMetric("login_failed", loginMetrics.failed, "1", "sum", "asInt", {}),
  ];
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

function startActiveSessionCleanup(period) {
  setInterval(() => {
    const now = Date.now();
    Object.keys(activeSessions).forEach((userId) => {
      if (now - activeSessions[userId] > ACTIVE_TIMEOUT) {
        delete activeSessions[userId];
      }
    });
  }, period);
}

module.exports = {
  requestTracker,
  sendMetricsPeriodically,
  trackActiveSession,
  startActiveSessionCleanup,
  removeActiveSession,
  recordFailedLogin,
  recordSuccessfulLogin,
};
