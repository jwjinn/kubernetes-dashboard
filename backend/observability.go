package main

import (
	"bufio"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"net/url"
	"os"
	"strconv"
	"strings"
	"time"
)

type observabilityClient struct {
	logsBaseURL    string
	tracesBaseURL  string
	metricsBaseURL string
	httpClient     *http.Client
}

type promResponse struct {
	Status string `json:"status"`
	Data   struct {
		ResultType string       `json:"resultType"`
		Result     []promResult `json:"result"`
	} `json:"data"`
	Error string `json:"error"`
}

type promResult struct {
	Metric map[string]string `json:"metric"`
	Value  []any             `json:"value"`
	Values [][]any           `json:"values"`
}

type promSample struct {
	Timestamp time.Time
	Value     float64
}

type traceSearchResponse struct {
	Data []traceSummary `json:"data"`
}

type traceSummary struct {
	TraceID string `json:"traceID"`
	Spans   []struct {
		SpanID        string          `json:"spanID"`
		OperationName string          `json:"operationName"`
		StartTime     int64           `json:"startTime"`
		Duration      int64           `json:"duration"`
		ProcessID     string          `json:"processID"`
		Tags          []traceKeyValue `json:"tags"`
	} `json:"spans"`
	Processes map[string]traceProcess `json:"processes"`
}

type traceProcess struct {
	ServiceName string          `json:"serviceName"`
	Tags        []traceKeyValue `json:"tags"`
}

type traceKeyValue struct {
	Key   string `json:"key"`
	Type  string `json:"type"`
	Value any    `json:"value"`
}

func newObservabilityClient() *observabilityClient {
	return &observabilityClient{
		logsBaseURL:    strings.TrimRight(os.Getenv("LOGS_BASE_URL"), "/"),
		tracesBaseURL:  strings.TrimRight(os.Getenv("TRACES_BASE_URL"), "/"),
		metricsBaseURL: strings.TrimRight(os.Getenv("METRICS_BASE_URL"), "/"),
		httpClient: &http.Client{
			Timeout: 15 * time.Second,
		},
	}
}

func (c *observabilityClient) queryMetricsInstant(ctx context.Context, query string) ([]promResult, error) {
	return c.queryPrometheus(ctx, []string{
		"/select/0/prometheus/api/v1/query",
		"/prometheus/api/v1/query",
		"/api/v1/query",
	}, url.Values{
		"query": []string{query},
		"time":  []string{strconv.FormatInt(time.Now().Unix(), 10)},
	})
}

func (c *observabilityClient) queryMetricsRange(ctx context.Context, query string, start, end time.Time, step time.Duration) ([]promResult, error) {
	return c.queryPrometheus(ctx, []string{
		"/select/0/prometheus/api/v1/query_range",
		"/prometheus/api/v1/query_range",
		"/api/v1/query_range",
	}, url.Values{
		"query": []string{query},
		"start": []string{strconv.FormatInt(start.Unix(), 10)},
		"end":   []string{strconv.FormatInt(end.Unix(), 10)},
		"step":  []string{strconv.FormatInt(int64(step.Seconds()), 10)},
	})
}

func (c *observabilityClient) queryPrometheus(ctx context.Context, paths []string, values url.Values) ([]promResult, error) {
	if c == nil || c.metricsBaseURL == "" {
		return nil, fmt.Errorf("metrics base URL is not configured")
	}

	var lastErr error
	for _, path := range paths {
		req, err := http.NewRequestWithContext(ctx, http.MethodPost, c.metricsBaseURL+path, strings.NewReader(values.Encode()))
		if err != nil {
			return nil, err
		}
		req.Header.Set("Content-Type", "application/x-www-form-urlencoded")

		resp, err := c.httpClient.Do(req)
		if err != nil {
			lastErr = err
			continue
		}

		body, readErr := io.ReadAll(resp.Body)
		resp.Body.Close()
		if readErr != nil {
			lastErr = readErr
			continue
		}
		if resp.StatusCode >= 400 {
			lastErr = fmt.Errorf("metrics query failed on %s: %s", path, strings.TrimSpace(string(body)))
			continue
		}

		var payload promResponse
		if err := json.Unmarshal(body, &payload); err != nil {
			lastErr = fmt.Errorf("failed to decode prometheus response on %s: %w", path, err)
			continue
		}
		if payload.Status != "success" {
			lastErr = fmt.Errorf("prometheus API returned status %q on %s: %s", payload.Status, path, payload.Error)
			continue
		}
		return payload.Data.Result, nil
	}

	if lastErr == nil {
		lastErr = fmt.Errorf("metrics query failed")
	}
	return nil, lastErr
}

