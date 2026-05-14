import Moodboard from "../model/moodboard.model.js";

export const createMoodboard = async (req, res, next) => {
  try {
    const { id } = req.user;
    const { name, description, visibility } = req.body;

    if (!name) return res.status(400).json({ success: false, message: "name is required" });

    const moodboard = await Moodboard.create({ userId: id, name, description, visibility });
    return res.status(201).json({ success: true, message: "Moodboard created successfully", data: moodboard });
  } catch (error) {
    next(error);
  }
};

export const addMoodboardItem = async (req, res, next) => {
  try {
    const { id } = req.user;
    const { moodboardId } = req.params;
    const { itemType, itemId, imageUrl, note, inspiredBy } = req.body;

    const moodboard = await Moodboard.findOne({ _id: moodboardId, userId: id });
    if (!moodboard) return res.status(404).json({ success: false, message: "Moodboard not found" });
    if (!itemType) return res.status(400).json({ success: false, message: "itemType is required" });

    moodboard.items.push({ itemType, itemId, imageUrl, note, inspiredBy });
    await moodboard.save();

    return res.status(200).json({ success: true, message: "Moodboard item added successfully", data: moodboard });
  } catch (error) {
    next(error);
  }
};

export const getMoodboards = async (req, res, next) => {
  try {
    const { id } = req.user;
    const moodboards = await Moodboard.find({ userId: id }).sort({ updatedAt: -1 }).lean();
    return res.status(200).json({ success: true, message: "Moodboards fetched successfully", data: moodboards });
  } catch (error) {
    next(error);
  }
};

export const removeMoodboardItem = async (req, res, next) => {
  try {
    const { id } = req.user;
    const { moodboardId, itemId } = req.params;

    const moodboard = await Moodboard.findOneAndUpdate(
      { _id: moodboardId, userId: id },
      { $pull: { items: { _id: itemId } } },
      { new: true }
    );
    if (!moodboard) return res.status(404).json({ success: false, message: "Moodboard not found" });

    return res.status(200).json({ success: true, message: "Moodboard item removed successfully", data: moodboard });
  } catch (error) {
    next(error);
  }
};

