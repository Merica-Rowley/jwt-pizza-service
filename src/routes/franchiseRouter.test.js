const request = require("supertest");
const app = require("../service");
const { Role, DB } = require("../database/database.js");

const testUser = { name: "pizza diner", email: "reg@test.com", password: "a" };
let testUserAuthToken;

const testUser2 = {
  name: "pizza diner2",
  email: "reg@test.com",
  password: "a",
};
let testUser2AuthToken;

beforeAll(async () => {
  testUser.email = Math.random().toString(36).substring(2, 12) + "@test.com";
  testUser2.email = Math.random().toString(36).substring(2, 12) + "@test.com";
  const registerRes = await request(app).post("/api/auth").send(testUser);
  testUserAuthToken = registerRes.body.token;
  expectValidJwt(testUserAuthToken);
  const registerRes2 = await request(app).post("/api/auth").send(testUser2);
  testUser2AuthToken = registerRes2.body.token;
  expectValidJwt(testUser2AuthToken);
});

function randomName() {
  return Math.random().toString(36).substring(2, 12);
}

async function createAdminUser() {
  let user = { password: "toomanysecrets", roles: [{ role: Role.Admin }] };
  user.name = randomName();
  user.email = user.name + "@admin.com";

  user = await DB.addUser(user);
  return { ...user, password: "toomanysecrets" };
}

test("create franchise for unknown franchisee", async () => {
  const adminUser = await createAdminUser();
  const adminLoginRes = await request(app)
    .put("/api/auth")
    .send({ email: adminUser.email, password: adminUser.password });
  expectValidJwt(adminLoginRes.body.token);
  let testAdminAuthToken = adminLoginRes.body.token;

  const franchiseReq = {
    name: "Test Franchise",
    admins: [{ email: "fakeemail@xxxxx.com" }],
  };
  const createFranchiseRes = await request(app)
    .post("/api/franchise")
    .set("Authorization", `Bearer ${testAdminAuthToken}`)
    .send(franchiseReq);
  expect(createFranchiseRes.status).toBe(404);
  expect(createFranchiseRes.body.message).toBe(
    `unknown user for franchise admin fakeemail@xxxxx.com provided`
  );
});

test("create franchise as admin", async () => {
  const adminUser = await createAdminUser();
  const adminLoginRes = await request(app)
    .put("/api/auth")
    .send({ email: adminUser.email, password: adminUser.password });
  expectValidJwt(adminLoginRes.body.token);
  let testAdminAuthToken = adminLoginRes.body.token;

  const franchiseReq = {
    name: randomName(),
    admins: [{ email: testUser.email }],
  };
  const createFranchiseRes = await request(app)
    .post("/api/franchise")
    .set("Authorization", `Bearer ${testAdminAuthToken}`)
    .send(franchiseReq);
  expect(createFranchiseRes.status).toBe(200);
  expect(createFranchiseRes.body).toMatchObject({ name: franchiseReq.name });
});

test("create franchise as non-admin", async () => {
  // Login as regular user
  const loginRes = await request(app).put("/api/auth").send(testUser);
  expectValidJwt(loginRes.body.token);
  let testUserAuthToken = loginRes.body.token;

  const franchiseReq = {
    name: "Test Franchise",
    admins: [{ email: testUser.email }], // email doesn't really matter, since the user won't get that far
  };
  const createFranchiseRes = await request(app)
    .post("/api/franchise")
    .set("Authorization", `Bearer ${testUserAuthToken}`)
    .send(franchiseReq);
  expect(createFranchiseRes.status).toBe(403);
  expect(createFranchiseRes.body.message).toBe("unable to create a franchise");
});

test("delete franchise", async () => {
  // Step 1: Create a franchise
  const adminUser = await createAdminUser();
  const adminLoginRes = await request(app)
    .put("/api/auth")
    .send({ email: adminUser.email, password: adminUser.password });
  expectValidJwt(adminLoginRes.body.token);
  let testAdminAuthToken = adminLoginRes.body.token;

  const franchiseReq = {
    name: randomName(),
    admins: [{ email: testUser.email }],
  };
  const createFranchiseRes = await request(app)
    .post("/api/franchise")
    .set("Authorization", `Bearer ${testAdminAuthToken}`)
    .send(franchiseReq);

  // Step 2: Delete the franchise
  const franchiseId = createFranchiseRes.body.id;
  const deleteFranchiseRes = await request(app)
    .delete(`/api/franchise/${franchiseId}`)
    .set("Authorization", `Bearer ${testAdminAuthToken}`);
  expect(deleteFranchiseRes.status).toBe(200);
  expect(deleteFranchiseRes.body).toMatchObject({
    message: "franchise deleted",
  });

  // Step 3: Try to get the deleted franchise (should't be found)
  const getFranchiseRes = await request(app)
    .get(`/api/franchise`)
    .set("Authorization", `Bearer ${testAdminAuthToken}`);
  expect(getFranchiseRes.status).toBe(200);
  expect(getFranchiseRes.body.franchises).not.toContainEqual(
    expect.objectContaining({ id: franchiseId })
  );
});

