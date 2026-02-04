const BankEmailConfig = require("../models/BankEmailConfig");

// Get all email configs for logged-in user
exports.getAllConfigs = async (req, res) => {
  try {
    const configs = await BankEmailConfig.find({ userId: req.user.id }).sort({
      createdAt: -1,
    });
    res.json(configs);
  } catch (error) {
    console.error("Error fetching email configs:", error);
    res.status(500).json({ message: "Error fetching email configs" });
  }
};

// Get single config by ID
exports.getConfigById = async (req, res) => {
  try {
    const config = await BankEmailConfig.findOne({
      _id: req.params.id,
      userId: req.user.id,
    });

    if (!config) {
      return res.status(404).json({ message: "Email config not found" });
    }

    res.json(config);
  } catch (error) {
    console.error("Error fetching email config:", error);
    res.status(500).json({ message: "Error fetching email config" });
  }
};

// Create new email config
exports.createConfig = async (req, res) => {
  try {
    const {
      name,
      fromPatterns,
      subjectPatterns,
      bodyKeywords,
      bankName,
      isActive,
      amountLabels,
      descriptionLabels,
      exampleEmail,
    } = req.body;

    // Validate required fields
    if (!name || !fromPatterns || fromPatterns.length === 0 || !bankName) {
      return res.status(400).json({
        message: "Name, at least one from pattern, and bank name are required",
      });
    }

    const config = new BankEmailConfig({
      userId: req.user.id,
      name,
      fromPatterns,
      subjectPatterns: subjectPatterns || [],
      bodyKeywords: bodyKeywords || [],
      bankName,
      isActive: isActive !== undefined ? isActive : true,
      amountLabels: amountLabels || [],
      descriptionLabels: descriptionLabels || [],
      exampleEmail,
    });

    await config.save();
    res.status(201).json(config);
  } catch (error) {
    console.error("Error creating email config:", error);
    res.status(500).json({ message: "Error creating email config" });
  }
};

// Update email config
exports.updateConfig = async (req, res) => {
  try {
    const {
      name,
      fromPatterns,
      subjectPatterns,
      bodyKeywords,
      bankName,
      isActive,
      amountLabels,
      descriptionLabels,
      exampleEmail,
    } = req.body;

    const config = await BankEmailConfig.findOne({
      _id: req.params.id,
      userId: req.user.id,
    });

    if (!config) {
      return res.status(404).json({ message: "Email config not found" });
    }

    // Update fields
    if (name) config.name = name;
    if (fromPatterns) config.fromPatterns = fromPatterns;
    if (subjectPatterns !== undefined) config.subjectPatterns = subjectPatterns;
    if (bodyKeywords !== undefined) config.bodyKeywords = bodyKeywords;
    if (bankName) config.bankName = bankName;
    if (isActive !== undefined) config.isActive = isActive;
    if (amountLabels !== undefined) config.amountLabels = amountLabels;
    if (descriptionLabels !== undefined)
      config.descriptionLabels = descriptionLabels;
    if (exampleEmail !== undefined) config.exampleEmail = exampleEmail;

    await config.save();
    res.json(config);
  } catch (error) {
    console.error("Error updating email config:", error);
    res.status(500).json({ message: "Error updating email config" });
  }
};

// Delete email config
exports.deleteConfig = async (req, res) => {
  try {
    const config = await BankEmailConfig.findOne({
      _id: req.params.id,
      userId: req.user.id,
    });

    if (!config) {
      return res.status(404).json({ message: "Email config not found" });
    }

    await config.deleteOne();
    res.json({ message: "Email config deleted successfully" });
  } catch (error) {
    console.error("Error deleting email config:", error);
    res.status(500).json({ message: "Error deleting email config" });
  }
};

// Test email config against example email
exports.testConfig = async (req, res) => {
  try {
    const { configId, testEmail } = req.body;

    if (!testEmail || !testEmail.from || !testEmail.subject) {
      return res.status(400).json({
        message: "Test email must include 'from' and 'subject' fields",
      });
    }

    let config;
    if (configId) {
      config = await BankEmailConfig.findOne({
        _id: configId,
        userId: req.user.id,
      });
      if (!config) {
        return res.status(404).json({ message: "Email config not found" });
      }
    } else {
      // Use temporary config from request body
      config = req.body.config;
      if (!config) {
        return res
          .status(400)
          .json({ message: "Either configId or config is required" });
      }
    }

    // Test if email matches config
    const transactionParser = require("../services/transactionParser");
    const matches = transactionParser.matchesConfig(testEmail, config);

    if (!matches) {
      return res.json({
        matches: false,
        message: "Email does not match config patterns",
      });
    }

    // Try to parse transaction
    const transaction = transactionParser.parseTransaction(testEmail, config);

    res.json({
      matches: true,
      transaction,
      message: transaction
        ? "Email matched and transaction parsed successfully"
        : "Email matched but could not extract transaction data",
    });
  } catch (error) {
    console.error("Error testing email config:", error);
    res.status(500).json({ message: "Error testing email config" });
  }
};
