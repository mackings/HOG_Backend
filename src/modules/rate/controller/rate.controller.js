import Vendor from "../../vendor/model/vendor.model";
import User from "../../user/model/user.model";
import Material from "../../material/model/material.model"



export const rateVendor = async (req, res, next) => {
    try {
        const { rating } = req.body;
        const { vendorId } = req.params;
        const vendor = await Vendor.findById(vendorId);
        if (!vendor) {
            return res.status(404).json({ message: "Vendor not found" });
        }

        const rate = await Vendor.findByIdAndUpdate(
            vendorId,
            {
                $push: { ratings: rating },
                $inc: { totalRatings: 1, ratingSum: rating }
            },
            { new: true }
        );

        if (!rate) {
            return res.status(500).json({ message: "Failed to update vendor rating" });
        }

        return res.status(200).json({ message: "Vendor rated successfully", vendor: rate });
    } catch (error) {
        next(error);
    }
};


export const getVendorRating = async (req, res, next) => {
    try {
        const { vendorId } = req.params;
        const vendor = await Vendor.findById(vendorId);
        if (!vendor) {
            return res.status(404).json({ message: "Vendor not found" });
        }

        const averageRating = vendor.ratingSum / vendor.totalRatings || 0;

        return res.status(200).json({ message: "Vendor rating retrieved successfully", averageRating });
    } catch (error) {
        next(error);
    }
};



export const deleteVendorRating = async (req, res, next) => {
    try {
        const { vendorId } = req.params;
        const { rating } = req.body;

        const vendor = await Vendor.findById(vendorId);
        if (!vendor) {
            return res.status(404).json({ message: "Vendor not found" });
        }

        const updatedVendor = await Vendor.findByIdAndUpdate(
            vendorId,
            {
                $pull: { ratings: rating },
                $inc: { totalRatings: -1, ratingSum: -rating }
            },
            { new: true }
        );

        if (!updatedVendor) {
            return res.status(500).json({ message: "Failed to delete vendor rating" });
        }

        return res.status(200).json({ message: "Vendor rating deleted successfully", vendor: updatedVendor });
    } catch (error) {
        next(error);
    }
};
