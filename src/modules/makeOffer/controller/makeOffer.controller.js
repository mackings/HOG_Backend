import User from "../../user/model/user.model.js"
import MakeOffer from "../model/makeOffer.model.js"
import Review from "../../review/model/review.model.js"
import Vendor from "../../vendor/model/vendor.model.js"
import mongoose from "mongoose";
import Material from "../../material/model/material.model.js"



export const createMakeOffer = async (req, res, next) => {
  try {
    const { id } = req.user;
    const user = await User.findById(id);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    const { reviewId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(reviewId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid review ID",
      });
    }

    const review = await Review.findById(reviewId);
    if (!review) {
      return res.status(404).json({
        success: false,
        message: "Review not found",
      });
    }

    if (["approved", "rejected", "part payment", "full payment"].includes(review.status)) {
      return res.status(400).json({
        success: false,
        message: `This Quotation has already been ${review.status}.`,
      });
    }

    const material = await Material.findById(review.materialId);
    const Vendor = (await import('../../vendor/model/vendor.model.js')).default;
    const [buyer, vendor] = await Promise.all([
      User.findById(material.userId),
      Vendor.findById(review.vendorId).populate('userId')
    ]);

    const buyerCountry = buyer?.country || '';
    const vendorCountry = vendor?.userId?.country || '';
    
    // Determine if international vendor
    const isInternationalVendor = ['UNITED STATES', 'US', 'USA', 'UNITED KINGDOM', 'UK', 'GB']
      .includes(vendorCountry?.toUpperCase().trim() || '');
    
    // Get exchange rate from review or fetch new one
    let exchangeRate = review.exchangeRate || 0;

    const { comment, materialTotalCost, workmanshipTotalCost } = req.body;
    const materialCost = Number(materialTotalCost);
    const workmanshipCost = Number(workmanshipTotalCost);

    if (isNaN(materialCost) || isNaN(workmanshipCost)) {
      return res.status(400).json({
        success: false,
        message: "Invalid cost values. Must be numeric.",
      });
    }

    const totalCost = materialCost + workmanshipCost;

    const { vendorId, materialId } = review;
    if (!vendorId || !materialId) {
      return res.status(400).json({
        success: false,
        message: "Missing vendor or material information in the associated review.",
      });
    }

    // 🆕 Calculate USD amounts
    const materialCostUSD = isInternationalVendor && exchangeRate > 0 
      ? Math.round(materialCost / exchangeRate * 100) / 100 
      : 0;
    const workmanshipCostUSD = isInternationalVendor && exchangeRate > 0 
      ? Math.round(workmanshipCost / exchangeRate * 100) / 100 
      : 0;
    const totalCostUSD = isInternationalVendor && exchangeRate > 0 
      ? Math.round(totalCost / exchangeRate * 100) / 100 
      : 0;

    let offer = await MakeOffer.findOne({
      userId: user._id,
      vendorId,
      materialId,
      reviewId: review._id,
      status: "pending",
    });

    if (offer) {
      // 🔄 Update existing offer with USD amounts
      offer = await MakeOffer.findByIdAndUpdate(
        offer._id,
        {
          $set: {
            materialTotalCost: materialCost,
            workmanshipTotalCost: workmanshipCost,
            totalCost,
            comment: comment || offer.comment,
            status: "pending",
          },
          $push: {
            chats: {
              senderType: "customer",
              action: "pending",
              counterMaterialCost: materialCost,
              counterWorkmanshipCost: workmanshipCost,
              counterTotalCost: totalCost,
              counterMaterialCostUSD: materialCostUSD,
              counterWorkmanshipCostUSD: workmanshipCostUSD,
              counterTotalCostUSD: totalCostUSD,
              comment: comment || "Updated the offer terms",
              timestamp: new Date(),
            },
          },
        },
        { new: true }
      );
    } else {
      // 🆕 Create new offer with USD amounts in chat
      offer = await MakeOffer.create({
        userId: user._id,
        vendorId,
        materialId,
        reviewId: review._id,
        materialTotalCost: materialCost,
        workmanshipTotalCost: workmanshipCost,
        totalCost,
        comment,
        status: "incoming",
        isInternationalVendor,
        exchangeRate,
        buyerCountry,
        vendorCountry,
        chats: [
          {
            senderType: "customer",
            action: "incoming",
            counterMaterialCost: materialCost,
            counterWorkmanshipCost: workmanshipCost,
            counterTotalCost: totalCost,
            // 🆕 Add USD amounts
            counterMaterialCostUSD: materialCostUSD,
            counterWorkmanshipCostUSD: workmanshipCostUSD,
            counterTotalCostUSD: totalCostUSD,
            comment: comment || "Sent a new offer",
            timestamp: new Date(),
          },
        ],
      });
    }

    if (!offer) {
      return res.status(500).json({
        success: false,
        message: "Error creating or updating offer",
      });
    }

    return res.status(201).json({
      success: true,
      message: offer.isNew
        ? "Offer created successfully"
        : "Offer updated successfully",
      data: offer,
    });
  } catch (error) {
    next(error);
  }
};



