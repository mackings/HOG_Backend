import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import errorMiddleware from './src/middlewares/error.middleware.js';
import limiter from './src/middlewares/rateLimit.js';
import connectDB from './src/connection/database.js';
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


 

const app = express();

connectDB();


app.use(helmet());
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
// app.use(limiter);


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

app.use((req, res)=>{
  res.status(404).json({message: "Endpoint not found. please, check the url and try again."})
});

app.use(errorMiddleware);



export default app;

