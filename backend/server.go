package main

import (
	"log"
	"net"
	"time"

	"github.com/miekg/dns"
)

type DNSServer struct {
	upstream  string
	firewall  *Firewall
	db        *Database
	clients   *ClientManager
}

func NewDNSServer(upstream string, firewall *Firewall, db *Database, clients *ClientManager) *DNSServer {
	return &DNSServer{
		upstream:  upstream,
		firewall:  firewall,
		db:        db,
		clients:   clients,
	}
}

func (s *DNSServer) handleDNS(w dns.ResponseWriter, r *dns.Msg) {
	start := time.Now()

	if len(r.Question) == 0 {
		return
	}

	q := r.Question[0]
	domain := q.Name
	clientIP := ParseClientIP(w.RemoteAddr().String())

	m := new(dns.Msg)
	m.SetReply(r)
	m.Authoritative = false

	if s.firewall.IsBlocked(domain) {
		m.Rcode = dns.RcodeNameError
		m.Ns = []dns.RR{}

		duration := time.Since(start).Milliseconds()
		s.db.LogQuery(clientIP, domain, dns.TypeToString[q.Qtype], true, duration)

		s.clients.Broadcast(WSMessage{
			Type: "query",
			Data: map[string]interface{}{
				"client_ip": clientIP,
				"domain":    domain,
				"type":      dns.TypeToString[q.Qtype],
				"blocked":   true,
				"duration":  duration,
			},
		})

		w.WriteMsg(m)
		return
	}

	c := new(dns.Client)
	c.Net = "udp"
	c.DialTimeout = 3 * time.Second
	c.ReadTimeout = 3 * time.Second

	resp, _, err := c.Exchange(r, s.upstream)
	if err != nil {
		log.Printf("Upstream error for %s: %v", domain, err)
		m.Rcode = dns.RcodeServerFailure
		w.WriteMsg(m)
		return
	}

	resp.Id = r.Id
	resp.MsgHdr.Response = true

	duration := time.Since(start).Milliseconds()
	s.db.LogQuery(clientIP, domain, dns.TypeToString[q.Qtype], false, duration)

	s.clients.Broadcast(WSMessage{
		Type: "query",
		Data: map[string]interface{}{
			"client_ip": clientIP,
			"domain":    domain,
			"type":      dns.TypeToString[q.Qtype],
			"blocked":   false,
			"duration":  duration,
		},
	})

	w.WriteMsg(resp)
}

func (s *DNSServer) Start(addr string) error {
	handler := dns.NewServeMux()
	handler.HandleFunc(".", s.handleDNS)

	udpServer := &dns.Server{
		Addr:    addr,
		Net:     "udp",
		Handler: handler,
	}

	tcpServer := &dns.Server{
		Addr:    addr,
		Net:     "tcp",
		Handler: handler,
	}

	go func() {
		log.Printf("DNS server listening on %s (UDP)", addr)
		if err := udpServer.ListenAndServe(); err != nil {
			log.Fatalf("UDP DNS server error: %v", err)
		}
	}()

	go func() {
		log.Printf("DNS server listening on %s (TCP)", addr)
		if err := tcpServer.ListenAndServe(); err != nil {
			log.Fatalf("TCP DNS server error: %v", err)
		}
	}()

	select {}
}

func (s *DNSServer) lookup(domain string) ([]net.IP, error) {
	m := new(dns.Msg)
	m.SetQuestion(dns.Fqdn(domain), dns.TypeA)
	m.RecursionDesired = true

	c := new(dns.Client)
	resp, _, err := c.Exchange(m, s.upstream)
	if err != nil {
		return nil, err
	}

	var ips []net.IP
	for _, ans := range resp.Answer {
		if a, ok := ans.(*dns.A); ok {
			ips = append(ips, a.A)
		}
	}
	return ips, nil
}
