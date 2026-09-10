const express = require("express");
const router = express.Router();
const passport = require("passport");
const mongoose = require("mongoose");
const User = require("../public/models/user");
const Listing = require("../public/models/listing");
const wrapAsync = require("../utils/wrapAsync");
const { isLoggedIn, saveRedirectUrl } = require("../middleware.js");

// =========================
// ✅ SIGNUP ROUTES
// =========================

router.get("/signup", (req, res) => {
  res.render("users/signup");
});

router.post(
  "/signup",
  wrapAsync(async (req, res, next) => {
    const { username, email, password } = req.body;
    
    if (!username || !email || !password) {
      req.flash("error", "Please fill in all required fields.");
      return res.redirect("/signup");
    }

    try {
      const user = new User({ email, username });
      const registeredUser = await User.register(user, password);
      
      req.login(registeredUser, (err) => {
        if (err) {
          console.error("Login after signup error:", err);
          return next(err);
        }
        req.flash("success", "Welcome to Stayora! Account created successfully.");
        return res.redirect("/listings");
      });

    } catch (e) {
      console.error("Signup error:", e);
      let userMessage = e.message;

      if (e.name === "UserExistsError" || e.code === 11000) {
        userMessage = "This username or email is already registered. Please log in or choose another.";
      }
      
      req.flash("error", userMessage);
      return res.redirect("/signup");
    }
  })
);

// =========================
// ✅ LOGIN ROUTES
// =========================

router.get("/login", (req, res) => {
  res.render("users/login");
});

router.post(
  "/login",
  saveRedirectUrl,
  passport.authenticate("local", {
    failureFlash: true,
    failureRedirect: "/login",
  }),
  (req, res) => {
    req.flash("success", "Welcome back to Stayora!");
    const redirectUrl = res.locals.redirectUrl || "/listings";
    return res.redirect(redirectUrl);
  }
);

// =========================
// ✅ LOGOUT ROUTE
// =========================

router.post("/logout", (req, res, next) => {
  req.logout(function (err) {
    if (err) {
      console.error("Logout error:", err);
      return next(err);
    }
    req.flash("success", "You have logged out successfully!");
    return res.redirect("/listings");
  });
});

// =========================
// ✅ WISHLIST ROUTES
// =========================

// GET /wishlist - Render logged-in user's saved wishlist items
router.get(
  "/wishlist",
  isLoggedIn,
  wrapAsync(async (req, res) => {
    const user = await User.findById(req.user._id).populate({
      path: "wishlist",
      populate: { path: "owner", select: "username" }
    });

    const rawListings = user.wishlist || [];
    // Filter out null/deleted listing references safely
    const savedListings = rawListings.filter(item => item !== null && item._id);

    // Clean up stale deleted listing IDs from DB if any reference was broken
    if (savedListings.length !== rawListings.length) {
      user.wishlist = savedListings.map(item => item._id);
      await user.save();
    }

    res.render("listings/wishlist", {
      listings: savedListings,
      allListings: savedListings,
      wishlistCount: savedListings.length,
      country: null,
      category: null,
    });
  })
);

// POST /wishlist/toggle/:id - Toggle listing in user's wishlist in MongoDB
router.post(
  "/wishlist/toggle/:id",
  wrapAsync(async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ success: false, message: "Please log in to save listings." });
    }

    const { id } = req.params;
    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({ success: false, message: "Invalid listing ID." });
    }

    const listing = await Listing.findById(id);
    if (!listing) {
      return res.status(404).json({ success: false, message: "Listing no longer exists." });
    }

    const user = await User.findById(req.user._id);
    const targetIdStr = id.toString();
    
    // Check if listing ID is already in user's wishlist array
    const existingIndex = user.wishlist.findIndex(
      item => (item._id ? item._id.toString() : item.toString()) === targetIdStr
    );
    
    let added = false;
    if (existingIndex > -1) {
      user.wishlist.splice(existingIndex, 1);
      added = false;
    } else {
      user.wishlist.push(listing._id);
      added = true;
    }

    await user.save();

    // Recalculate valid wishlist count
    const updatedUser = await User.findById(req.user._id).populate("wishlist");
    const validWishlist = (updatedUser.wishlist || []).filter(item => item !== null && item._id);
    
    // Clean stale references if any
    if (validWishlist.length !== updatedUser.wishlist.length) {
      updatedUser.wishlist = validWishlist.map(i => i._id);
      await updatedUser.save();
    }

    const newCount = validWishlist.length;

    return res.json({
      success: true,
      added,
      message: added ? "Added to your wishlist ❤️" : "Removed from your wishlist.",
      count: newCount,
      wishlistIds: validWishlist.map(i => i._id.toString())
    });
  })
);

module.exports = router;
