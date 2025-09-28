const request = require("supertest");
const app = require("../service");

const testUser = { name: "pizza diner", email: "reg@test.com", password: "a" };
let testUserAuthToken;

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

function expectValidJwt(potentialJwt) {
  expect(potentialJwt).toMatch(
    /^[a-zA-Z0-9\-_]*\.[a-zA-Z0-9\-_]*\.[a-zA-Z0-9\-_]*$/
  );
}
