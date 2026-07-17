const express = require("express");
const cors = require("cors");
const sqlite3 = require("sqlite3").verbose();
const path = require("path");
const fs = require("fs");
const multer = require("multer");

const app = express();
app.use(cors());
app.use(express.json());

// --- Static custom art hosting ---
const uploadDir = path.join(__dirname, "../public/custom-art");
fs.mkdirSync(uploadDir, { recursive: true });
app.use("/custom-art", express.static(uploadDir));

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    // Unique timestamp prevents files with identical names from overwriting each other
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB per upload
  // Server-side type guard — the client's accept="image/*" is only cosmetic
  fileFilter: (req, file, cb) => {
    if (file.mimetype && file.mimetype.startsWith("image/")) cb(null, true);
    else cb(new Error("Only image files are allowed."));
  },
});

// --- Database ---
const dataDir = path.join(__dirname, "../data");
fs.mkdirSync(dataDir, { recursive: true });
const dbPath = path.join(dataDir, "database.sqlite");
const db = new sqlite3.Database(dbPath, (err) => {
  if (err) console.error("Database connection error:", err);
  else console.log("Connected to SQLite database.");
});

// IMPORTANT: all CREATEs run before any ALTER so fresh databases work.
db.serialize(() => {
  db.run(`CREATE TABLE IF NOT EXISTS players (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,
    wins INTEGER DEFAULT 0
  )`);
  // NOTE: players.wins is legacy. Win totals are now computed from the games
  // table (single source of truth). The column is kept so old databases open
  // cleanly, but nothing reads or writes it anymore.

  db.run(`CREATE TABLE IF NOT EXISTS favorites (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    player_id INTEGER,
    commander_name TEXT NOT NULL,
    image_url TEXT NOT NULL,
    scryfall_id TEXT,
    FOREIGN KEY(player_id) REFERENCES players(id) ON DELETE CASCADE
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS games (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    winner_id INTEGER,
    winner_name TEXT,
    player_count INTEGER,
    turns INTEGER DEFAULT 0,
    played_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(winner_id) REFERENCES players(id)
  )`);

  // Legacy migration: databases created before the turns column existed.
  // Runs AFTER the create above, so "no such table" can never happen.
  db.run(`ALTER TABLE games ADD COLUMN turns INTEGER DEFAULT 0`, (err) => {
    if (err && !err.message.includes("duplicate column name")) {
      console.error("Error migrating games schema:", err.message);
    }
  });
});

// --- API ENDPOINTS ---

// Players, with win totals computed live from the games table.
app.get("/api/players", (req, res) => {
  db.all(
    `SELECT p.id, p.name, COUNT(g.id) AS wins
     FROM players p
     LEFT JOIN games g ON g.winner_id = p.id
     GROUP BY p.id
     ORDER BY p.name COLLATE NOCASE`,
    [],
    (err, rows) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json(rows);
    },
  );
});

app.post("/api/players", (req, res) => {
  const { name } = req.body;
  if (!name || !name.trim())
    return res.status(400).json({ error: "Name is required" });
  db.run(
    "INSERT INTO players (name) VALUES (?)",
    [name.trim()],
    function (err) {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ id: this.lastID, name: name.trim(), wins: 0 });
    },
  );
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

// Delete a player and their favorites (their game history rows are kept —
// winner_name preserves the record even after the profile is gone).
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

// Direct multi-part file upload endpoint.
// Wrapped manually so multer errors (bad type, too large) return clean JSON.
app.post("/api/players/:id/upload-favorite", (req, res) => {
  upload.single("image")(req, res, (err) => {
    if (err) return res.status(400).json({ error: err.message });

    const playerId = req.params.id;
    const { commander_name } = req.body;
    if (!req.file) return res.status(400).json({ error: "No file uploaded" });

    // Stored as a RELATIVE path so the art keeps working no matter which
    // domain or IP the app is accessed from later. The frontend prefixes
    // the backend origin at render time.
    const image_url = `/custom-art/${req.file.filename}`;

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
  });
});

// Log a game result. This is now THE act of recording a win — win totals
// are derived from these rows.
app.post("/api/games", (req, res) => {
  const { winner_id, winner_name, player_count } = req.body;
  db.run(
    "INSERT INTO games (winner_id, winner_name, player_count) VALUES (?, ?, ?)",
    [winner_id, winner_name, player_count],
    function (err) {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ id: this.lastID });
    },
  );
});

// Fetch game history (also feeds the stats screen)
app.get("/api/games", (req, res) => {
  db.all(
    "SELECT * FROM games ORDER BY played_at DESC, id DESC LIMIT 200",
    [],
    (err, rows) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json(rows);
    },
  );
});

// Delete a game log entry. No counter to decrement anymore — removing the
// row automatically removes the win from the computed totals.
app.delete("/api/games/:id", (req, res) => {
  db.run("DELETE FROM games WHERE id = ?", [req.params.id], function (err) {
    if (err) return res.status(500).json({ error: err.message });
    if (this.changes === 0)
      return res.status(404).json({ error: "Game not found" });
    res.json({ success: true });
  });
});

app.listen(5000, () => console.log("Backend running on port 5000"));
