const {Paystack} = require( 'paystack-sdk');
const paystack = new Paystack(process.env.PAYSTACK_MAIN_KEY );
const axios = require('axios');
import User from '../../user/model/user.model.js';
import Transaction from '../model/transaction.model.js';



exports.paystackPayment= async(req, res) => {
    const id = req.user;
    const userStatus = await User.findById(id);
    const existingEmail = await User.findOne({ email: userStatus.email });
    if (!existingEmail) {
        return res.status(400).json({
            message: 'Invalid Email, The email does not exist'
            }); 
    }

    const courseId = req.params.courseId;
    const course = await Course.findById( courseId );
    // Create a new order in the database
    const transaction = await Transaction.create({
        reference: crypto.randomBytes(9).toString('hex'),
        amount: course.isPrice_course || 5000,
        title: course.course_title,
        email: existingEmail.email,
        userId: existingEmail._id, 
        courseId: course._id,
        tutorId: course.userId  
      });   
  // Use Paystack library to initiate payment
    const paystackPayment = paystack.transaction.initialize({
        amount: transaction.amount * 100, 
        email: transaction.email,
        reference: transaction.reference,
        first_name: userStatus.firstName,
        last_name: userStatus.lastName,
        }, 
        (error, response) => {
            if (error) {
                console.error(error);
                return res.status(500).json({ error: 'An error occurred while initializing payment.' });
                } else {
                    return res.json(response.data.authorization_url); 
                }
            }
        )};
        
        // to receive event and Paystack data from convoy webhook
