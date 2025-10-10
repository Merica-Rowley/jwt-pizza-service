const request = require("supertest");
const app = require("../service");

const { Role, db } = require("../database/database.js");

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

  // Step 3: Create an order as the test user
  const menu = await getMenu();
  const orderReq = {
    franchiseId: createFranchiseRes.body.id,
    storeId: createStoreRes.body.id,
    items: [
      {
        menuId: menu[0].id,
        description: menu[0].description,
        price: menu[0].price,
      },
    ],
  };

  const createOrderRes = await request(app)
    .post("/api/order")
    .set("Authorization", `Bearer ${testUserAuthToken}`)
    .send(orderReq);
  expect(createOrderRes.status).toBe(200);
  expect(createOrderRes.body).toMatchObject({
    order: {
      franchiseId: orderReq.franchiseId,
      storeId: orderReq.storeId,
      items: orderReq.items,
      id: expect.any(Number),
    },
    jwt: expect.any(String),
  });
  expectValidJwt(createOrderRes.body.jwt);

  // Step 4: Verify the order shows up in the user's order list
  const orders = await getOrders();
  expect(orders.orders).toContainEqual(
    expect.objectContaining({
      id: expect.any(Number),
      franchiseId: orderReq.franchiseId,
      storeId: orderReq.storeId,
      items: expect.arrayContaining([
        expect.objectContaining({
          menuId: orderReq.items[0].menuId,
          description: orderReq.items[0].description,
          price: orderReq.items[0].price,
        }),
      ]),
    })
  );
});

function expectValidJwt(potentialJwt) {
  expect(potentialJwt).toMatch(
    /^[a-zA-Z0-9\-_]*\.[a-zA-Z0-9\-_]*\.[a-zA-Z0-9\-_]*$/
  );
}
