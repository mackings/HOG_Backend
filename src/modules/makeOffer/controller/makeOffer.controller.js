import User from "../../user/model/user.model.js"
import MakeOffer from "../model/makeOffer.model.js"
import Review from "../../review/model/review.model.js"
import Vendor from "../../vendor/model/vendor.model.js"
import mongoose from "mongoose";
import Material from "../../material/model/material.model.js"
import { getPricingRates } from "../../../utils/pricingConfig.utils.js";

const roundUpNGN = (value) => Math.ceil(Number(value) || 0);
const roundUpUSD = (value) => Math.ceil((Number(value) || 0) * 100) / 100;

const netFromGross = (gross, totalRate) => gross / (1 + totalRate);
const grossFromNet = (net, totalRate) => net * (1 + totalRate);

const normalizeCountry = (value) => (value || "").toUpperCase().trim();
const INTERNATIONAL_COUNTRIES = new Set(["UNITED STATES", "US", "USA", "UNITED KINGDOM", "UK", "GB"]);
const NIGERIAN_COUNTRIES = new Set(["NIGERIA", "NG", "NIGERIAN"]);
const isInternationalCountry = (country) => INTERNATIONAL_COUNTRIES.has(normalizeCountry(country));
const isNigerianCountry = (country) => NIGERIAN_COUNTRIES.has(normalizeCountry(country));

const normalizeOfferFromChat = (chat, totalRate) => {
  const materialRaw = roundUpNGN(chat?.counterMaterialCost || 0);
  const workmanshipRaw = roundUpNGN(chat?.counterWorkmanshipCost || 0);
  const totalRaw = roundUpNGN(chat?.counterTotalCost || (materialRaw + workmanshipRaw));
  const isGross = chat?.action === "accepted";

  const baseMaterial = isGross ? roundUpNGN(netFromGross(materialRaw, totalRate)) : materialRaw;
  const baseWorkmanship = isGross ? roundUpNGN(netFromGross(workmanshipRaw, totalRate)) : workmanshipRaw;
  const baseTotal = roundUpNGN(baseMaterial + baseWorkmanship);

  const grossMaterial = isGross ? materialRaw : roundUpNGN(grossFromNet(baseMaterial, totalRate));
  const grossWorkmanship = isGross ? workmanshipRaw : roundUpNGN(grossFromNet(baseWorkmanship, totalRate));
  const grossTotal = isGross ? totalRaw : roundUpNGN(grossMaterial + grossWorkmanship);

  return {
    baseMaterial,
    baseWorkmanship,
    baseTotal,
    grossMaterial,
    grossWorkmanship,
    grossTotal,
  };
};

const getInitialBuyerOfferBase = (offer, totalRate) => {
  const initialBuyerChat = Array.isArray(offer?.chats)
    ? offer.chats.find((chat) => chat.senderType === "customer")
    : null;

  if (!initialBuyerChat) return 0;
  return Number(normalizeOfferFromChat(initialBuyerChat, totalRate).baseTotal || 0);
};

const calculateNegotiatedPayoutBase = ({ quotationBase, buyerMarkdown }) => {
  const safeQuotationBase = Math.max(0, Number(quotationBase) || 0);
  const safeBuyerMarkdown = Math.max(0, Number(buyerMarkdown) || 0);

  return Math.max(0, safeQuotationBase - safeBuyerMarkdown);
};

const transformOfferForViewer = (offer, viewerType, totalRate) => {
  if (!offer || !offer.chats || !Array.isArray(offer.chats)) {
    return offer;
  }

  const exchangeRate = offer.exchangeRate || 0;
  const isInternational = offer.isInternationalVendor;

  const toUSD = (ngnValue) =>
    isInternational && exchangeRate > 0 ? roundUpUSD(ngnValue / exchangeRate) : 0;
  const toGrossNGN = (netValue) => roundUpNGN(grossFromNet(netValue, totalRate));

  const chats = offer.chats.map((chat) => {
    const updated = { ...chat };
    if (chat.action === "accepted") {
      return updated;
    }

    const isSenderBuyer = chat.senderType === "customer";
    const isViewerBuyer = viewerType === "buyer";

    const shouldShowGross =
      (isViewerBuyer && !isSenderBuyer) || (!isViewerBuyer && isSenderBuyer);

    if (shouldShowGross) {
      const grossMaterial = toGrossNGN(chat.counterMaterialCost || 0);
      const grossWorkmanship = toGrossNGN(chat.counterWorkmanshipCost || 0);
      const grossTotal = roundUpNGN(grossMaterial + grossWorkmanship);

      updated.counterMaterialCost = grossMaterial;
      updated.counterWorkmanshipCost = grossWorkmanship;
      updated.counterTotalCost = grossTotal;
      updated.counterMaterialCostUSD = toUSD(grossMaterial);
      updated.counterWorkmanshipCostUSD = toUSD(grossWorkmanship);
      updated.counterTotalCostUSD = toUSD(grossTotal);
    } else {
      const netMaterial = roundUpNGN(chat.counterMaterialCost || 0);
      const netWorkmanship = roundUpNGN(chat.counterWorkmanshipCost || 0);
      const netTotal = roundUpNGN(netMaterial + netWorkmanship);

      updated.counterMaterialCost = netMaterial;
      updated.counterWorkmanshipCost = netWorkmanship;
      updated.counterTotalCost = netTotal;
      updated.counterMaterialCostUSD = toUSD(netMaterial);
      updated.counterWorkmanshipCostUSD = toUSD(netWorkmanship);
      updated.counterTotalCostUSD = toUSD(netTotal);
    }

    return updated;
  });

  return { ...offer, chats };
};

