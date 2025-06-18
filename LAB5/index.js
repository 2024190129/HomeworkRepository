const express = require("express");
const sqlite3 = require("sqlite3");
const fs = require("fs").promises;
const path = require("path");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.static("public"));
app.use(express.json());

const db = new sqlite3.Database("public/product.db");

function runQuery(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
}

function runSingleQuery(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) reject(err);
      else resolve(row);
    });
  });
}

async function readJsonFile(filePath) {
  try {
    const data = await fs.readFile(filePath, "utf-8");
    return JSON.parse(data);
  } catch (err) {
    if (err.code === "ENOENT") return {};
    throw err;
  }
}

async function writeJsonFile(filePath, data) {
  await fs.writeFile(filePath, JSON.stringify(data, null, 2));
}

app.get("/", (_, res) => res.sendFile(path.join(__dirname, "public/index.html")));
app.get("/login", (_, res) => res.sendFile(path.join(__dirname, "public/login.html")));
app.get("/signup", (_, res) => res.sendFile(path.join(__dirname, "public/signup.html")));

app.get("/movies", async (req, res) => {
  const { keyword, sort } = req.query;
  let sql = "SELECT * FROM movies";
  const params = [];

  if (keyword) {
    sql += " WHERE movie_title LIKE ? OR movie_overview LIKE ?";
    const k = `%${keyword}%`;
    params.push(k, k);
  }

  const sortMap = {
    "rating-desc": "movie_rate DESC",
    "rating-asc": "movie_rate ASC",
    "release-desc": "movie_release_date DESC",
    "release-asc": "movie_release_date ASC",
  };

  if (sort && sortMap[sort]) {
    sql += ` ORDER BY ${sortMap[sort]}`;
  }

  try {
    const results = await runQuery(sql, params);
    res.json(results);
  } catch (err) {
    console.error("Failed to fetch movies:", err.message);
    res.status(500).json({ message: "Could not retrieve movies" });
  }
});

app.get("/movies/:movie_id", async (req, res) => {
  try {
    const movie = await runSingleQuery("SELECT * FROM movies WHERE movie_id = ?", [req.params.movie_id]);
    if (!movie) return res.status(404).json({ message: "Movie not found" });
    res.json(movie);
  } catch (err) {
    console.error("Error retrieving movie:", err.message);
    res.status(500).json({ message: "Database error" });
  }
});

app.get("/comments/:movie_id", async (req, res) => {
  try {
    const comments = await readJsonFile("public/comment.json");
    res.json(comments[req.params.movie_id] || []);
  } catch (err) {
    console.error("Failed to load comments:", err.message);
    res.status(500).json({ message: "Failed to retrieve comments" });
  }
});

app.post("/comments", async (req, res) => {
  const { movie_id, comment } = req.body;
  if (!movie_id || !comment) {
    return res.status(400).json({ message: "movie_id and comment are required" });
  }

  try {
    const commentsData = await readJsonFile("public/comment.json");
    const idStr = String(movie_id);

    if (!commentsData[idStr]) commentsData[idStr] = [];
    commentsData[idStr].push(comment);

    await writeJsonFile("public/comment.json", commentsData);
    res.status(200).json({ success: true });
  } catch (err) {
    console.error("Failed to save comment:", err.message);
    res.status(500).json({ message: "Failed to save comment" });
  }
});

app.listen(PORT, () => console.log(`Server listening on port ${PORT}`));