export const vendorReplyOffer = async (req, res, next) => {
  try {
    const { id } = req.user;
    const vendor = await User.findById(id);
    if (!vendor) {
      return res.status(404).json({ success: false, message: "Vendor not found" });
    }

    const { offerId } = req.params;
    if (!mongoose.Types.ObjectId.isValid(offerId)) {
      return res.status(400).json({ success: false, message: "Invalid offer ID" });
    }

    const offer = await MakeOffer.findById(offerId)
      .populate({
        path: "vendorId",
        select: "businessName userId",
        populate: { path: "userId", select: "fullName email" },
      });

    if (!offer) {
      return res.status(404).json({ success: false, message: "Offer not found" });
    }

    if (offer.status === "rejected") {
      return res.status(400).json({
        success: false,
        message: "Offer has already been rejected.",
      });
    }

    if (offer.mutualConsentAchieved) {
      return res.status(400).json({
        success: false,
        message: "Both parties have already agreed to this offer.",
      });
    }

    const materialOwner = await Vendor.findOne({ userId: vendor._id });
    if (!materialOwner || String(offer.vendorId?._id) !== String(materialOwner._id)) {
      return res.status(403).json({
        success: false,
        message: "You are not authorized to reply to this offer.",
      });
    }

    const { action, counterMaterialCost, counterWorkmanshipCost, comment } = req.body;

    const validActions = ["accepted", "rejected", "countered"];
    if (!validActions.includes(action)) {
      return res.status(400).json({ success: false, message: "Invalid action type" });
    }

    let materialCost, workmanshipCost, totalCost;

    if (action === "accepted") {
      const latestCustomerOffer = [...offer.chats]
        .reverse()
        .find(chat => chat.senderType === "customer" && (chat.action === "countered" || chat.action === "incoming"));

      if (latestCustomerOffer) {
        materialCost = latestCustomerOffer.counterMaterialCost || 0;
        workmanshipCost = latestCustomerOffer.counterWorkmanshipCost || 0;
        totalCost = latestCustomerOffer.counterTotalCost || (materialCost + workmanshipCost);
      } else {
        materialCost = Number(counterMaterialCost) || 0;
        workmanshipCost = Number(counterWorkmanshipCost) || 0;
        totalCost = materialCost + workmanshipCost;
      }
    } else {
      materialCost = Number(counterMaterialCost) || 0;
      workmanshipCost = Number(counterWorkmanshipCost) || 0;
      totalCost = materialCost + workmanshipCost;
    }

    const exchangeRate = offer.exchangeRate || 0;
    const isInternational = offer.isInternationalVendor;
    
    const materialCostUSD = isInternational && exchangeRate > 0 
      ? Math.round(materialCost / exchangeRate * 100) / 100 
      : 0;
    const workmanshipCostUSD = isInternational && exchangeRate > 0 
      ? Math.round(workmanshipCost / exchangeRate * 100) / 100 
      : 0;
    const totalCostUSD = isInternational && exchangeRate > 0 
      ? Math.round(totalCost / exchangeRate * 100) / 100 
      : 0;

    const newChat = {
      senderType: "vendor",
      action,
      counterMaterialCost: materialCost,
      counterWorkmanshipCost: workmanshipCost,
      counterTotalCost: totalCost,
      counterMaterialCostUSD: materialCostUSD,
      counterWorkmanshipCostUSD: workmanshipCostUSD,
      counterTotalCostUSD: totalCostUSD,
      comment: comment || "",
      timestamp: new Date(),
    };

    offer.chats.push(newChat);

    if (action === "accepted") {
      offer.vendorConsent = true;
      offer.status = "accepted";

      offer.finalMaterialCost = materialCost;
      offer.finalWorkmanshipCost = workmanshipCost;
      offer.finalTotalCost = totalCost;

      if (offer.isInternationalVendor && offer.exchangeRate) {
        offer.finalMaterialCostUSD = materialCostUSD;
        offer.finalWorkmanshipCostUSD = workmanshipCostUSD;
        offer.finalTotalCostUSD = totalCostUSD;
      }

      if (offer.buyerConsent) {
        offer.mutualConsentAchieved = true;
      }
    } else if (action === "countered") {
      offer.vendorConsent = false;
      offer.buyerConsent = false;
      offer.mutualConsentAchieved = false;
      offer.status = "pending";
    } else if (action === "rejected") {
      offer.vendorConsent = false;
      offer.buyerConsent = false;
      offer.mutualConsentAchieved = false;
      offer.status = "rejected";
    }

    await offer.save();

    // 🔥 UPDATE REVIEW WHEN MUTUAL CONSENT IS ACHIEVED
    if (offer.mutualConsentAchieved && offer.reviewId) {
      console.log(`\n💰 MUTUAL CONSENT ACHIEVED - Updating Review ${offer.reviewId}`);
      console.log(`   Negotiated Amount (NGN): ₦${totalCost}`);
      
      const review = await Review.findById(offer.reviewId);
      
      if (review) {
        // Calculate tax and commission on the NEW negotiated amount
        const subTotalCost = materialCost + workmanshipCost;
        const tax = (20 / 100) * subTotalCost;
        
        const Commission = (await import('../../commission/model/commission.model.js')).default;
        const feeDoc = await Commission.findOne();
        const feePercentage = feeDoc ? Number(feeDoc.amount) : 0;
        const commission = ((feePercentage / 100) * subTotalCost);
        
        const newTotalCost = subTotalCost + tax + commission;

        let updateData = {
          // Update the main costs with negotiated amounts + tax/commission
          materialTotalCost: materialCost,
          workmanshipTotalCost: workmanshipCost,
          subTotalCost: subTotalCost,
          tax: tax,
          commission: commission,
          totalCost: newTotalCost,
          amountToPay: newTotalCost,
          hasAcceptedOffer: true,
          acceptedOfferId: offer._id,
          
          // 🔥 STORE THE FINAL NEGOTIATED AMOUNTS (before tax/commission)
          finalMaterialCost: materialCost,
          finalWorkmanshipCost: workmanshipCost,
          finalTotalCost: subTotalCost, // This is BEFORE tax and commission
        };

        console.log(`   Material Cost: ₦${materialCost}`);
        console.log(`   Workmanship Cost: ₦${workmanshipCost}`);
        console.log(`   Subtotal (negotiated): ₦${subTotalCost}`);
        console.log(`   Tax (20%): ₦${tax.toFixed(2)}`);
        console.log(`   Commission (${feePercentage}%): ₦${commission.toFixed(2)}`);
        console.log(`   New Total Cost (with tax/commission): ₦${newTotalCost.toFixed(2)}`);

        // If international vendor, calculate USD amounts
        if (offer.isInternationalVendor && exchangeRate > 0) {
          const subTotalCostUSD = Math.round(subTotalCost / exchangeRate * 100) / 100;
          const taxUSD = Math.round(tax / exchangeRate * 100) / 100;
          const commissionUSD = Math.round(commission / exchangeRate * 100) / 100;
          const totalCostUSD = Math.round(newTotalCost / exchangeRate * 100) / 100;

          updateData.materialTotalCostUSD = materialCostUSD;
          updateData.workmanshipTotalCostUSD = workmanshipCostUSD;
          updateData.subTotalCostUSD = subTotalCostUSD;
          updateData.totalCostUSD = totalCostUSD;
          updateData.amountToPayUSD = totalCostUSD;
          
          // 🔥 STORE USD FINAL AMOUNTS (before tax/commission)
          updateData.finalMaterialCostUSD = materialCostUSD;
          updateData.finalWorkmanshipCostUSD = workmanshipCostUSD;
          updateData.finalTotalCostUSD = subTotalCostUSD;

          console.log(`   Negotiated Amount (USD): $${subTotalCostUSD}`);
          console.log(`   Total with tax/commission (USD): $${totalCostUSD}`);
          console.log(`   Exchange Rate: 1 USD = ₦${exchangeRate}`);
        }

        await Review.findByIdAndUpdate(
          offer.reviewId,
          { $set: updateData },
          { new: true }
        );

        console.log(`✅ Review updated successfully with negotiated amounts`);
      }
    }

    return res.status(200).json({
      success: true,
      message:
        action === "accepted"
          ? (offer.mutualConsentAchieved
              ? "Offer accepted successfully. Both parties have consented. Review has been updated with negotiated price."
              : "Offer accepted successfully. Waiting for buyer to confirm consent.")
          : action === "rejected"
          ? "Offer rejected successfully"
          : "Counter offer sent successfully",
      data: offer,
      mutualConsentAchieved: offer.mutualConsentAchieved,
      buyerConsent: offer.buyerConsent,
      vendorConsent: offer.vendorConsent,
    });
  } catch (error) {
    next(error);
  }
};



