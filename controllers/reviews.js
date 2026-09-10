const mongoose = require("mongoose");
const Review = require("../public/models/review.js");
const Listing = require("../public/models/listing.js");

module.exports.createReview = async (req, res) => {
  const { id } = req.params;

  if (!mongoose.isValidObjectId(id)) {
    req.flash("error", "Listing not found!");
    return res.redirect("/listings");
  }

  let listing = await Listing.findById(id);

  if (!listing) {
    req.flash("error", "Listing not found!");
    return res.redirect("/listings");
  }

  let newReview = new Review(req.body.review);
  newReview.author = req.user._id;
  listing.reviews.push(newReview);

  await newReview.save();
  await listing.save();

  req.flash("success", "Review added successfully!");
  return res.redirect(`/listings/${listing._id}`);
};

module.exports.deleteReview = async (req, res) => {
  const { id, reviewId } = req.params;

  if (!mongoose.isValidObjectId(id) || !mongoose.isValidObjectId(reviewId)) {
    req.flash("error", "Invalid parameters.");
    return res.redirect("/listings");
  }

  await Listing.findByIdAndUpdate(id, { $pull: { reviews: reviewId } });
  await Review.findByIdAndDelete(reviewId);

  req.flash("success", "Review deleted successfully!");
  return res.redirect(`/listings/${id}`);
};