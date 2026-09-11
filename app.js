// Load environment variables only in development
if (process.env.NODE_ENV !== "production") {
  require("dotenv").config();
}

// -------------------- Startup Environment Validation --------------------
const dbUrl = process.env.MONGO_URL;
if (!dbUrl) {
  console.error("❌ CRITICAL ERROR: MONGO_URL environment variable is missing.");
  process.exit(1);
}

const secret = process.env.SECRET || "wanderlust_default_super_secret_session_key_32chars_min";
if (!process.env.SECRET) {
  console.warn("⚠️ WARNING: SECRET environment variable is missing. Using safe fallback.");
}

// -------------------- Required Packages --------------------
const express = require("express");
const app = express();
const mongoose = require("mongoose");
const path = require("path");
const methodOverride = require("method-override");
const ejsMate = require("ejs-mate");
const session = require("express-session");
const MongoStore = require("connect-mongo");
const flash = require("connect-flash");
const passport = require("passport");
const LocalStrategy = require("passport-local");
const ExpressError = require("./utils/ExpressError.js");
const User = require("./public/models/user.js");

// -------------------- Routes --------------------
const listingRouter = require("./routes/listing.js");
const reviewRouter = require("./routes/review.js");
const userRouter = require("./routes/user.js");
const bookingRouter = require("./routes/bookings.js");

// -------------------- MongoDB Connection --------------------
async function connectWithRetry() {
  try {
    await mongoose.connect(dbUrl);
    console.log("✅ MongoDB Connected Successfully!");
  } catch (err) {
    console.error("❌ MongoDB Connection Error:", err.message);
    console.log("⏳ Retrying MongoDB connection in 10 sec...");
    setTimeout(connectWithRetry, 10000);
  }
}
connectWithRetry();

// -------------------- App Configurations --------------------
app.engine("ejs", ejsMate);
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(methodOverride("_method"));
app.use(express.static(path.join(__dirname, "public")));

// -------------------- Session Configuration --------------------
const store = MongoStore.create({
  mongoUrl: dbUrl,
  touchAfter: 24 * 3600, // 1 day
});

store.on("error", (err) => {
  console.log("❌ SESSION STORE ERROR:", err);
});

const sessionOptions = {
  store,
  secret,
  resave: false,
  saveUninitialized: false,
  cookie: {
    expires: Date.now() + 1000 * 60 * 60 * 24 * 7, // 1 week
    maxAge: 1000 * 60 * 60 * 24 * 7,
    httpOnly: true,
  },
};

app.use(session(sessionOptions));
app.use(flash());

// -------------------- Passport Configuration --------------------
app.use(passport.initialize());
app.use(passport.session());
passport.use(new LocalStrategy(User.authenticate()));
passport.serializeUser(User.serializeUser());
passport.deserializeUser(User.deserializeUser());

// -------------------- Flash & Global UI Locals Middleware --------------------
app.use((req, res, next) => {
  res.locals.success = req.flash("success");
  res.locals.error = req.flash("error");
  res.locals.warning = req.flash("warning");
  res.locals.info = req.flash("info");
  res.locals.currUser = req.user;

  // Wishlist count & active IDs derived directly from authenticated user
  if (req.user && Array.isArray(req.user.wishlist)) {
    const validWishlist = req.user.wishlist.filter(id => id);
    res.locals.wishlistCount = validWishlist.length;
    res.locals.wishlistIds = validWishlist.map(id => (id._id || id).toString());
  } else {
    res.locals.wishlistCount = 0;
    res.locals.wishlistIds = [];
  }

  // Safe defaults for optional template variables
  res.locals.category = null;
  res.locals.country = null;
  res.locals.search = null;
  res.locals.query = null;
  res.locals.sort = null;
  res.locals.filters = null;

  next();
});

// -------------------- Routes --------------------
app.get("/", (req, res) => {
  return res.redirect("/listings");
});

app.use("/listings", listingRouter);
app.use("/listings/:id/reviews", reviewRouter);
app.use("/", userRouter);
app.use("/", bookingRouter);

app.get("/health", (req, res) => {
  res.status(200).json({
    status: "OK",
    message: "Backend is healthy",
    timestamp: new Date().toISOString()
  });
});

// -------------------- Express 5 Catch-All 404 Middleware --------------------
app.use((req, res, next) => {
  next(new ExpressError(404, "Page Not Found!"));
});

// -------------------- Central Error Handler --------------------
app.use((err, req, res, next) => {
  if (res.headersSent) {
    return next(err);
  }

  const statusCode = err.statusCode || err.status || 500;
  const message = err.message || "Something went wrong!";

  return res.status(statusCode).render("error.ejs", {
    err: {
      message,
      statusCode
    }
  });
});

// -------------------- Start Server --------------------
const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
  console.log(`🚀 Server is listening on port ${PORT}`);
});
