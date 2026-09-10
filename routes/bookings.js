const express = require("express");
const router = express.Router();
const bookings = require("../controllers/bookings.js");
const wrapAsync = require("../utils/wrapAsync.js");
const { isLoggedIn, validateBooking } = require("../middleware.js");

const isLoggedInApi = (req, res, next) => {
  if (!req.isAuthenticated()) return res.status(401).json({ success: false, message: "You must be logged in to book." });
  next();
};

router.post("/listings/:id/bookings/create-order", isLoggedInApi, validateBooking, bookings.createOrder);
router.post("/bookings/verify-payment", isLoggedInApi, validateBooking, bookings.verifyPayment);
router.get("/bookings/my-bookings", isLoggedIn, wrapAsync(bookings.myBookings));
router.get("/bookings/host", isLoggedIn, wrapAsync(bookings.hostBookings));
router.get("/bookings/:bookingId", isLoggedIn, wrapAsync(bookings.showBooking));
router.patch("/bookings/:bookingId/cancel", isLoggedIn, wrapAsync(bookings.cancelBooking));

module.exports = router;
