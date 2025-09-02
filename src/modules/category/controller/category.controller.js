import User from '../../user/model/user.model.js';
import Material from '../../material/model/material.model';
import Vendor from '../../vendor/model/vendor.model.js';
import Category from '../model/category.model.js';


export const createCategory = async (req, res, next) => {
  try {
    const { name, description } = req.body;

    if (!name || !description) {
      return res.status(400).json({ message: "All fields are required" });
    }

    const images = req.imageUrls || [];

    const category = await Category.create({
      name,
      description,
      image: images[0]
    });

    return res.status(201).json({
      success: true,
      message: "Category created successfully",
      data: category
    });
  } catch (error) {
    next(error);
  }
};



export const getAllCategories = async (req, res, next) => {
  try {
    const categories = await Category.find();
    return res.status(200).json({
      success: true,
      message: "Categories fetched successfully",
      data: categories
    });
  } catch (error) {
    next(error);
  }
};



export const getCategoryById = async (req, res, next) => {
    try {
        const { id } = req.query;
        const category = await Category.findById(id);
        if (!category) {
            return res.status(404).json({
                success: false,
                message: "Category not found"
            });
        }
        return res.status(200).json({
            success: true,
            message: "Category fetched successfully",
            data: category
        });
    } catch (error) {
        next(error);
    }
};



export const updateCategory = async (req, res, next) => {
    try {
        const { id } = req.params;
        const { name, description} = req.body;

        const images = req.imageUrls || [];

        const category = await Category.findByIdAndUpdate(id, {
            name,
            description,
            image: images[0]
        }, { new: true });

        if (!category) {
            return res.status(404).json({
                success: false,
                message: "Category not found"
            });
        }

        return res.status(200).json({
            success: true,
            message: "Category updated successfully",
            data: category
        });
    } catch (error) {
        next(error);
    }
};



export const deleteCategory = async (req, res, next) => {
    try {
        const { id } = req.query;
        const category = await Category.findByIdAndDelete(id);
        if (!category) {
            return res.status(404).json({
                success: false,
                message: "Category not found"
            });
        }
        return res.status(200).json({
            success: true,
            message: "Category deleted successfully",
            data: category
        });
    } catch (error) {
        next(error);
    }
};