exports.decodePaystack = async (req, res) => {
    try {
        const { event, data } = req.body; 
        if(event === 'charge.success'){
            const { reference } = data;
            const transaction = await Transaction.findOne({ reference });
            if (!transaction) {
                return res.status(404).json({ message: 'Transaction not found' });
            } 
            const existingCourse = await Course.findOne({course_title: transaction.title})
            const user = await User.findById(transaction.userId);
            if (user) {
                await User.findOneAndUpdate(
                {
                    _id: user._id
                },
                {
                  $push: { 
                    courses: existingCourse._id
                  }
                },
                {
                    new : true,
                });
            }
        const modules = await Module.findOne({ courseId: existingCourse._id })
        const newCourse = await StudentCourse.create({
            courseId: existingCourse._id,
            title: existingCourse.course_title,
            description: existingCourse.course_description,
            image: existingCourse.course_image,
            price: existingCourse.isPrice_course,
            courseOwnerId: existingCourse.userId,
            userId: transaction.userId,
            module: modules 

        });
        // update the user courseLimit
        const updatedUser = await User.findByIdAndUpdate({_id: transaction.userId}, {
            $inc: {courseLimit: +1}
        },
        {
            new: true
        });
        // update the course's totalRegisteredByStudent
        const totalRegisteredByStudent = await Course.findByIdAndUpdate({_id: existingCourse._id}, {
            $inc: {totalRegisteredByStudent: +1}
        }, {
            new: true
        });
        // credit the course owner wallet 
        const ownerCredited = await User.findByIdAndUpdate({_id: totalRegisteredByStudent.userId}, {
            $inc: { 
                wallet: +transaction.amount * 80/100,
                earnings: +transaction.amount * 80/100
             }
        },
        {
            new: true
        })

        // update the owner of the company wallet
        const totalCredited = await User.findOneAndUpdate({ roles: "superadmin" }, {
            $inc: {
                wallet : + transaction.amount * 20/100,
                earnings: +transaction.amount * 20/100
             }
        },
        {
            new: true
        })
         
        await sendEmail({
            email: user.email,
            subject: `Payment Successful`,
            message: `            
  <head></head>

  <body style="background-color:#ffffff;font-family:-apple-system,BlinkMacSystemFont,&quot;Segoe UI&quot;,Roboto,Oxygen-Sans,Ubuntu,Cantarell,&quot;Helvetica Neue&quot;,sans-serif">
    <table align="center" role="presentation" cellSpacing="0" cellPadding="0" border="0" width="100%" style="max-width:37.5em;margin:0 auto;padding:20px 0 48px">
      <tr style="width:100%">
        <td><img alt="DECODE" src="/public/decodelogo.jpeg" width="170" height="50" style="display:block;outline:none;border:none;text-decoration:none;margin:0 auto" />        
          <p style="font-size:16px;line-height:26px;margin:16px 0">Hello, ${user.firstName} ${user.lastName}, <br>
                        You have successfully made the payment of the one time non-refundable ${transaction.amount} for the course ${totalRegisteredByStudent.course_title}. <br>                       
                        . <br><br><br>
                        Thanks for patronage.</p>
          <table style="text-align:center" align="center" border="0" cellPadding="0" cellSpacing="0" role="presentation" width="100%">
            <tbody>
              <tr>
                <td><a href="#" target="_blank" style="background-color:#5F51E8;border-radius:3px;color:#fff;font-size:16px;text-decoration:none;text-align:center;display:inline-block;p-x:12px;p-y:12px;line-height:100%;max-width:100%;padding:12px 12px"><span><!--[if mso]><i style="letter-spacing: 12px;mso-font-width:-100%;mso-text-raise:18" hidden>&nbsp;</i><![endif]--></span><span style="background-color:#5F51E8;border-radius:3px;color:#fff;font-size:16px;text-decoration:none;text-align:center;display:inline-block;p-x:12px;p-y:12px;max-width:100%;line-height:120%;text-transform:none;mso-padding-alt:0px;mso-text-raise:9px">Reference: ${transaction.reference}.</span><span><!--[if mso]><i style="letter-spacing: 12px;mso-font-width:-100%" hidden>&nbsp;</i><![endif]--></span></a></td>
              </tr>
            </tbody>
          </table>
          <p style="font-size:16px;line-height:26px;margin:16px 0">Best,<br /><br/>The Decode team</p>
          <hr style="width:100%;border:none;border-top:1px solid #eaeaea;border-color:#cccccc;margin:20px 0"/>
          <p style="font-size:12px;line-height:24px;margin:16px 0;color:#8898aa"> Lagos, Nigeria </p>
        </td>
      </tr>
    </table>
  </body>
</html>`
});
await sendEmail({
    email: totalCredited.email,
    subject: `commission for the course ${totalRegisteredByStudent.course_title}`,
    message: `
    <head></head>
    <body style="background-color:#ffffff;font-family:-apple-system,BlinkMacSystemFont,&quot;Segoe UI&quot
    ,&quot;Roboto&quot;,&quot;Oxygen-Sans&quot;,&quot;Ubuntu&quot;,&quot;Cantare
    ll&quot;,&quot;Helvetica Neue&quot;,sans-serif">
    <table align="center" role="presentation" cellSpacing="0" cellPadding="0" border="0" width="100%"

    style="max-width:37.5em;margin:0 auto;padding:20px 0 48px">
    <tr style="width:100%">
    <td><img alt="DECODE" src="/public/decodelogo.jpeg" width="170" height="50" style="
    display:block;outline:none;border:none;text-decoration:none;margin:0 auto" />
    <p style="font-size:16px;line-height:26px;margin:16px 0">Hello,
    ${totalCredited.firstName} ${totalCredited.lastName}, <br>
    You have been credited with ${transaction.amount * 20/100} for the course ${totalRegisteredByStudent.course_title}. <br> 
    . <br><br><br>
    Thanks for patronage.</p>
    <table style="text-align:center" align="center" border="0" cellPadding="0" cellSpacing="0" role="
    presentation" width="100%">
    <tbody>
    <tr>
    <td><a href="#" target="_blank" style="background-color:#5F51E8;border-radius:3px;
    color:#fff;font-size:16px;text-decoration:none;text-align:center;display:inline-block;
    p-x:12px;p-y:12px;line-height:100%;max-width:10
    0%;padding:12px 12px"><span><!--[if mso]><i style="letter-spacing: 12

    `
})
return res.status(200).json({
    message: 'Payment successful',
    data: transaction
});
} 
}catch (error) {        
        return res.status(500).json({ 
            error: 'An error occurred while initializing payment.',
            message: error.message
        });
    }
}
