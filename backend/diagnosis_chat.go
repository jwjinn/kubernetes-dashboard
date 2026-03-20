package main

import (
	"bytes"
	"context"
	"encoding/json"
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

func (a *app) proxyDiagnosisChat(ctx context.Context, req diagnosisChatRequest) (string, error) {
	if strings.TrimSpace(a.mcpAgentBaseURL) == "" {
		return "", fmt.Errorf("mcp agent base URL is not configured")
	}

	payload := map[string]string{
		"message": buildDiagnosisPrompt(req.History, req.Message),
	}

	body, err := json.Marshal(payload)
	if err != nil {
		return "", fmt.Errorf("failed to marshal diagnosis request: %w", err)
	}

	requestCtx, cancel := context.WithTimeout(ctx, 90*time.Second)
	defer cancel()

	httpReq, err := http.NewRequestWithContext(requestCtx, http.MethodPost, a.mcpAgentBaseURL+"/api/chat", bytes.NewReader(body))
	if err != nil {
		return "", fmt.Errorf("failed to create mcp agent request: %w", err)
	}
	httpReq.Header.Set("Content-Type", "application/json")

	client := &http.Client{Timeout: 95 * time.Second}
	resp, err := client.Do(httpReq)
	if err != nil {
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

func buildDiagnosisPrompt(history []diagnosisChatMessage, latest string) string {
	if len(history) == 0 {
		return latest
	}

	var b strings.Builder
	b.WriteString("이전 대화 문맥:\n")
	for _, message := range history {
		role := strings.TrimSpace(message.Role)
		content := strings.TrimSpace(message.Content)
		if content == "" {
			continue
		}

		switch role {
		case "assistant":
			b.WriteString("Assistant: ")
		case "user":
			b.WriteString("User: ")
		default:
			b.WriteString("Message: ")
		}
		b.WriteString(content)
		b.WriteString("\n")
	}
	b.WriteString("\n현재 사용자 요청:\n")
	b.WriteString(strings.TrimSpace(latest))
	return b.String()
}
