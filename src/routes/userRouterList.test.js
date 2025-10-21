// Created a separate file to make sure the db is clean before running
const request = require("supertest");
const app = require("../service");
const { Role, DB } = require("../database/database.js");

const testUsers = [
  {
    name: "Ava McKinley ZZZZZ",
    email: randomName() + "@test.com",
    password: "password",
    roles: [{ role: Role.Diner }],
  },
  {
    name: "Liam Barrett",
    email: randomName() + "@test.com",
    password: "password",
    roles: [{ role: Role.Diner }],
  },
  {
    name: "Nora Hastings",
    email: randomName() + "@test.com",
    password: "password",
    roles: [{ role: Role.Diner }],
  },
  {
    name: "Ethan Rowe ZZZZZ",
    email: randomName() + "@test.com",
    password: "password",
    roles: [{ role: Role.Diner }],
  },
  {
    name: "Isla Carmichael",
    email: randomName() + "@test.com",
    password: "password",
    roles: [{ role: Role.Diner }],
  },
  {
    name: "Caleb Monroe",
    email: randomName() + "@test.com",
    password: "password",
    roles: [{ role: Role.Diner }],
  },
  {
    name: "Chloe Winters",
    email: randomName() + "@test.com",
    password: "password",
    roles: [{ role: Role.Diner }],
  },
  {
    name: "Owen Prescott ZZZZZ",
    email: randomName() + "@test.com",
    password: "password",
    roles: [{ role: Role.Diner }],
  },
  {
    name: "Lila Hartman",
    email: randomName() + "@test.com",
    password: "password",
    roles: [{ role: Role.Diner }],
  },
  {
    name: "Mason Ellery",
    email: randomName() + "@test.com",
    password: "password",
    roles: [{ role: Role.Diner }],
  },
  {
    name: "Sophie Alden",
    email: randomName() + "@test.com",
    password: "password",
    roles: [{ role: Role.Diner }],
  },
  {
    name: "Jack Hollis",
    email: randomName() + "@test.com",
    password: "password",
    roles: [{ role: Role.Diner }],
  },
  {
    name: "Ella Brighton",
    email: randomName() + "@test.com",
    password: "password",
    roles: [{ role: Role.Diner }],
  },
  {
    name: "Henry Caldwell ZZZZZ",
    email: randomName() + "@test.com",
    password: "password",
    roles: [{ role: Role.Diner }],
  },
  {
    name: "Grace Winslow",
    email: randomName() + "@test.com",
    password: "password",
    roles: [{ role: Role.Diner }],
  },
];

const testUser = { name: "pizza diner", email: "reg@test.com", password: "a" };
let testUserAuthToken;

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

test("retrieve list of users", async () => {
  // Step 1: Add a bunch of users to the database
  for (const user of testUsers) {
    await DB.addUser(user);
  }

  // Step 2: Create and log in as admin user
  const adminUser = await createAdminUser();
  const adminLoginRes = await request(app)
    .put("/api/auth")
    .send({ email: adminUser.email, password: adminUser.password });
  expectValidJwt(adminLoginRes.body.token);
  let testAdminAuthToken = adminLoginRes.body.token;

  // Step 3: Get a list of the users back
  let userListRes = await request(app)
    .get(`/api/user?page=0&limit=10&name=*`)
    .set("Authorization", `Bearer ${testAdminAuthToken}`);

  expect(userListRes.status).toBe(200);
  expect(userListRes.body.users.length).toBe(10); // should be 10 for first page of users

  userListRes = await request(app)
    .get(`/api/user?page=0&limit=10&name=*ZZZZZ*`)
    .set("Authorization", `Bearer ${testAdminAuthToken}`);
  expect(userListRes.status).toBe(200);
  expect(userListRes.body.users.length).toBeGreaterThan(4); // At least 4 users have 'ZZ' in their name
});

test("get list of users as non-admin", async () => {
  // Step 1: Register testUser
  testUser.email = Math.random().toString(36).substring(2, 12) + "@test.com";
  const registerRes = await request(app).post("/api/auth").send(testUser);
  testUserAuthToken = registerRes.body.token;
  expectValidJwt(testUserAuthToken);

  // Step 2: Login as test user
  const loginRes = await request(app).put("/api/auth").send(testUser);
  expectValidJwt(loginRes.body.token);

  // Step 3: attempt to get a user list
  let userListRes = await request(app)
    .get(`/api/user?page=0&limit=10&name=*`)
    .set("Authorization", `Bearer ${testUserAuthToken}`);

  expect(userListRes.status).toBe(403);
  expect(userListRes.body.message).toBe("unauthorized");
});

function expectValidJwt(potentialJwt) {
  expect(potentialJwt).toMatch(
    /^[a-zA-Z0-9\-_]*\.[a-zA-Z0-9\-_]*\.[a-zA-Z0-9\-_]*$/
  );
}
