const express = require("express");
const User = require("../models/user");
const Order = require("../models/order");
const Stripe = require("stripe");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { v4: uuidv4 } = require("uuid");
const nodemailer = require("nodemailer");
const otpGenerator = require("otp-generator");
const crypto = require("crypto");
require("dotenv").config();

const stripe = Stripe(process.env.STRIPE_KEY);
const router = express.Router();

const transporter = nodemailer.createTransport({
  service: "gmail",
  host: "smtp.gmail.com",
  port: 465,
  secure: true,
  auth: {
    user: "TheGrimoreAi@gmail.com",
    pass: "lrlz ahli awlj mlcb",
  },
});

router.post("/signup", async (req, res) => {
  try {
    const { email, password, fullName } = req.body;
    let user = await User.findOne({ email });
    if (user) {
      return res.status(400).send("User already exists");
    }

    const otp = otpGenerator.generate(6, {
      digits: true,
      alphabets: false,
      upperCase: false,
      specialChars: false,
    });
    const otp_expiry = new Date(Date.now() + 300000);
    console.log("otp", otp, "otp_expiry", otp_expiry);
    const verified = false;
    user = new User({ email, password, fullName, otp, otp_expiry, verified });
    await user.save();

    const mailOptions = {
      from: process.env.EMAIL,
      to: user.email,
      subject: "Verify your email",
      // text: `Your OTP is ${otp}. It will expire in 5 minutes.`,
      html: `
      <!DOCTYPE html>
      <html lang="en">
        <head>
          <meta charset="UTF-8" />
          <meta name="viewport" content="width=device-width, initial-scale=1.0" />
          <meta http-equiv="X-UA-Compatible" content="ie=edge" />
          <title>Verify your OTP</title>
      
          <link
            href="https://fonts.googleapis.com/css2?family=Poppins:wght@300;400;500;600&display=swap"
            rel="stylesheet"
          />
        </head>
        <body
          style="
            margin: 0;
            font-family: 'Poppins', sans-serif;
            background: #ffffff;
            font-size: 14px;
          "
        >
          <div
            style="
              max-width: 680px;
              margin: 0 auto;
              padding: 45px 30px 60px;
              background: #ffffff;
              background-image: url(https://i.ibb.co/dj7cT9z/seamless-gold-rhombus-grid-pattern-black-background-53876-97589.jpg);
              background-repeat: no-repeat;
              background-size: 800px 452px;
              background-position: top center;
              font-size: 14px;
              color: #434343;
            "
          >
            <header>
              <table style="width: 100%;">
                <tbody>
                  <tr style="height: 0;">
                    <td>
                      <img
                        alt=""
                        src="https://i.ibb.co/4s74W2h/grimore-white.png"
                        height="80px"
                      />
                    </td>
                  </tr>
                </tbody>
              </table>
            </header>
      
            <main>
              <div
                style="
                  margin: 0;
                  margin-top: 70px;
                  padding: 92px 30px 115px;
                  background: #ffffff;
                  border-radius: 30px;
                  text-align: center;
                "
              >
                <div style="width: 100%; max-width: 489px; margin: 0 auto;">
                  <h1
                    style="
                      margin: 0;
                      font-size: 24px;
                      font-weight: 500;
                      color: #1f1f1f;
                    "
                  >
                    Your OTP
                  </h1>
                  <p
                    style="
                      margin: 0;
                      margin-top: 17px;
                      font-size: 16px;
                      font-weight: 500;
                    "
                  >
                    Hello,
                  </p>
                  <p
                    style="
                      margin: 0;
                      margin-top: 17px;
                      font-weight: 500;
                      letter-spacing: 0.56px;
                    "
                  >
                    Thank you for choosing Grimore. Use the following OTP
                    to complete the procedure to change your email address. OTP is
                    valid for
                    <span style="font-weight: 600; color: #1f1f1f;">5 minutes</span>.
                    Do not share this code with others, including Grimore
                    employees.
                  </p>
                  <p
                    style="
                      margin: 0;
                      margin-top: 60px;
                      font-size: 40px;
                      font-weight: 600;
                      letter-spacing: 25px;
                      color: #8C52FF;
                    "
                  >
                    ${otp}
                  </p>
                </div>
              </div>
      
              <p
                style="
                  max-width: 400px;
                  margin: 0 auto;
                  margin-top: 90px;
                  text-align: center;
                  font-weight: 500;
                  color: #8c8c8c;
                "
              >
                Need help? Ask at
                <a
                  href="mailto:grimore@gmail.com"
                  style="color: #8C52FF; text-decoration: none;"
                  >grimore@gmail.com</a
                >
                or visit our
                <a
                  href=""
                  target="_blank"
                  style="color: #8C52FF; text-decoration: none;"
                  >Help Center</a
                >
              </p>
            </main>
      
            <footer
              style="
                width: 100%;
                max-width: 490px;
                margin: 20px auto 0;
                text-align: center;
                border-top: 1px solid #8C52FF;
              "
            >
              <p
                style="
                  margin: 0;
                  margin-top: 40px;
                  font-size: 16px;
                  font-weight: 600;
                  color: #434343;
                "
              >
              Grimore             </p>
              <p style="margin: 0; margin-top: 8px; color: #8C52FF;">
                Address 540, City, State.
              </p>
              <p style="margin: 0; margin-top: 16px; color: #434343;">
                Copyright © 2025 Grimore. All rights reserved.
              </p>
            </footer>
          </div>
        </body>
      </html>
      
`,
    };

    transporter.sendMail(mailOptions, (error, info) => {
      if (error) {
        console.log(error);
        return res.status(500).json("Error sending email");
      }
      console.log("Email sent: " + info.response);
      res.status(200).json("OTP sent to your email");
    });
  } catch (err) {
    console.error(err.message);
    res.status(500).json("Server error");
  }
});

