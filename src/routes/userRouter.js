const express = require("express");
const { asyncHandler, StatusCodeError } = require("../endpointHelper.js");
const { db, Role } = require("../database/database.js");
const { authRouter, setAuth } = require("./authRouter.js");

const userRouter = express.Router();

userRouter.docs = [
  {
    method: "GET",
    path: "/api/user/me",
    requiresAuth: true,
    description: "Get authenticated user",
    example: `curl -X GET localhost:3000/api/user/me -H 'Authorization: Bearer tttttt'`,
    response: {
      id: 1,
      name: "常用名字",
      email: "a@jwt.com",
      roles: [{ role: "admin" }],
    },
  },
  {
    method: "PUT",
    path: "/api/user/:userId",
    requiresAuth: true,
    description: "Update user",
    example: `curl -X PUT localhost:3000/api/user/1 -d '{"name":"常用名字", "email":"a@jwt.com", "password":"admin"}' -H 'Content-Type: application/json' -H 'Authorization: Bearer tttttt'`,
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
    path: "/api/user/:userId",
    requiresAuth: true,
    description: "Delete user",
    example: `curl -X DELETE localhost:3000/api/user/1 -H 'Authorization: Bearer tttttt`,
    response: { message: "User removed successfully" },
  },
];

// getUser
userRouter.get(
  "/me",
  authRouter.authenticateToken,
  asyncHandler(async (req, res) => {
    await db.init();
    res.json(req.user);
  })
);

// updateUser
userRouter.put(
  "/:userId",
  authRouter.authenticateToken,
  asyncHandler(async (req, res) => {
    await db.init();
    const { name, email, password } = req.body;
    const userId = Number(req.params.userId);
    const user = req.user;
    if (user.id !== userId && !user.isRole(Role.Admin)) {
      return res.status(403).json({ message: "unauthorized" });
    }

    const updatedUser = await db.updateUser(userId, name, email, password);
    const auth = await setAuth(updatedUser);
    res.json({ user: updatedUser, token: auth });
  })
);

// deleteuser
userRouter.delete(
  "/:userId",
  authRouter.authenticateToken,
  asyncHandler(async (req, res) => {
    await db.init();
    const userId = Number(req.params.userId);
    const foundUser = await db.getUserById(userId);
    if (!foundUser || !req.user.isRole(Role.Admin)) {
      throw new StatusCodeError("unable to delete a user", 403);
    }

    await db.deleteUser(userId);
    res.json({ message: "user deleted" });
  })
);

module.exports = userRouter;
