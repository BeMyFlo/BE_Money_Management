const express = require("express");
const router = express.Router();
const bankEmailConfigController = require("../controllers/bankEmailConfigController");
const { protect } = require("../middleware/auth");

// All routes require authentication
router.use(protect);

// Get all email configs
router.get("/", bankEmailConfigController.getAllConfigs);

// Get single config
router.get("/:id", bankEmailConfigController.getConfigById);

// Create new config
router.post("/", bankEmailConfigController.createConfig);

// Update config
router.put("/:id", bankEmailConfigController.updateConfig);

// Delete config
router.delete("/:id", bankEmailConfigController.deleteConfig);

// Test config against example email
router.post("/test", bankEmailConfigController.testConfig);

module.exports = router;
