const request = require("supertest");
const app = require("../service");
const { Role, DB } = require("../database/database.js");

const testUser = { name: "pizza diner", email: "reg@test.com", password: "a" };
let testUserAuthToken;

function randomName() {
  return Math.random().toString(36).substring(2, 12);
}

beforeAll(async () => {
  testUser.email = Math.random().toString(36).substring(2, 12) + "@test.com";
  const registerRes = await request(app).post("/api/auth").send(testUser);
  testUserAuthToken = registerRes.body.token;
  expectValidJwt(testUserAuthToken);
});

async function createAdminUser() {
  let user = { password: "toomanysecrets", roles: [{ role: Role.Admin }] };
  user.name = randomName();
  user.email = user.name + "@admin.com";

  user = await DB.addUser(user);
  return { ...user, password: "toomanysecrets" };
}

async function createFranchiseeUser() {
  let user = { password: "supersecretpw", roles: [{ role: Role.Franchisee }] };
  user.name = randomName();
  user.email = user.name + "@franchisee.com";

  user = await DB.addUser(user);
  return { ...user, password: "supersecretpw" };
}

test("get franchises", async () => {
  const franchiseRes = await request(app).get("/api/franchise");
  expect(franchiseRes.status).toBe(200);
  expect(Array.isArray(franchiseRes.body.franchises)).toBe(true);
  expect(franchiseRes.body.more).toBeDefined();
});

test("create franchise as admin", async () => {
  const adminUser = await createAdminUser();
  const loginRes = await request(app).put("/api/auth").send(adminUser);
  expectValidJwt(loginRes.body.token);

  const newFranchise = { name: adminUser.name, admins: [adminUser] };
  const createFranchiseRes = await request(app)
    .post("/api/franchise")
    .set("Authorization", `Bearer ${loginRes.body.token}`)
    .send(newFranchise);
  expect(createFranchiseRes.status).toBe(200);
  expect(createFranchiseRes.body).toMatchObject(newFranchise);
});

test("create franchise as non-admin", async () => {
  const loginRes = await request(app).put("/api/auth").send(testUser);
  expect(loginRes.status).toBe(200);
  expectValidJwt(loginRes.body.token);

  const newFranchise = { name: testUser.name, admins: [testUser] };
  const createFranchiseRes = await request(app)
    .post("/api/franchise")
    .set("Authorization", `Bearer ${loginRes.body.token}`)
    .send(newFranchise);
  expect(createFranchiseRes.status).toBe(403);
  expect(createFranchiseRes.body.message).toBe("unable to create a franchise");
});

function expectValidJwt(potentialJwt) {
  expect(potentialJwt).toMatch(
    /^[a-zA-Z0-9\-_]*\.[a-zA-Z0-9\-_]*\.[a-zA-Z0-9\-_]*$/
  );
}
