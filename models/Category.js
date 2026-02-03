const mongoose = require("mongoose");

const categorySchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
    index: true,
  },
  name: {
    type: String,
    required: true,
    trim: true,
    lowercase: true,
  },
  displayName: {
    type: String,
    required: true,
    trim: true,
  },
  color: {
    type: String,
    default: "#3b82f6",
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

// Compound index để đảm bảo mỗi user không có category trùng tên
categorySchema.index({ userId: 1, name: 1 }, { unique: true });

module.exports = mongoose.model("Category", categorySchema);
