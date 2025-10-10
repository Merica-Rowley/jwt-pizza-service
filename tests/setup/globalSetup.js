const fs = require("fs");
const path = require("path");

const mysql = require("mysql2/promise");
const dotenv = require("dotenv");
const { db, Role } = require("../../src/database/database.js");

dotenv.config({ path: ".env.test" });

module.exports = async () => {
  if (process.env.CI) {
    console.log(
      "✅ CI environment detected — skipping local test DB creation."
    );
    return;
  }

  // Create temporary test DB
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
  });

  const dbName = `${process.env.DB_NAME}_${process.pid}`;
  console.log(`🧪 Creating local test database: ${dbName}`);

  await connection.query(`DROP DATABASE IF EXISTS ${dbName}`);
  await connection.query(`CREATE DATABASE ${dbName}`);
  await connection.end();

  // Store the DB name in env for teardown
  process.env.JEST_DB_NAME = dbName;

  fs.writeFileSync(path.resolve(__dirname, "testDBName.txt"), dbName, "utf-8");

  // Initialize tables and default admin
  await db.init();

  // Seed dummy data directly
  console.log("🌱 Seeding test data...");

  await db.addUser({
    name: "pizza diner",
    email: "d@jwt.com",
    password: "diner",
    roles: [{ role: Role.Diner }],
  });
  await db.addUser({
    name: "pizza franchisee",
    email: "f@jwt.com",
    password: "franchisee",
    roles: [{ role: Role.Admin }],
  });

  await db.addMenuItem({
    title: "Veggie",
    description: "A garden of delight",
    image: "pizza1.png",
    price: 0.0038,
  });
  await db.addMenuItem({
    title: "Pepperoni",
    description: "Spicy treat",
    image: "pizza2.png",
    price: 0.0042,
  });
  await db.addMenuItem({
    title: "Margarita",
    description: "Essential classic",
    image: "pizza3.png",
    price: 0.0042,
  });
  await db.addMenuItem({
    title: "Crusty",
    description: "A dry mouthed favorite",
    image: "pizza4.png",
    price: 0.0028,
  });
  await db.addMenuItem({
    title: "Charred Leopard",
    description: "For those with a darker side",
    image: "pizza5.png",
    price: 0.0099,
  });

  // Add franchise
  const franchise = await db.createFranchise({
    name: "pizzaPocket",
    admins: [{ email: "f@jwt.com" }],
  });

  // Add store
  await db.createStore(franchise.id, { name: "SLC" });

  console.log("✅ Test database ready with schema and dummy data");
};