export const buyerReplyToOffer = async (req, res, next) => {
  try {
    const { id } = req.user;
    const buyer = await User.findById(id);

    if (!buyer) {
      return res.status(404).json({ success: false, message: "Buyer not found" });
    }

    const { offerId } = req.params;
    if (!mongoose.Types.ObjectId.isValid(offerId)) {
      return res.status(400).json({ success: false, message: "Invalid offer ID" });
    }

    const offer = await MakeOffer.findById(offerId)
      .populate({
        path: "userId",
        select: "fullName email profileImage role",
      })
      .populate({
        path: "vendorId",
        select: "businessName userId",
        populate: {
          path: "userId",
          select: "fullName email",
        },
      });

    if (!offer) {
      return res.status(404).json({ success: false, message: "Offer not found" });
    }

    if (offer.status === "rejected") {
      return res.status(400).json({
        success: false,
        message: "Offer has already been rejected.",
      });
    }

    if (offer.mutualConsentAchieved) {
      return res.status(400).json({
        success: false,
        message: "Both parties have already agreed to this offer.",
      });
    }

    if (String(offer.userId?._id) !== String(buyer._id)) {
      return res.status(403).json({
        success: false,
        message: "You are not authorized to reply to this offer.",
      });
    }

    const { action, counterMaterialCost, counterWorkmanshipCost, comment } = req.body;

    const validActions = ["accepted", "rejected", "countered"];
    if (!validActions.includes(action)) {
      return res.status(400).json({
        success: false,
        message: "Invalid action. Must be accepted, rejected, or countered.",
      });
    }

    let materialCost, workmanshipCost, totalCost;

    if (action === "accepted") {
      const latestVendorOffer = [...offer.chats]
        .reverse()
        .find(chat => chat.senderType === "vendor" && chat.action === "countered");

      if (latestVendorOffer) {
        materialCost = latestVendorOffer.counterMaterialCost || 0;
        workmanshipCost = latestVendorOffer.counterWorkmanshipCost || 0;
        totalCost = latestVendorOffer.counterTotalCost || (materialCost + workmanshipCost);
      } else {
        const originalOffer = offer.chats.find(chat => chat.senderType === "customer");
        materialCost = originalOffer?.counterMaterialCost || 0;
        workmanshipCost = originalOffer?.counterWorkmanshipCost || 0;
        totalCost = originalOffer?.counterTotalCost || (materialCost + workmanshipCost);
      }
    } else {
      materialCost = Number(counterMaterialCost) || 0;
      workmanshipCost = Number(counterWorkmanshipCost) || 0;
      totalCost = materialCost + workmanshipCost;
    }

    const exchangeRate = offer.exchangeRate || 0;
    const isInternational = offer.isInternationalVendor;
    
    const materialCostUSD = isInternational && exchangeRate > 0 
      ? Math.round(materialCost / exchangeRate * 100) / 100 
      : 0;
    const workmanshipCostUSD = isInternational && exchangeRate > 0 
      ? Math.round(workmanshipCost / exchangeRate * 100) / 100 
      : 0;
    const totalCostUSD = isInternational && exchangeRate > 0 
      ? Math.round(totalCost / exchangeRate * 100) / 100 
      : 0;

    const newChat = {
      senderType: "customer",
      action,
      counterMaterialCost: materialCost,
      counterWorkmanshipCost: workmanshipCost,
      counterTotalCost: totalCost,
      counterMaterialCostUSD: materialCostUSD,
      counterWorkmanshipCostUSD: workmanshipCostUSD,
      counterTotalCostUSD: totalCostUSD,
      comment: comment || "",
      timestamp: new Date(),
    };

    offer.chats.push(newChat);

    if (action === "accepted") {
      offer.buyerConsent = true;
      offer.status = "accepted";

      offer.finalMaterialCost = materialCost;
      offer.finalWorkmanshipCost = workmanshipCost;
      offer.finalTotalCost = totalCost;

      if (offer.isInternationalVendor && offer.exchangeRate) {
        offer.finalMaterialCostUSD = materialCostUSD;
        offer.finalWorkmanshipCostUSD = workmanshipCostUSD;
        offer.finalTotalCostUSD = totalCostUSD;
      }

      if (offer.vendorConsent) {
        offer.mutualConsentAchieved = true;
      }
    } else if (action === "countered") {
      offer.vendorConsent = false;
      offer.buyerConsent = false;
      offer.mutualConsentAchieved = false;
      offer.status = "pending";
    } else if (action === "rejected") {
      offer.vendorConsent = false;
      offer.buyerConsent = false;
      offer.mutualConsentAchieved = false;
      offer.status = "rejected";
    }

    await offer.save();

    // 🔥 UPDATE REVIEW WHEN MUTUAL CONSENT IS ACHIEVED
    if (offer.mutualConsentAchieved && offer.reviewId) {
      console.log(`\n💰 MUTUAL CONSENT ACHIEVED - Updating Review ${offer.reviewId}`);
      console.log(`   Negotiated Amount (NGN): ₦${totalCost}`);
      
      const review = await Review.findById(offer.reviewId);
      
      if (review) {
        // Calculate tax and commission on the NEW negotiated amount
        const subTotalCost = materialCost + workmanshipCost;
        const tax = (20 / 100) * subTotalCost;
        
        const Commission = (await import('../../commission/model/commission.model.js')).default;
        const feeDoc = await Commission.findOne();
        const feePercentage = feeDoc ? Number(feeDoc.amount) : 0;
        const commission = ((feePercentage / 100) * subTotalCost);
        
        const newTotalCost = subTotalCost + tax + commission;

        let updateData = {
          // Update the main costs with negotiated amounts + tax/commission
          materialTotalCost: materialCost,
          workmanshipTotalCost: workmanshipCost,
          subTotalCost: subTotalCost,
          tax: tax,
          commission: commission,
          totalCost: newTotalCost,
          amountToPay: newTotalCost,
          hasAcceptedOffer: true,
          acceptedOfferId: offer._id,
          
          // 🔥 STORE THE FINAL NEGOTIATED AMOUNTS (before tax/commission)
          finalMaterialCost: materialCost,
          finalWorkmanshipCost: workmanshipCost,
          finalTotalCost: subTotalCost, // This is BEFORE tax and commission
        };

        console.log(`   Material Cost: ₦${materialCost}`);
        console.log(`   Workmanship Cost: ₦${workmanshipCost}`);
        console.log(`   Subtotal (negotiated): ₦${subTotalCost}`);
        console.log(`   Tax (20%): ₦${tax.toFixed(2)}`);
        console.log(`   Commission (${feePercentage}%): ₦${commission.toFixed(2)}`);
        console.log(`   New Total Cost (with tax/commission): ₦${newTotalCost.toFixed(2)}`);

        // If international vendor, calculate USD amounts
        if (offer.isInternationalVendor && exchangeRate > 0) {
          const subTotalCostUSD = Math.round(subTotalCost / exchangeRate * 100) / 100;
          const taxUSD = Math.round(tax / exchangeRate * 100) / 100;
          const commissionUSD = Math.round(commission / exchangeRate * 100) / 100;
          const totalCostUSD = Math.round(newTotalCost / exchangeRate * 100) / 100;

          updateData.materialTotalCostUSD = materialCostUSD;
          updateData.workmanshipTotalCostUSD = workmanshipCostUSD;
          updateData.subTotalCostUSD = subTotalCostUSD;
          updateData.totalCostUSD = totalCostUSD;
          updateData.amountToPayUSD = totalCostUSD;
          
          // 🔥 STORE USD FINAL AMOUNTS (before tax/commission)
          updateData.finalMaterialCostUSD = materialCostUSD;
          updateData.finalWorkmanshipCostUSD = workmanshipCostUSD;
          updateData.finalTotalCostUSD = subTotalCostUSD;

          console.log(`   Negotiated Amount (USD): $${subTotalCostUSD}`);
          console.log(`   Total with tax/commission (USD): $${totalCostUSD}`);
          console.log(`   Exchange Rate: 1 USD = ₦${exchangeRate}`);
        }

        await Review.findByIdAndUpdate(
          offer.reviewId,
          { $set: updateData },
          { new: true }
        );

        console.log(`✅ Review updated successfully with negotiated amounts`);
      }
    }

    return res.status(200).json({
      success: true,
      message:
        action === "accepted"
          ? (offer.mutualConsentAchieved
              ? "Offer accepted successfully. Both parties have consented. Review has been updated with negotiated price."
              : "Offer accepted successfully. Waiting for vendor to confirm consent.")
          : action === "rejected"
          ? "You rejected the vendor's offer successfully"
          : "Counter offer sent successfully",
      data: offer,
      mutualConsentAchieved: offer.mutualConsentAchieved,
      buyerConsent: offer.buyerConsent,
      vendorConsent: offer.vendorConsent,
    });
  } catch (error) {
    next(error);
  }
};




