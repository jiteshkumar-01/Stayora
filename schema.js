const Joi = require("joi");

module.exports.listingSchema = Joi.object({
  listing: Joi.object({
    title: Joi.string().required(),
    description: Joi.string().required(),
    price: Joi.number().required().min(0),
    location: Joi.string().required(),
    country: Joi.string().required(),
    category: Joi.string()
      .valid(
        "Trending",
        "Rooms",
        "Cities",
        "Mountain",
        "Castles",
        "Pools",
        "Lakes",
        "Beach",
        "Camping",
        "Domes",
        "Arictic",
        "Boats",
      )
      .required(),
  }).required(),
});


module.exports.reviewSchema = Joi.object({
  review: Joi.object({
    rating: Joi.number().required().min(1).max(5),
    comment: Joi.string().required(),
  }).required(),
});

module.exports.bookingSchema = Joi.object({
  checkIn: Joi.string().isoDate().required(),
  checkOut: Joi.string().isoDate().required(),
  guests: Joi.number().integer().min(1).required(),
  razorpay_order_id: Joi.string().optional(),
  razorpay_payment_id: Joi.string().optional(),
  razorpay_signature: Joi.string().optional(),
  listingId: Joi.string().optional(),
}).unknown(false);
