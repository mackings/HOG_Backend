import Commission from "../model/commission.model.js"

export const createFee = async (req, res, next) => {
  try {
    const { amount } = req.body;
    if (!amount) {
      return res.status(400).json({ message: "Amount field is required" });
    }

    // Check if a fee already exists (ignoring amount value)
    const existingFee = await Commission.findOne();

    let fee;
    if (existingFee) {
      fee = await Commission.findByIdAndUpdate(
        existingFee._id,
        { amount },
        { new: true }
      );
    } else {
      fee = await Commission.create({ amount });
    }

    return res.status(201).json({
      success: true,
      message: existingFee
        ? "Fee updated successfully"
        : "Fee created successfully",
      data: fee,
    });
  } catch (error) {
    next(error);
  }
};



export const getFee = async( req, res, next )=>{
  try {
    const fees = await Commission.find();
    return res.status(200).json({
      success: true,
      message: "Fees fetched successfully",
      data: fees
    });
  } catch (error) {
    next(error);
  }
}