import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import mysql from 'mysql2/promise';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(__dirname));

const {
  DB_HOST = 'localhost',
  DB_PORT = '3306',
  DB_USER = 'root',
  DB_PASSWORD = '',
  DB_NAME = 'Library'
} = process.env;

let pool;

async function ensureDatabaseAndSchema() {
  const connection = await mysql.createConnection({
    host: DB_HOST,
    port: Number(DB_PORT),
    user: DB_USER,
    password: DB_PASSWORD,
    multipleStatements: true
  });

  // Create database if not exists
  await connection.query(`CREATE DATABASE IF NOT EXISTS \`${DB_NAME}\`;`);
  await connection.query(`USE \`${DB_NAME}\`;`);

  // Read and execute schema file
  const schemaPath = path.join(__dirname, 'dbschema.sql');
  if (fs.existsSync(schemaPath)) {
    const raw = fs.readFileSync(schemaPath, 'utf8');
    // Remove comments and empty lines safely, but keep statements order
    const statements = raw
      .split(/;\s*[\r\n]+/g)
      .map(s => s.trim())
      .filter(s => s.length > 0 && !s.toLowerCase().startsWith('--'));

    for (const stmt of statements) {
      // Skip CREATE DATABASE/USE if present in file, we already handled
      const lower = stmt.toLowerCase();
      // Also skip DROP DATABASE to avoid dropping the active DB during server start
      if (
        lower.startsWith('create database') ||
        lower.startsWith('use ') ||
        lower.startsWith('drop database')
      ) {
        continue;
      }
      await connection.query(stmt);
    }
  }

  await connection.end();
}

async function createPool() {
  pool = mysql.createPool({
    host: DB_HOST,
    port: Number(DB_PORT),
    user: DB_USER,
    password: DB_PASSWORD,
    database: DB_NAME,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
  });
}

