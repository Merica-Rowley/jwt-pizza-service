const request = require("supertest");
const app = require("../service");
const { Role, DB } = require("../database/database.js");

const testUser = { name: "pizza diner", email: "reg@test.com", password: "a" };
let testUserAuthToken;

const franchiseUser = {
  name: "pizza franchisee",
  email: "fran@test.com",
  password: "b",
  roles: [
    {
      role: Role.Franchisee,
    },
  ],
};
let testFranchiseeAuthToken;

// const adminUser = {
//   name: "pizza admin",
//   email: "admin@test.com",
//   password: "c",
//   roles: [
//     {
//       role: Role.Admin,
//     },
//   ],
// };
// let testAdminAuthToken;

beforeAll(async () => {
  testUser.email = Math.random().toString(36).substring(2, 12) + "@test.com";
  const registerRes = await request(app).post("/api/auth").send(testUser);
  testUserAuthToken = registerRes.body.token;
  expectValidJwt(testUserAuthToken);

  // franchiseUser.email =
  //   Math.random().toString(36).substring(2, 12) + "@test.com";
  // // const franchiseeRegisterRes = await request(app)
  // //   .post("/api/auth")
  // //   .send(franchiseUser);
  // await DB.addUser(franchiseUser);
  // const franchiseLoginRes = await request(app)
  //   .put("/api/auth")
  //   .send(franchiseUser);
  // expect(franchiseLoginRes.status).toBe(200);
  // expectValidJwt(franchiseLoginRes.body.token);
  // testFranchiseeAuthToken = franchiseLoginRes.body.token;

  // adminUser.email = Math.random().toString(36).substring(2, 12) + "@test.com";
  // // const adminRegisterRes = await request(app).post("/api/auth").send(adminUser);
  // await DB.addUser(adminUser);
  // const adminLoginRes = await request(app).put("/api/auth").send(adminUser);
  // testAdminAuthToken = adminRegisterRes.body.token;
  // expectValidJwt(testAdminAuthToken);
  // testAdminAuthToken = adminLoginRes.body.token;
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

// async function createFranchiseUser() {
//   let user = { password: "toomanysecrets", roles: [{ role: Role.Franchisee }] };
//   user.name = randomName();
//   user.email = user.name + "@franchisee.com";

//   user = await DB.addUser(user);
//   return { ...user, password: "superdupersecret" };
// }

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

  // const franchiseUser = await createFranchiseUser();

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

function expectValidJwt(potentialJwt) {
  expect(potentialJwt).toMatch(
    /^[a-zA-Z0-9\-_]*\.[a-zA-Z0-9\-_]*\.[a-zA-Z0-9\-_]*$/
  );
}
