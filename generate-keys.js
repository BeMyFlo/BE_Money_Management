const crypto = require("crypto");

console.log("\n🔐 Generating secure keys for your application...\n");

const jwtSecret = crypto.randomBytes(64).toString("hex");
const encryptionKey = crypto.randomBytes(16).toString("hex");

console.log("Copy these to your backend/.env file:\n");
console.log("JWT_SECRET=" + jwtSecret);
console.log("ENCRYPTION_KEY=" + encryptionKey);

console.log("\n✅ Keys generated successfully!\n");
console.log("⚠️  Keep these secret and never commit to git!\n");
