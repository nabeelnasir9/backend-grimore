const express = require("express");
const User = require("../models/user");
const Order = require("../models/order");
const Stripe = require("stripe");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const nodemailer = require("nodemailer");
const otpGenerator = require("otp-generator");
require("dotenv").config();

const stripe = Stripe(process.env.STRIPE_KEY);
const router = express.Router();

const transporter = nodemailer.createTransport({
  service: "gmail",
  host: "smtp.gmail.com",
  port: 465,
  secure: true,
  auth: {
    user: "nasirnabeel36@gmail.com",
    pass: "omjv eavd zmyp ytjv",
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
      text: `Your OTP is ${otp}. It will expire in 5 minutes.`,
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
    user.selectedImages.push(image);
    await user.save();
    res.status(200).json({ success: "Image added successfully" });
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ error: "Server error" });
  }
});

router.post("/confirmed", async (req, res) => {
  try {
    const { email, image } = req.body;
    let user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({ error: "User not found" });
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

router.post("/check", async (req, res) => {
  try {
    const { email, image } = req.body;
    let user = await User.findOne({ email });

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }
    const urlExists = user.selectedImages.includes(image);

    if (!urlExists) {
      user.selectedImages.push(image);
      await user.save();
    }

    return res.status(200).json({ exists: urlExists });
  } catch (error) {
    res.status(500).json({ error: "Server error" });
  }
});

router.post("/payment", async (req, res) => {
  const { images, userEmail } = req.body;

  const lineItems = images.map((index) => ({
    price_data: {
      currency: "usd",
      product_data: {
        name: "Tarot Card",
        images: [index],
      },
      unit_amount: 6000,
    },
    quantity: "1",
  }));
  try {
    const user = await User.findOne({ email: userEmail });

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      line_items: lineItems,
      mode: "payment",
      shipping_address_collection: {
        allowed_countries: ["IN", "US", "CA"],
      },
      success_url: "https://be-tomnonv.onrender.com/success",
      cancel_url: "https://be-tomnonv.onrender.com/cancel",
    });

    const order = new Order({
      sessionId: session.id,
      userId: user._id,
      lineItems: lineItems,
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

// router.get("/sessionid", async (req, res) => {
//   try {
//     const session = await stripe.checkout.sessions.retrieve(
//       "cs_test_a1BX7s0kj2b0XFEPikuwNBfdApTDYdFKgh2gcIDZvgUgVpmi5YZBP82tBG",
//     );
//     res.json(session);
//   } catch (error) {
//     console.log(error);
//   }
// });

// router.post("/payment2", async (req, res) => {
//   const { images } = req.body;
//   const lineItems = images.map((index) => ({
//     price_data: {
//       currency: "usd",
//       product_data: {
//         name: "Tarot Cards",
//         images: [index],
//       },
//       unit_amount: 6000,
//     },
//     quantity: "1",
//   }));
//   const session = await stripe.checkout.sessions.create({
//     payment_method_types: ["card"],
//     line_items: lineItems,
//     mode: "payment",
//     success_url: "http://localhost:8000/success",
//     cancel_url: "http://localhost:8000/cancel",
//   });
//   console.log(session.customer);
//   res.json({ id: session.id, url: session.url });
// });

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
module.exports = router;
