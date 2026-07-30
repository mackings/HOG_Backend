
const errorMiddleware = (err, req, res, next) => {
    const statusCode = err.status || 500;
    res.status(statusCode).json({
      success: false,
      message: err.message || "Internal Server Error",
      ...(err.fedexCode && { fedexCode: err.fedexCode }),
      ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
    });
  };
  
 export default errorMiddleware;
  