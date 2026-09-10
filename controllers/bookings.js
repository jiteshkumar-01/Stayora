const crypto = require("crypto");
const mongoose = require("mongoose");
const Razorpay = require("razorpay");
const Booking = require("../public/models/booking.js");
const Listing = require("../public/models/listing.js");
const ExpressError = require("../utils/ExpressError.js");

const DAY_MS = 1000 * 60 * 60 * 24;
const jsonError = (res, status, message) => res.status(status).json({ success: false, message });

function razorpayClient() {
  if (!process.env.RAZORPAY_KEY_ID || !process.env.RAZORPAY_KEY_SECRET) return null;
  return new Razorpay({ key_id: process.env.RAZORPAY_KEY_ID, key_secret: process.env.RAZORPAY_KEY_SECRET });
}

function parseBookingInput(body) {
  const checkInText = String(body.checkIn || "");
  const checkOutText = String(body.checkOut || "");
  const guests = Number(body.guests);
  const datePattern = /^\d{4}-\d{2}-\d{2}$/;
  if (!datePattern.test(checkInText) || !datePattern.test(checkOutText)) throw new ExpressError(400, "Check-in and check-out dates are required.");
  const checkIn = new Date(`${checkInText}T00:00:00.000Z`);
  const checkOut = new Date(`${checkOutText}T00:00:00.000Z`);
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);
  if (Number.isNaN(checkIn.getTime()) || Number.isNaN(checkOut.getTime())) throw new ExpressError(400, "Please enter valid booking dates.");
  if (checkIn < today) throw new ExpressError(400, "Check-in cannot be before today.");
  if (checkOut <= checkIn) throw new ExpressError(400, "Check-out must be after check-in.");
  if (!Number.isInteger(guests) || guests < 1) throw new ExpressError(400, "Guests must be a whole number of at least 1.");
  return { checkIn, checkOut, checkInText, checkOutText, guests };
}

function totals(listing, checkIn, checkOut) {
  const totalNights = Math.ceil((checkOut - checkIn) / DAY_MS);
  const pricePerNight = Number(listing.price);
  const totalAmount = totalNights * pricePerNight;
  if (!Number.isFinite(pricePerNight) || pricePerNight < 0 || !Number.isFinite(totalAmount)) throw new ExpressError(500, "This listing does not have a valid price.");
  return { totalNights, pricePerNight, totalAmount };
}

async function conflictingBooking(listingId, checkIn, checkOut) {
  return Booking.findOne({ listing: listingId, bookingStatus: "confirmed", paymentStatus: "paid", checkIn: { $lt: checkOut }, checkOut: { $gt: checkIn } });
}

async function listingForBooking(listingId, userId) {
  if (!mongoose.isValidObjectId(listingId)) throw new ExpressError(400, "Invalid listing ID.");
  const listing = await Listing.findById(listingId);
  if (!listing) throw new ExpressError(404, "Listing not found.");
  if (listing.owner.equals(userId)) throw new ExpressError(400, "You cannot book your own listing.");
  return listing;
}

module.exports.createOrder = async (req, res) => {
  try {
    const client = razorpayClient();
    if (!client) return jsonError(res, 503, "Razorpay is not configured. Please contact support.");
    const input = parseBookingInput(req.body);
    const listing = await listingForBooking(req.params.id, req.user._id);
    if (listing.guestCapacity != null && input.guests > Number(listing.guestCapacity)) return jsonError(res, 400, `This listing allows at most ${listing.guestCapacity} guests.`);
    if (await conflictingBooking(listing._id, input.checkIn, input.checkOut)) return jsonError(res, 409, "This listing is unavailable for the selected dates.");
    const calculated = totals(listing, input.checkIn, input.checkOut);
    const receipt = `booking_${Date.now()}_${crypto.randomBytes(5).toString("hex")}`.slice(0, 40);
    const order = await client.orders.create({
      amount: Math.round(calculated.totalAmount * 100), currency: "INR", receipt,
      notes: { listingId: String(listing._id), userId: String(req.user._id), checkIn: input.checkInText, checkOut: input.checkOutText, guests: String(input.guests) },
    });
    return res.json({ success: true, key: process.env.RAZORPAY_KEY_ID, orderId: order.id, amount: order.amount, currency: order.currency, listingTitle: listing.title, totalNights: calculated.totalNights, totalAmount: calculated.totalAmount, user: { name: req.user.username, email: req.user.email } });
  } catch (err) {
    console.error("Razorpay order creation failed:", err);
    return jsonError(res, err.statusCode || 500, err.statusCode ? err.message : "Unable to create payment order. Please try again.");
  }
};

