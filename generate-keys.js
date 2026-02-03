const crypto = require("crypto");


const jwtSecret = crypto.randomBytes(64).toString("hex");
const encryptionKey = crypto.randomBytes(16).toString("hex");
