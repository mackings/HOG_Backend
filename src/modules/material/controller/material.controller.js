import User from '../../user/model/user.model.js';
import Material from '../../material/model/material.model';


export const createMaterial = async (req, res, next) => {
    try {
        const { id } = req.user;
        const { attireType, clothMaterial, color, brand, measurement, price } = req.body;

        if (!attireType || !clothMaterial || !color || !brand || !measurement ) {
            return res.status(400).json({
                message: "Attire type, cloth material, color, brand, measurement  are required"
            });
        }

        if (!req.file || !req.imageUrl) {
            return res.status(400).json({ message: "Sample image is required" });
        }

        const material = await Material.create({
            userId: id,
            attireType,
            clothMaterial,
            color,
            brand,
            measurement,
            price,
            sampleImage: req.imageUrl
        });

        if (!material) {
            return res.status(400).json({ message: "Material not created" });
        }

        return res.status(201).json({
            message: "Material created successfully",
            data: material
        });

    } catch (error) {
        next(error);
    }
};


export const getAllMaterials = async (req, res, next )=> {
    try {
        const { id } = req.user;
        const materials = await Material.find({ userId: id });
        if (materials.length === 0 || !materials ) {
            return res.status(404).json({ message: "Materials not found" });
        }
        return res.status(200).json({
            message: "Materials fetched successfully",
            data: materials
        });
    } catch (error) {
        next(error);
    }
};


export const getMaterialById = async (req, res, next) => {
    try {
        const { id } = req.query;
        const material = await Material.findById(id);
        if (!material) {
            return res.status(404).json({ message: "Material not found" });
        }
        return res.status(200).json({
            message: "Material fetched successfully",
            data: material
        });
    } catch (error) {
        next(error);
    }
};


export const updateMaterial = async (req, res, next) => {
    try {
        const { id }=req.user;
        const { materialId } = req.params;
        const { attireType, clothMaterial, color, brand, measurement, price } = req.body;

        if (!attireType || !clothMaterial || !color || !brand || !measurement ) {
            return res.status(400).json({
                message: "Attire type, cloth material, color, brand, measurement  are required"
            });
        }

        if (!req.file || !req.imageUrl) {
            return res.status(400).json({ message: "Sample image is required" });
        }

        const updateMaterial = await Material.findByIdAndUpdate(
            materialId,
            {
                attireType,
                clothMaterial,
                color,
                brand,
                measurement,
                price,
                sampleImage: req.imageUrl
            },
            { new: true }
        );

        if(!updateMaterial){
            return res.status(404).json({message: "Material not found"});
        }

        return res.status(200).json({
            message: "Material updated successfully",
            data: updateMaterial
        });
    } catch (error) {
        next(error);
    }
};


export const deleteMaterial = async (req, res, next) => {
  try {
    const { id } = req.user;
    const { materialId } = req.query;
    const material = await Material.findByIdAndDelete(materialId);

    if (!material) {
      return res.status(404).json({
        success: false,
        message: "Material not found",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Material deleted successfully",
      data: material,
    });
  } catch (error) {
    next(error);
  }
};








