const mongoose = require("mongoose");
const Review = require("./review");
const Schema = mongoose.Schema;

const listingSchema = new Schema({
  title: {
    type: String,
    required: true,
  },
  description: {
    type: String,
    required: true,
  },
  // Legacy single image support
  image: {
    url: String,
    filename: String,
  },
  // Multiple image support
  images: [
    {
      url: String,
      filename: String,
    }
  ],
  price: Number,
  location: String,
  country: String,
  reviews: [
    {
      type: Schema.Types.ObjectId,
      ref: "Review",
    }
  ],
  owner: {
    type: Schema.Types.ObjectId,
    ref: "User",
    required: true, 
  },
  category: {
    type: String,
    required: true,
    enum: ["Trending", "Rooms", "Cities", "Mountain", "Castles", "Pools", "Lakes", "Beach", "Camping", "Domes", "Arictic", "Boats"],
  },
});

// Post middleware to delete reviews when listing is deleted
listingSchema.post("findOneAndDelete", async (listing) => {
  if (listing) {
    await Review.deleteMany({ _id: { $in: listing.reviews } });
  }
});

const Listing = mongoose.model("Listing", listingSchema);
module.exports = Listing;
