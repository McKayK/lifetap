const express = require("express");
const cors = require("cors");
const sqlite3 = require("sqlite3").verbose();
const path = require("path");
const fs = require("fs");
const multer = require("multer");

const app = express();
app.use(cors());
app.use(express.json());

// 1. Setup the upload storage path on disk
const uploadDir = path.join(__dirname, "../public/custom-art");
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// 2. Serve the static images folder to the frontend
app.use("/custom-art", express.static(uploadDir));

// 3. Configure secure storage parameters
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    // Unique timestamp prevents files with identical names from overwriting each other
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  },
});

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 5 * 1024 * 1024, // Strict 5MB size guard per upload
  },
});

// 4. Connect Database
const dbPath = path.join(__dirname, "../data/database.sqlite");
const db = new sqlite3.Database(dbPath, (err) => {
  if (err) console.error("Database connection error:", err);
});

db.serialize(() => {
  // 1. Create players table if it doesn't exist
  db.run(
    `CREATE TABLE IF NOT EXISTS players (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT UNIQUE)`,
  );

  // EXTRA SAFE: Add the wins column to players if it doesn't exist yet
  db.run(`ALTER TABLE players ADD COLUMN wins INTEGER DEFAULT 0`, (err) => {
    // We safely catch the error here because SQLite throws an error if the column ALREADY exists
    if (err && !err.message.includes("duplicate column name")) {
      console.error("Error updating players schema:", err.message);
    }
  });

  db.run(`ALTER TABLE games ADD COLUMN turns INTEGER DEFAULT 0`, (err) => {
    if (err && !err.message.includes("duplicate column name")) {
      console.error("Error updating games schema:", err.message);
    }
  });

  // 2. Create favorites table
  db.run(`CREATE TABLE IF NOT EXISTS favorites (
    id INTEGER PRIMARY KEY AUTOINCREMENT, 
    player_id INTEGER, 
    commander_name TEXT, 
    image_url TEXT, 
    scryfall_id TEXT,
    FOREIGN KEY(player_id) REFERENCES players(id)
  )`);
});

// --- API ENDPOINTS ---

app.get("/api/players", (req, res) => {
  db.all("SELECT * FROM players", [], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

app.post("/api/players", (req, res) => {
  const { name } = req.body;
  db.run("INSERT INTO players (name) VALUES (?)", [name], function (err) {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ id: this.lastID, name });
  });
});

app.get("/api/players/:id/favorites", (req, res) => {
  db.all(
    "SELECT * FROM favorites WHERE player_id = ?",
    [req.params.id],
    (err, rows) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json(rows);
    },
  );
});

// Direct Multi-part File Upload Endpoint
app.post(
  "/api/players/:id/upload-favorite",
  upload.single("image"),
  (req, res) => {
    const playerId = req.params.id;
    const { commander_name } = req.body;

    if (!req.file) return res.status(400).json({ error: "No file uploaded" });

    // Dynamically uses whatever domain/IP you are using to browse the app
    const domain = req.get("host");
    const protocol = req.protocol;
    const image_url = `${protocol}://${domain}/custom-art/${req.file.filename}`;

    db.run(
      "INSERT INTO favorites (player_id, commander_name, image_url, scryfall_id) VALUES (?, ?, ?, 'custom')",
      [playerId, commander_name, image_url],
      function (err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({
          id: this.lastID,
          player_id: playerId,
          commander_name,
          image_url,
        });
      },
    );
  },
);

app.post("/api/players/:id/favorites", (req, res) => {
  const { commander_name, image_url, scryfall_id } = req.body;
  db.run(
    "INSERT INTO favorites (player_id, commander_name, image_url, scryfall_id) VALUES (?, ?, ?, ?)",
    [req.params.id, commander_name, image_url, scryfall_id],
    function (err) {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ id: this.lastID });
    },
  );
});

// Increment a specific player's win total
app.post("/api/players/:id/win", (req, res) => {
  const playerId = req.params.id;
  db.run(
    "UPDATE players SET wins = COALESCE(wins, 0) + 1 WHERE id = ?",
    [playerId],
    function (err) {
      if (err) return res.status(500).json({ error: err.message });
      res.json({
        success: true,
        message: `Win recorded for player ID ${playerId}`,
      });
    },
  );
});

// Optional: Reset all win counts back to 0 across the board
app.post("/api/players/reset-wins", (req, res) => {
  db.run("UPDATE players SET wins = 0", [], function (err) {
    if (err) return res.status(500).json({ error: err.message });
    res.json({
      success: true,
      message: "All player win histories have been reset.",
    });
  });
});

// Rename a player
app.patch("/api/players/:id", (req, res) => {
  const { name } = req.body;
  if (!name || !name.trim())
    return res.status(400).json({ error: "Name is required" });
  db.run(
    "UPDATE players SET name = ? WHERE id = ?",
    [name.trim(), req.params.id],
    function (err) {
      if (err) return res.status(500).json({ error: err.message });
      if (this.changes === 0)
        return res.status(404).json({ error: "Player not found" });
      res.json({ id: req.params.id, name: name.trim() });
    },
  );
});

// Delete a player and their favorites
app.delete("/api/players/:id", (req, res) => {
  const playerId = req.params.id;
  db.run("DELETE FROM favorites WHERE player_id = ?", [playerId], (err) => {
    if (err) return res.status(500).json({ error: err.message });
    db.run("DELETE FROM players WHERE id = ?", [playerId], function (err) {
      if (err) return res.status(500).json({ error: err.message });
      if (this.changes === 0)
        return res.status(404).json({ error: "Player not found" });
      res.json({ success: true });
    });
  });
});

// Create games table
db.serialize(() => {
  db.run(`CREATE TABLE IF NOT EXISTS games (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    winner_id INTEGER,
    winner_name TEXT,
    player_count INTEGER,
    played_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(winner_id) REFERENCES players(id)
  )`);
});

// Log a game result
app.post("/api/games", (req, res) => {
  const { winner_id, winner_name, player_count, turns } = req.body;
  db.run(
    "INSERT INTO games (winner_id, winner_name, player_count, turns) VALUES (?, ?, ?, ?)",
    [winner_id, winner_name, player_count, turns || 0],
    function (err) {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ id: this.lastID });
    },
  );
});

// Fetch game history
app.get("/api/games", (req, res) => {
  db.all(
    "SELECT * FROM games ORDER BY played_at DESC LIMIT 50",
    [],
    (err, rows) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json(rows);
    },
  );
});

// Delete a single game log entry and decrement the winner's win count
app.delete("/api/games/:id", (req, res) => {
  // First fetch the game so we know who the winner was
  db.get("SELECT * FROM games WHERE id = ?", [req.params.id], (err, game) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!game) return res.status(404).json({ error: "Game not found" });

    db.run("DELETE FROM games WHERE id = ?", [req.params.id], function (err) {
      if (err) return res.status(500).json({ error: err.message });

      // Decrement the winner's win count, floor at 0
      db.run(
        "UPDATE players SET wins = MAX(0, wins - 1) WHERE id = ?",
        [game.winner_id],
        function (err) {
          if (err) console.error("Error decrementing wins:", err.message);
          res.json({ success: true, winner_id: game.winner_id });
        },
      );
    });
  });
});

app.post("/api/players/:id/set-wins", (req, res) => {
  const { wins } = req.body;
  db.run(
    "UPDATE players SET wins = ? WHERE id = ?",
    [wins, req.params.id],
    function (err) {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ success: true });
    },
  );
});

app.listen(5000, () => console.log("Backend running on port 5000"));
