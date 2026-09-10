const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.resolve(__dirname, 'whatsapp.sqlite');
const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
        console.error('Error opening database', err.message);
    } else {
        console.log('Connected to the SQLite database.');
        
        // Initialize tables
        db.serialize(() => {
            db.run(`CREATE TABLE IF NOT EXISTS messages (
                id TEXT PRIMARY KEY,
                fromMe INTEGER,
                author TEXT,
                body TEXT,
                timestamp INTEGER,
                type TEXT,
                hasMedia INTEGER,
                isAudio INTEGER,
                transcription TEXT,
                tag TEXT,
                senderName TEXT
            )`);
            
            db.run(`CREATE TABLE IF NOT EXISTS contacts (
                id TEXT PRIMARY KEY,
                name TEXT,
                pushname TEXT,
                number TEXT
            )`);
            
            db.run(`CREATE TABLE IF NOT EXISTS chat_tags (
                chatId TEXT PRIMARY KEY,
                tag TEXT
            )`);
            
            db.run(`CREATE TABLE IF NOT EXISTS sessions (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                chatId TEXT,
                startTime INTEGER,
                endTime INTEGER,
                duration INTEGER
            )`);
        });
    }
});

module.exports = db;