export const getAllMakeOffers = async (req, res, next) => {
  try {
    const { id } = req.user;

    // 🧩 Find logged-in user
    const user = await User.findById(id);
    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    // 🧩 Check if the user is a vendor
    const vendor = await Vendor.findOne({ userId: id });

    // 🧩 Build dynamic query filter
    const filter = [];
    if (user?._id) filter.push({ userId: user._id });
    if (vendor?._id) filter.push({ vendorId: vendor._id });

    if (filter.length === 0) {
      return res.status(200).json({
        success: true,
        message: "No make offers found",
        data: [],
      });
    }

    // 🧩 Fetch all offers involving the user or vendor
    const makeOffers = await MakeOffer.find({ $or: filter })
      .populate({
        path: "userId",
        select: "fullName email profileImage role",
      })
      .populate({
        path: "vendorId",
        select: "businessName userId",
        populate: {
          path: "userId",
          select: "fullName email",
        },
      })
      .populate("materialId reviewId")
      .sort({ createdAt: -1 })
      .lean(); // Use lean for better performance if you don’t need Mongoose documents

    if (!makeOffers || makeOffers.length === 0) {
      return res.status(200).json({
        success: true,
        message: "No make offers found",
        data: [],
      });
    }

    // 🧩 Include chat summary (optional)
    const offersWithChatSummary = makeOffers.map((offer) => {
      const chats = offer.chats || [];
      const latestChat = chats.length > 0 ? chats[chats.length - 1] : null;

      return {
        ...offer,
        chatSummary: {
          totalMessages: chats.length,
          latestMessage: latestChat,
        },
      };
    });

    return res.status(200).json({
      success: true,
      message: "Make offers retrieved successfully",
      count: offersWithChatSummary.length,
      data: offersWithChatSummary,
    });
  } catch (error) {
    next(error);
  }
};


