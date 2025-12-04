const express = require("express");
const rateLimit = require("express-rate-limit");
const jwt = require("jsonwebtoken");
const config = require("../config.js");
const { asyncHandler } = require("../endpointHelper.js");
const { DB, Role } = require("../database/database.js");
const { removeActiveSession } = require("../metrics.js");
const { recordSuccessfulLogin, recordFailedLogin } = require("../metrics.js");

const authRouter = express.Router();

const registerLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 5,
  message: { message: "Too many registration attempts, try again later." },
});

const loginLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 5,
  message: { message: "Too many login attempts, try again later." },
});

const emailAttempts = new Map();

function limitByEmail(maxAttempts, windowMs) {
  return (req, res, next) => {
    const email = req.body.email?.toLowerCase();
    if (!email) return next();

    const now = Date.now();
    const attempts = emailAttempts.get(email) || [];
    const recent = attempts.filter((ts) => now - ts < windowMs);

    if (recent.length >= maxAttempts) {
      return res.status(429).json({
        message: "Too many attempts for this account. Please wait a bit.",
      });
    }

    recent.push(now);
    emailAttempts.set(email, recent);

    next();
  };
}

authRouter.docs = [
  {
    method: "POST",
    path: "/api/auth",
    description: "Register a new user",
    example: `curl -X POST localhost:3000/api/auth -d '{"name":"pizza diner", "email":"d@jwt.com", "password":"diner"}' -H 'Content-Type: application/json'`,
    response: {
      user: {
        id: 2,
        name: "pizza diner",
        email: "d@jwt.com",
        roles: [{ role: "diner" }],
      },
      token: "tttttt",
    },
  },
  {
    method: "PUT",
    path: "/api/auth",
    description: "Login existing user",
    example: `curl -X PUT localhost:3000/api/auth -d '{"email":"a@jwt.com", "password":"admin"}' -H 'Content-Type: application/json'`,
    response: {
      user: {
        id: 1,
        name: "常用名字",
        email: "a@jwt.com",
        roles: [{ role: "admin" }],
      },
      token: "tttttt",
    },
  },
  {
    method: "DELETE",
    path: "/api/auth",
    requiresAuth: true,
    description: "Logout a user",
    example: `curl -X DELETE localhost:3000/api/auth -H 'Authorization: Bearer tttttt'`,
    response: { message: "logout successful" },
  },
];

async function setAuthUser(req, res, next) {
  const token = readAuthToken(req);
  if (token) {
    try {
      if (await DB.isLoggedIn(token)) {
        // Check the database to make sure the token is valid.
        req.user = jwt.verify(token, config.jwtSecret);
        req.user.isRole = (role) =>
          !!req.user.roles.find((r) => r.role === role);
      }
    } catch {
      req.user = null;
    }
  }
  next();
}

// Authenticate token
authRouter.authenticateToken = (req, res, next) => {
  if (!req.user) {
    return res.status(401).send({ message: "unauthorized" });
  }
  next();
};

// register
authRouter.post(
  "/",
  registerLimiter,
  asyncHandler(async (req, res) => {
    const { name, email, password } = req.body;
    if (!name || !email || !password) {
      return res
        .status(400)
        .json({ message: "name, email, and password are required" });
    }
    const user = await DB.addUser({
      name,
      email,
      password,
      roles: [{ role: Role.Diner }],
    });
    const auth = await setAuth(user);
    res.json({ user: user, token: auth });
  })
);

// login
authRouter.put(
  "/",
  loginLimiter, // limits by IP
  limitByEmail(5, 60000), // limits by email
  asyncHandler(async (req, res) => {
    const { email, password } = req.body;

    try {
      const user = await DB.getUser(email, password);
      const auth = await setAuth(user);

      recordSuccessfulLogin();

      res.json({ user: user, token: auth });
    } catch (error) {
      recordFailedLogin();
      throw error;
    }
  })
);

// logout
authRouter.delete(
  "/",
  authRouter.authenticateToken,
  asyncHandler(async (req, res) => {
    await clearAuth(req);
    removeActiveSession(readAuthToken(req));
    res.json({ message: "logout successful" });
  })
);

async function setAuth(user) {
  const token = jwt.sign(user, config.jwtSecret);
  await DB.loginUser(user.id, token);
  return token;
}

async function clearAuth(req) {
  const token = readAuthToken(req);
  if (token) {
    await DB.logoutUser(token);
  }
}

function readAuthToken(req) {
  const authHeader = req.headers.authorization;
  if (authHeader) {
    return authHeader.split(" ")[1];
  }
  return null;
}

module.exports = { authRouter, setAuthUser, setAuth };
