const sqlite3 = require("sqlite3").verbose();
const path = require("path");
const fs = require("fs");

// Ensure the data directory exists for the SQLite file
const dataDir = path.join(__dirname, "../data");
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir);
}

const dbPath = path.join(dataDir, "database.sqlite");
const db = new sqlite3.Database(dbPath, (err) => {
  if (err) console.error("Database opening error:", err.message);
  else console.log("Connected to SQLite database.");
});

// Serialize ensures tables are created sequentially
db.serialize(() => {
  // Create Players Table
  db.run(`CREATE TABLE IF NOT EXISTS players (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL UNIQUE
    )`);

  // Create Favorites Table
  db.run(`CREATE TABLE IF NOT EXISTS favorites (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        player_id INTEGER,
        commander_name TEXT NOT NULL,
        image_url TEXT NOT NULL,
        scryfall_id TEXT,
        FOREIGN KEY (player_id) REFERENCES players(id) ON DELETE CASCADE
    )`);
});

module.exports = db;
