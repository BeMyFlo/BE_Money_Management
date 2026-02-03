const mongoose = require("mongoose");

const expenseSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
    index: true,
  },
  amount: {
    type: Number,
    required: [true, "Amount is required"],
    min: 0,
  },
  currency: {
    type: String,
    default: "INR",
    uppercase: true,
  },
  description: {
    type: String,
    required: true,
    trim: true,
  },
  categoryId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Category",
    required: true,
    index: true,
  },
  transactionType: {
    type: String,
    enum: ["debit", "credit", "credit_card_statement"],
    default: "debit",
    index: true,
  },
  transactionDate: {
    type: Date,
    required: true,
    index: true,
  },
  month: {
    type: String,
    required: true,
    index: true, // Format: YYYY-MM
  },
  bankName: {
    type: String,
    trim: true,
  },
  emailMessageId: {
    type: String,
    unique: true,
    sparse: true, // Allows null values
  },
  extractedFrom: {
    type: String,
    enum: ["gmail", "manual"],
    default: "gmail",
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

// Index for efficient queries
expenseSchema.index({ userId: 1, month: 1 });
expenseSchema.index({ userId: 1, categoryId: 1 });
expenseSchema.index({ userId: 1, transactionDate: -1 });

// Set month before saving
expenseSchema.pre("save", function (next) {
  if (this.transactionDate) {
    const date = new Date(this.transactionDate);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    this.month = `${year}-${month}`;
  }
  next();
});

module.exports = mongoose.model("Expense", expenseSchema);
