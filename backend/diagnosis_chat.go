package main

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"
)

type diagnosisChatMessage struct {
	Role    string `json:"role"`
	Content string `json:"content"`
}

type diagnosisChatRequest struct {
	Message string                 `json:"message"`
	History []diagnosisChatMessage `json:"history,omitempty"`
}

type diagnosisChatResponse struct {
	Reply string `json:"reply"`
}

func (a *app) handleDiagnosisChat(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		writeError(w, http.StatusMethodNotAllowed, "method not allowed")
		return
	}

	var req diagnosisChatRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}

	req.Message = strings.TrimSpace(req.Message)
	if req.Message == "" {
		writeError(w, http.StatusBadRequest, "message is required")
		return
	}

	reply, err := a.proxyDiagnosisChat(r.Context(), req)
	if err != nil {
		writeError(w, http.StatusBadGateway, err.Error())
		return
	}

	writeJSON(w, http.StatusOK, diagnosisChatResponse{Reply: reply})
}

func (a *app) handleDiagnosisChatStream(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		writeError(w, http.StatusMethodNotAllowed, "method not allowed")
		return
	}

	var req diagnosisChatRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}

	req.Message = strings.TrimSpace(req.Message)
	if req.Message == "" {
		writeError(w, http.StatusBadRequest, "message is required")
		return
	}

	if err := a.proxyDiagnosisChatStream(w, r.Context(), req); err != nil {
		writeError(w, http.StatusBadGateway, err.Error())
	}
}

func (a *app) proxyDiagnosisChat(ctx context.Context, req diagnosisChatRequest) (string, error) {
	if strings.TrimSpace(a.mcpAgentBaseURL) == "" {
		return "", fmt.Errorf("mcp agent base URL is not configured")
	}

	payload := map[string]string{
		"message": req.Message,
	}

	body, err := json.Marshal(payload)
	if err != nil {
		return "", fmt.Errorf("failed to marshal diagnosis request: %w", err)
	}

	timeout := a.diagnosisChatTimeout
	if timeout <= 0 {
		timeout = 240 * time.Second
	}

	requestCtx, cancel := context.WithTimeout(ctx, timeout)
	defer cancel()

	httpReq, err := http.NewRequestWithContext(requestCtx, http.MethodPost, a.mcpAgentBaseURL+"/api/chat", bytes.NewReader(body))
	if err != nil {
		return "", fmt.Errorf("failed to create mcp agent request: %w", err)
	}
	httpReq.Header.Set("Content-Type", "application/json")

	client := &http.Client{Timeout: timeout + 5*time.Second}
	resp, err := client.Do(httpReq)
	if err != nil {
		if errors.Is(err, context.DeadlineExceeded) || errors.Is(requestCtx.Err(), context.DeadlineExceeded) {
			return "", fmt.Errorf("mcp agent response timed out after %s", timeout)
		}
		return "", fmt.Errorf("failed to reach mcp agent: %w", err)
	}
	defer resp.Body.Close()

	respBody, err := io.ReadAll(resp.Body)
	if err != nil {
		return "", fmt.Errorf("failed to read mcp agent response: %w", err)
	}
	if resp.StatusCode >= 400 {
		return "", fmt.Errorf("mcp agent returned %d: %s", resp.StatusCode, strings.TrimSpace(string(respBody)))
	}

	var payloadResp diagnosisChatResponse
	if err := json.Unmarshal(respBody, &payloadResp); err != nil {
		return "", fmt.Errorf("failed to decode mcp agent response: %w", err)
	}
	if strings.TrimSpace(payloadResp.Reply) == "" {
		return "", fmt.Errorf("mcp agent returned an empty reply")
	}

	return payloadResp.Reply, nil
}

func (a *app) proxyDiagnosisChatStream(w http.ResponseWriter, ctx context.Context, req diagnosisChatRequest) error {
	if strings.TrimSpace(a.mcpAgentBaseURL) == "" {
		return fmt.Errorf("mcp agent base URL is not configured")
	}

	payload := map[string]string{
		"message": req.Message,
	}

	body, err := json.Marshal(payload)
	if err != nil {
		return fmt.Errorf("failed to marshal diagnosis request: %w", err)
	}

	timeout := a.diagnosisChatTimeout
	if timeout <= 0 {
		timeout = 240 * time.Second
	}

	requestCtx, cancel := context.WithTimeout(ctx, timeout)
	defer cancel()

	httpReq, err := http.NewRequestWithContext(requestCtx, http.MethodPost, a.mcpAgentBaseURL+"/api/stream_chat", bytes.NewReader(body))
	if err != nil {
		return fmt.Errorf("failed to create mcp agent stream request: %w", err)
	}
	httpReq.Header.Set("Content-Type", "application/json")
	httpReq.Header.Set("Accept", "text/event-stream, application/x-ndjson, application/json")

	client := &http.Client{}
	resp, err := client.Do(httpReq)
	if err != nil {
		if errors.Is(err, context.DeadlineExceeded) || errors.Is(requestCtx.Err(), context.DeadlineExceeded) {
			return fmt.Errorf("mcp agent stream timed out after %s", timeout)
		}
		return fmt.Errorf("failed to reach mcp agent stream: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode >= 400 {
		respBody, readErr := io.ReadAll(resp.Body)
		if readErr != nil {
			return fmt.Errorf("mcp agent stream returned %d", resp.StatusCode)
		}
		return fmt.Errorf("mcp agent stream returned %d: %s", resp.StatusCode, strings.TrimSpace(string(respBody)))
	}

	contentType := strings.TrimSpace(resp.Header.Get("Content-Type"))
	if contentType == "" {
		contentType = "text/event-stream; charset=utf-8"
	}

	w.Header().Set("Content-Type", contentType)
	w.Header().Set("Cache-Control", "no-cache")
	w.Header().Set("Connection", "keep-alive")
	w.Header().Set("X-Accel-Buffering", "no")
	w.WriteHeader(http.StatusOK)

	flusher, ok := w.(http.Flusher)
	if !ok {
		return fmt.Errorf("streaming is not supported by the response writer")
	}

	buffer := make([]byte, 4096)
	for {
		n, readErr := resp.Body.Read(buffer)
		if n > 0 {
			if _, writeErr := w.Write(buffer[:n]); writeErr != nil {
				return nil
			}
			flusher.Flush()
		}

		if readErr == nil {
			continue
		}
		if readErr == io.EOF {
			return nil
		}
		if errors.Is(readErr, context.DeadlineExceeded) || errors.Is(requestCtx.Err(), context.DeadlineExceeded) {
			return nil
		}
		return nil
	}
}
