// napas-ss-proxy — a tiny local SOCKS5 front-end that tunnels TCP through a
// Shadowsocks server using the Outline SDK, with support for the Outline
// "prefix" (a salt prefix that disguises the first bytes as a TLS record so
// DPI does not recognise the Shadowsocks handshake). This is the same
// mechanism the official Outline / VanyaVPN client uses to pass Russian DPI.
//
// Usage: napas-ss-proxy -config <path-to-json> -listen 127.0.0.1:10810
// Config JSON: {"server","server_port","method","password","prefix"}
package main

import (
	"context"
	"encoding/json"
	"flag"
	"fmt"
	"io"
	"log"
	"net"
	"os"
	"strconv"

	"golang.getoutline.org/sdk/transport"
	"golang.getoutline.org/sdk/transport/shadowsocks"
)

type ssConfig struct {
	Server     string `json:"server"`
	ServerPort int    `json:"server_port"`
	Method     string `json:"method"`
	Password   string `json:"password"`
	Prefix     string `json:"prefix"`
}

func main() {
	configPath := flag.String("config", "", "path to shadowsocks JSON config")
	listen := flag.String("listen", "127.0.0.1:10810", "local SOCKS5 listen address")
	flag.Parse()

	if *configPath == "" {
		log.Fatal("missing -config")
	}
	raw, err := os.ReadFile(*configPath)
	if err != nil {
		log.Fatalf("read config: %v", err)
	}
	var cfg ssConfig
	if err := json.Unmarshal(raw, &cfg); err != nil {
		log.Fatalf("parse config: %v", err)
	}

	key, err := shadowsocks.NewEncryptionKey(cfg.Method, cfg.Password)
	if err != nil {
		log.Fatalf("cipher: %v", err)
	}

	serverAddr := net.JoinHostPort(cfg.Server, strconv.Itoa(cfg.ServerPort))
	endpoint := &transport.StreamDialerEndpoint{Dialer: &transport.TCPDialer{}, Address: serverAddr}
	sd, err := shadowsocks.NewStreamDialer(endpoint, key)
	if err != nil {
		log.Fatalf("dialer: %v", err)
	}

	// The Outline prefix: each rune of the JSON string is one raw byte (Latin-1).
	if cfg.Prefix != "" {
		prefix := make([]byte, 0, len(cfg.Prefix))
		for _, r := range cfg.Prefix {
			prefix = append(prefix, byte(r))
		}
		sd.SaltGenerator = shadowsocks.NewPrefixSaltGenerator(prefix)
	}

	ln, err := net.Listen("tcp", *listen)
	if err != nil {
		log.Fatalf("listen %s: %v", *listen, err)
	}
	// Signal readiness on stdout so the parent can wait for the port.
	fmt.Printf("napas-ss-proxy listening on %s -> %s\n", *listen, serverAddr)

	for {
		c, err := ln.Accept()
		if err != nil {
			continue
		}
		go handleSocks(c, sd)
	}
}

func handleSocks(c net.Conn, sd transport.StreamDialer) {
	defer c.Close()
	buf := make([]byte, 262)

	// Greeting: VER, NMETHODS, METHODS...
	if _, err := io.ReadFull(c, buf[:2]); err != nil || buf[0] != 5 {
		return
	}
	n := int(buf[1])
	if _, err := io.ReadFull(c, buf[:n]); err != nil {
		return
	}
	if _, err := c.Write([]byte{5, 0}); err != nil { // no auth
		return
	}

	// Request: VER, CMD, RSV, ATYP, ADDR, PORT
	if _, err := io.ReadFull(c, buf[:4]); err != nil {
		return
	}
	if buf[1] != 1 { // only CONNECT
		c.Write([]byte{5, 7, 0, 1, 0, 0, 0, 0, 0, 0})
		return
	}
	var host string
	switch buf[3] {
	case 1: // IPv4
		if _, err := io.ReadFull(c, buf[:4]); err != nil {
			return
		}
		host = net.IP(buf[:4]).String()
	case 3: // domain
		if _, err := io.ReadFull(c, buf[:1]); err != nil {
			return
		}
		l := int(buf[0])
		if _, err := io.ReadFull(c, buf[:l]); err != nil {
			return
		}
		host = string(buf[:l])
	case 4: // IPv6
		if _, err := io.ReadFull(c, buf[:16]); err != nil {
			return
		}
		host = net.IP(buf[:16]).String()
	default:
		c.Write([]byte{5, 8, 0, 1, 0, 0, 0, 0, 0, 0})
		return
	}
	if _, err := io.ReadFull(c, buf[:2]); err != nil {
		return
	}
	port := int(buf[0])<<8 | int(buf[1])
	target := net.JoinHostPort(host, strconv.Itoa(port))

	rc, err := sd.DialStream(context.Background(), target)
	if err != nil {
		c.Write([]byte{5, 1, 0, 1, 0, 0, 0, 0, 0, 0}) // general failure
		return
	}
	defer rc.Close()
	if _, err := c.Write([]byte{5, 0, 0, 1, 0, 0, 0, 0, 0, 0}); err != nil { // success
		return
	}

	// Relay both directions.
	go func() { io.Copy(rc, c); rc.CloseWrite() }()
	io.Copy(c, rc)
}
