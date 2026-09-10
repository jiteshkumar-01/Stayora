const express = require("express");
const router = express.Router();
const mongoose = require("mongoose");
const wrapAsync = require("../utils/wrapAsync");
const { isLoggedIn, isOwner, validateListing } = require("../middleware.js");
const listingController = require("../controllers/listings.js");
const multer = require("multer");
const { storage } = require("../cloudcofig.js");

const upload = multer({ storage });
const uploadImagesMiddleware = upload.fields([
  { name: "listing[image]", maxCount: 1 },
  { name: "images", maxCount: 10 }
]);

const Listing = require("../public/models/listing.js");

// INDEX + CREATE
router
  .route("/")
  .get(
    wrapAsync(async (req, res) => {
      const allListings = await Listing.find({});
      return res.render("listings/index", {
        allListings,
        listings: allListings,
        country: null,
        category: null,
        currentUser: req.user || null,
      });
    })
  )
  .post(
    isLoggedIn,
    uploadImagesMiddleware,
    validateListing,
    wrapAsync(listingController.createListing)
  );

// NEW FORM
router.get("/new", isLoggedIn, listingController.renderNewForm);

// EDIT FORM
router.get("/:id/edit", isLoggedIn, isOwner, wrapAsync(listingController.editListing));

// SEARCH BY COUNTRY
router.get(
  "/search",
  wrapAsync(async (req, res) => {
    const { country } = req.query;
    let listings = [];

    if (country && country.trim() !== "") {
      listings = await Listing.find({ country: { $regex: new RegExp(country.trim(), "i") } });

      if (listings.length === 0) {
        req.flash("error", `No stays found for "${country}".`);
      }
    } else {
      req.flash("error", "Please enter a country or destination to search.");
      return res.redirect("/listings");
    }

    return res.render("listings/index", { listings, allListings: listings, country, category: null });
  })
);

// FILTER BY CATEGORY
router.get(
  "/category/:category",
  wrapAsync(async (req, res) => {
    const { category } = req.params;
    const listings = await Listing.find({ category });

    if (listings.length === 0) {
      req.flash("error", `No stays found in "${category}" category.`);
    }

    return res.render("listings/index", {
      listings,
      allListings: listings,
      country: null,
      category,
    });
  })
);

// SHOW, UPDATE, DELETE
router
  .route("/:id")
  .get(wrapAsync(listingController.showListing))
  .put(
    isLoggedIn,
    isOwner,
    uploadImagesMiddleware,
    validateListing,
    wrapAsync(listingController.updateListing)
  )
  .delete(
    isLoggedIn,
    isOwner,
    wrapAsync(listingController.destroyListing)
  );

module.exports = router;
