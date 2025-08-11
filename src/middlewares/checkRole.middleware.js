
import User from "../user/model/user.model";
export const userCheckRole = (allowedRoles) => {
    return async (req, res, next) => {
        try {
            const { id }= req.user;
            const user = await User.findById(id);
            if (!user) {
                return res.status(200).json({ message: "User not found" });
            }

            const userRoles = user.role || [];
            const hasRole = allowedRoles.some(role => userRoles.includes(role));

            if (!hasRole) {
                return res.status(403).json({ message: `You are not authorized as ${user.role} to perform this operation` });
            }

            next();

        } catch (error) {
            return res.status(500).json({ message: "Internal server error", error: error.message });
        }
    };
};
