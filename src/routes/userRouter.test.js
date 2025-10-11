const request = require("supertest");
const app = require("../service");
const { Role, db } = require("../database/database.js");
const { StatusCodeError } = require("../endpointHelper.js");

const testUser = { name: "pizza diner", email: "reg@test.com", password: "a" };
const testUser2 = {
  name: "pizza diner 2",
  email: "reg@test.com",
  password: "b",
};
const testUser3 = {
  name: "pizza diner 3",
  email: "reg@test.com",
  password: "c",
};
let testUserAuthToken;
let testUserAuthToken2;
let testUserAuthToken3;

beforeAll(async () => {
  testUser.email = Math.random().toString(36).substring(2, 12) + "@test.com";
  const registerRes = await request(app).post("/api/auth").send(testUser);
  testUserAuthToken = registerRes.body.token;
  expectValidJwt(testUserAuthToken);
});

const updatedUser = {
  name: "new name",
  email: randomName() + "@test.com",
  password: "newpassword",
};

function randomName() {
  return Math.random().toString(36).substring(2, 12);
}

async function createAdminUser() {
  await db.init();
  let user = { password: "toomanysecrets", roles: [{ role: Role.Admin }] };
  user.name = randomName();
  user.email = user.name + "@admin.com";

  user = await db.addUser(user);
  return { ...user, password: "toomanysecrets" };
}

test("get authenticated user", async () => {
  // Step 1: Login as test user
  const loginRes = await request(app).put("/api/auth").send(testUser);
  expectValidJwt(loginRes.body.token);

  // Step 2: Use the token to get the authenticated user
  const meRes = await request(app)
    .get("/api/user/me")
    .set("Authorization", `Bearer ${loginRes.body.token}`);
  expect(meRes.status).toBe(200);

  const expectedUser = { ...testUser, roles: [{ role: "diner" }] };
  delete expectedUser.password;
  expect(meRes.body).toMatchObject(expectedUser);
});

test("update user as self", async () => {
  // Step 1: Login as test user
  const loginRes = await request(app).put("/api/auth").send(testUser);
  expectValidJwt(loginRes.body.token);

  // Step 2: Use the token to update the authenticated user
  const updateRes = await request(app)
    .put(`/api/user/${loginRes.body.user.id}`)
    .set("Authorization", `Bearer ${loginRes.body.token}`)
    .send(updatedUser);
  expect(updateRes.status).toBe(200);
  expectValidJwt(updateRes.body.token);

  const expectedUser = { ...updatedUser, roles: [{ role: "diner" }] };
  delete expectedUser.password;
  expect(updateRes.body.user).toMatchObject(expectedUser);
});

test("delete user as admin", async () => {
  // Step 1: Register a user to delete
  testUser2.email = Math.random().toString(36).substring(2, 12) + "@test.com";
  const registerRes = await request(app).post("/api/auth").send(testUser2);
  testUserAuthToken2 = registerRes.body.token;
  expectValidJwt(testUserAuthToken2);

  // Step 2: Create and log in as admin user
  const adminUser = await createAdminUser();
  const adminLoginRes = await request(app)
    .put("/api/auth")
    .send({ email: adminUser.email, password: adminUser.password });
  expectValidJwt(adminLoginRes.body.token);
  let testAdminAuthToken = adminLoginRes.body.token;

  // Step 3: Delete the created user as an admin
  const userId = registerRes.body.user.id;
  const deleteUserRes = await request(app)
    .delete(`/api/user/${userId}`)
    .set("Authorization", `Bearer ${testAdminAuthToken}`);
  expect(deleteUserRes.status).toBe(200);
  expect(deleteUserRes.body).toMatchObject({ message: "user deleted" });

  // Step 4: Make sure that the user is actually gone from the db
  await expect(db.getUser(testUser2.email, testUser2.password)).rejects.toThrow(
    StatusCodeError
  );
});

test("delete user as non-admin", async () => {
  // Step 1: Register a user to delete
  testUser2.email = Math.random().toString(36).substring(2, 12) + "@test.com";
  const registerRes = await request(app).post("/api/auth").send(testUser2);
  testUserAuthToken2 = registerRes.body.token;
  expectValidJwt(testUserAuthToken2);

  // Step 2: Register another user
  testUser3.email = Math.random().toString(36).substring(2, 12) + "@test.com";
  const registerOtherRes = await request(app).post("/api/auth").send(testUser3);
  testUserAuthToken3 = registerOtherRes.body.token;
  expectValidJwt(testUserAuthToken3);

  // Step 3: Attempt to delete as test user
  const userId = registerRes.body.user.id;
  const deleteUserRes = await request(app)
    .delete(`/api/user/${userId}`)
    .set("Authorization", `Bearer ${testUserAuthToken3}`);
  expect(deleteUserRes.status).toBe(403);
  expect(deleteUserRes.body).toMatchObject({
    message: "unable to delete a user",
  });
});

function expectValidJwt(potentialJwt) {
  expect(potentialJwt).toMatch(
    /^[a-zA-Z0-9\-_]*\.[a-zA-Z0-9\-_]*\.[a-zA-Z0-9\-_]*$/
  );
}
