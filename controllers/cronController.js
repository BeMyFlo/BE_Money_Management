const express = require("express");
const router = express.Router();
const User = require("../models/User");
const GmailToken = require("../models/GmailToken");
const Expense = require("../models/Expense");
const Category = require("../models/Category");
const gmailService = require("../services/gmailService");
const transactionParser = require("../services/transactionParser");

// @desc    Auto-sync emails for all users
// @route   POST /api/cron/auto-sync-all
// @access  Public (but protected by secret key)
exports.autoSyncAll = async (req, res, next) => {
  try {
    // Verify cron secret to prevent unauthorized access
    const authHeader = req.headers.authorization;
    const cronSecret = process.env.CRON_SECRET || "your-secret-key-change-this";

    if (!authHeader || authHeader !== `Bearer ${cronSecret}`) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized - Invalid cron secret",
      });
    }


    // Get all users with Gmail connected
    const users = await User.find({ gmailConnected: true }).select(
      "_id name email",
    );


    let successCount = 0;
    let errorCount = 0;
    const errors = [];

    // Get current month
    const now = new Date();
    const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

    // Sync for each user
    for (const user of users) {
      try {

        // Get user's Gmail token
        const tokenDoc = await GmailToken.findOne({ userId: user._id });

        if (!tokenDoc) {
          errorCount++;
          continue;
        }

        // Check if token is expired and refresh if needed
        let accessToken = tokenDoc.getDecryptedAccessToken();
        const refreshToken = tokenDoc.getDecryptedRefreshToken();

        if (new Date() >= tokenDoc.expiresAt) {
          const newTokens = await gmailService.refreshAccessToken(refreshToken);
          accessToken = newTokens.access_token;

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
        const [year, monthNum] = currentMonth.split("-");
        const startDate = new Date(year, monthNum - 1, 1);
        const endDate = new Date(year, monthNum, 0, 23, 59, 59);

        const afterStr = startDate
          .toISOString()
          .split("T")[0]
          .replace(/-/g, "/");
        const beforeStr = endDate
          .toISOString()
          .split("T")[0]
          .replace(/-/g, "/");

        const query = `(debited OR credited OR transaction OR payment) -is:spam after:${afterStr} before:${beforeStr}`;

        // Fetch emails
        const messages = await gmailService.fetchEmails(query, 50);

        let newTransactions = 0;

        // Process each email
        for (const message of messages) {
          try {
            const emailData = gmailService.parseMessage(message);
            const transaction = transactionParser.parseTransaction(emailData);

            if (transaction) {
              // Check if already exists
              const existing = await Expense.findOne({
                emailMessageId: emailData.id,
              });

              if (!existing) {
                // Format month
                const transactionDate = new Date(transaction.date);
                const month = `${transactionDate.getFullYear()}-${String(transactionDate.getMonth() + 1).padStart(2, "0")}`;

                // Find or create category
                const categoryName = transaction.category.toLowerCase().trim();
                let category = await Category.findOne({
                  userId: user._id,
                  name: categoryName,
                });

                if (!category) {
                  category = await Category.create({
                    userId: user._id,
                    name: categoryName,
                    displayName: transaction.category.trim(),
                    color: "#667eea",
                  });
                }

                // Create expense
                await Expense.create({
                  userId: user._id,
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

                newTransactions++;
              }
            }
          } catch (err) {
            console.error("Error processing message:", err);
          }
        }

        // Update last sync time
        await User.findByIdAndUpdate(user._id, {
          lastGmailSync: new Date(),
        });

        successCount++;
      } catch (error) {
        console.error(`Error syncing for user ${user.email}:`, error.message);
        errorCount++;
        errors.push({
          userId: user._id,
          email: user.email,
          error: error.message,
        });
      }
    }


    res.json({
      success: true,
      data: {
        totalUsers: users.length,
        successCount,
        errorCount,
        errors: errors.length > 0 ? errors : undefined,
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error("Cron job error:", error);
    next(error);
  }
};
