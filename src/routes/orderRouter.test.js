const request = require("supertest");
const app = require("../service");

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

const testUser = { name: "pizza diner", email: "reg@test.com", password: "a" };
let testUserAuthToken;

let testItem = {
  title: randomName(),
  description: "pizza pizza",
  image: "pizza1.png",
  price: 0.004,
};

beforeAll(async () => {
  testUser.email = Math.random().toString(36).substring(2, 12) + "@test.com";
  const registerRes = await request(app).post("/api/auth").send(testUser);
  testUserAuthToken = registerRes.body.token;
  expectValidJwt(testUserAuthToken);
});

test("get menu items", getMenu);

async function getMenu() {
  const menuRes = await request(app).get("/api/order/menu");
  expect(menuRes.status).toBe(200);
  expect(Array.isArray(menuRes.body)).toBe(true);
  return menuRes.body;
}

test("attempt to add items as diner", async () => {
  const loginRes = await request(app).put("/api/auth").send(testUser);
  expectValidJwt(loginRes.body.token);

  const addMenuItemRes = await request(app)
    .put("/api/order/menu")
    .set("Authorization", `Bearer ${loginRes.body.token}`)
    .send({ ...testItem });
  expect(addMenuItemRes.status).toBe(403);
  expect(addMenuItemRes.body.message).toBe("unable to add menu item");
});

test("add items to menu as admin", async () => {
  // login as admin
  const adminUser = await createAdminUser();
  const adminLoginRes = await request(app)
    .put("/api/auth")
    .send({ email: adminUser.email, password: adminUser.password });
  expectValidJwt(adminLoginRes.body.token);

  const menu = await getMenu();
  const numItemsBefore = menu.length;

  // add menu item
  const addMenuItemRes = await request(app)
    .put("/api/order/menu")
    .set("Authorization", `Bearer ${adminLoginRes.body.token}`)
    .send({ ...testItem });
  expect(addMenuItemRes.status).toBe(200);
  const newMenu = await getMenu();
  expect(newMenu).toHaveLength(numItemsBefore + 1);
  expect(newMenu).toContainEqual(
    expect.objectContaining({
      title: testItem.title,
      description: testItem.description,
      price: testItem.price,
    })
  );
});

test("get orders", getOrders);

async function getOrders() {
  // login as test user
  const loginRes = await request(app).put("/api/auth").send(testUser);
  expectValidJwt(loginRes.body.token);

  const orderRes = await request(app)
    .get("/api/order")
    .set("Authorization", `Bearer ${testUserAuthToken}`);
  expect(orderRes.status).toBe(200);
  expect(Array.isArray(orderRes.body.orders)).toBe(true);
  return orderRes.body;
}

test("create order", async () => {
  //   const orders = getOrders();
  // TODO: finish this test
});

function expectValidJwt(potentialJwt) {
  expect(potentialJwt).toMatch(
    /^[a-zA-Z0-9\-_]*\.[a-zA-Z0-9\-_]*\.[a-zA-Z0-9\-_]*$/
  );
}
