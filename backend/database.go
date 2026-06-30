package main

import (
	"database/sql"
	"log"
	"time"

	_ "github.com/mattn/go-sqlite3"
)

type Database struct {
	db *sql.DB
}

func NewDatabase(path string) (*Database, error) {
	db, err := sql.Open("sqlite3", path+"?_journal_mode=WAL&_busy_timeout=5000")
	if err != nil {
		return nil, err
	}

	if err := db.Ping(); err != nil {
		return nil, err
	}

	d := &Database{db: db}
	if err := d.migrate(); err != nil {
		return nil, err
	}

	go d.cleanup()
	return d, nil
}

func (d *Database) migrate() error {
	_, err := d.db.Exec(`
		CREATE TABLE IF NOT EXISTS query_logs (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
			client_ip TEXT NOT NULL,
			domain TEXT NOT NULL,
			query_type TEXT NOT NULL,
			blocked BOOLEAN NOT NULL DEFAULT 0,
			duration_ms INTEGER NOT NULL DEFAULT 0
		);
		CREATE INDEX IF NOT EXISTS idx_timestamp ON query_logs(timestamp);
		CREATE INDEX IF NOT EXISTS idx_blocked ON query_logs(blocked);
		CREATE INDEX IF NOT EXISTS idx_domain ON query_logs(domain);
		CREATE INDEX IF NOT EXISTS idx_client_ip ON query_logs(client_ip);
	`)
	return err
}

func (d *Database) LogQuery(clientIP, domain, queryType string, blocked bool, durationMs int64) {
	_, err := d.db.Exec(
		"INSERT INTO query_logs (client_ip, domain, query_type, blocked, duration_ms) VALUES (?, ?, ?, ?, ?)",
		clientIP, domain, queryType, blocked, durationMs,
	)
	if err != nil {
		log.Printf("Failed to log query: %v", err)
	}
}

func (d *Database) GetStats() Stats {
	var s Stats

	d.db.QueryRow("SELECT COUNT(*) FROM query_logs").Scan(&s.TotalQueries)
	d.db.QueryRow("SELECT COUNT(*) FROM query_logs WHERE blocked = 1").Scan(&s.BlockedCount)

	if s.TotalQueries > 0 {
		s.BlockedPct = float64(s.BlockedCount) / float64(s.TotalQueries) * 100
	}

	rows, err := d.db.Query(`
		SELECT domain, COUNT(*) as cnt FROM query_logs
		WHERE timestamp > datetime('now', '-24 hours')
		GROUP BY domain ORDER BY cnt DESC LIMIT 10
	`)
	if err == nil {
		defer rows.Close()
		for rows.Next() {
			var dc DomainCount
			rows.Scan(&dc.Domain, &dc.Count)
			s.TopDomains = append(s.TopDomains, dc)
		}
	}

	rows2, err := d.db.Query(`
		SELECT client_ip, COUNT(*) as cnt FROM query_logs
		WHERE timestamp > datetime('now', '-24 hours')
		GROUP BY client_ip ORDER BY cnt DESC LIMIT 10
	`)
	if err == nil {
		defer rows2.Close()
		for rows2.Next() {
			var cc ClientCount
			rows2.Scan(&cc.ClientIP, &cc.Count)
			s.TopClients = append(s.TopClients, cc)
		}
	}

	rows3, err := d.db.Query(`
		SELECT strftime('%Y-%m-%dT%H:00:00Z', timestamp) as hour,
			COUNT(*) as total,
			SUM(CASE WHEN blocked THEN 1 ELSE 0 END) as blocked
		FROM query_logs
		WHERE timestamp > datetime('now', '-24 hours')
		GROUP BY hour ORDER BY hour
	`)
	if err == nil {
		defer rows3.Close()
		for rows3.Next() {
			var tb TimeBucket
			rows3.Scan(&tb.Hour, &tb.Total, &tb.Blocked)
			s.QueriesLast24 = append(s.QueriesLast24, tb)
		}
	}

	return s
}

func (d *Database) cleanup() {
	ticker := time.NewTicker(1 * time.Hour)
	for range ticker.C {
		d.db.Exec("DELETE FROM query_logs WHERE timestamp < datetime('now', '-7 days')")
		_, err := d.db.Exec("VACUUM")
		if err != nil {
			log.Printf("Vacuum error: %v", err)
		}
	}
}

func (d *Database) Close() {
	d.db.Close()
}
