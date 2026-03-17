package main

import (
	"sync"
	"time"
)

type cacheEntry struct {
	value     any
	expiresAt time.Time
}

type ttlCache struct {
	mu      sync.RWMutex
	entries map[string]cacheEntry
}

func newTTLCache() *ttlCache {
	return &ttlCache{
		entries: make(map[string]cacheEntry),
	}
}

func (c *ttlCache) GetOrSet(key string, ttl time.Duration, loader func() (any, error)) (any, error) {
	if ttl > 0 {
		if value, ok := c.get(key); ok {
			return value, nil
		}
	}

	value, err := loader()
	if err != nil {
		return nil, err
	}

	if ttl > 0 {
		c.set(key, value, ttl)
	}

	return value, nil
}

func (c *ttlCache) get(key string) (any, bool) {
	c.mu.RLock()
	entry, ok := c.entries[key]
	c.mu.RUnlock()
	if !ok {
		return nil, false
	}

	if time.Now().After(entry.expiresAt) {
		c.mu.Lock()
		current, exists := c.entries[key]
		if exists && time.Now().After(current.expiresAt) {
			delete(c.entries, key)
		}
		c.mu.Unlock()
		return nil, false
	}

	return entry.value, true
}

func (c *ttlCache) set(key string, value any, ttl time.Duration) {
	c.mu.Lock()
	c.entries[key] = cacheEntry{
		value:     value,
		expiresAt: time.Now().Add(ttl),
	}
	c.mu.Unlock()
}
