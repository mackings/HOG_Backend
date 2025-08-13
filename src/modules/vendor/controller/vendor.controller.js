import User from "../../user/model/user.model.js";
import Vendor from "../model/vendor.model.js";


export const createTailor = async (req, res, next) => {
  try {
    const { id } = req.user;
    const {
      businessName,
      businessEmail,
      businessPhone,
      address,
      city,
      state,
      yearOfExperience,
      description
    } = req.body;

    const requiredFields = {
      businessName,
      businessEmail,
      businessPhone,
      address,
      city,
      state,
      yearOfExperience,
      description
    };

    for (const [key, value] of Object.entries(requiredFields)) {
      if (!value) {
        return res.status(400).json({ message: `${key} is required` });
      }
    }

    const existingTailor = await Vendor.findOne({ userId: id });
    if (existingTailor) {
      return res.status(400).json({ message: 'Tailor(Vendor) already exists' });
    }

    const newTailor = await Vendor.create({
      userId: id,
      businessName,
      businessEmail,
      businessPhone,
      address,
      nepaBill: req.imageUrl,
      city,
      state,
      yearOfExperience,
      description
    });

    return res.status(201).json({
      message: 'Tailor created successfully',
      data: newTailor
    });
  } catch (error) {
    console.error(error);
    next(error);
  }
};
   



export const getTailor = async (req, res, next)=>{
    try {
        const {id}= req.user;
        const tailor = await Vendor.findOne({userId: id});
        if (!tailor) {
            return res.status(404).json({ message: 'Tailor not found' });
        }
        return res.status(200).json({ message: 'Tailor found', data: tailor });
    } catch (error) {
        next(error);
    }
}


export const updateTailor = async (req, res, next) => {
  try {
    const { id } = req.user;
    const { tailorId } = req.params;
    const {
      businessName,
      businessEmail,
      BusinessPhone,
      address,
      city,
      state,
      yearOfExperience,
      description
    } = req.body;

    const tailor = await Vendor.findOne({ where: { id: tailorId, userId: id } });
    if (!tailor) {
      return res.status(404).json({ message: "Tailor not found or unauthorized" });
    }

    await tailor.update({
      businessName,
      businessEmail,
      BusinessPhone,
      address,
      city,
      state,
      yearOfExperience,
      description
    });

    return res.status(200).json({
      message: "Tailor updated successfully",
      data: tailor
    });

  } catch (error) {
    next(error);
  }
};
