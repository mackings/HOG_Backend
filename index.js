import dotenv from '@dotenvx/dotenvx';
import app from './app.js';


dotenv.config();

const port = process.env.PORT || 4500;


app.listen(port, () => {
    console.log(`HOG Server is running on port http://localhost:${port}`);
});