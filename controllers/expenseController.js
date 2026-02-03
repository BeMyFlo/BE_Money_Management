const Expense = require("../models/Expense");
const Category = require("../models/Category");
const { EXPENSE_CATEGORIES } = require("../config/constants");

// @desc    Get all expenses for user
// @route   GET /api/expenses
// @access  Private
exports.getExpenses = async (req, res, next) => {
  try {
    const {
      month,
      category,
      startDate,
      endDate,
      limit = 100,
      page = 1,
    } = req.query;

    // Build query
    const query = { userId: req.user._id };

    if (month) {
      query.month = month;
    }

    if (category) {
      query.categoryId = category;
    }

    if (startDate || endDate) {
      query.transactionDate = {};
      if (startDate) {
        query.transactionDate.$gte = new Date(startDate);
      }
      if (endDate) {
        query.transactionDate.$lte = new Date(endDate);
      }
    }

    console.log("\n=== GET EXPENSES DEBUG ===");
    console.log("Query params:", req.query);
    console.log("Built query:", JSON.stringify(query, null, 2));
    console.log("Limit:", limit, "Page:", page);

    // Check all records for this user (no month filter)
    const allUserExpenses = await Expense.find({ userId: req.user._id })
      .select("transactionDate month amount description category")
      .sort({ transactionDate: -1 })
      .limit(15);

    console.log("\n=== ALL USER EXPENSES (max 15) ===");
    allUserExpenses.forEach((exp, idx) => {
      console.log(
        `${idx + 1}. Date: ${exp.transactionDate.toISOString().split("T")[0]}, Month: "${exp.month}", Amount: ${exp.amount}, Desc: ${exp.description.substring(0, 30)}`,
      );
    });

    // Execute query with pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);

    // Count total first
    const total = await Expense.countDocuments(query);
    console.log("Total records matching query:", total);

    const expenses = await Expense.find(query)
      .populate("categoryId", "name displayName color")
      .sort({ transactionDate: -1 })
      .limit(parseInt(limit))
      .skip(skip);

    console.log("Records returned:", expenses.length);
    console.log("Skip:", skip);
    console.log(
      "First 3 expenses:",
      expenses.slice(0, 3).map((e) => ({
        date: e.transactionDate,
        amount: e.amount,
        description: e.description,
        category: e.category,
        month: e.month,
      })),
    );

    res.json({
      success: true,
      data: {
        expenses,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / parseInt(limit)),
        },
      },
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get expense by ID
// @route   GET /api/expenses/:id
// @access  Private
exports.getExpenseById = async (req, res, next) => {
  try {
    const expense = await Expense.findOne({
      _id: req.params.id,
      userId: req.user._id,
    }).populate("categoryId", "name displayName color");

    if (!expense) {
      return res.status(404).json({
        success: false,
        message: "Expense not found",
      });
    }

    res.json({
      success: true,
      data: { expense },
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Create manual expense
// @route   POST /api/expenses
// @access  Private
exports.createManualExpense = async (req, res, next) => {
  try {
    const { amount, description, category, transactionDate, bankName } =
      req.body;

    if (!amount || !description || !transactionDate || !category) {
      return res.status(400).json({
        success: false,
        message:
          "Amount, description, category, and transaction date are required",
      });
    }

    // Find the category by name (lowercase)
    const categoryDoc = await Category.findOne({
      userId: req.user._id,
      name: category.toLowerCase(),
    });

    if (!categoryDoc) {
      return res.status(400).json({
        success: false,
        message: "Category not found. Please create the category first.",
      });
    }

    const expense = await Expense.create({
      userId: req.user._id,
      amount,
      description,
      categoryId: categoryDoc._id,
      transactionDate,
      bankName: bankName || "",
      extractedFrom: "manual",
    });
    await expense.populate("categoryId", "name displayName color");
    res.status(201).json({
      success: true,
      data: { expense },
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Update expense
// @route   PUT /api/expenses/:id
// @access  Private
exports.updateExpense = async (req, res, next) => {
  try {
    const { category, description, amount, transactionDate } = req.body;

    const expense = await Expense.findOne({
      _id: req.params.id,
      userId: req.user._id,
    });

    if (!expense) {
      return res.status(404).json({
        success: false,
        message: "Expense not found",
      });
    }

    // Update fields
    if (category) {
      // Find category by name
      const categoryDoc = await Category.findOne({
        userId: req.user._id,
        name: category.toLowerCase(),
      });
      if (!categoryDoc) {
        return res.status(400).json({
          success: false,
          message: "Category not found",
        });
      }
      expense.categoryId = categoryDoc._id;
    }
    if (description) expense.description = description;
    if (amount) expense.amount = amount;
    if (transactionDate) expense.transactionDate = transactionDate;

    await expense.save();
    await expense.populate("categoryId", "name displayName color");

    res.json({
      success: true,
      data: { expense },
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Delete expense
// @route   DELETE /api/expenses/:id
// @access  Private
exports.deleteExpense = async (req, res, next) => {
  try {
    const expense = await Expense.findOneAndDelete({
      _id: req.params.id,
      userId: req.user._id,
    });

    if (!expense) {
      return res.status(404).json({
        success: false,
        message: "Expense not found",
      });
    }

    res.json({
      success: true,
      message: "Expense deleted successfully",
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get expense summary
// @route   GET /api/expenses/summary
// @access  Private
exports.getSummary = async (req, res, next) => {
  try {
    const { month, startDate, endDate } = req.query;

    // Build match query
    const matchQuery = { userId: req.user._id };

    if (month) {
      matchQuery.month = month;
    } else if (startDate || endDate) {
      matchQuery.transactionDate = {};
      if (startDate) {
        matchQuery.transactionDate.$gte = new Date(startDate);
      }
      if (endDate) {
        matchQuery.transactionDate.$lte = new Date(endDate);
      }
    } else {
      // Default to current month
      const now = new Date();
      const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
      matchQuery.month = currentMonth;
    }

    // Aggregate by category
    const categoryBreakdown = await Expense.aggregate([
      { $match: matchQuery },
      {
        $lookup: {
          from: "categories",
          localField: "categoryId",
          foreignField: "_id",
          as: "categoryInfo",
        },
      },
      { $unwind: "$categoryInfo" },
      {
        $group: {
          _id: "$categoryId",
          categoryName: { $first: "$categoryInfo.displayName" },
          total: { $sum: "$amount" },
          count: { $sum: 1 },
        },
      },
      { $sort: { total: -1 } },
    ]);

    // Calculate total
    const totalExpense = categoryBreakdown.reduce(
      (sum, cat) => sum + cat.total,
      0,
    );
    const totalCount = categoryBreakdown.reduce(
      (sum, cat) => sum + cat.count,
      0,
    );

    // Monthly trend (last 6 months)
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

    const monthlyTrend = await Expense.aggregate([
      {
        $match: {
          userId: req.user._id,
          transactionDate: { $gte: sixMonthsAgo },
        },
      },
      {
        $group: {
          _id: "$month",
          total: { $sum: "$amount" },
          count: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
    ]);

    res.json({
      success: true,
      data: {
        totalExpense,
        totalCount,
        categoryBreakdown: categoryBreakdown.map((cat) => ({
          category: cat.categoryName,
          total: cat.total,
          count: cat.count,
          percentage:
            totalExpense > 0
              ? ((cat.total / totalExpense) * 100).toFixed(2)
              : 0,
        })),
        monthlyTrend,
      },
    });
  } catch (error) {
    next(error);
  }
};