export const deleteAllMakeOffer = async (req, res, next) => {
  try {
    const deleteAllMakeOffer = await MakeOffer.deleteMany();
    if (!deleteAllMakeOffer) {
      return res.status(400).json({ success: false, message: "No make offer found" });
    }
    return res.status(200).json({ success: true, message: "All make offers deleted successfully" });
    }catch (error) {
    next(error);
    }

}


export const getMakeOfferById = async (req, res, next) => {
  try {
    const { id } = req.user;
    const { offerId } = req.params;

    // 🧩 Validate offer ID
    if (!mongoose.Types.ObjectId.isValid(offerId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid offer ID format",
      });
    }

    // 🧩 Check if user exists
    const user = await User.findById(id);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    // 🧩 Check if user is a vendor
    const vendor = await Vendor.findOne({ userId: id });

    // 🧩 Fetch offer and populate references
    const offer = await MakeOffer.findById(offerId)
      .populate({
        path: "userId",
        select: "fullName email profileImage role",
      })
      .populate({
        path: "vendorId",
        select: "businessName userId",
        populate: {
          path: "userId",
          select: "fullName email",
        },
      })
      .populate("materialId reviewId")
      .lean(); // Convert to plain JS object for efficiency

    if (!offer) {
      return res.status(404).json({
        success: false,
        message: "Offer not found",
      });
    }

    // 🧩 Authorization: only user or vendor involved can access
    const isAuthorized =
      String(offer.userId?._id) === String(user._id) ||
      (vendor && String(offer.vendorId?._id) === String(vendor._id));

    if (!isAuthorized) {
      return res.status(403).json({
        success: false,
        message: "You are not authorized to view this offer",
      });
    }

    // 🧩 Sort chats by timestamp (for consistent order)
    if (offer.chats && Array.isArray(offer.chats)) {
      offer.chats = offer.chats.sort(
        (a, b) => new Date(a.timestamp) - new Date(b.timestamp)
      );
    }

    // 🧩 Optional chat summary
    const latestChat =
      offer.chats && offer.chats.length > 0
        ? offer.chats[offer.chats.length - 1]
        : null;

    return res.status(200).json({
      success: true,
      message: "Offer retrieved successfully",
      data: {
        ...offer,
        chatSummary: {
          totalMessages: offer.chats?.length || 0,
          latestMessage: latestChat,
        },
      },
    });
  } catch (error) {
    next(error);
  }
};

