const mongoose = require("mongoose");
const Listing = require("../public/models/listing.js");
const ExpressError = require("../utils/ExpressError.js");

module.exports.index = async (req, res) => {
  const allListings = await Listing.find({});
  return res.render("listings/index.ejs", { allListings, listings: allListings });
};

module.exports.renderNewForm = (req, res) => {
  return res.render("listings/new.ejs");
};

module.exports.showListing = async (req, res) => {
  let { id } = req.params;
  
  if (!mongoose.isValidObjectId(id)) {
    req.flash("error", "Listing not found!");
    return res.redirect("/listings");
  }

  const listing = await Listing.findById(id)
    .populate({
      path: "reviews",
      populate: {
        path: "author",
      },
    })
    .populate("owner");

  if (!listing) {
    req.flash("error", "Listing you requested for does not exist!");
    return res.redirect("/listings");
  }

  return res.render("listings/show.ejs", { listing });
};

module.exports.createListing = async (req, res, next) => {
  const newListing = new Listing(req.body.listing);
  newListing.owner = req.user._id;

  let uploadedImages = [];

  if (req.files) {
    if (req.files["images"]) {
      uploadedImages = req.files["images"].map(f => ({ url: f.path, filename: f.filename }));
    }
    if (req.files["listing[image]"]) {
      const single = req.files["listing[image]"][0];
      uploadedImages.unshift({ url: single.path, filename: single.filename });
    }
  }

  if (uploadedImages.length > 0) {
    newListing.images = uploadedImages;
    newListing.image = uploadedImages[0]; // Set legacy primary image
  }

  await newListing.save();
  req.flash("success", "Listing created successfully!");
  return res.redirect("/listings");
};

module.exports.editListing = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.isValidObjectId(id)) {
      req.flash("error", "Listing not found!");
      return res.redirect("/listings");
    }

    const listing = await Listing.findById(id);

    if (!listing) {
      req.flash("error", "Listing not found!");
      return res.redirect("/listings");
    }

    // Determine cover image for preview
    let orignalImageUrl = "https://images.unsplash.com/photo-1564013799919-ab600027ffc6?auto=format&fit=crop&w=800&q=80";
    if (listing.images && listing.images.length > 0) {
      orignalImageUrl = listing.images[0].url;
    } else if (listing.image && listing.image.url) {
      orignalImageUrl = listing.image.url;
    }

    return res.render("listings/edit", { listing, orignalImageUrl });
  } catch (err) {
    console.error("Error in editListing controller:", err);
    req.flash("error", "Something went wrong while loading the edit page.");
    return res.redirect("/listings");
  }
};

module.exports.updateListing = async (req, res) => {
  let { id } = req.params;

  if (!mongoose.isValidObjectId(id)) {
    req.flash("error", "Listing not found!");
    return res.redirect("/listings");
  }

  let listing = await Listing.findById(id);
  if (!listing) {
    req.flash("error", "Listing not found!");
    return res.redirect("/listings");
  }

  // Update text fields
  const { title, price, description, location, country, category } = req.body.listing;
  listing.title = title;
  listing.price = price;
  listing.description = description;
  listing.location = location;
  listing.country = country;
  listing.category = category;

  // Handle explicit image deletions if passed
  if (req.body.deleteImages && Array.isArray(req.body.deleteImages)) {
    listing.images = listing.images.filter(img => !req.body.deleteImages.includes(img.filename));
  } else if (req.body.deleteImages && typeof req.body.deleteImages === "string") {
    listing.images = listing.images.filter(img => img.filename !== req.body.deleteImages);
  }

  // Append newly uploaded images
  let newImages = [];
  if (req.files) {
    if (req.files["images"]) {
      newImages = req.files["images"].map(f => ({ url: f.path, filename: f.filename }));
    }
    if (req.files["listing[image]"]) {
      const single = req.files["listing[image]"][0];
      newImages.push({ url: single.path, filename: single.filename });
    }
  }

  if (newImages.length > 0) {
    if (!listing.images) listing.images = [];
    listing.images.push(...newImages);
  }

  // Ensure legacy image field remains synced to primary photo
  if (listing.images && listing.images.length > 0) {
    listing.image = listing.images[0];
  }

  await listing.save();
  req.flash("success", "Listing updated successfully!");
  return res.redirect(`/listings/${id}`);
};

module.exports.destroyListing = async (req, res) => {
  let { id } = req.params;

  if (!mongoose.isValidObjectId(id)) {
    req.flash("error", "Listing not found!");
    return res.redirect("/listings");
  }

  await Listing.findByIdAndDelete(id);
  req.flash("success", "Listing deleted successfully!");
  return res.redirect("/listings");
};