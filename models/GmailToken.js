const mongoose = require("mongoose");
const crypto = require("crypto");

const gmailTokenSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
    unique: true,
  },
  accessToken: {
    type: String,
    required: true,
  },
  refreshToken: {
    type: String,
    required: true,
  },
  expiresAt: {
    type: Date,
    required: true,
  },
  scope: {
    type: String,
    required: true,
  },
  updatedAt: {
    type: Date,
    default: Date.now,
  },
});

// Encrypt tokens before saving
gmailTokenSchema.pre("save", function (next) {
  if (this.isModified("accessToken") && !this.accessToken.includes(":")) {
    this.accessToken = encrypt(this.accessToken);
  }
  if (this.isModified("refreshToken") && !this.refreshToken.includes(":")) {
    this.refreshToken = encrypt(this.refreshToken);
  }
  this.updatedAt = Date.now();
  next();
});

// Helper methods
gmailTokenSchema.methods.getDecryptedAccessToken = function () {
  return decrypt(this.accessToken);
};

gmailTokenSchema.methods.getDecryptedRefreshToken = function () {
  return decrypt(this.refreshToken);
};

// Encryption functions
function encrypt(text) {
  const algorithm = "aes-256-cbc";
  const keyStr = process.env.ENCRYPTION_KEY || "defaultkey12345678901234567890";
  console.log("ENCRYPT - Key from env:", keyStr);
  console.log("ENCRYPT - Key length:", keyStr.length);

  const key = Buffer.from(keyStr, "utf8").slice(0, 32);
  const iv = crypto.randomBytes(16);

  const cipher = crypto.createCipheriv(algorithm, key, iv);
  let encrypted = cipher.update(text, "utf8", "hex");
  encrypted += cipher.final("hex");

  return iv.toString("hex") + ":" + encrypted;
}

function decrypt(text) {
  const algorithm = "aes-256-cbc";
  const keyStr = process.env.ENCRYPTION_KEY || "defaultkey12345678901234567890";
  console.log("DECRYPT - Key from env:", keyStr);
  console.log("DECRYPT - Key length:", keyStr.length);
  console.log("DECRYPT - Text to decrypt:", text);

  const key = Buffer.from(keyStr, "utf8").slice(0, 32);

  const parts = text.split(":");
  const iv = Buffer.from(parts[0], "hex");
  const encrypted = parts[1];

  const decipher = crypto.createDecipheriv(algorithm, key, iv);
  let decrypted = decipher.update(encrypted, "hex", "utf8");
  decrypted += decipher.final("utf8");

  return decrypted;
}

module.exports = mongoose.model("GmailToken", gmailTokenSchema);
