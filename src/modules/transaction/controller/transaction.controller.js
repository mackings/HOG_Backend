import User from "../../user/model/user.model";
import Transaction from "../model/transaction.model";


export const getAllTransactions = async (req, res, next) => {
    try {
    const { id } = req.user;
    const transactions = await Transaction.find({ userId: id })
    .sort({ createdAt: -1 }) ;
    if (transactions.length === 0) {
        return res.status(404).json({ message: "Transactions not found" });
    }
    return res.status(200).json({
        message: "Transactions fetched successfully",
        data: transactions
    });
    } catch (error) {
        next(error);
    }
}


export const getSingleTransaction = async (req, res, next) => {
    try {
        const { id } = req.user;
        const { transactionId } = req.query;
        const transaction = await Transaction.findOne({ userId: id, _id: transactionId });
        if (!transaction) {
            return res.status(404).json({ message: "Transaction not found" });
        }
        return res.status(200).json({
            message: "Transaction fetched successfully",
            data: transaction
        });
    } catch (error) {
        next(error);
    }
}

export const deleteTransaction = async (req, res, next) => {
    try {
        const { id } = req.user;
        const { transactionId } = req.query;
        const transaction = await Transaction.findOneAndDelete({ userId: id, _id: transactionId });
        if (!transaction) {
            return res.status(404).json({ message: "Transaction not found" });
        }
        return res.status(200).json({
            message: "Transaction deleted successfully",
            data: transaction
        });
    } catch (error) {
        next(error);
    }
}