func (c *observabilityClient) queryLogs(ctx context.Context, query string, limit int) ([]map[string]any, error) {
	if c == nil || c.logsBaseURL == "" {
		return nil, fmt.Errorf("logs base URL is not configured")
	}

	values := url.Values{
		"query": []string{query},
		"limit": []string{strconv.Itoa(limit)},
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, c.logsBaseURL+"/select/logsql/query", strings.NewReader(values.Encode()))
	if err != nil {
		return nil, err
	}
	req.Header.Set("Content-Type", "application/x-www-form-urlencoded")

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode >= 400 {
		body, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("log query failed: %s", strings.TrimSpace(string(body)))
	}

	var records []map[string]any
	scanner := bufio.NewScanner(resp.Body)
	scanner.Buffer(make([]byte, 0, 1024), 1024*1024)
	for scanner.Scan() {
		line := strings.TrimSpace(scanner.Text())
		if line == "" {
			continue
		}

		var row map[string]any
		if err := json.Unmarshal([]byte(line), &row); err != nil {
			log.Printf("skipping undecodable log line: %v", err)
			continue
		}
		records = append(records, row)
	}

	if err := scanner.Err(); err != nil {
		return nil, err
	}
	return records, nil
}

func (c *observabilityClient) listTraceServices(ctx context.Context) ([]string, error) {
	if c == nil || c.tracesBaseURL == "" {
		return nil, fmt.Errorf("traces base URL is not configured")
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodGet, c.tracesBaseURL+"/select/jaeger/api/services", nil)
	if err != nil {
		return nil, err
	}

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode >= 400 {
		body, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("trace services query failed: %s", strings.TrimSpace(string(body)))
	}

	var payload struct {
		Data []string `json:"data"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&payload); err != nil {
		return nil, err
	}
	return payload.Data, nil
}

func (c *observabilityClient) searchTraces(ctx context.Context, service string, tags map[string]string, limit int, lookback time.Duration) ([]traceSummary, error) {
	if c == nil || c.tracesBaseURL == "" {
		return nil, fmt.Errorf("traces base URL is not configured")
	}

	tagBytes, err := json.Marshal(tags)
	if err != nil {
		return nil, err
	}

	values := url.Values{
		"service":     []string{service},
		"tags":        []string{string(tagBytes)},
		"limit":       []string{strconv.Itoa(limit)},
		"lookback":    []string{lookback.String()},
		"endTs":       []string{strconv.FormatInt(time.Now().UnixMilli(), 10)},
		"startTs":     []string{strconv.FormatInt(time.Now().Add(-lookback).UnixMilli(), 10)},
		"minDuration": []string{"0ms"},
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodGet, c.tracesBaseURL+"/select/jaeger/api/traces?"+values.Encode(), nil)
	if err != nil {
		return nil, err
	}

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode >= 400 {
		body, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("trace search failed: %s", strings.TrimSpace(string(body)))
	}

	var payload traceSearchResponse
	if err := json.NewDecoder(resp.Body).Decode(&payload); err != nil {
		return nil, err
	}
	return payload.Data, nil
}

func promVectorByPod(results []promResult) map[string]float64 {
	values := make(map[string]float64, len(results))
	for _, result := range results {
		namespace := result.Metric["namespace"]
		pod := result.Metric["pod"]
		if pod == "" {
			continue
		}
		key := namespace + "/" + pod
		values[key] = promSampleValue(result.Value)
	}
	return values
}

func promRangeValues(results []promResult) []promSample {
	if len(results) == 0 {
		return nil
	}

	samples := make([]promSample, 0, len(results[0].Values))
	for _, raw := range results[0].Values {
		if len(raw) != 2 {
			continue
		}

		ts := float64FromAny(raw[0])
		value := float64FromAny(raw[1])
		samples = append(samples, promSample{
			Timestamp: time.Unix(int64(ts), 0),
			Value:     value,
		})
	}
	return samples
}

func promSampleValue(raw []any) float64 {
	if len(raw) != 2 {
		return 0
	}
	return float64FromAny(raw[1])
}

func float64FromAny(raw any) float64 {
	switch value := raw.(type) {
	case float64:
		return value
	case int64:
		return float64(value)
	case json.Number:
		parsed, _ := value.Float64()
		return parsed
	case string:
		parsed, _ := strconv.ParseFloat(value, 64)
		return parsed
	default:
		return 0
	}
}
