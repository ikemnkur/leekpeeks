const express = require('express');
const mysql = require('mysql2/promise');
const bodyParser = require('body-parser');
const geoip = require('geoip-lite');
require('dotenv').config();
// const express = require('express');
const path = require('path');
// const bodyParser = require('body-parser');
const session = require('express-session');
// const mysql = require('mysql2');
const cors = require('cors');  // Import CORS
// require('dotenv').config(); 

const app = express();
app.use(bodyParser.json());
const port = process.env.PORT || 3000;

// MySQL connection pool
const pool = mysql.createPool({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    port: process.env.DB_PORT,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
});

app.use(express.json());
app.use(express.static('public'));
app.use(session({
    secret: 'your_secret_key',
    resave: false,
    saveUninitialized: true
  }));


// Middleware to get user's IP and location
const getUserInfo = (req, res, next) => {
    req.userInfo = {
      ip: req.ip,
      location: 'Unknown', // You'd need to implement IP geolocation here
      nickname: req.headers['x-user-nickname'] || 'Anonymous'
    };
    next();
  };

// Middleware to get user's IP and location
app.use((req, res, next) => {
    const ip = req.ip || req.connection.remoteAddress;
    const geo = geoip.lookup(ip);
    req.userIp = ip;
    req.userLocation = geo ? `${geo.city}, ${geo.country}` : 'Unknown';
    next();
});

// API routes
app.post('/api/user', async (req, res) => {
    const { nickname } = req.body;
    try {
        await pool.query('INSERT INTO users (nickname) VALUES (?)', [nickname]);
        res.status(201).json({ message: 'User created' });
    } catch (error) {
        console.error('Error creating user:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

app.get('/api/images/random', async (req, res) => {
    const count = parseInt(req.query.count) || 9;
    try {
        const [rows] = await pool.query('SELECT * FROM images ORDER BY RAND() LIMIT ?', [count]);
        res.json(rows);
    } catch (error) {
        console.error('Error fetching random images:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});


app.post('/api/search', async (req, res) => {
    const { term } = req.body;
    console.log(req.body.userId)
    const userId = req.body.userId
    try {
        await pool.query('INSERT INTO searches (user_id, term, ip_address, location) VALUES (?, ?, ?, ?)',
            [userId, term, req.userIp, req.userLocation]);
        res.status(201).json({ message: 'Search recorded' });
    } catch (error) {
        console.error('Error recording search:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

app.get('/api/images/search', async (req, res) => {
    const { term } = req.query;
    try {
        const [rows] = await pool.query('SELECT * FROM images WHERE name LIKE ?', [`%${term}%`]);
        res.json(rows);
    } catch (error) {
        console.error('Error searching images:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

app.get('/api/image/:id', async (req, res) => {
    const { id } = req.params;
    const userId = req.body.userId
    try {
        const [rows] = await pool.query('SELECT * FROM images WHERE id = ?', [id]);
        if (rows.length === 0) {
            return res.status(404).json({ error: 'Image not found' });
        }
        const image = rows[0];

        // Record view
        await pool.query('INSERT INTO views (image_id, user_id, ip_address, location) VALUES (?, ?, ?, ?)',
            [id, userId, req.userIp, req.userLocation]);

        // Update view count
        await pool.query('UPDATE images SET views = views + 1 WHERE id = ?', [id]);

        image.views += 1;
        res.json(image);
    } catch (error) {
        console.error('Error fetching image:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

app.post('/api/image/:id/like', async (req, res) => {
    const { id } = req.params;
    try {
        await pool.query('UPDATE images SET likes = likes + 1 WHERE id = ?', [id]);
        const [rows] = await pool.query('SELECT likes FROM images WHERE id = ?', [id]);
        res.json({ likes: rows[0].likes });
    } catch (error) {
        console.error('Error liking image:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

app.post('/api/image/:id/dislike', async (req, res) => {
    const { id } = req.params;
    try {
        await pool.query('UPDATE images SET dislikes = dislikes + 1 WHERE id = ?', [id]);
        const [rows] = await pool.query('SELECT dislikes FROM images WHERE id = ?', [id]);
        res.json({ dislikes: rows[0].dislikes });
    } catch (error) {
        console.error('Error disliking image:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

app.post('/api/image/:id/comment', async (req, res) => {
    const { id } = req.params;
    const { comment } = req.body;
    const userId = req.body.userId
    try {
        await pool.query('INSERT INTO comments (image_id, user_id, comment) VALUES (?, ?, ?)', [id, userId, comment]);
        res.status(201).json({ message: 'Comment added' });
    } catch (error) {
        console.error('Error adding comment:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

app.get('/api/image/:id/comments', async (req, res) => {
    const { id } = req.params;
    try {
        const [rows] = await pool.query(`
      SELECT c.*, u.nickname 
      FROM comments c 
      JOIN users u ON c.user_id = u.id 
      WHERE c.image_id = ? 
      ORDER BY c.id DESC
    `, [id]);
        res.json(rows);
    } catch (error) {
        console.error('Error fetching comments:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});


app.use(getUserInfo);

// Routes
app.get('/api/image/:id', async (req, res) => {
    const [rows] = await pool.query('SELECT * FROM images WHERE id = ?', [req.params.id]);
    if (rows.length === 0) return res.status(404).json({ error: 'Image not found' });

    // Record view
    await pool.query('INSERT INTO views (image_id, user_id, ip_address, location) VALUES (?, ?, ?, ?)',
        [req.params.id, null, req.userInfo.ip, req.userInfo.location]);

    res.json(rows[0]);
});

app.post('/api/image/:id/like', async (req, res) => {
    await pool.query('UPDATE images SET likes = likes + 1 WHERE id = ?', [req.params.id]);
    res.sendStatus(200);
});

app.post('/api/image/:id/dislike', async (req, res) => {
    await pool.query('UPDATE images SET dislikes = dislikes + 1 WHERE id = ?', [req.params.id]);
    res.sendStatus(200);
});

app.post('/api/image/:id/comment', async (req, res) => {
    const { comment } = req.body;
    await pool.query('INSERT INTO comments (image_id, user_id, comment) VALUES (?, ?, ?)',
        [req.params.id, null, comment]);
    res.sendStatus(200);
});

app.get('/api/image/:id/comments', async (req, res) => {
    const [rows] = await pool.query('SELECT * FROM comments WHERE image_id = ?', [req.params.id]);
    res.json(rows);
});

app.get('/api/slideshow/:person', async (req, res) => {
    const [rows] = await pool.query('SELECT * FROM images WHERE name = ?', [req.params.person]);
    res.json(rows);
});

app.get('/api/search', async (req, res) => {
    const { query } = req.query;
    const [rows] = await pool.query('SELECT * FROM images WHERE name LIKE ?', [`%${query}%`]);

    // Record search
    await pool.query('INSERT INTO searches (query, user_id, ip_address, location) VALUES (?, ?, ?, ?)',
        [query, null, req.userInfo.ip, req.userInfo.location]);

    res.json(rows);
});



// Serve index.html for all other routes
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(port, () => {
    console.log(`Server running on port ${port}`);
});
