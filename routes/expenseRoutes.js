const express = require("express");
const {
  getExpenses,
  getExpenseById,
  updateExpense,
  deleteExpense,
  getSummary,
  createManualExpense,
} = require("../controllers/expenseController");
const { protect } = require("../middleware/auth");

const router = express.Router();

// All routes require authentication
router.use(protect);

router.get("/", getExpenses);
router.post("/", createManualExpense);
router.get("/summary", getSummary);
router.get("/:id", getExpenseById);
router.put("/:id", updateExpense);
router.delete("/:id", deleteExpense);

module.exports = router;
