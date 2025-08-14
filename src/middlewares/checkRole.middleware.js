
import User from "../modules/user/model/user.model";

export const userCheckRole = (allowedRoles = []) => {
  return async (req, res, next) => {
    try {
      const { id } = req.user || {};
      if (!id) {
        return res.status(401).json({ message: "Unauthorized: Missing user ID" });
      }

      const user = await User.findById(id);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      const userRoles = Array.isArray(user.role) ? user.role : [user.role].filter(Boolean);

      const hasRole = allowedRoles.some(role => userRoles.includes(role));

      if (!hasRole) {
        return res.status(403).json({
          message: `You are not authorized as ${user.role || "unknown"} to perform this operation`
        });
      }

      next();
    } catch (error) {
      return res.status(500).json({
        message: "Internal server error",
        error: error.message
      });
    }
  };
};
