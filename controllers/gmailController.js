const User = require("../models/User");
const GmailToken = require("../models/GmailToken");
const Expense = require("../models/Expense");
const Category = require("../models/Category");
const gmailService = require("../services/gmailService");
const transactionParser = require("../services/transactionParser");

// @desc    Get Gmail OAuth URL
// @route   GET /api/gmail/auth-url
// @access  Private
exports.getAuthUrl = async (req, res, next) => {
  try {
    // Pass userId in state for callback identification
    const state = Buffer.from(
      JSON.stringify({ userId: req.user._id.toString() }),
    ).toString("base64");
    const authUrl = gmailService.getAuthUrl(state);

    res.json({
      success: true,
      data: { authUrl },
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Handle OAuth callback
// @route   GET /api/gmail/callback
// @access  Public (but requires valid code from Google)
exports.handleCallback = async (req, res, next) => {
  try {
    const { code, state } = req.query;

    if (!code) {
      return res.redirect(
        `${process.env.FRONTEND_URL}/dashboard?error=no_code`,
      );
    }

    // Decode state to get userId
    let userId;
    try {
      const decoded = JSON.parse(Buffer.from(state, "base64").toString());
      userId = decoded.userId;
    } catch (err) {
      return res.redirect(
        `${process.env.FRONTEND_URL}/dashboard?error=invalid_state`,
      );
    }

    // Exchange code for tokens
    const tokens = await gmailService.getTokensFromCode(code);

    // Calculate expiry date - tokens.expires_in is in seconds
    const expiresInMs = (tokens.expires_in || 3600) * 1000;
    const expiresAt = new Date(Date.now() + expiresInMs);

    // Save or update tokens using save() to trigger pre-save hook
    let tokenDoc = await GmailToken.findOne({ userId: userId });

    if (!tokenDoc) {
      tokenDoc = new GmailToken({
        userId: userId,
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token,
        expiresAt: expiresAt,
        scope: tokens.scope,
      });
    } else {
      tokenDoc.accessToken = tokens.access_token;
      tokenDoc.refreshToken = tokens.refresh_token;
      tokenDoc.expiresAt = expiresAt;
      tokenDoc.scope = tokens.scope;
    }

    await tokenDoc.save();

    // Update user
    await User.findByIdAndUpdate(userId, {
      gmailConnected: true,
    });

    res.redirect(`${process.env.FRONTEND_URL}/dashboard?gmail=connected`);
  } catch (error) {
    console.error("OAuth callback error:", error);
    res.redirect(`${process.env.FRONTEND_URL}/dashboard?error=gmail_failed`);
  }
};

// @desc    Save tokens manually (alternative flow)
// @route   POST /api/gmail/save-tokens
// @access  Private
exports.saveTokens = async (req, res, next) => {
  try {
    const { tokens } = req.body;

    if (!tokens || !tokens.access_token || !tokens.refresh_token) {
      return res.status(400).json({
        success: false,
        message: "Invalid tokens",
      });
    }

    const expiresInMs = (tokens.expires_in || 3600) * 1000;
    const expiresAt = new Date(Date.now() + expiresInMs);

    let tokenDoc = await GmailToken.findOne({ userId: req.user._id });

    if (!tokenDoc) {
      tokenDoc = new GmailToken({
        userId: req.user._id,
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token,
        expiresAt: expiresAt,
        scope: tokens.scope,
      });
    } else {
      tokenDoc.accessToken = tokens.access_token;
      tokenDoc.refreshToken = tokens.refresh_token;
      tokenDoc.expiresAt = expiresAt;
      tokenDoc.scope = tokens.scope;
    }

    await tokenDoc.save();

    await User.findByIdAndUpdate(req.user._id, {
      gmailConnected: true,
    });

    res.json({
      success: true,
      message: "Tokens saved successfully",
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Sync emails and extract transactions
// @route   POST /api/gmail/sync
// @access  Private
exports.syncEmails = async (req, res, next) => {
  try {
    const { month } = req.body; // Format: YYYY-MM

    // Get stored tokens
    const tokenDoc = await GmailToken.findOne({ userId: req.user._id });

    if (!tokenDoc) {
      return res.status(400).json({
        success: false,
        message:
          "Gmail not connected. Please connect your Gmail account first.",
      });
    }

    // Check if token is expired and refresh if needed
    let accessToken = tokenDoc.getDecryptedAccessToken();
    const refreshToken = tokenDoc.getDecryptedRefreshToken();

    if (new Date() >= tokenDoc.expiresAt) {
      const newTokens = await gmailService.refreshAccessToken(refreshToken);
      accessToken = newTokens.access_token;

      // Update tokens
      tokenDoc.accessToken = accessToken;
      const expiresInMs = (newTokens.expires_in || 3600) * 1000;
      tokenDoc.expiresAt = new Date(Date.now() + expiresInMs);
      await tokenDoc.save();
    }

    // Set credentials
    gmailService.setCredentials({
      access_token: accessToken,
      refresh_token: refreshToken,
    });

    // Build query for transaction emails
    let query = "(debited OR credited OR transaction OR payment) -is:spam";

    if (month) {
      // Parse month to get date range
      const [year, monthNum] = month.split("-");
      const startDate = new Date(year, monthNum - 1, 1);
      const endDate = new Date(year, monthNum, 0, 23, 59, 59); // Last second of last day of month

      const afterStr = startDate.toISOString().split("T")[0].replace(/-/g, "/");
      const beforeStr = endDate.toISOString().split("T")[0].replace(/-/g, "/");

      query += ` after:${afterStr} before:${beforeStr}`;
    }

    // Fetch emails
    const messages = await gmailService.fetchEmails(query, 200);

    let processed = 0;
    let added = 0;

    // Process each email
    for (const message of messages) {
      try {
        const emailData = gmailService.parseMessage(message);
        const transaction = transactionParser.parseTransaction(emailData);

        if (transaction) {
          processed++;

          // Check if already exists
          const existing = await Expense.findOne({
            emailMessageId: emailData.id,
          });

          if (!existing) {
            // Format month as YYYY-MM
            const transactionDate = new Date(transaction.date);
            const month = `${transactionDate.getFullYear()}-${String(transactionDate.getMonth() + 1).padStart(2, "0")}`;

            // Check if category exists, create if not
            const categoryName = transaction.category.toLowerCase().trim();
            let category = await Category.findOne({
              userId: req.user._id,
              name: categoryName,
            });

            if (!category) {
              // Create new category for this user
              category = await Category.create({
                userId: req.user._id,
                name: categoryName,
                displayName: transaction.category.trim(),
                color: "#667eea", // Default color
              });
              console.log(
                `Created new category: ${category.displayName} for user ${req.user._id}`,
              );
            }

            await Expense.create({
              userId: req.user._id,
              amount: transaction.amount,
              description: transaction.description,
              categoryId: category._id,
              transactionType: transaction.transactionType,
              transactionDate: transaction.date,
              month: month,
              bankName: transaction.bankName,
              emailMessageId: emailData.id,
              extractedFrom: "gmail",
            });
            added++;
          }
        }
      } catch (err) {
        console.error("Error processing message:", err);
        // Continue with next message
      }
    }

    // Update last sync time
    await User.findByIdAndUpdate(req.user._id, {
      lastGmailSync: new Date(),
    });

    res.json({
      success: true,
      data: {
        emailsChecked: messages.length,
        transactionsProcessed: processed,
        newExpensesAdded: added,
      },
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Disconnect Gmail
// @route   DELETE /api/gmail/disconnect
// @access  Private
exports.disconnectGmail = async (req, res, next) => {
  try {
    await GmailToken.findOneAndDelete({ userId: req.user._id });

    await User.findByIdAndUpdate(req.user._id, {
      gmailConnected: false,
      lastGmailSync: null,
    });

    res.json({
      success: true,
      message: "Gmail disconnected successfully",
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get Gmail connection status
// @route   GET /api/gmail/status
// @access  Private
exports.getGmailStatus = async (req, res, next) => {
  try {
    const user = await User.findById(req.user._id);

    res.json({
      success: true,
      data: {
        connected: user.gmailConnected,
        lastSync: user.lastGmailSync,
      },
    });
  } catch (error) {
    next(error);
  }
};
