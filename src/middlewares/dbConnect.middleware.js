import connectDB from '../connection/database.js';

/**
 * Middleware to ensure database connection before handling requests
 * Critical for Vercel serverless functions
 */
export const ensureDbConnection = async (req, res, next) => {
    try {
        await connectDB();
        next();
    } catch (error) {
        console.error('Database connection middleware error:', error);
        return res.status(500).json({
            success: false,
            message: 'Database connection failed',
            error: error.message
        });
    }
};
