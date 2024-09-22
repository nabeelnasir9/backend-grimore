const express = require("express");
const User = require("../models/user");
const Stripe = require("stripe");
const Order = require("../models/order");
const Prompt = require("../models/prompts");
require("dotenv").config();

const stripe = Stripe(process.env.STRIPE_KEY);
const router = express.Router();
router.get("/all-users", async (_req, res) => {
  try {
    const users = await User.find()
      .populate({
        path: "orders",
        options: { sort: { _id: -1 } },
      })
      .sort({ _id: -1 });

    for (const user of users) {
      for (const order of user.orders) {
        try {
          const session = await stripe.checkout.sessions.retrieve(
            order.sessionId
          );
          order.shipping = session;
          await order.save();
        } catch (error) {
          console.error("Error retrieving session:", error.message);
        }
      }
    }

    res.json(users);
  } catch (error) {
    console.error(error.message);
    res.status(500).send("Server error");
  }
});
router.get("/all-orders", async (_req, res) => {
  try {
    const orders = await Order.find();
    let totalAmount = 0;
    let totalItemCount = 0;
    let paidCount = 0;
    let unpaidCount = 0;

    orders.forEach((order) => {
      // Safely access amount_total and ensure it's a number
      if (order.shipping && order.shipping.amount_total) {
        totalAmount += parseFloat(order.shipping.amount_total) || 0;
      }

      order.lineItems.forEach((item) => {
        totalItemCount += parseInt(item.quantity) || 0; // Ensure quantity is a number
      });

      // Safely handle payment status
      const paymentStatus = order.shipping?.payment_status;
      if (paymentStatus === "paid") {
        paidCount++;
      } else if (paymentStatus === "unpaid") {
        unpaidCount++;
      }
    });

    const response = {
      totalAmount,
      totalItemCount,
      paymentStatusCounts: {
        paid: paidCount,
        unpaid: unpaidCount,
      },
    };
    res.json(response);
  } catch (error) {
    console.error(error.message);
    res.status(500).send("Server error");
  }
});

/**
 * @classdesc [INFO: Update Status of Order]
 */
router.post("/update-status", async (req, res) => {
  try {
    const { orderId, deliveryStatus } = req.body;
    const order = await Order.findByIdAndUpdate(
      orderId,
      { delivery_status: deliveryStatus },
      { new: true }
    );
    if (!order) {
      return res.status(404).json({ message: "Order not found" });
    }

    res.json(order);
  } catch (error) {
    console.error("Error updating delivery status:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});

router.get("/prompts", async (req, res) => {
  try {
    const existingPrompts = await Prompt.find();

    res.status(200).json(existingPrompts);
  } catch (error) {
    console.error("Error retrieving prompts:", error);
    res
      .status(500)
      .json({ message: "Error retrieving prompts from the database" });
  }
});

router.get("/order-noti", async (req, res) => {
  try {
    const allOrders = await Order.find();
    res.status(200).json(allOrders.length);
  } catch (error) {
    console.error("Error retrieving prompts:", error);
    res
      .status(500)
      .json({ message: "Error retrieving prompts from the database" });
  }
});

router.post("/prompt-editor", async (req, res) => {
  try {
    const updatedPrompts = req.body;
    await Promise.all(
      updatedPrompts.map(async (updatedPrompt) => {
        const existingPrompt = await Prompt.findOneAndUpdate(
          { _id: updatedPrompt._id },
          { prompt: updatedPrompt.prompt },
          { new: true }
        );
        if (!existingPrompt) {
          throw new Error(`Prompt with ID ${updatedPrompt._id} not found`);
        }
      })
    );
    const updatedPromptsFromDB = await Prompt.find();
    res.status(200).json(updatedPromptsFromDB);
  } catch (error) {
    console.error("Prompt changing error:", error);
    res.status(500).json({ message: "Prompt changing had error" });
  }
});
module.exports = router;
