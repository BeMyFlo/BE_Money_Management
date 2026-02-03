const Category = require("../models/Category");
const Expense = require("../models/Expense");

// @desc    Get user's categories
// @route   GET /api/categories
// @access  Private
exports.getCategories = async (req, res, next) => {
  try {
    const categories = await Category.find({ userId: req.user._id }).sort({
      displayName: 1,
    });

    res.json({
      success: true,
      data: categories,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Create or get existing category
// @route   POST /api/categories
// @access  Private
exports.createCategory = async (req, res, next) => {
  try {
    const { name, displayName, color } = req.body;

    const categoryName = (name || displayName).toLowerCase().trim();

    // Check if category exists
    let category = await Category.findOne({
      userId: req.user._id,
      name: categoryName,
    });

    if (!category) {
      category = await Category.create({
        userId: req.user._id,
        name: categoryName,
        displayName: displayName || name,
        color: color || "#3b82f6",
      });
    }

    res.status(201).json({
      success: true,
      data: category,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get categories with expense counts and totals
// @route   GET /api/categories/stats
// @access  Private
exports.getCategoryStats = async (req, res, next) => {
  try {
    const { month } = req.query;

    const matchStage = { userId: req.user._id };
    if (month) {
      matchStage.month = month;
    }

    const stats = await Expense.aggregate([
      { $match: matchStage },
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
          _id: {
            categoryId: "$categoryId",
            categoryName: "$categoryInfo.displayName",
            transactionType: "$transactionType",
          },
          count: { $sum: 1 },
          total: { $sum: "$amount" },
        },
      },
      {
        $group: {
          _id: "$_id.categoryId",
          categoryName: { $first: "$_id.categoryName" },
          transactionTypes: {
            $push: {
              type: "$_id.transactionType",
              count: "$count",
              total: "$total",
            },
          },
          totalCount: { $sum: "$count" },
          totalAmount: { $sum: "$total" },
        },
      },
      { $sort: { totalAmount: -1 } },
    ]);

    res.json({
      success: true,
      data: stats,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Update category
// @route   PUT /api/categories/:id
// @access  Private
exports.updateCategory = async (req, res, next) => {
  try {
    const { displayName, color } = req.body;

    const category = await Category.findOneAndUpdate(
      { _id: req.params.id, userId: req.user._id },
      { displayName, color },
      { new: true, runValidators: true },
    );

    if (!category) {
      return res.status(404).json({
        success: false,
        message: "Category not found",
      });
    }

    res.json({
      success: true,
      data: category,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Delete category
// @route   DELETE /api/categories/:id
// @access  Private
exports.deleteCategory = async (req, res, next) => {
  try {
    const category = await Category.findOneAndDelete({
      _id: req.params.id,
      userId: req.user._id,
    });

    if (!category) {
      return res.status(404).json({
        success: false,
        message: "Category not found",
      });
    }

    // Find or create a default "khác" category
    let defaultCategory = await Category.findOne({
      userId: req.user._id,
      name: "khác",
    });

    if (!defaultCategory) {
      defaultCategory = await Category.create({
        userId: req.user._id,
        name: "khác",
        displayName: "Khác",
        color: "#6b7280",
      });
    }

    // Update all expenses with this category to "khác"
    await Expense.updateMany(
      { userId: req.user._id, categoryId: req.params.id },
      { categoryId: defaultCategory._id },
    );

    res.json({
      success: true,
      message: "Category deleted successfully",
    });
  } catch (error) {
    next(error);
  }
};
