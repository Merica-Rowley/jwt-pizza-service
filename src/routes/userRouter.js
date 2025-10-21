const express = require("express");
const { asyncHandler, StatusCodeError } = require("../endpointHelper.js");
const { DB, Role } = require("../database/database.js");
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
    method: "GET",
    path: "/api/user?page=1&limit=10&name=*",
    description: "List all the users",
    example: `curl localhost:3000/api/franchise&page=0&limit=10&name=pizzaPocket`,
    response: {
      users: [
        {
          id: 3,
          name: "Kai Chen",
          email: "d@jwt.com",
          roles: [{ role: "diner" }],
        },
        {
          id: 5,
          name: "Buddy",
          email: "b@jwt.com",
          roles: [{ role: "admin" }],
        },
      ],
      more: true,
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
    res.json(req.user);
  })
);

// getUsers
userRouter.get(
  "/",
  authRouter.authenticateToken,
  asyncHandler(async (req, res) => {
    if (req.user.isRole(Role.Admin)) {
      const [users, more] = await DB.getUsers(
        req.query.page,
        req.query.limit,
        req.query.name
      );
      res.json({ users, more });
    } else {
      return res.status(403).json({ message: "unauthorized" });
    }
  })
);

// updateUser
userRouter.put(
  "/:userId",
  authRouter.authenticateToken,
  asyncHandler(async (req, res) => {
    const { name, email, password } = req.body;
    const userId = Number(req.params.userId);
    const user = req.user;
    if (user.id !== userId && !user.isRole(Role.Admin)) {
      return res.status(403).json({ message: "unauthorized" });
    }

    const updatedUser = await DB.updateUser(userId, name, email, password);
    const auth = await setAuth(updatedUser);
    res.json({ user: updatedUser, token: auth });
  })
);

// deleteuser
userRouter.delete(
  "/:userId",
  authRouter.authenticateToken,
  asyncHandler(async (req, res) => {
    const userId = Number(req.params.userId);
    const foundUser = await DB.getUserById(userId);
    if (!foundUser || !req.user.isRole(Role.Admin)) {
      throw new StatusCodeError("unable to delete a user", 403);
    }

    await DB.deleteUser(userId);
    res.json({ message: "user deleted" });
  })
);

module.exports = userRouter;
