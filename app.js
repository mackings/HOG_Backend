import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import errorMiddleware from './src/middlewares/error.middleware.js';
import limiter from './src/middlewares/rateLimit.js';
import connectDB from './src/connection/database.js';
import { ensureDbConnection } from './src/middlewares/dbConnect.middleware.js';
import userRouter from './src/modules/user/routes/user.routes.js';
import tailorRouter from './src/modules/vendor/routes/vendor.routes.js';
import materialRouter from './src/modules/material/routes/materilas.routes.js';
import bankRouter from './src/modules/bank/routes/bank.routes.js';
import transactionRouter from './src/modules/transaction/routes/transaction.routes.js';
import subcriptionRouter from './src/modules/subscription/routes/subscription.routes.js';
import rateRouter from './src/modules/rate/routes/rate.routes.js';
import trackingRouter from './src/modules/tracking/routes/tracking.routes.js';
import categoryRouter from './src/modules/category/routes/category.routes.js';
import reviewRouter from './src/modules/review/routes/review.routes.js';
import publishedRouter from './src/modules/vendor/routes/published.routes.js';
import sellerRouter from './src/modules/seller/routes/seller.routes.js';
import buyerRouter from './src/modules/seller/routes/buyer.routes.js';
import adminRouter from './src/modules/seller/routes/admin.routes.js';
import makeOfferRouter from './src/modules/makeOffer/routes/makeOffer.routes.js';
import deliveryRateRouter from './src/modules/deliveryRate/routes/deliveryRate.routes.js';
import stripeRouter from './src/modules/stripe/routes/stripe.routes.js';
import rapydRouter from './src/modules/rapyd/routes/rapyd.routes.js';
import { rapydWebhook } from './src/modules/rapyd/controller/rapyd.controller.js';
import { webhookPaymentSuccess } from './src/modules/stripe/controller/stripe.controller.js';
import feeRouter from './src/modules/commission/routes/commission.routes.js'
import conversionRouter from './src/modules/conversion/routes/conversion.routes.js';
import imagekitRouter from './src/modules/imagekit/routes/imagekit.routes.js';
import pricingRouter from './src/modules/pricing/routes/pricing.routes.js';
import messagingRouter from './src/modules/messaging/routes/messaging.routes.js';
import measurementRouter from './src/modules/measurement/routes/measurement.routes.js';
import customOrderRouter from './src/modules/customOrder/routes/customOrder.routes.js';
import moodboardRouter from './src/modules/moodboard/routes/moodboard.routes.js';
import disputeRouter from './src/modules/dispute/routes/dispute.routes.js';
import reputationRouter from './src/modules/reputation/routes/reputation.routes.js';
import discoveryRouter from './src/modules/discovery/routes/discovery.routes.js';
import designerToolsRouter from './src/modules/designerTools/routes/designerTools.routes.js';
import supportRouter from './src/modules/support/routes/support.routes.js';




const app = express();

// Webhook routes BEFORE body parsing middleware (they need raw body)
// Also include DB connection middleware
app.post('/api/v1/stripe/webhook', express.raw({ type: 'application/json' }), ensureDbConnection, webhookPaymentSuccess);
app.post("/api/v1/rapyd/webhook", express.json({ type: 'application/json' }), ensureDbConnection, rapydWebhook);

// connectDB(); // Moved to index.js to ensure env vars are loaded first


app.use(helmet());
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
// app.use(limiter);

// Apply database connection middleware to ALL API routes
app.use(ensureDbConnection);


app.get('/', (req, res) => {
    res.send('Hello, You are welcome to the world of Hog!');
});

app.use('/api/v1/user', userRouter);
app.use('/api/v1/tailor', tailorRouter);
app.use('/api/v1/material', materialRouter);
app.use('/api/v1/bank', bankRouter);
app.use('/api/v1/transaction', transactionRouter);
app.use('/api/v1/subscription', subcriptionRouter);
app.use('/api/v1/rate', rateRouter);
app.use('/api/v1/tracking', trackingRouter );
app.use('/api/v1/category', categoryRouter);
app.use('/api/v1/review', reviewRouter);
app.use('/api/v1/published', publishedRouter);
app.use('/api/v1/seller', sellerRouter);
app.use('/api/v1/buyer', buyerRouter);
app.use('/api/v1/admin', adminRouter);
app.use('/api/v1/makeOffer', makeOfferRouter);
app.use('/api/v1/deliveryRate', deliveryRateRouter);
app.use('/api/v1/stripe', stripeRouter);
app.use('/api/v1/rapyd', rapydRouter);
app.use('/api/v1/fee', feeRouter);
app.use('/api/v1/conversion', conversionRouter);
app.use('/api/v1/imagekit', imagekitRouter);
app.use('/api/v1/pricing', pricingRouter);
app.use('/api/v1/messaging', messagingRouter);
app.use('/api/v1/measurements', measurementRouter);
app.use('/api/v1/custom-orders', customOrderRouter);
app.use('/api/v1/moodboards', moodboardRouter);
app.use('/api/v1/disputes', disputeRouter);
app.use('/api/v1/reputation', reputationRouter);
app.use('/api/v1/discovery', discoveryRouter);
app.use('/api/v1/designer-tools', designerToolsRouter);
app.use('/api/v1/support', supportRouter);

app.use((req, res) => {
  res.status(404).json({ message: "Endpoint not found. please, check the url and try again." });
});

app.use(errorMiddleware);



export default app;
