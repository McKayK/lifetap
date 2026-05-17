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
  db.run(
    `CREATE TABLE IF NOT EXISTS players (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT UNIQUE)`,
  );
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

app.listen(5000, () => console.log("Backend running on port 5000"));
