package main

import (
	"bufio"
	"fmt"
	"log"
	"net/netip"
	"os"
	"sort"
	"strings"
	"sync"
	"time"
)

type Firewall struct {
	mu        sync.RWMutex
	blocklist map[string]bool
	domains   []string
	updatedAt time.Time
}

func NewFirewall() *Firewall {
	f := &Firewall{
		blocklist: make(map[string]bool),
	}
	f.loadDefaults()
	return f
}

func (f *Firewall) loadDefaults() {
	builtin := []string{
		"doubleclick.net", "googlesyndication.com", "googleadservices.com",
		"google-analytics.com", "googletagmanager.com",
		"adsrvr.org", "adzerk.net", "analytics.twitter.com",
		"scorecardresearch.com", "outbrain.com", "taboola.com",
		"criteo.com", "criteo.net", "adnxs.com",
		"rubiconproject.com", "pubmatic.com", "openx.net",
		"casalemedia.com", "moatads.com", "amazon-adsystem.com",
		"adsafeprotected.com", "serving-sys.com", "lijit.com",
		"exelator.com", "dpm.demdex.net", "adsymptotic.com",
		"agkn.com", "bluekai.com", "rlcdn.com",
		"turn.com", "krxd.net", "adsnative.com",
		"advertising.com", "media.net", "contextweb.com",
		"bidswitch.net", "appnexus.com", "spotxchange.com",
		"sharethrough.com", "sovrn.com", "indexww.com",
		"sonobi.com", "rhythmone.com", "gumgum.com",
		"districtm.io", "improvedigital.com", "pubnative.net",
		"adform.com", "smartyads.com", "smartadserver.com",
		"onesignal.com", "branch.io", "adjust.com",
		"appsflyer.com", "amplitude.com", "mixpanel.com",
		"segment.io", "hotjar.com", "fullstory.com",
		"crazyegg.com", "mouseflow.com", "clicktale.net",
		"optimizely.com", "vwo.com", "abtasty.com",
		"mailchimp.com", "sendgrid.net", "hubspot.com",
		"intercom.io", "drift.com", "olark.com",
		"livechatinc.com", "tawk.to", "freshdesk.com",
		"zendesk.com", "jira.com", "trello.com",
		"pushbullet.com", "pushover.net", "box.com",
		"dropbox.com", "evernote.com", "slack.com",
	}
	for _, d := range builtin {
		f.blocklist[d] = true
	}
	f.domains = append(f.domains, builtin...)
}

func (f *Firewall) LoadBlocklist(path string) error {
	file, err := os.Open(path)
	if err != nil {
		return fmt.Errorf("open blocklist: %w", err)
	}
	defer file.Close()

	tmpBlocklist := make(map[string]bool)
	var tmpDomains []string

	scanner := bufio.NewScanner(file)
	count := 0
	for scanner.Scan() {
		line := strings.TrimSpace(scanner.Text())
		if line == "" || strings.HasPrefix(line, "#") {
			continue
		}
		domain := strings.ToLower(line)
		tmpBlocklist[domain] = true
		tmpDomains = append(tmpDomains, domain)
		count++
	}

	f.mu.Lock()
	f.blocklist = tmpBlocklist
	f.domains = tmpDomains
	f.updatedAt = time.Now()
	f.mu.Unlock()

	log.Printf("Loaded %d domains from blocklist", count)
	return scanner.Err()
}

func (f *Firewall) AllBlocks() []string {
	f.mu.RLock()
	defer f.mu.RUnlock()
	result := make([]string, len(f.domains))
	copy(result, f.domains)
	return result
}

func (f *Firewall) AddCustom(domain string) {
	f.mu.Lock()
	defer f.mu.Unlock()
	f.blocklist[strings.ToLower(domain)] = true
	f.domains = append(f.domains, domain)
}

func (f *Firewall) RemoveCustom(domain string) {
	f.mu.Lock()
	defer f.mu.Unlock()
	delete(f.blocklist, strings.ToLower(domain))
	// rebuild domains slice without the removed one
	d := strings.ToLower(domain)
	var kept []string
	for _, v := range f.domains {
		if strings.ToLower(v) != d {
			kept = append(kept, v)
		}
	}
	f.domains = kept
}

func (f *Firewall) IsBlocked(domain string) bool {
	f.mu.RLock()
	defer f.mu.RUnlock()

	d := strings.ToLower(strings.TrimSuffix(domain, "."))

	if f.blocklist[d] {
		return true
	}

	parts := strings.Split(d, ".")
	for i := 1; i < len(parts)-1; i++ {
		sub := strings.Join(parts[i:], ".")
		if f.blocklist[sub] {
			return true
		}
	}

	return false
}

func (f *Firewall) Count() int {
	f.mu.RLock()
	defer f.mu.RUnlock()
	return len(f.blocklist)
}

func (f *Firewall) Domains() []string {
	f.mu.RLock()
	defer f.mu.RUnlock()
	result := make([]string, len(f.domains))
	copy(result, f.domains)
	return result
}

func (f *Firewall) SearchDomains(q string, limit int) []string {
	f.mu.RLock()
	defer f.mu.RUnlock()
	if q == "" {
		return nil
	}
	q = strings.ToLower(q)
	var results []string
	for _, d := range f.domains {
		if strings.Contains(d, q) {
			results = append(results, d)
		}
	}
	sort.Strings(results)
	if len(results) > limit {
		results = results[:limit]
	}
	return results
}

func (f *Firewall) Stat() (total int, updated string) {
	f.mu.RLock()
	defer f.mu.RUnlock()
	return len(f.blocklist), f.updatedAt.Format(time.RFC3339)
}

func ParseClientIP(addr string) string {
	ipport, err := netip.ParseAddrPort(addr)
	if err != nil {
		return addr
	}
	return ipport.Addr().String()
}
