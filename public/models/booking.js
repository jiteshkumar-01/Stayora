const mongoose = require("mongoose");

const bookingSchema = new mongoose.Schema(
  {
    listing: { type: mongoose.Schema.Types.ObjectId, ref: "Listing", required: true },
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    host: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    checkIn: { type: Date, required: true },
    checkOut: { type: Date, required: true },
    guests: { type: Number, required: true, min: 1 },
    totalNights: { type: Number, required: true },
    pricePerNight: { type: Number, required: true },
    totalAmount: { type: Number, required: true },
    bookingStatus: { type: String, enum: ["pending", "confirmed", "cancelled"], default: "pending" },
    paymentStatus: { type: String, enum: ["pending", "paid", "failed", "refunded"], default: "pending" },
    razorpayOrderId: String,
    razorpayPaymentId: { type: String, unique: true, sparse: true },
    razorpaySignature: String,
  },
  { timestamps: true }
);

bookingSchema.index({ listing: 1, bookingStatus: 1, paymentStatus: 1, checkIn: 1, checkOut: 1 });

module.exports = mongoose.model("Booking", bookingSchema);