const buildPayoutBreakdown = (review, agreedBase) => {
  if (!review) return null;
  const quotationBase = Number(review.quotationTotalCost ?? review.subTotalCost ?? 0);
  const safeAgreedBase = Number(agreedBase ?? review.finalTotalCost ?? review.subTotalCost ?? 0);
  const buyerMarkdown = Number(
    review.buyerMarkdownAmount ?? Math.max(0, safeAgreedBase - Number(review.payoutBaseAmount ?? safeAgreedBase))
  );
  const payoutBaseUsed = Number(
    review.payoutBaseAmount ??
      Math.max(0, quotationBase - buyerMarkdown)
  );
  const commissionDeducted = Number(review.payoutCommissionAmount ?? 0);
  const designerNetCredit = Number(review.payoutNetAmount ?? Math.max(0, payoutBaseUsed - commissionDeducted));

  return {
    quotationBase,
    agreedBase: safeAgreedBase,
    buyerMarkdown,
    payoutBaseUsed,
    commissionDeducted,
    designerNetCredit,
  };
};



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

    const displayRate = 0; // show exact offer values (no added commission in chat)
    const totalRate = displayRate;

    const netMaterialCost = roundUpNGN(materialCost);
    const netWorkmanshipCost = roundUpNGN(workmanshipCost);
    const netTotalCost = roundUpNGN(netMaterialCost + netWorkmanshipCost);

    const { vendorId, materialId } = review;
    if (!vendorId || !materialId) {
      return res.status(400).json({
        success: false,
        message: "Missing vendor or material information in the associated review.",
      });
    }

    // 🆕 Calculate USD amounts
    const materialCostUSD = isInternationalVendor && exchangeRate > 0 
      ? roundUpUSD(netMaterialCost / exchangeRate) 
      : 0;
    const workmanshipCostUSD = isInternationalVendor && exchangeRate > 0 
      ? roundUpUSD(netWorkmanshipCost / exchangeRate) 
      : 0;
    const totalCostUSD = isInternationalVendor && exchangeRate > 0 
      ? roundUpUSD(netTotalCost / exchangeRate) 
      : 0;

    const existingOffer = await MakeOffer.findOne({
      userId: user._id,
      vendorId,
      materialId,
      reviewId: review._id,
    });

    if (existingOffer) {
      return res.status(400).json({
        success: false,
        message: "You have already made an offer for this material.",
      });
    }

    // 🆕 Create new offer with USD amounts in chat
    const offer = await MakeOffer.create({
      userId: user._id,
      vendorId,
      materialId,
      reviewId: review._id,
      materialTotalCost: netMaterialCost,
      workmanshipTotalCost: netWorkmanshipCost,
      totalCost: netTotalCost,
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
          counterMaterialCost: netMaterialCost,
          counterWorkmanshipCost: netWorkmanshipCost,
          counterTotalCost: netTotalCost,
          // 🆕 Add USD amounts
          counterMaterialCostUSD: materialCostUSD,
          counterWorkmanshipCostUSD: workmanshipCostUSD,
          counterTotalCostUSD: totalCostUSD,
          comment: comment || "Sent a new offer",
          timestamp: new Date(),
        },
      ],
    });

    if (!offer) {
      return res.status(500).json({
        success: false,
        message: "Error creating or updating offer",
      });
    }

    const offerData = offer?.toObject ? offer.toObject() : offer;
    const viewOffer = transformOfferForViewer(offerData, "buyer", totalRate);

    return res.status(201).json({
      success: true,
      message: offer.isNew
        ? "Offer created successfully"
        : "Offer updated successfully",
      data: viewOffer,
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

    const displayRate = 0; // show exact offer values (no added commission in chat)
    const totalRate = displayRate;

    let baseMaterialCost, baseWorkmanshipCost, baseTotalCost;
    let baseMaterialCostUSD = 0;
    let baseWorkmanshipCostUSD = 0;
    let baseTotalCostUSD = 0;
    let usedInputForBase = false;

    const exchangeRate = offer.exchangeRate || 0;
    const isInternational = offer.isInternationalVendor;
    const buyerCountry = offer.buyerCountry || "";
    const vendorCountry = offer.vendorCountry || "";
    const shouldConvertUsdToNgn =
      isInternationalCountry(vendorCountry) && isNigerianCountry(buyerCountry);

    const inputMaterial = Number(counterMaterialCost) || 0;
    const inputWorkmanship = Number(counterWorkmanshipCost) || 0;

    if (shouldConvertUsdToNgn && exchangeRate <= 0) {
      return res.status(400).json({
        success: false,
        message: "Exchange rate not available for this international offer.",
      });
    }

    if (action === "accepted") {
      const latestCustomerOffer = [...offer.chats]
        .reverse()
        .find(chat => chat.senderType === "customer");

      if (latestCustomerOffer) {
        const normalized = normalizeOfferFromChat(latestCustomerOffer, totalRate);
        baseMaterialCost = normalized.baseMaterial;
        baseWorkmanshipCost = normalized.baseWorkmanship;
        baseTotalCost = normalized.baseTotal;
      } else {
        usedInputForBase = true;
        baseMaterialCost = shouldConvertUsdToNgn
          ? roundUpNGN(inputMaterial * exchangeRate)
          : roundUpNGN(inputMaterial);
        baseWorkmanshipCost = shouldConvertUsdToNgn
          ? roundUpNGN(inputWorkmanship * exchangeRate)
          : roundUpNGN(inputWorkmanship);
        baseTotalCost = roundUpNGN(baseMaterialCost + baseWorkmanshipCost);
      }
    } else {
      usedInputForBase = true;
      baseMaterialCost = shouldConvertUsdToNgn
        ? roundUpNGN(inputMaterial * exchangeRate)
        : roundUpNGN(inputMaterial);
      baseWorkmanshipCost = shouldConvertUsdToNgn
        ? roundUpNGN(inputWorkmanship * exchangeRate)
        : roundUpNGN(inputWorkmanship);
      baseTotalCost = roundUpNGN(baseMaterialCost + baseWorkmanshipCost);
    }

    if (shouldConvertUsdToNgn && usedInputForBase) {
      baseMaterialCostUSD = roundUpUSD(inputMaterial);
      baseWorkmanshipCostUSD = roundUpUSD(inputWorkmanship);
      baseTotalCostUSD = roundUpUSD(inputMaterial + inputWorkmanship);
    } else {
      baseMaterialCostUSD = isInternational && exchangeRate > 0
        ? roundUpUSD(baseMaterialCost / exchangeRate)
        : 0;
      baseWorkmanshipCostUSD = isInternational && exchangeRate > 0
        ? roundUpUSD(baseWorkmanshipCost / exchangeRate)
        : 0;
      baseTotalCostUSD = isInternational && exchangeRate > 0
        ? roundUpUSD(baseTotalCost / exchangeRate)
        : 0;
    }

    let acceptedGrossMaterial = 0;
    let acceptedGrossWorkmanship = 0;
    let acceptedGrossTotal = 0;
    let acceptedGrossMaterialUSD = 0;
    let acceptedGrossWorkmanshipUSD = 0;
    let acceptedGrossTotalUSD = 0;

    const newChat = {
      senderType: "vendor",
      action,
      counterMaterialCost: baseMaterialCost,
      counterWorkmanshipCost: baseWorkmanshipCost,
      counterTotalCost: baseTotalCost,
      counterMaterialCostUSD: baseMaterialCostUSD,
      counterWorkmanshipCostUSD: baseWorkmanshipCostUSD,
      counterTotalCostUSD: baseTotalCostUSD,
      comment: comment || "",
      timestamp: new Date(),
    };

    if (action === "accepted") {
      const latestCustomerOffer = [...offer.chats]
        .reverse()
        .find(chat => chat.senderType === "customer");
      const normalized = latestCustomerOffer
        ? normalizeOfferFromChat(latestCustomerOffer, totalRate)
        : { grossMaterial: roundUpNGN(grossFromNet(baseMaterialCost, totalRate)), grossWorkmanship: roundUpNGN(grossFromNet(baseWorkmanshipCost, totalRate)), grossTotal: roundUpNGN(grossFromNet(baseMaterialCost, totalRate) + grossFromNet(baseWorkmanshipCost, totalRate)) };

      acceptedGrossMaterial = normalized.grossMaterial;
      acceptedGrossWorkmanship = normalized.grossWorkmanship;
      acceptedGrossTotal = normalized.grossTotal;
      acceptedGrossMaterialUSD = isInternational && exchangeRate > 0
        ? roundUpUSD(acceptedGrossMaterial / exchangeRate)
        : 0;
      acceptedGrossWorkmanshipUSD = isInternational && exchangeRate > 0
        ? roundUpUSD(acceptedGrossWorkmanship / exchangeRate)
        : 0;
      acceptedGrossTotalUSD = isInternational && exchangeRate > 0
        ? roundUpUSD(acceptedGrossTotal / exchangeRate)
        : 0;

      newChat.counterMaterialCost = acceptedGrossMaterial;
      newChat.counterWorkmanshipCost = acceptedGrossWorkmanship;
      newChat.counterTotalCost = acceptedGrossTotal;
      newChat.counterMaterialCostUSD = acceptedGrossMaterialUSD;
      newChat.counterWorkmanshipCostUSD = acceptedGrossWorkmanshipUSD;
      newChat.counterTotalCostUSD = acceptedGrossTotalUSD;
    }

    offer.chats.push(newChat);

    if (action === "accepted") {
      offer.vendorConsent = true;
      offer.status = "accepted";

      offer.finalMaterialCost = baseMaterialCost;
      offer.finalWorkmanshipCost = baseWorkmanshipCost;
      offer.finalTotalCost = baseTotalCost;

      if (offer.isInternationalVendor && offer.exchangeRate) {
        offer.finalMaterialCostUSD = baseMaterialCostUSD;
        offer.finalWorkmanshipCostUSD = baseWorkmanshipCostUSD;
        offer.finalTotalCostUSD = baseTotalCostUSD;
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

    let payoutBreakdown = null;
    // 🔥 UPDATE REVIEW WHEN MUTUAL CONSENT IS ACHIEVED
    if (offer.mutualConsentAchieved && offer.reviewId) {
      console.log(`\n💰 MUTUAL CONSENT ACHIEVED - Updating Review ${offer.reviewId}`);
      console.log(`   Negotiated Amount (NGN): ₦${baseTotalCost}`);
      
      const review = await Review.findById(offer.reviewId);
      
      if (review) {
        const { quotationTaxPercent, vatRate, vatPercent } = await getPricingRates();
        // At mutual consent, apply only VAT on agreed base amount
        const subTotalCost = baseMaterialCost + baseWorkmanshipCost;
        const vat = vatRate * subTotalCost;
        const tax = 0;
        const commission = vat;
        const visibleQuoteAmount = Number(review.totalCost ?? review.amountToPay ?? 0);
        const initialBuyerOfferBase = getInitialBuyerOfferBase(offer, totalRate);
        const buyerMarkdown = Math.max(0, visibleQuoteAmount - initialBuyerOfferBase);
        const payoutBaseAmount = calculateNegotiatedPayoutBase({
          quotationBase: Number(review.quotationTotalCost ?? review.subTotalCost ?? 0),
          buyerMarkdown,
        });
        const payoutCommissionAmount = vatRate * payoutBaseAmount;
        const payoutNetAmount = Math.max(0, payoutBaseAmount - payoutCommissionAmount);
        
        const computedTotalCost = subTotalCost + tax + commission;
        const newTotalCost = computedTotalCost;

        let updateData = {
          // Update the main costs with negotiated amounts + tax/commission
          materialTotalCost: baseMaterialCost,
          workmanshipTotalCost: baseWorkmanshipCost,
          subTotalCost: subTotalCost,
          tax: tax,
          commission: commission,
          totalCost: newTotalCost,
          amountToPay: newTotalCost,
          hasAcceptedOffer: true,
          acceptedOfferId: offer._id,
          
          // 🔥 STORE THE FINAL NEGOTIATED AMOUNTS (vendor base, before commission)
          finalMaterialCost: baseMaterialCost,
          finalWorkmanshipCost: baseWorkmanshipCost,
          finalTotalCost: baseTotalCost,
          buyerMarkdownAmount: buyerMarkdown,
          payoutBaseAmount: payoutBaseAmount,
          payoutCommissionAmount: payoutCommissionAmount,
          payoutNetAmount: payoutNetAmount,
          // Expose both vendor base and user payable totals for the frontend
          vendorBaseTotal: baseTotalCost,
          userPayableTotal: newTotalCost,
        };

        console.log(`   Material Cost: ₦${baseMaterialCost}`);
        console.log(`   Workmanship Cost: ₦${baseWorkmanshipCost}`);
        console.log(`   Subtotal (negotiated): ₦${subTotalCost}`);
        console.log(`   Quotation Tax (${quotationTaxPercent}%): already applied at quote stage`);
        console.log(`   VAT on Agreement (${vatPercent}%): ₦${vat.toFixed(2)}`);
        console.log(`   Final Payable = Base + VAT ${vatPercent}%`);
        console.log(`   Buyer Markdown from Quote: ₦${buyerMarkdown.toFixed(2)}`);
        console.log(`   Payout Base = Designer Quote - Buyer Markdown: ₦${payoutBaseAmount.toFixed(2)}`);
        console.log(`   Payout Commission (${vatPercent}%): ₦${payoutCommissionAmount.toFixed(2)}`);
        console.log(`   Payout Net to Designer: ₦${payoutNetAmount.toFixed(2)}`);
        console.log(`   User Payable (NGN): ₦${newTotalCost.toFixed(2)}`);

        // If international vendor, calculate USD amounts
        if (offer.isInternationalVendor && exchangeRate > 0) {
          const subTotalCostUSD = Math.round(subTotalCost / exchangeRate * 100) / 100;
          const taxUSD = 0;
          const commissionUSD = Math.round(commission / exchangeRate * 100) / 100;
          const totalCostUSD = Math.round(newTotalCost / exchangeRate * 100) / 100;
          const payoutBaseAmountUSD = Math.round(payoutBaseAmount / exchangeRate * 100) / 100;
          const payoutCommissionAmountUSD = Math.round(payoutCommissionAmount / exchangeRate * 100) / 100;
          const payoutNetAmountUSD = Math.round(payoutNetAmount / exchangeRate * 100) / 100;
          const buyerMarkdownUSD = Math.round(buyerMarkdown / exchangeRate * 100) / 100;

          updateData.materialTotalCostUSD = baseMaterialCostUSD;
          updateData.workmanshipTotalCostUSD = baseWorkmanshipCostUSD;
          updateData.subTotalCostUSD = subTotalCostUSD;
          // Keep vendor USD at agreed base amount (user payable includes configured VAT in NGN)
          updateData.totalCostUSD = baseTotalCostUSD;
          updateData.amountToPayUSD = baseTotalCostUSD;
          
          // 🔥 STORE USD FINAL AMOUNTS (vendor base, before commission)
          updateData.finalMaterialCostUSD = baseMaterialCostUSD;
          updateData.finalWorkmanshipCostUSD = baseWorkmanshipCostUSD;
          updateData.finalTotalCostUSD = baseTotalCostUSD;
          updateData.buyerMarkdownAmountUSD = buyerMarkdownUSD;
          updateData.vendorBaseTotalUSD = baseTotalCostUSD;
          updateData.userPayableTotalUSD = totalCostUSD;
          updateData.payoutBaseAmountUSD = payoutBaseAmountUSD;
          updateData.payoutCommissionAmountUSD = payoutCommissionAmountUSD;
          updateData.payoutNetAmountUSD = payoutNetAmountUSD;

          console.log(`   Negotiated Amount (USD): $${subTotalCostUSD}`);
          console.log(`   Vendor Base (USD): $${baseTotalCostUSD}`);
          console.log(`   Exchange Rate: 1 USD = ₦${exchangeRate}`);
        }

        const updatedReview = await Review.findByIdAndUpdate(
          offer.reviewId,
          { $set: updateData },
          { new: true }
        );
        payoutBreakdown = buildPayoutBreakdown(updatedReview, baseTotalCost);

        console.log(`✅ Review updated successfully with negotiated amounts`);
      }
    }

    const offerData = offer?.toObject ? offer.toObject() : offer;
    const viewOffer = transformOfferForViewer(offerData, "vendor", totalRate);

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
      data: viewOffer,
      mutualConsentAchieved: offer.mutualConsentAchieved,
      buyerConsent: offer.buyerConsent,
      vendorConsent: offer.vendorConsent,
      payoutBreakdown,
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

    const displayRate = 0; // show exact offer values (no added commission in chat)
    const totalRate = displayRate;

    let baseMaterialCost, baseWorkmanshipCost, baseTotalCost;

    if (action === "accepted") {
      const latestVendorOffer = [...offer.chats]
        .reverse()
        .find(chat => chat.senderType === "vendor");

      if (latestVendorOffer) {
        const normalized = normalizeOfferFromChat(latestVendorOffer, totalRate);
        baseMaterialCost = normalized.baseMaterial;
        baseWorkmanshipCost = normalized.baseWorkmanship;
        baseTotalCost = normalized.baseTotal;
      } else {
        const originalOffer = offer.chats.find(chat => chat.senderType === "customer");
        if (originalOffer) {
          const normalized = normalizeOfferFromChat(originalOffer, totalRate);
          baseMaterialCost = normalized.baseMaterial;
          baseWorkmanshipCost = normalized.baseWorkmanship;
          baseTotalCost = normalized.baseTotal;
        } else {
          baseMaterialCost = roundUpNGN(Number(counterMaterialCost) || 0);
          baseWorkmanshipCost = roundUpNGN(Number(counterWorkmanshipCost) || 0);
          baseTotalCost = roundUpNGN(baseMaterialCost + baseWorkmanshipCost);
        }
      }
    } else {
      baseMaterialCost = roundUpNGN(Number(counterMaterialCost) || 0);
      baseWorkmanshipCost = roundUpNGN(Number(counterWorkmanshipCost) || 0);
      baseTotalCost = roundUpNGN(baseMaterialCost + baseWorkmanshipCost);
    }

    const exchangeRate = offer.exchangeRate || 0;
    const isInternational = offer.isInternationalVendor;

    const baseMaterialCostUSD = isInternational && exchangeRate > 0 
      ? roundUpUSD(baseMaterialCost / exchangeRate) 
      : 0;
    const baseWorkmanshipCostUSD = isInternational && exchangeRate > 0 
      ? roundUpUSD(baseWorkmanshipCost / exchangeRate) 
      : 0;
    const baseTotalCostUSD = isInternational && exchangeRate > 0 
      ? roundUpUSD(baseTotalCost / exchangeRate) 
      : 0;

    let acceptedGrossMaterial = 0;
    let acceptedGrossWorkmanship = 0;
    let acceptedGrossTotal = 0;
    let acceptedGrossMaterialUSD = 0;
    let acceptedGrossWorkmanshipUSD = 0;
    let acceptedGrossTotalUSD = 0;

    const newChat = {
      senderType: "customer",
      action,
      counterMaterialCost: baseMaterialCost,
      counterWorkmanshipCost: baseWorkmanshipCost,
      counterTotalCost: baseTotalCost,
      counterMaterialCostUSD: baseMaterialCostUSD,
      counterWorkmanshipCostUSD: baseWorkmanshipCostUSD,
      counterTotalCostUSD: baseTotalCostUSD,
      comment: comment || "",
      timestamp: new Date(),
    };

    if (action === "accepted") {
      const latestVendorOffer = [...offer.chats]
        .reverse()
        .find(chat => chat.senderType === "vendor");
      const normalized = latestVendorOffer
        ? normalizeOfferFromChat(latestVendorOffer, totalRate)
        : { grossMaterial: roundUpNGN(grossFromNet(baseMaterialCost, totalRate)), grossWorkmanship: roundUpNGN(grossFromNet(baseWorkmanshipCost, totalRate)), grossTotal: roundUpNGN(grossFromNet(baseMaterialCost, totalRate) + grossFromNet(baseWorkmanshipCost, totalRate)) };

      acceptedGrossMaterial = normalized.grossMaterial;
      acceptedGrossWorkmanship = normalized.grossWorkmanship;
      acceptedGrossTotal = normalized.grossTotal;
      acceptedGrossMaterialUSD = isInternational && exchangeRate > 0
        ? roundUpUSD(acceptedGrossMaterial / exchangeRate)
        : 0;
      acceptedGrossWorkmanshipUSD = isInternational && exchangeRate > 0
        ? roundUpUSD(acceptedGrossWorkmanship / exchangeRate)
        : 0;
      acceptedGrossTotalUSD = isInternational && exchangeRate > 0
        ? roundUpUSD(acceptedGrossTotal / exchangeRate)
        : 0;

      newChat.counterMaterialCost = acceptedGrossMaterial;
      newChat.counterWorkmanshipCost = acceptedGrossWorkmanship;
      newChat.counterTotalCost = acceptedGrossTotal;
      newChat.counterMaterialCostUSD = acceptedGrossMaterialUSD;
      newChat.counterWorkmanshipCostUSD = acceptedGrossWorkmanshipUSD;
      newChat.counterTotalCostUSD = acceptedGrossTotalUSD;
    }

    offer.chats.push(newChat);

    if (action === "accepted") {
      offer.buyerConsent = true;
      offer.status = "accepted";

      offer.finalMaterialCost = baseMaterialCost;
      offer.finalWorkmanshipCost = baseWorkmanshipCost;
      offer.finalTotalCost = baseTotalCost;

      if (offer.isInternationalVendor && offer.exchangeRate) {
        offer.finalMaterialCostUSD = baseMaterialCostUSD;
        offer.finalWorkmanshipCostUSD = baseWorkmanshipCostUSD;
        offer.finalTotalCostUSD = baseTotalCostUSD;
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

    let payoutBreakdown = null;
    // 🔥 UPDATE REVIEW WHEN MUTUAL CONSENT IS ACHIEVED
    if (offer.mutualConsentAchieved && offer.reviewId) {
      console.log(`\n💰 MUTUAL CONSENT ACHIEVED - Updating Review ${offer.reviewId}`);
      console.log(`   Negotiated Amount (NGN): ₦${baseTotalCost}`);
      
      const review = await Review.findById(offer.reviewId);
      
      if (review) {
        const { quotationTaxPercent, vatRate, vatPercent } = await getPricingRates();
        // At mutual consent, apply only VAT on agreed base amount
        const subTotalCost = baseMaterialCost + baseWorkmanshipCost;
        const vat = vatRate * subTotalCost;
        const tax = 0;
        const commission = vat;
        const visibleQuoteAmount = Number(review.totalCost ?? review.amountToPay ?? 0);
        const initialBuyerOfferBase = getInitialBuyerOfferBase(offer, totalRate);
        const buyerMarkdown = Math.max(0, visibleQuoteAmount - initialBuyerOfferBase);
        const payoutBaseAmount = calculateNegotiatedPayoutBase({
          quotationBase: Number(review.quotationTotalCost ?? review.subTotalCost ?? 0),
          buyerMarkdown,
        });
        const payoutCommissionAmount = vatRate * payoutBaseAmount;
        const payoutNetAmount = Math.max(0, payoutBaseAmount - payoutCommissionAmount);
        
        const computedTotalCost = subTotalCost + tax + commission;
        const newTotalCost = computedTotalCost;

        let updateData = {
          // Update the main costs with negotiated amounts + tax/commission
          materialTotalCost: baseMaterialCost,
          workmanshipTotalCost: baseWorkmanshipCost,
          subTotalCost: subTotalCost,
          tax: tax,
          commission: commission,
          totalCost: newTotalCost,
          amountToPay: newTotalCost,
          hasAcceptedOffer: true,
          acceptedOfferId: offer._id,
          
          // 🔥 STORE THE FINAL NEGOTIATED AMOUNTS (vendor base, before commission)
          finalMaterialCost: baseMaterialCost,
          finalWorkmanshipCost: baseWorkmanshipCost,
          finalTotalCost: baseTotalCost,
          buyerMarkdownAmount: buyerMarkdown,
          payoutBaseAmount: payoutBaseAmount,
          payoutCommissionAmount: payoutCommissionAmount,
          payoutNetAmount: payoutNetAmount,
          // Expose both vendor base and user payable totals for the frontend
          vendorBaseTotal: baseTotalCost,
          userPayableTotal: newTotalCost,
        };

        console.log(`   Material Cost: ₦${baseMaterialCost}`);
        console.log(`   Workmanship Cost: ₦${baseWorkmanshipCost}`);
        console.log(`   Subtotal (negotiated): ₦${subTotalCost}`);
        console.log(`   Quotation Tax (${quotationTaxPercent}%): already applied at quote stage`);
        console.log(`   VAT on Agreement (${vatPercent}%): ₦${vat.toFixed(2)}`);
        console.log(`   Final Payable = Base + VAT ${vatPercent}%`);
        console.log(`   Buyer Markdown from Quote: ₦${buyerMarkdown.toFixed(2)}`);
        console.log(`   Payout Base = Designer Quote - Buyer Markdown: ₦${payoutBaseAmount.toFixed(2)}`);
        console.log(`   Payout Commission (${vatPercent}%): ₦${payoutCommissionAmount.toFixed(2)}`);
        console.log(`   Payout Net to Designer: ₦${payoutNetAmount.toFixed(2)}`);
        console.log(`   User Payable (NGN): ₦${newTotalCost.toFixed(2)}`);

        // If international vendor, calculate USD amounts
        if (offer.isInternationalVendor && exchangeRate > 0) {
          const subTotalCostUSD = Math.round(subTotalCost / exchangeRate * 100) / 100;
          const taxUSD = 0;
          const commissionUSD = Math.round(commission / exchangeRate * 100) / 100;
          const totalCostUSD = Math.round(newTotalCost / exchangeRate * 100) / 100;
          const payoutBaseAmountUSD = Math.round(payoutBaseAmount / exchangeRate * 100) / 100;
          const payoutCommissionAmountUSD = Math.round(payoutCommissionAmount / exchangeRate * 100) / 100;
          const payoutNetAmountUSD = Math.round(payoutNetAmount / exchangeRate * 100) / 100;
          const buyerMarkdownUSD = Math.round(buyerMarkdown / exchangeRate * 100) / 100;

          updateData.materialTotalCostUSD = baseMaterialCostUSD;
          updateData.workmanshipTotalCostUSD = baseWorkmanshipCostUSD;
          updateData.subTotalCostUSD = subTotalCostUSD;
          // Keep vendor USD at agreed base amount (user payable includes configured VAT in NGN)
          updateData.totalCostUSD = baseTotalCostUSD;
          updateData.amountToPayUSD = baseTotalCostUSD;
          
          // 🔥 STORE USD FINAL AMOUNTS (vendor base, before commission)
          updateData.finalMaterialCostUSD = baseMaterialCostUSD;
          updateData.finalWorkmanshipCostUSD = baseWorkmanshipCostUSD;
          updateData.finalTotalCostUSD = baseTotalCostUSD;
          updateData.buyerMarkdownAmountUSD = buyerMarkdownUSD;
          updateData.vendorBaseTotalUSD = baseTotalCostUSD;
          updateData.userPayableTotalUSD = totalCostUSD;
          updateData.payoutBaseAmountUSD = payoutBaseAmountUSD;
          updateData.payoutCommissionAmountUSD = payoutCommissionAmountUSD;
          updateData.payoutNetAmountUSD = payoutNetAmountUSD;

          console.log(`   Negotiated Amount (USD): $${subTotalCostUSD}`);
          console.log(`   Vendor Base (USD): $${baseTotalCostUSD}`);
          console.log(`   Exchange Rate: 1 USD = ₦${exchangeRate}`);
        }

        const updatedReview = await Review.findByIdAndUpdate(
          offer.reviewId,
          { $set: updateData },
          { new: true }
        );
        payoutBreakdown = buildPayoutBreakdown(updatedReview, baseTotalCost);

        console.log(`✅ Review updated successfully with negotiated amounts`);
      }
    }

    const offerData = offer?.toObject ? offer.toObject() : offer;
    const viewOffer = transformOfferForViewer(offerData, "buyer", totalRate);

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
      data: viewOffer,
      mutualConsentAchieved: offer.mutualConsentAchieved,
      buyerConsent: offer.buyerConsent,
      vendorConsent: offer.vendorConsent,
      payoutBreakdown,
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

    const displayRate = 0; // show exact offer values (no added commission in chat)
    const totalRate = displayRate;

    // 🧩 Include chat summary (optional)
    const offersWithChatSummary = makeOffers.map((offer) => {
      const viewerType =
        String(offer.userId?._id) === String(user._id)
          ? "buyer"
          : vendor && String(offer.vendorId?._id) === String(vendor._id)
          ? "vendor"
          : null;

      const viewOffer = viewerType
        ? transformOfferForViewer(offer, viewerType, totalRate)
        : offer;

      const chats = viewOffer.chats || [];
      const latestChat = chats.length > 0 ? chats[chats.length - 1] : null;

      return {
        ...viewOffer,
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

    const displayRate = 0; // show exact offer values (no added commission in chat)
    const totalRate = displayRate;

    const viewerType =
      String(offer.userId?._id) === String(user._id)
        ? "buyer"
        : vendor && String(offer.vendorId?._id) === String(vendor._id)
        ? "vendor"
        : null;

    const viewOffer = viewerType
      ? transformOfferForViewer(offer, viewerType, totalRate)
      : offer;

    // 🧩 Optional chat summary
    const latestChat =
      viewOffer.chats && viewOffer.chats.length > 0
        ? viewOffer.chats[viewOffer.chats.length - 1]
        : null;

    return res.status(200).json({
      success: true,
      message: "Offer retrieved successfully",
      data: {
        ...viewOffer,
        chatSummary: {
          totalMessages: viewOffer.chats?.length || 0,
          latestMessage: latestChat,
        },
      },
    });
  } catch (error) {
    next(error);
  }
};
