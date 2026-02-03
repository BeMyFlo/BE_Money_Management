const express = require("express");
const {
  getAuthUrl,
  handleCallback,
  syncEmails,
  disconnectGmail,
  getGmailStatus,
  saveTokens,
} = require("../controllers/gmailController");
const { protect } = require("../middleware/auth");

const router = express.Router();

// OAuth callback is public (but validated by Google)
router.get("/callback", handleCallback);

// All other routes require authentication
router.get("/auth-url", protect, getAuthUrl);
router.post("/save-tokens", protect, saveTokens);
router.post("/sync", protect, syncEmails);
router.delete("/disconnect", protect, disconnectGmail);
router.get("/status", protect, getGmailStatus);

module.exports = router;
