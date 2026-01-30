import dotenv from '@dotenvx/dotenvx';
import app from './app.js';
import connectDB from './src/connection/database.js';
import { startStripePayoutRetryJob } from './src/jobs/stripePayoutRetry.job.js';

dotenv.config();

const port = process.env.PORT || 4500;

// Connect to database after env vars are loaded
connectDB();
startStripePayoutRetryJob();

app.listen(port, () => {
    console.log(`HOG Server is running on port http://localhost:${port}`);
});