test("get franchises for specific user", async () => {
  // Step 1: Create franchises for a user
  const adminUser = await createAdminUser();
  const adminLoginRes = await request(app)
    .put("/api/auth")
    .send({ email: adminUser.email, password: adminUser.password });
  expectValidJwt(adminLoginRes.body.token);
  let testAdminAuthToken = adminLoginRes.body.token;

  const franchiseReq1 = {
    name: randomName(),
    admins: [{ email: testUser.email }],
  };
  const createFranchiseRes1 = await request(app)
    .post("/api/franchise")
    .set("Authorization", `Bearer ${testAdminAuthToken}`)
    .send(franchiseReq1);

  const franchiseReq2 = {
    name: randomName(),
    admins: [{ email: testUser.email }],
  };
  const createFranchiseRes2 = await request(app)
    .post("/api/franchise")
    .set("Authorization", `Bearer ${testAdminAuthToken}`)
    .send(franchiseReq2);

  const franchiseReq3 = {
    name: randomName(),
    admins: [{ email: testUser.email }],
  };
  const createFranchiseRes3 = await request(app)
    .post("/api/franchise")
    .set("Authorization", `Bearer ${testAdminAuthToken}`)
    .send(franchiseReq3);

  // Step 2: Get franchises for the test user
  const testUserID = createFranchiseRes1.body.admins[0].id;
  const getFranchisesRes = await request(app)
    .get(`/api/franchise/${testUserID}`)
    .set("Authorization", `Bearer ${testAdminAuthToken}`);
  expect(getFranchisesRes.status).toBe(200);
  expect(getFranchisesRes.body).toEqual(
    expect.arrayContaining([
      expect.objectContaining({ id: createFranchiseRes1.body.id }),
      expect.objectContaining({ id: createFranchiseRes2.body.id }),
      expect.objectContaining({ id: createFranchiseRes3.body.id }),
    ])
  );
  expect(getFranchisesRes.body.length).toBeGreaterThanOrEqual(3);
});

test("create store for franchise", async () => {
  // Step 1: Create a franchise
  const adminUser = await createAdminUser();
  const adminLoginRes = await request(app)
    .put("/api/auth")
    .send({ email: adminUser.email, password: adminUser.password });
  expectValidJwt(adminLoginRes.body.token);
  let testAdminAuthToken = adminLoginRes.body.token;

  const franchiseReq = {
    name: randomName(),
    admins: [{ email: testUser.email }],
  };
  const createFranchiseRes = await request(app)
    .post("/api/franchise")
    .set("Authorization", `Bearer ${testAdminAuthToken}`)
    .send(franchiseReq);
  expect(createFranchiseRes.status).toBe(200);
  expect(createFranchiseRes.body).toMatchObject({ name: franchiseReq.name });

  // Step 2: Create a store for the franchise
  const franchiseId = createFranchiseRes.body.id;
  const storeReq = { name: randomName() };
  const createStoreRes = await request(app)
    .post(`/api/franchise/${franchiseId}/store`)
    .set("Authorization", `Bearer ${testAdminAuthToken}`)
    .send(storeReq);
  expect(createStoreRes.status).toBe(200);
  expect(createStoreRes.body).toMatchObject({
    name: storeReq.name,
    id: expect.any(Number),
  });
});

test("create store for franchise that doesn't exist", async () => {
  const adminUser = await createAdminUser();
  const adminLoginRes = await request(app)
    .put("/api/auth")
    .send({ email: adminUser.email, password: adminUser.password });
  expectValidJwt(adminLoginRes.body.token);
  let testAdminAuthToken = adminLoginRes.body.token;

  const franchiseId = -10;
  const storeReq = { name: randomName() };
  const createStoreRes = await request(app)
    .post(`/api/franchise/${franchiseId}/store`)
    .set("Authorization", `Bearer ${testAdminAuthToken}`)
    .send(storeReq);
  expect(createStoreRes.status).toBe(500);
});

test("create store for franchise as non-admin", async () => {
  // Step 1: Create a franchise
  const adminUser = await createAdminUser();
  const adminLoginRes = await request(app)
    .put("/api/auth")
    .send({ email: adminUser.email, password: adminUser.password });
  expectValidJwt(adminLoginRes.body.token);
  let testAdminAuthToken = adminLoginRes.body.token;

  const franchiseReq = {
    name: randomName(),
    admins: [{ email: testUser.email }],
  };
  const createFranchiseRes = await request(app)
    .post("/api/franchise")
    .set("Authorization", `Bearer ${testAdminAuthToken}`)
    .send(franchiseReq);
  expect(createFranchiseRes.status).toBe(200);
  expect(createFranchiseRes.body).toMatchObject({ name: franchiseReq.name });

  // Step 2: Attempt to create a store as a non-admin user (second test user)
  const loginRes = await request(app).put("/api/auth").send(testUser2);
  expectValidJwt(loginRes.body.token);
  testUser2AuthToken = loginRes.body.token;

  const franchiseId = createFranchiseRes.body.id;
  const storeReq = { name: randomName() };
  const createStoreRes = await request(app)
    .post(`/api/franchise/${franchiseId}/store`)
    .set("Authorization", `Bearer ${testUser2AuthToken}`)
    .send(storeReq);
  expect(createStoreRes.status).toBe(403);
  expect(createStoreRes.body.message).toBe("unable to create a store");
});

test("delete store from franchise", async () => {});

test("delete store from franchise as non-admin", async () => {});

function expectValidJwt(potentialJwt) {
  expect(potentialJwt).toMatch(
    /^[a-zA-Z0-9\-_]*\.[a-zA-Z0-9\-_]*\.[a-zA-Z0-9\-_]*$/
  );
}
