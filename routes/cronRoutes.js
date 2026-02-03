const express = require("express");
const router = express.Router();
const { autoSyncAll } = require("../controllers/cronController");

// Auto-sync for all users (called by external cron service)
router.post("/auto-sync-all", autoSyncAll);

module.exports = router;
