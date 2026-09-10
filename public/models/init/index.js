const mongoose = require("mongoose");
const initData = require("./data.js");
const Listing = require("../listing.js");

const MONGO_URL = "mongodb://127.0.0.1:27017/wanderlust";

main()
  .then(() => console.log("✅ Connected to DB"))
  .catch((err) => console.log("❌ DB Connection Error:", err));

async function main() {
  await mongoose.connect(MONGO_URL);
}

const initDB = async () => {
  try {
    
    console.log(`📦 Current listings in DB`);

    // ensure ObjectId type
    initData.data = initData.data.map((obj) => ({
      ...obj,
      owner: new mongoose.Types.ObjectId("68e31b7820489806eec1127b"),
    }));

    await Listing.deleteMany({});
    await Listing.insertMany(initData.data);

    console.log("✅ New sample data inserted successfully!");
  } catch (err) {
    console.log("❌ Error inserting data:", err);
  } finally {
    mongoose.connection.close();
  }
};

initDB();
