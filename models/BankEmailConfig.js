const mongoose = require("mongoose");

const bankEmailConfigSchema = new mongoose.Schema(
  {
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
    },
    // Email sender patterns (can be multiple)
    fromPatterns: {
      type: [String],
      required: true,
      validate: {
        validator: function (v) {
          return v && v.length > 0;
        },
        message: "At least one from pattern is required",
      },
    },
    // Subject patterns (optional, for additional filtering)
    subjectPatterns: {
      type: [String],
      default: [],
    },
    // Keywords that must appear in email body (optional)
    bodyKeywords: {
      type: [String],
      default: [],
    },
    // Bank name for categorization
    bankName: {
      type: String,
      required: true,
      trim: true,
    },
    // Is this config active?
    isActive: {
      type: Boolean,
      default: true,
    },
    // Amount labels (user-friendly, will be converted to regex)
    amountLabels: {
      type: [String],
      default: [],
    },
    // Description labels (user-friendly, will be converted to regex)
    descriptionLabels: {
      type: [String],
      default: [],
    },
    // Example email data for testing
    exampleEmail: {
      from: String,
      subject: String,
      body: String,
    },
  },
  {
    timestamps: true,
  },
);

// Index for faster queries
bankEmailConfigSchema.index({ userId: 1, isActive: 1 });

module.exports = mongoose.model("BankEmailConfig", bankEmailConfigSchema);
