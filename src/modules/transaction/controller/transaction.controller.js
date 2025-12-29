import mongoose from "mongoose";
import User from "../../user/model/user.model.js";
import Transaction from "../model/transaction.model.js";
import Vendor from "../../vendor/model/vendor.model.js";


export const getAllTransactions = async (req, res, next) => {
  try {
    const { id } = req.user;

    const vendor = await Vendor.findOne({ userId: id }).lean();

    const conditions = [{ userId: id }];
    if (vendor) {
      conditions.push({ vendorId: vendor._id });
    }

    const transactions = await Transaction.find({ $or: conditions })
      .sort({ createdAt: -1 })
      .lean();

    return res.status(200).json({
      success: true,
      message: "Transactions fetched successfully",
      count: transactions.length,
      data: transactions,
    });
  } catch (error) {
    next(error);
  }
};



export const getSingleTransaction = async (req, res, next) => {
  try {
    const { id } = req.user;
    const { transactionId } = req.query;

    if (!mongoose.Types.ObjectId.isValid(transactionId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid transaction ID",
      });
    }

    const vendor = await Vendor.findOne({ userId: id }).lean();

    // Build conditions
    const conditions = [{ userId: id }];
    if (vendor) {
      conditions.push({ vendorId: vendor._id });
    }

    const transaction = await Transaction.findOne({
      _id: transactionId,
      $or: conditions,
    }).lean();

    if (!transaction) {
      return res.status(404).json({
        success: false,
        message: "Transaction not found",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Transaction fetched successfully",
      data: transaction,
    });
  } catch (error) {
    next(error);
  }
};


export const deleteTransaction = async (req, res, next) => {
  try {
    const { id } = req.user;
    const { transactionId } = req.query;

    if (!mongoose.Types.ObjectId.isValid(transactionId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid transaction ID",
      });
    }

    const vendor = await Vendor.findOne({ userId: id }).lean();

    const conditions = [{ userId: id }];
    if (vendor) {
      conditions.push({ vendorId: vendor._id });
    }

    const transaction = await Transaction.findOneAndDelete({
      _id: transactionId,
      $or: conditions,
    }).lean();

    if (!transaction) {
      return res.status(404).json({
        success: false,
        message: "Transaction not found or not authorized to delete",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Transaction deleted successfully",
      data: transaction,
    });
  } catch (error) {
    next(error);
  }
};