module.exports.verifyPayment = async (req, res) => {
  try {
    const client = razorpayClient();
    if (!client) return jsonError(res, 503, "Razorpay is not configured. Please contact support.");
    const { razorpay_order_id: orderId, razorpay_payment_id: paymentId, razorpay_signature: signature, listingId } = req.body;
    if (!orderId || !paymentId || !signature) return jsonError(res, 400, "Incomplete payment verification data.");
    const expected = crypto.createHmac("sha256", process.env.RAZORPAY_KEY_SECRET).update(`${orderId}|${paymentId}`).digest("hex");
    const validSignature = signature.length === expected.length && crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
    if (!validSignature) return jsonError(res, 400, "Invalid payment signature.");
    if (await Booking.exists({ razorpayPaymentId: paymentId })) return jsonError(res, 409, "This payment has already been verified.");
    const input = parseBookingInput(req.body);
    const listing = await listingForBooking(listingId, req.user._id);
    const calculated = totals(listing, input.checkIn, input.checkOut);
    const order = await client.orders.fetch(orderId);
    const notes = order.notes || {};
    if (String(notes.listingId) !== String(listing._id) || String(notes.userId) !== String(req.user._id) || String(notes.checkIn) !== input.checkInText || String(notes.checkOut) !== input.checkOutText || String(notes.guests) !== String(input.guests)) return jsonError(res, 400, "Payment order does not match these booking details.");
    if (order.currency !== "INR" || Number(order.amount) !== Math.round(calculated.totalAmount * 100)) return jsonError(res, 400, "Payment amount does not match the booking total.");
    if (order.status !== "paid") return jsonError(res, 400, "Razorpay has not marked this order as paid.");
    if (listing.guestCapacity != null && input.guests > Number(listing.guestCapacity)) return jsonError(res, 400, `This listing allows at most ${listing.guestCapacity} guests.`);
    if (await conflictingBooking(listing._id, input.checkIn, input.checkOut)) return jsonError(res, 409, "The listing became unavailable before payment verification. Please contact support regarding your payment.");
    const booking = await Booking.create({ listing: listing._id, user: req.user._id, host: listing.owner, checkIn: input.checkIn, checkOut: input.checkOut, guests: input.guests, ...calculated, bookingStatus: "confirmed", paymentStatus: "paid", razorpayOrderId: orderId, razorpayPaymentId: paymentId, razorpaySignature: signature });
    return res.json({ success: true, bookingId: booking._id, redirectUrl: `/bookings/${booking._id}?success=1` });
  } catch (err) {
    if (err && err.code === 11000) return jsonError(res, 409, "This payment has already been verified.");
    console.error("Razorpay payment verification failed:", err);
    return jsonError(res, err.statusCode || 500, err.statusCode ? err.message : "Unable to verify payment. Please contact support if money was deducted.");
  }
};

module.exports.myBookings = async (req, res) => {
  const bookings = await Booking.find({ user: req.user._id }).populate("listing").populate("host").sort({ createdAt: -1 });
  res.render("bookings/my-bookings", { bookings });
};

module.exports.hostBookings = async (req, res) => {
  const ownedListings = await Listing.find({ owner: req.user._id }).sort({ createdAt: -1 });
  const ownedListingIds = ownedListings.map(l => l._id);
  const bookings = await Booking.find({ listing: { $in: ownedListingIds } }).populate("listing").populate("user").sort({ createdAt: -1 });
  res.render("bookings/host-bookings", { bookings, ownedListings });
};

module.exports.showBooking = async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.bookingId)) throw new ExpressError(400, "Invalid booking ID.");
  const booking = await Booking.findById(req.params.bookingId).populate("listing").populate("user").populate("host");
  if (!booking) throw new ExpressError(404, "Booking not found.");
  const isGuest = booking.user && booking.user._id.equals(req.user._id);
  const isCurrentOwner = booking.listing && booking.listing.owner.equals(req.user._id);
  if (!isGuest && !isCurrentOwner) throw new ExpressError(403, "You are not authorized to view this booking.");
  const view = req.query.success === "1" && isGuest ? "bookings/success" : "bookings/show";
  res.render(view, { booking });
};

module.exports.cancelBooking = async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.bookingId)) throw new ExpressError(400, "Invalid booking ID.");
  const booking = await Booking.findById(req.params.bookingId);
  if (!booking) throw new ExpressError(404, "Booking not found.");
  if (!booking.user.equals(req.user._id)) throw new ExpressError(403, "Only the booking customer can cancel this booking.");
  if (booking.bookingStatus === "cancelled") { req.flash("error", "This booking is already cancelled."); return res.redirect(`/bookings/${booking._id}`); }
  if (booking.checkIn <= new Date()) { req.flash("error", "Past or already-started bookings cannot be cancelled."); return res.redirect(`/bookings/${booking._id}`); }
  booking.bookingStatus = "cancelled";
  await booking.save();
  req.flash("success", "Booking cancelled. Your payment remains paid; any refund must be handled separately.");
  res.redirect(`/bookings/${booking._id}`);
};