// API routes
app.get('/api/books', async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM books ORDER BY book_id ASC');
    res.json(rows);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.get('/api/members', async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM members ORDER BY member_id ASC');
    res.json(rows);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/books', async (req, res) => {
  try {
    const {
      title,
      author,
      pages,
      year_published,
      category,
      quantity = 0,
      status = 0
    } = req.body || {};

    if (!title || !author || !pages || !year_published || !category) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const pagesNum = Number(pages);
    const yearNum = Number(year_published);
    const qtyNum = Number(quantity);
    const statusNum = Number(status);

    if (Number.isNaN(pagesNum) || Number.isNaN(yearNum) || Number.isNaN(qtyNum) || Number.isNaN(statusNum)) {
      return res.status(400).json({ error: 'Numeric fields are invalid' });
    }

    const [result] = await pool.execute(
      `INSERT INTO books (title, author, pages, year_published, status, category, quantity)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [title, author, pagesNum, yearNum, statusNum, category, qtyNum]
    );

    const [rows] = await pool.query('SELECT * FROM books WHERE book_id = ?', [result.insertId]);
    res.status(201).json(rows[0]);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.put('/api/books/:id', async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (Number.isNaN(id)) return res.status(400).json({ error: 'Invalid id' });
    const allowed = ['title', 'author', 'pages', 'year_published', 'status', 'category', 'quantity'];
    const data = req.body || {};
    const fields = [];
    const values = [];
    for (const key of allowed) {
      if (data[key] !== undefined && data[key] !== null && data[key] !== '') {
        fields.push(`${key} = ?`);
        if (['pages','year_published','status','quantity'].includes(key)) {
          values.push(Number(data[key]));
        } else {
          values.push(data[key]);
        }
      }
    }
    if (fields.length === 0) return res.status(400).json({ error: 'No fields to update' });
    values.push(id);
    await pool.execute(`UPDATE books SET ${fields.join(', ')} WHERE book_id = ?`, values);
    const [rows] = await pool.query('SELECT * FROM books WHERE book_id = ?', [id]);
    if (!rows[0]) return res.status(404).json({ error: 'Book not found' });
    res.json(rows[0]);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.delete('/api/books/:id', async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (Number.isNaN(id)) return res.status(400).json({ error: 'Invalid id' });
    // Check if book exists
    const [[book]] = await pool.query('SELECT status FROM books WHERE book_id = ?', [id]);
    if (!book) return res.status(404).json({ error: 'Sách không tồn tại để xóa.' });
    // Check if book is being borrowed (status = 1)
    if (book.status === 1) {
      return res.status(409).json({ error: 'Không thể xóa. Sách này đang được mượn.' });
    }
    const [result] = await pool.execute('DELETE FROM books WHERE book_id = ?', [id]);
    if (result.affectedRows === 0) return res.status(404).json({ error: 'Book not found' });
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Search books endpoints
app.get('/api/books/search/id/:id', async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (Number.isNaN(id)) return res.status(400).json({ error: 'Invalid id' });
    const [rows] = await pool.query('SELECT * FROM books WHERE book_id = ?', [id]);
    if (rows.length === 0) return res.json(null);
    res.json(rows[0]);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.get('/api/books/search/title', async (req, res) => {
  try {
    const { title } = req.query;
    if (!title) return res.status(400).json({ error: 'Missing title parameter' });
    const [rows] = await pool.query('SELECT * FROM books WHERE title = ?', [title]);
    if (rows.length === 0) return res.json(null);
    res.json(rows[0]);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.get('/api/books/search/keyword', async (req, res) => {
  try {
    const { keyword } = req.query;
    if (!keyword) return res.status(400).json({ error: 'Missing keyword parameter' });
    const [rows] = await pool.query('SELECT * FROM books WHERE title LIKE ?', [`%${keyword}%`]);
    res.json(rows);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.get('/api/borrowing', async (req, res) => {
  try {
    const [rows] = await pool.query(`
      SELECT b.borrowing_id, m.name AS member_name, bk.title AS book_title, b.borrow_date, b.due_date, b.return_date
      FROM borrowing b
      JOIN members m ON m.member_id = b.member_id
      JOIN books bk ON bk.book_id = b.book_id
      ORDER BY b.borrow_date DESC, b.borrowing_id DESC
    `);
    res.json(rows);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.get('/api/stats', async (req, res) => {
  try {
    const [[{ total_books }]] = await pool.query('SELECT COUNT(*) AS total_books FROM books');
    const [[{ total_members }]] = await pool.query('SELECT COUNT(*) AS total_members FROM members');
    const [[{ currently_borrowed }]] = await pool.query('SELECT COUNT(*) AS currently_borrowed FROM borrowing WHERE return_date IS NULL');
    const [[{ overdue }]] = await pool.query('SELECT COUNT(*) AS overdue FROM borrowing WHERE return_date IS NULL AND due_date < CURRENT_DATE()');
    res.json({ total_books, total_members, currently_borrowed, overdue });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Members
app.post('/api/members', async (req, res) => {
  try {
    const { name, email = null, status = 'active' } = req.body || {};
    if (!name) return res.status(400).json({ error: 'Missing name' });
    const [result] = await pool.execute(
      'INSERT INTO members (name, email, status) VALUES (?, ?, ?)',
      [name, email, status]
    );
    const [rows] = await pool.query('SELECT * FROM members WHERE member_id = ?', [result.insertId]);
    res.status(201).json(rows[0]);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.delete('/api/members/:id', async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (Number.isNaN(id)) return res.status(400).json({ error: 'Invalid id' });
    // Prevent deleting if member has active borrowings
    const [[{ cnt }]] = await pool.query(
      'SELECT COUNT(*) AS cnt FROM borrowing WHERE member_id = ? AND return_date IS NULL',
      [id]
    );
    if (cnt > 0) return res.status(409).json({ error: 'Member has active borrowings' });
    const [result] = await pool.execute('DELETE FROM members WHERE member_id = ?', [id]);
    if (result.affectedRows === 0) return res.status(404).json({ error: 'Member not found' });
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.put('/api/members/:id', async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (Number.isNaN(id)) return res.status(400).json({ error: 'Invalid id' });
    const allowed = ['name','email','status'];
    const data = req.body || {};
    const fields = [];
    const values = [];
    for (const key of allowed) {
      if (data[key] !== undefined && data[key] !== null && data[key] !== '') {
        fields.push(`${key} = ?`);
        values.push(data[key]);
      }
    }
    if (fields.length === 0) return res.status(400).json({ error: 'No fields to update' });
    values.push(id);
    await pool.execute(`UPDATE members SET ${fields.join(', ')} WHERE member_id = ?`, values);
    const [rows] = await pool.query('SELECT * FROM members WHERE member_id = ?', [id]);
    if (!rows[0]) return res.status(404).json({ error: 'Member not found' });
    res.json(rows[0]);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Search members endpoints
app.get('/api/members/search/id/:id', async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (Number.isNaN(id)) return res.status(400).json({ error: 'Invalid id' });
    const [rows] = await pool.query('SELECT * FROM members WHERE member_id = ?', [id]);
    if (rows.length === 0) return res.json(null);
    res.json(rows[0]);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.get('/api/members/search/name', async (req, res) => {
  try {
    const { keyword } = req.query;
    if (!keyword) return res.status(400).json({ error: 'Missing keyword parameter' });
    const [rows] = await pool.query('SELECT * FROM members WHERE name LIKE ?', [`%${keyword}%`]);
    res.json(rows);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Borrow a book
app.post('/api/borrow', async (req, res) => {
  const { member_id, book_id, days = 7 } = req.body || {};
  const memberId = Number(member_id);
  const bookId = Number(book_id);
  const daysNum = Number(days);
  if (Number.isNaN(memberId) || Number.isNaN(bookId) || Number.isNaN(daysNum)) {
    return res.status(400).json({ error: 'Invalid member_id/book_id/days' });
  }
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const [[book]] = await conn.query('SELECT quantity FROM books WHERE book_id = ? FOR UPDATE', [bookId]);
    if (!book) {
      await conn.rollback();
      return res.status(404).json({ error: 'Book not found' });
    }
    if ((book.quantity ?? 0) <= 0) {
      await conn.rollback();
      return res.status(409).json({ error: 'Book out of stock' });
    }
    // ensure member exists
    const [[m]] = await conn.query('SELECT member_id FROM members WHERE member_id = ?', [memberId]);
    if (!m) {
      await conn.rollback();
      return res.status(404).json({ error: 'Member not found' });
    }
    await conn.execute('UPDATE books SET quantity = quantity - 1 WHERE book_id = ?', [bookId]);
    await conn.execute(
      `INSERT INTO borrowing (member_id, book_id, borrow_date, due_date, return_date)
       VALUES (?, ?, CURRENT_DATE(), DATE_ADD(CURRENT_DATE(), INTERVAL ? DAY), NULL)`,
      [memberId, bookId, daysNum]
    );
    await conn.commit();
    res.status(201).json({ success: true });
  } catch (e) {
    await conn.rollback();
    res.status(500).json({ error: e.message });
  } finally {
    conn.release();
  }
});

// Return a book (supports both borrowing_id and member_id+book_id)
app.post('/api/return', async (req, res) => {
  const { borrowing_id, member_id, book_id } = req.body || {};
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    let bor;
    
    if (borrowing_id) {
      // Use borrowing_id if provided
      const id = Number(borrowing_id);
      if (Number.isNaN(id)) {
        await conn.rollback();
        return res.status(400).json({ error: 'Invalid borrowing_id' });
      }
      const [rows] = await conn.query(
        'SELECT borrowing_id, book_id, return_date FROM borrowing WHERE borrowing_id = ? FOR UPDATE',
        [id]
      );
      bor = rows[0];
    } else if (member_id && book_id) {
      // Use member_id and book_id (matches Python logic)
      const memId = Number(member_id);
      const bkId = Number(book_id);
      if (Number.isNaN(memId) || Number.isNaN(bkId)) {
        await conn.rollback();
        return res.status(400).json({ error: 'Invalid member_id or book_id' });
      }
      const [rows] = await conn.query(
        `SELECT borrowing_id, book_id, return_date FROM borrowing 
         WHERE member_id = ? AND book_id = ? AND return_date IS NULL 
         ORDER BY borrow_date DESC LIMIT 1 FOR UPDATE`,
        [memId, bkId]
      );
      bor = rows[0];
    } else {
      await conn.rollback();
      return res.status(400).json({ error: 'Either borrowing_id or (member_id + book_id) required' });
    }
    
    if (!bor) {
      await conn.rollback();
      return res.status(404).json({ error: 'Borrowing not found' });
    }
    if (bor.return_date) {
      await conn.rollback();
      return res.status(409).json({ error: 'Already returned' });
    }
    
    const borId = bor.borrowing_id || Number(borrowing_id);
    await conn.execute('UPDATE borrowing SET return_date = CURRENT_DATE() WHERE borrowing_id = ?', [borId]);
    await conn.execute('UPDATE books SET quantity = quantity + 1 WHERE book_id = ?', [bor.book_id]);
    await conn.commit();
    res.json({ success: true });
  } catch (e) {
    await conn.rollback();
    res.status(500).json({ error: e.message });
  } finally {
    conn.release();
  }
});

// Get overdue books (with borrower info)
app.get('/api/overdue', async (req, res) => {
  try {
    const [rows] = await pool.query(`
      SELECT m.member_id, m.name AS member_name, b.book_id, b.title,
             bo.borrow_date, bo.due_date, 
             DATEDIFF(CURRENT_DATE(), bo.due_date) AS days_overdue
      FROM borrowing bo
      JOIN books b ON b.book_id = bo.book_id
      JOIN members m ON m.member_id = bo.member_id
      WHERE bo.return_date IS NULL AND bo.due_date < CURRENT_DATE()
      ORDER BY days_overdue DESC
    `);
    res.json(rows);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Get member borrowing history
app.get('/api/members/:id/history', async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (Number.isNaN(id)) return res.status(400).json({ error: 'Invalid member id' });
    const [rows] = await pool.query(`
      SELECT b.book_id, b.title, b.author, bo.borrow_date, bo.due_date, bo.return_date
      FROM borrowing bo
      JOIN books b ON b.book_id = bo.book_id
      WHERE bo.member_id = ?
      ORDER BY bo.borrow_date DESC
    `, [id]);
    res.json(rows);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Get currently borrowed books by member (with book_id)
app.get('/api/members/:id/currently-borrowed', async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (Number.isNaN(id)) return res.status(400).json({ error: 'Invalid member id' });
    const [rows] = await pool.query(`
      SELECT b.book_id, b.title, b.author
      FROM borrowing bo
      JOIN books b ON b.book_id = bo.book_id
      WHERE bo.member_id = ? AND bo.return_date IS NULL
    `, [id]);
    res.json(rows);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Get all currently borrowed books report
app.get('/api/currently-borrowed', async (req, res) => {
  try {
    const [rows] = await pool.query(`
      SELECT m.name AS member_name, b.title, bo.borrow_date, bo.due_date
      FROM borrowing bo
      JOIN books b ON b.book_id = bo.book_id
      JOIN members m ON m.member_id = bo.member_id
      WHERE bo.return_date IS NULL
      ORDER BY bo.due_date ASC
    `);
    res.json(rows);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Serve index.html by default for convenience
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

const PORT = process.env.PORT || 3000;

(async () => {
  try {
    await ensureDatabaseAndSchema();
    await createPool();
    app.listen(PORT, () => {
      console.log(`Server running at http://localhost:${PORT}`);
    });
  } catch (e) {
    console.error('Failed to start server:', e);
    process.exit(1);
  }
})();


