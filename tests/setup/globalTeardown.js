const fs = require("fs");
const path = require("path");
const mysql = require("mysql2/promise");
const dotenv = require("dotenv");

dotenv.config({ path: ".env.test" });

module.exports = async () => {
  if (process.env.CI) {
    console.log("✅ CI environment detected — skipping test DB teardown.");
    return;
  }

  const dbFile = path.resolve(__dirname, "testDBName.txt");
  if (!fs.existsSync(dbFile)) {
    console.warn("⚠️ No test DB name file found, skipping teardown.");
    return;
  }

  const dbName = fs.readFileSync(dbFile, "utf-8");
  console.log(`🧹 Dropping local test database: ${dbName}`);

  const connection = await mysql.createConnection({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
  });

  await connection.query(`DROP DATABASE IF EXISTS \`${dbName}\``);
  await connection.end();

  // Remove the temporary file
  fs.unlinkSync(dbFile);
};
