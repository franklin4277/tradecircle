const express = require('express');
const path = require('path');
const bodyParser = require('body-parser');
const multer = require('multer');
const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const fs = require('fs');
const cors = require('cors');

const UPLOAD_DIR = path.join(__dirname, 'public', 'uploads');
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const upload = multer({ dest: UPLOAD_DIR });
const app = express();
app.use(cors());
app.use(bodyParser.json());
app.use('/uploads', express.static(UPLOAD_DIR));
app.use(express.static(path.join(__dirname, 'public')));

const DB_FILE = path.join(__dirname, 'tradecircle.db');
const db = new sqlite3.Database(DB_FILE);

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-me';

// Initialize tables
db.serialize(() => {
  db.run(`CREATE TABLE IF NOT EXISTS users(
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT,
    email TEXT UNIQUE,
    password TEXT
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS listings(
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    title TEXT,
    description TEXT,
    price REAL DEFAULT 0,
    image TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(user_id) REFERENCES users(id)
  )`);
});

function authMiddleware(req, res, next) {
  const auth = req.headers.authorization;
  if (!auth) return res.status(401).send('Missing authorization');
  const parts = auth.split(' ');
  if (parts.length !== 2 || parts[0] !== 'Bearer') return res.status(401).send('Invalid authorization');
  try {
    const payload = jwt.verify(parts[1], JWT_SECRET);
    req.user = payload;
    next();
  } catch (err) {
    return res.status(401).send('Invalid token');
  }
}

app.post('/register', async (req, res) => {
  const { name, email, password } = req.body || {};
  if (!email || !password) return res.status(400).send('Missing email or password');
  try {
    const hash = await bcrypt.hash(password, 10);
    db.run('INSERT INTO users(name,email,password) VALUES(?,?,?)', [name || '', email, hash], function(err) {
      if (err) return res.status(400).send(err.message);
      res.status(201).send('ok');
    });
  } catch (err) {
    res.status(500).send('Server error');
  }
});

app.post('/login', (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password) return res.status(400).send('Missing email or password');
  db.get('SELECT id, name, email, password FROM users WHERE email = ?', [email], async (err, row) => {
    if (err) return res.status(500).send('Server error');
    if (!row) return res.status(401).send('Invalid credentials');
    const ok = await bcrypt.compare(password, row.password);
    if (!ok) return res.status(401).send('Invalid credentials');
    const token = jwt.sign({ id: row.id, name: row.name, email: row.email }, JWT_SECRET, { expiresIn: '7d' });
    res.json({ id: row.id, name: row.name, email: row.email, token });
  });
});

app.post('/add-listing', authMiddleware, upload.single('image'), (req, res) => {
  const { title, description, price } = req.body || {};
  const image = req.file ? `uploads/${path.basename(req.file.path)}` : null;
  if (!title || !description) return res.status(400).send('Missing title or description');
  db.run('INSERT INTO listings(user_id,title,description,price,image) VALUES(?,?,?,?,?)', [req.user.id, title, description, parseFloat(price) || 0, image], function(err) {
    if (err) return res.status(500).send('Database error');
    res.status(201).json({ id: this.lastID });
  });
});

// update listing (only owner)
app.put('/listings/:id', authMiddleware, upload.single('image'), (req, res) => {
  const id = Number(req.params.id);
  const { title, description, price } = req.body || {};
  db.get('SELECT user_id, image FROM listings WHERE id = ?', [id], (err, row) => {
    if (err) return res.status(500).send('DB error');
    if (!row) return res.status(404).send('Not found');
    if (row.user_id !== req.user.id) return res.status(403).send('Forbidden');
    const image = req.file ? `uploads/${path.basename(req.file.path)}` : row.image;
    db.run('UPDATE listings SET title=?,description=?,price=?,image=? WHERE id=?', [title, description, parseFloat(price) || 0, image, id], function(uerr) {
      if (uerr) return res.status(500).send('Update failed');
      res.json({ updated: this.changes });
    });
  });
});

// delete listing (only owner)
app.delete('/listings/:id', authMiddleware, (req, res) => {
  const id = Number(req.params.id);
  db.get('SELECT user_id, image FROM listings WHERE id = ?', [id], (err, row) => {
    if (err) return res.status(500).send('DB error');
    if (!row) return res.status(404).send('Not found');
    if (row.user_id !== req.user.id) return res.status(403).send('Forbidden');
    db.run('DELETE FROM listings WHERE id = ?', [id], function(derr) {
      if (derr) return res.status(500).send('Delete failed');
      // attempt unlink image file if exists
      if (row.image) {
        const imgPath = path.join(__dirname, 'public', row.image);
        fs.unlink(imgPath, () => {});
      }
      res.json({ deleted: this.changes });
    });
  });
});

// current user info
app.get('/me', authMiddleware, (req, res) => {
  db.get('SELECT id, name, email FROM users WHERE id = ?', [req.user.id], (err, row) => {
    if (err) return res.status(500).send('DB error');
    res.json(row || {});
  });
});

// my listings
app.get('/my-listings', authMiddleware, (req, res) => {
  db.all('SELECT * FROM listings WHERE user_id = ? ORDER BY created_at DESC', [req.user.id], (err, rows) => {
    if (err) return res.status(500).send('DB error');
    res.json(rows);
  });
});

app.get('/search', (req, res) => {
  const q = (req.query.q || '').trim();
  if (!q) {
    // return recent listings
    db.all('SELECT * FROM listings ORDER BY created_at DESC LIMIT 40', [], (err, rows) => {
      if (err) return res.status(500).send('DB error');
      res.json(rows);
    });
    return;
  }
  const like = `%${q.replace(/%/g,'') }%`;
  db.all('SELECT * FROM listings WHERE title LIKE ? OR description LIKE ? ORDER BY created_at DESC LIMIT 100', [like, like], (err, rows) => {
    if (err) return res.status(500).send('DB error');
    res.json(rows);
  });
});

app.get('/listings', (req, res) => {
  db.all('SELECT * FROM listings ORDER BY created_at DESC LIMIT 100', [], (err, rows) => {
    if (err) return res.status(500).send('DB error');
    res.json(rows);
  });
});

const port = process.env.PORT || 3000;
app.listen(port, () => console.log('Server listening on', port));
