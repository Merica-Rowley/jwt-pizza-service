const Test = require("supertest/lib/test.js");
const { Role, DB } = require("../database/database.js");

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

async function createFranchiseeUser() {
  let user = { password: "supersecretpw", roles: [{ role: Role.Franchisee }] };
  user.name = randomName();
  user.email = user.name + "@franchisee.com";

  user = await DB.addUser(user);
  return { ...user, password: "supersecretpw" };
}

test("placeholder", () => {});
