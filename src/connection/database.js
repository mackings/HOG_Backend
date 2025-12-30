import mongoose from "mongoose";

// Cache connection for Vercel serverless functions
let cached = global.mongoose;

if (!cached) {
    cached = global.mongoose = { conn: null, promise: null };
}

const connectDB = async () => {
    // If already connected, return existing connection
    if (cached.conn) {
        console.log("✅ Using cached database connection");
        return cached.conn;
    }

    // If connection is in progress, wait for it
    if (!cached.promise) {
        const opts = {
            bufferCommands: false, // Disable buffering for serverless
            maxPoolSize: 10, // Limit connection pool
            serverSelectionTimeoutMS: 10000, // 10 second timeout
            socketTimeoutMS: 45000, // 45 second socket timeout
        };

        console.log("🔄 Connecting to MongoDB...");
        cached.promise = mongoose.connect(process.env.MONGODB_URL, opts)
            .then((mongoose) => {
                console.log("✅ Database connected successfully");
                return mongoose;
            })
            .catch((error) => {
                console.error("❌ Database connection failed:", error.message);
                cached.promise = null; // Reset promise on failure
                throw error;
            });
    }

    try {
        cached.conn = await cached.promise;
    } catch (e) {
        cached.promise = null;
        throw e;
    }

    return cached.conn;
}

export default connectDB;