// Verify OTP Route
router.post("/verify-otp", async (req, res) => {
  try {
    const { email, otp } = req.body;
    const user = await User.findOne({ email });

    if (!user) {
      return res.status(400).send("User not found");
    }

    const current = new Date();
    if (current > user.otp_expiry) {
      return res.status(400).send("OTP expired");
    }

    if (user.otp !== otp) {
      return res.status(400).send("Invalid OTP");
    }

    // OTP is correct and not expired
    // Here, instead of nulling the OTP fields, mark the user as verified
    user.verified = true;
    user.otp = null;
    user.otp_expiry = null;
    await user.save();

    // You might still issue a JWT here or redirect the user to the login process,
    // depending on your application flow
    const payload = {
      user: {
        id: user.id,
      },
    };

    jwt.sign(
      payload,
      process.env.JWT_SECRET,
      { expiresIn: "5h" },
      (err, token) => {
        if (err) throw err;
        res.json({ token });
      },
    );
  } catch (err) {
    console.error(err.message);
    res.status(500).send("Server error");
  }
});

// @route   POST /api/auth/login
router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;
    let user = await User.findOne({ email });

    if (!user || !user.verified) {
      return res.status(400).json("Invalid Credentials or User not verified");
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json("Invalid Credentials");
    }

    const payload = {
      user: {
        id: user.id,
      },
    };

    jwt.sign(
      payload,
      process.env.JWT_SECRET,
      { expiresIn: "5h" },
      (err, token) => {
        if (err) throw err;
        res.json({
          token,
          user: {
            fullName: user.fullName,
            email: user.email,
          },
        });
      },
    );
  } catch (err) {
    console.error(err.message);
    res.status(500).send("Server error");
  }
});

router.post("/selected", async (req, res) => {
  try {
    const { email, image } = req.body;
    let user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }
    if (user.selectedImages.includes(image)) {
      return res.status(400).json({ error: "Image already selected" });
    }
    user.selectedImages.push(image);
    await user.save();
    res.status(200).json({ success: "Image added successfully" });
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ error: "Server error" });
  }
});

router.post("/cart", async (req, res) => {
  try {
    const { email } = req.body;
    let user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }
    const selectedImages = user.selectedImages;
    return res
      .status(200)
      .json({ message: "User found", images: selectedImages });
  } catch (error) {
    res.status(500).json({ error: "Server error" });
  }
});
router.post("/delete-cart", async (req, res) => {
  try {
    const { email, image } = req.body;
    let user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }
    user.selectedImages.splice(user.selectedImages.indexOf(image), 1);
    await user.save();
    return res.status(200).json({ message: "deleted successfully" });
  } catch (error) {
    res.status(500).json({ error: "Server error" });
  }
});

router.post("/payment", async (req, res) => {
  const { images, userEmail } = req.body;

  const trackingId = uuidv4();
  const successUrl = `${process.env.ORIGIN}/success?trackingId=${trackingId}`;
  const failUrl = `${process.env.ORIGIN}/cancel?trackingId=${trackingId}`;
  const lineItems = [
    {
      price_data: {
        currency: "usd",
        product_data: {
          name: "Generative Images",
          images: images.map((image) => image),
        },
        unit_amount: 4000,
      },
      quantity: 1,
    },
  ];

  try {
    const user = await User.findOne({ email: userEmail });
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }
    console.log(process.env.ORIGIN);
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      line_items: lineItems,
      mode: "payment",
      shipping_address_collection: {
        allowed_countries: ["IN", "US", "CA"],
      },
      success_url: successUrl,
      cancel_url: failUrl,
    });
    const order = new Order({
      trackingId: trackingId,
      sessionId: session.id,
      userId: user._id,
      lineItems: lineItems,
      delivery_status: "Pending",
    });
    await order.save();
    user.orders.push(order._id);
    await user.save();
    res.json({ id: session.id, url: session.url });
  } catch (error) {
    console.error("Error processing payment:", error);
    res.status(500).json({ error: "Failed to process payment" });
  }
});

