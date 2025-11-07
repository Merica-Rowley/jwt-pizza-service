const config = require("./config");
const os = require("os");

// Metrics stored in memory
const requests = {};

const activeSessions = {}; // { userId: lastSeenTimestamp }
const ACTIVE_TIMEOUT = 5 * 60 * 1000; // 5 minutes

const loginMetrics = {
  success: 0,
  failed: 0,
};

const pizzaPurchaseMetrics = {
  pizzasSold: 0,
  creationFailures: 0,
  revenue: 0.0,
};

const pizzaLatencyMetrics = {
  pizzaCreationLatency: 0,
};

let totalLatency = 0;
let requestCount = 0;

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

function getCpuUsagePercentage() {
  const cpuUsage = os.loadavg()[0] / os.cpus().length;
  return Number(cpuUsage.toFixed(2)) * 100;
}

function getMemoryUsagePercentage() {
  const totalMemory = os.totalmem();
  const freeMemory = os.freemem();
  const usedMemory = totalMemory - freeMemory;
  const memoryUsage = (usedMemory / totalMemory) * 100;
  return Number(memoryUsage.toFixed(2));
}

function recordPizzaSale(numPizzas, amount) {
  pizzaPurchaseMetrics.pizzasSold += numPizzas;
  pizzaPurchaseMetrics.revenue += amount;
}

function recordPizzaCreationFailure() {
  pizzaPurchaseMetrics.creationFailures++;
}

function recordPizzaCreationLatency(latency) {
  pizzaLatencyMetrics.pizzaCreationLatency += latency;
}

function latencyTracker(req, res, next) {
  const start = performance.now();

  res.on("finish", () => {
    const end = performance.now();
    const latency = end - start;

    totalLatency += latency;
    requestCount++;
  });

  next();
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
  const cpuPercent = getCpuUsagePercentage();
  const memPercent = getMemoryUsagePercentage();

  return [
    createMetric(
      "system_cpu_usage_percent",
      cpuPercent,
      "%",
      "gauge",
      "asDouble",
      {}
    ),
    createMetric(
      "system_memory_usage_percent",
      memPercent,
      "%",
      "gauge",
      "asDouble",
      {}
    ),
  ];
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
  return [
    createMetric(
      "pizzas_sold",
      pizzaPurchaseMetrics.pizzasSold,
      "1",
      "sum",
      "asInt",
      {}
    ),
    createMetric(
      "pizza_creation_failures",
      pizzaPurchaseMetrics.creationFailures,
      "1",
      "sum",
      "asInt",
      {}
    ),
    createMetric(
      "total_revenue",
      pizzaPurchaseMetrics.revenue,
      "USD",
      "sum",
      "asDouble",
      {}
    ),
    createMetric(
      "pizza_creation_latency",
      pizzaLatencyMetrics.pizzaCreationLatency,
      "ms",
      "sum",
      "asDouble",
      {}
    ),
  ];
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

function latencyMetrics() {
  const average = requestCount > 0 ? totalLatency / requestCount : 0;

  // Reset after capturing so next interval starts fresh
  totalLatency = 0;
  requestCount = 0;

  return [
    createMetric(
      "average_request_latency_ms",
      average,
      "ms",
      "gauge",
      "asDouble",
      {}
    ),
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

    console.log(body); // For debugging

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
      metricsBuilder.add(latencyMetrics());
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
  recordPizzaSale,
  recordPizzaCreationFailure,
  recordPizzaCreationLatency,
  latencyTracker,
};
