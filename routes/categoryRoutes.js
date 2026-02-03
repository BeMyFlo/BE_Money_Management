const express = require("express");
const router = express.Router();
const {
  getCategories,
  createCategory,
  getCategoryStats,
  updateCategory,
  deleteCategory,
} = require("../controllers/categoryController");
const { protect } = require("../middleware/auth");

router.use(protect);

router.route("/").get(getCategories).post(createCategory);
router.route("/stats").get(getCategoryStats);
router.route("/:id").put(updateCategory).delete(deleteCategory);

module.exports = router;