router.get("/orders", async (req, res) => {
  const { userEmail } = req.query;
  try {
    const user = await User.findOne({ email: userEmail }).populate("orders");
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }
    res.json(user.orders);
  } catch (error) {
    console.error("Error fetching user's orders:", error);
    res.status(500).json({ error: "Failed to fetch user's orders" });
  }
});

router.get("/cancel/:trackingId", async (req, res) => {
  const { trackingId } = req.params;
  try {
    const order = await Order.findOne({ trackingId });
    order.delivery_status = "Cancelled";
    await order.save();
    res.json({ message: "Order cancelled" });
  } catch (error) {
    console.error("Error fetching user's orders:", error);
  }
});

router.post("/forgot-password", async (req, res) => {
  const { email } = req.body;
  try {
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(400).json({ message: "User not found" });
    }

    const token = crypto.randomBytes(20).toString("hex");

    user.resetPasswordToken = token;
    user.resetPasswordExpires = Date.now() + 3600000; // 1 hour

    await user.save();

    const resetUrl = `${process.env.ORIGIN}/reset-password/${token}`;

    const mailOptions = {
      to: user.email,
      from: process.env.EMAIL_USER,
      subject: "Password Reset",
      html: `
        <!DOCTYPE html>
        <html lang="en">
          <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Password Reset</title>
            <style>
              body {
                font-family: 'Arial', sans-serif;
                background-color: #f4f4f4;
                margin: 0;
                padding: 0;
              }
              .container {
                width: 100%;
                max-width: 600px;
                margin: 0 auto;
                background-color: #ffffff;
                padding: 20px;
                box-shadow: 0 0 10px rgba(0, 0, 0, 0.1);
              }
              .header {
                text-align: center;
                padding: 20px 0;
              }
              .header img {
                width: 150px;
              }
              .content {
                text-align: center;
                padding: 20px 0;
              }
              .content h1 {
                color: #333333;
                font-size: 24px;
              }
              .content p {
                color: #666666;
                font-size: 16px;
              }
              .content a {
                display: inline-block;
                margin-top: 20px;
                padding: 10px 20px;
                color: #ffffff;
                background-color: #007BFF;
                text-decoration: none;
                border-radius: 5px;
              }
              .footer {
                text-align: center;
                padding: 20px 0;
                color: #999999;
                font-size: 14px;
              }
            </style>
          </head>
          <body>
            <div class="container">
              <div class="header">
                <img src="https://i.ibb.co/4s74W2h/grimore-white.png" alt="Synthseer Logo">
              </div>
              <div class="content">
                <h1>Password Reset Request</h1>
                <p>You are receiving this email because you (or someone else) requested a password reset for your account. If you did not request this, please ignore this email and your password will remain unchanged.</p>
                <p>Click the button below to reset your password:</p>
                <a href="${resetUrl}">Reset Password</a>
              </div>
              <div class="footer">
                <p>Need help? Contact us at <a href="mailto:grimore@gmail.com">grimore@gmail.com</a></p>
                <p>&copy; 2025 Grimore. All rights reserved.</p>
              </div>
            </div>
          </body>
        </html>
      `,
    };

    transporter.sendMail(mailOptions, (err, response) => {
      if (err) {
        console.error("Error sending email:", err);
        return res.status(500).json({ message: "Error sending email" });
      }
      res.status(200).json({ message: "Password reset link sent" });
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});
router.post("/reset-password/:token", async (req, res) => {
  const { token } = req.params;
  const { email, password, confirmPassword } = req.body;

  console.log("Received password:", password);
  console.log("Received confirmPassword:", confirmPassword);

  if (password !== confirmPassword) {
    console.log("Passwords do not match");
    return res.status(400).json({ message: "Passwords do not match" });
  }

  try {
    // Find the user by email and ensure the token and expiration date match
    const user = await User.findOne({
      email,
      resetPasswordToken: token,
      resetPasswordExpires: { $gt: Date.now() },
    });

    if (!user) {
      console.log("Invalid or expired token or email");
      return res
        .status(400)
        .json({ message: "Invalid or expired token or email" });
    }

    // Log the current password
    console.log("Current hashed password (before resetting):", user.password);

    // Hash the new password manually
    const hashedPassword = await bcrypt.hash(password, 8);

    // Log the new hashed password
    console.log("New hashed password (after hashing):", hashedPassword);

    // Update the user's password and clear the reset token and expiry
    user.password = hashedPassword;
    user.resetPasswordToken = undefined;
    user.resetPasswordExpires = undefined;

    // Save the updated user document without triggering the pre-save hook
    await user.updateOne({
      password: hashedPassword,
      resetPasswordToken: undefined,
      resetPasswordExpires: undefined,
    });

    // Log the saved password
    console.log("Saved hashed password:", hashedPassword);

    res.status(200).json({ message: "Password reset successful" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});

module.exports = router;
