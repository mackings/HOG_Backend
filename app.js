import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import errorMiddleware from './src/middlewares/error.middleware.js';
import limiter from './src/middlewares/rateLimit.js';
import connectDB from './src/connection/database.js';
import userRouter from './src/modules/user/routes/user.routes.js';


 

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
app.use((req, res)=>{
  res.status(404).json({message: "Endpoint not found. please, check the url and try again."})
});

app.use(errorMiddleware);



export default app;

