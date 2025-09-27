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

// async function createFranchiseeUser() {
//   let user = { password: "supersecretpw", roles: [{ role: Role.Franchisee }] };
//   user.name = randomName();
//   user.email = user.name + "@franchisee.com";

//   user = await DB.addUser(user);
//   return { ...user, password: "supersecretpw" };
// }

test("get franchises", getFranchises);

async function getFranchises() {
  let allFranchises = [];
  let page = 0;
  let more = true;

  while (more) {
    const nextPageRes = await request(app).get(`/api/franchise?page=${page}`);
    expect(nextPageRes.status).toBe(200);
    expect(Array.isArray(nextPageRes.body.franchises)).toBe(true);
    expect(nextPageRes.body.more).toBeDefined();

    allFranchises = allFranchises.concat(nextPageRes.body.franchises);
    more = nextPageRes.body.more;
    page++;
  }

  return allFranchises;
}

test("create franchise as admin", adminCreateFranchise);

async function adminCreateFranchise() {
  const adminUser = await createAdminUser();
  const loginRes = await request(app).put("/api/auth").send(adminUser);
  expectValidJwt(loginRes.body.token);

  const franchisesBefore = await getFranchises();

  const newFranchise = { name: randomName(), admins: [adminUser] };
  const createFranchiseRes = await request(app)
    .post("/api/franchise")
    .set("Authorization", `Bearer ${loginRes.body.token}`)
    .send(newFranchise);
  expect(createFranchiseRes.status).toBe(200);
  expect(createFranchiseRes.body).toMatchObject(newFranchise);

  const franchisesAfter = await getFranchises();
  expect(franchisesAfter.length).toBe(franchisesBefore.length + 1);

  return {
    franchise: newFranchise,
    adminUser: adminUser,
    adminAuthToken: loginRes.body.token,
  };
}

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

test("get user franchises", getUserFranchises);

async function getUserFranchises() {
  const { franchise, adminUser, adminAuthToken } = await adminCreateFranchise();

  const getUserFranchisesRes = await request(app)
    .get(`/api/franchise/${adminUser.id}`)
    .set("Authorization", `Bearer ${adminAuthToken}`);
  expect(getUserFranchisesRes.status).toBe(200);
  expect(Array.isArray(getUserFranchisesRes.body)).toBe(true);
  expect(getUserFranchisesRes.body).toContainEqual(
    expect.objectContaining({ name: franchise.name })
  );

  return {
    franchise,
    adminUser,
    adminAuthToken,
    franchises: getUserFranchisesRes.body,
  };
}

// test("delete franchise", async () => {
//   const { franchise, adminUser, adminAuthToken, franchises } =
//     await getUserFranchises();

//   // franchises should contain info for one franchise
//   const franchiseIDToDelete = franchises[0].id;
//   expect(franchiseIDToDelete).toBeDefined();

//   // delete the franchise
//   const franchiseDeleteRes = await request(app)
//     .delete(`/api/franchise/${franchiseIDToDelete}`)
//     .set("Authorization", `Bearer ${adminAuthToken}`);
//   expect(franchiseDeleteRes.status).toBe(200);
//   expect(franchiseDeleteRes.body).toMatchObject({
//     message: "franchise deleted",
//   });

//   const getUserFranchisesRes = await request(app)
//     .get(`/api/franchise/${adminUser.id}`)
//     .set("Authorization", `Bearer ${adminAuthToken}`);
//   expect(getUserFranchisesRes.status).toBe(200);
//   expect(Array.isArray(getUserFranchisesRes.body)).toBe(true);
//   expect(getUserFranchisesRes.body).not.toContainEqual(
//     expect.objectContaining({ name: franchise.name })
//   );
// });

function expectValidJwt(potentialJwt) {
  expect(potentialJwt).toMatch(
    /^[a-zA-Z0-9\-_]*\.[a-zA-Z0-9\-_]*\.[a-zA-Z0-9\-_]*$/
  );
}
