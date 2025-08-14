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

    // Validate required fields
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

    const missingField = Object.entries(requiredFields)
      .find(([_, value]) => !value)?.[0];

    if (missingField) {
      return res.status(400).json({ message: `${missingField} is required` });
    }

    // Check if vendor already exists
    const existingTailor = await Vendor.findOne({ userId: id });
    if (existingTailor) {
      return res.status(400).json({ message: 'Tailor (Vendor) already exists' });
    }

    // Validate image upload
    if (!req.imageUrl) {
      return res.status(400).json({ message: "Nepa bill image is required" });
    }

    // Create vendor
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

    const updates = req.body;

    const tailor = await Vendor.findOneAndUpdate(
      { _id: tailorId, userId: id },
      {
        $set: {
          businessName: updates.businessName,
          businessEmail: updates.businessEmail,
          businessPhone: updates.businessPhone,
          address: updates.address,
          city: updates.city,
          state: updates.state,
          yearOfExperience: updates.yearOfExperience,
          description: updates.description
        }
      },
      { new: true, runValidators: true }
    );

    if (!tailor) {
      return res.status(404).json({ message: "Tailor not found or unauthorized" });
    }

    res.status(200).json({
      message: "Tailor updated successfully",
      data: tailor
    });

  } catch (error) {
    next(error);
  }
};

