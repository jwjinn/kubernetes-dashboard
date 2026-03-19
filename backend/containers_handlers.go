package main

import (
	"context"
	"fmt"
	"log"
	"net/http"
	"strings"
	"time"

	corev1 "k8s.io/api/core/v1"
)

type containerMapItem struct {
	ID              string           `json:"id"`
	Name            string           `json:"name"`
	Namespace       string           `json:"namespace"`
	Node            string           `json:"node"`
	ResourceType    string           `json:"resourceType"`
	Status          string           `json:"status"`
	StatusReason    string           `json:"statusReason"`
	CPURequest      int64            `json:"cpuRequest"`
	HasCPURequest   bool             `json:"hasCpuRequest"`
	CPUUsagePercent int              `json:"cpuUsagePercent"`
	MemRequestBytes int64            `json:"memRequestBytes"`
	HasMemRequest   bool             `json:"hasMemRequest"`
	MemUsagePercent int              `json:"memUsagePercent"`
	NPURequest      int              `json:"npuRequest"`
	NodeNPUCapacity int              `json:"nodeNpuCapacity"`
	NodeNPUActive   int              `json:"nodeNpuActive"`
	NodeNPUObserved int              `json:"nodeNpuObservedPercent"`
	TXCount         int              `json:"txCount"`
	HasTrace        bool             `json:"hasTrace"`
	Image           string           `json:"image,omitempty"`
	ServiceName     string           `json:"serviceName,omitempty"`
	Volume          *containerVolume `json:"volume,omitempty"`
}

type containerVolume struct {
	Type string `json:"type"`
	Path string `json:"path"`
}

type metricsSeriesResponse struct {
	Times     []string  `json:"times"`
	CPU       []float64 `json:"cpu"`
	Memory    []float64 `json:"memory"`
	NetworkRx []float64 `json:"networkRx"`
	NetworkTx []float64 `json:"networkTx"`
	DiskRead  []float64 `json:"diskRead"`
	DiskWrite []float64 `json:"diskWrite"`
}

type logEntry struct {
	ID        string `json:"id"`
	Timestamp string `json:"timestamp"`
	Level     string `json:"level"`
	Message   string `json:"message"`
	Source    string `json:"source"`
}

type traceEntry struct {
	ID        string   `json:"id"`
	Service   string   `json:"service"`
	Operation string   `json:"operation"`
	Duration  string   `json:"duration"`
	StartTime string   `json:"startTime"`
	Pod       string   `json:"pod"`
	Tags      []string `json:"tags"`
}

func (a *app) handleContainers(w http.ResponseWriter, r *http.Request) {
	payload, err := a.responseCache.GetOrSet("k8s-containers", a.containersTTL, func() (any, error) {
		nodes, err := a.clusterCache.ListNodes()
		if err != nil {
			return nil, fmt.Errorf("failed to list nodes: %w", err)
		}
		pods, err := a.clusterCache.ListPods()
		if err != nil {
			return nil, fmt.Errorf("failed to list pods: %w", err)
		}

		ctx, cancel := context.WithTimeout(r.Context(), 10*time.Second)
		defer cancel()

		cpuUsage, memUsage, txUsage := a.loadPodInstantMetrics(ctx)
		nodeTelemetry := a.loadNodeNPUTelemetry(ctx)
		nodeCapacity := make(map[string]int, len(nodes))
		for _, node := range nodes {
			nodeCapacity[node.Name] = acceleratorCapacity(node.Status.Allocatable, "NPU")
		}
		items := make([]containerMapItem, 0, len(pods))
		for _, pod := range pods {
			if shouldSkipPod(*pod) || len(pod.Spec.Containers) == 0 {
				continue
			}

			key := pod.Namespace + "/" + pod.Name
			cpuRequestMilli, hasCPURequest := podCPURequestMilli(pod)
			memRequestBytes, hasMemRequest := podMemoryRequestBytes(pod)
			npuRequest := acceleratorRequestCount(pod, "NPU")
			nodeSummary := nodeTelemetry[pod.Spec.NodeName]
			status, statusReason := podVisualStatus(*pod)

			firstContainer := pod.Spec.Containers[0]
			items = append(items, containerMapItem{
				ID:              fmt.Sprintf("pod:%s:%s", pod.Namespace, pod.Name),
				Name:            pod.Name,
				Namespace:       pod.Namespace,
				Node:            pod.Spec.NodeName,
				ResourceType:    podPrimaryResourceType(pod),
				Status:          status,
				StatusReason:    statusReason,
				CPURequest:      cpuRequestMilli,
				HasCPURequest:   hasCPURequest,
				CPUUsagePercent: usagePercent(cpuUsage[key], milliToCores(cpuRequestMilli), -1),
				MemRequestBytes: memRequestBytes,
				HasMemRequest:   hasMemRequest,
				MemUsagePercent: usagePercent(memUsage[key], float64(memRequestBytes), -1),
				NPURequest:      npuRequest,
				NodeNPUCapacity: nodeCapacity[pod.Spec.NodeName],
				NodeNPUActive:   nodeSummary.Active,
				NodeNPUObserved: nodeSummary.ObservedPercent(),
				TXCount:         int(txUsage[key] * 1000),
				HasTrace:        false,
				Image:           firstContainer.Image,
				ServiceName:     pod.Labels["app.kubernetes.io/name"],
				Volume:          podPrimaryVolume(pod),
			})
		}
		return items, nil
	})
	if err != nil {
		writeError(w, http.StatusServiceUnavailable, err.Error())
		return
	}

	writeJSON(w, http.StatusOK, payload)
}

type nodeNPUTelemetrySummary struct {
	Active int
	Total  int
}

func (s nodeNPUTelemetrySummary) ObservedPercent() int {
	if s.Total <= 0 {
		return 0
	}
	return int(clampFloat(percentOf(float64(s.Active), float64(s.Total)), 0, 100))
}

func (a *app) handleK8sMetrics(w http.ResponseWriter, r *http.Request) {
	metricRef := strings.TrimPrefix(r.URL.Path, "/api/k8s/metrics/")
	namespace, podName, err := parseSimplePodReference(metricRef)
	if err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}

	pod, err := a.clusterCache.GetPod(namespace, podName)
	if err != nil {
		writeError(w, http.StatusNotFound, fmt.Sprintf("failed to resolve pod %s/%s: %v", namespace, podName, err))
		return
	}

	cacheKey := "metrics:" + namespace + ":" + podName
	payload, err := a.responseCache.GetOrSet(cacheKey, a.metricsTTL, func() (any, error) {
		ctx, cancel := context.WithTimeout(r.Context(), 15*time.Second)
		defer cancel()

		end := time.Now()
		start := end.Add(-1 * time.Hour)
		step := time.Minute

		cpuRequestMilli, _ := podCPURequestMilli(pod)
		memRequestValue, hasMemRequest := podMemoryRequestBytes(pod)
		cpuRequestCores := milliToCores(cpuRequestMilli)
		memRequestBytes := float64(memRequestValue)
		if memRequestBytes <= 0 || !hasMemRequest {
			memRequestBytes = float64(defaultMemoryRequestBytes())
		}

		cpuSeries, cpuErr := a.fetchMetricRange(ctx,
			fmt.Sprintf(`sum(rate(container_cpu_usage_seconds_total{namespace=%q,pod=%q,container!="",container!="POD"}[5m]))`, namespace, podName),
			start, end, step,
			func(value float64) float64 { return clampFloat(percentOf(value, cpuRequestCores), 0, 100) },
		)
		memSeries, memErr := a.fetchMetricRange(ctx,
			fmt.Sprintf(`sum(container_memory_working_set_bytes{namespace=%q,pod=%q,container!="",container!="POD"})`, namespace, podName),
			start, end, step,
			func(value float64) float64 { return clampFloat(percentOf(value, memRequestBytes), 0, 100) },
		)
		rxSeries, rxErr := a.fetchMetricRange(ctx,
			fmt.Sprintf(`sum(rate(container_network_receive_bytes_total{namespace=%q,pod=%q,interface!="lo"}[5m]))`, namespace, podName),
			start, end, step,
			bytesPerSecondToMB,
		)
		txSeries, txErr := a.fetchMetricRange(ctx,
			fmt.Sprintf(`sum(rate(container_network_transmit_bytes_total{namespace=%q,pod=%q,interface!="lo"}[5m]))`, namespace, podName),
			start, end, step,
			bytesPerSecondToMB,
		)
		readSeries, readErr := a.fetchMetricRange(ctx,
			fmt.Sprintf(`sum(rate(container_fs_reads_bytes_total{namespace=%q,pod=%q,container!="",container!="POD"}[5m]))`, namespace, podName),
			start, end, step,
			bytesPerSecondToMB,
		)
		writeSeries, writeErr := a.fetchMetricRange(ctx,
			fmt.Sprintf(`sum(rate(container_fs_writes_bytes_total{namespace=%q,pod=%q,container!="",container!="POD"}[5m]))`, namespace, podName),
			start, end, step,
			bytesPerSecondToMB,
		)

		if cpuErr != nil {
			log.Printf("cpu metric query failed for %s/%s: %v", namespace, podName, cpuErr)
		}
		if memErr != nil {
			log.Printf("memory metric query failed for %s/%s: %v", namespace, podName, memErr)
		}
		if rxErr != nil {
			log.Printf("network rx query failed for %s/%s: %v", namespace, podName, rxErr)
		}
		if txErr != nil {
			log.Printf("network tx query failed for %s/%s: %v", namespace, podName, txErr)
		}
		if readErr != nil {
			log.Printf("disk read query failed for %s/%s: %v", namespace, podName, readErr)
		}
		if writeErr != nil {
			log.Printf("disk write query failed for %s/%s: %v", namespace, podName, writeErr)
		}

		times := buildTimeAxis(start, end, step)
		return metricsSeriesResponse{
			Times:     times,
			CPU:       alignSeries(times, cpuSeries),
			Memory:    alignSeries(times, memSeries),
			NetworkRx: alignSeries(times, rxSeries),
			NetworkTx: alignSeries(times, txSeries),
			DiskRead:  alignSeries(times, readSeries),
			DiskWrite: alignSeries(times, writeSeries),
		}, nil
	})
	if err != nil {
		writeError(w, http.StatusServiceUnavailable, err.Error())
		return
	}

	writeJSON(w, http.StatusOK, payload)
}

func (a *app) handleLogs(w http.ResponseWriter, r *http.Request) {
	podName := r.URL.Query().Get("pod")
	level := strings.ToUpper(r.URL.Query().Get("level"))
	search := strings.TrimSpace(r.URL.Query().Get("search"))

	cacheKey := fmt.Sprintf("logs:%s:%s:%s", podName, level, search)
	payload, err := a.responseCache.GetOrSet(cacheKey, a.logsTTL, func() (any, error) {
		query := `_time:15m`
		if podName != "" {
			query += fmt.Sprintf(` %q`, podName)
		}
		if level != "" && level != "ALL" {
			query += fmt.Sprintf(` (level:=%q or severity_text:=%q or severity:=%q)`, level, level, level)
		}
		if search != "" {
			query += fmt.Sprintf(` %q`, search)
		}

		ctx, cancel := context.WithTimeout(r.Context(), 10*time.Second)
		defer cancel()

		rows, err := a.observability.queryLogs(ctx, query, 200)
		if err != nil {
			return nil, err
		}

		entries := make([]logEntry, 0, len(rows))
		for idx, row := range rows {
			entries = append(entries, logEntry{
				ID:        stringField(row, "_stream_id", fmt.Sprintf("log-%d", idx)),
				Timestamp: normalizeTimestamp(anyField(row, "_time", "timestamp", "ts")),
				Level:     normalizeLevel(anyField(row, "level", "severity_text", "severity")),
				Message:   stringField(row, "_msg", stringField(row, "message", stringField(row, "body", ""))),
				Source:    stringField(row, "k8s.pod.name", stringField(row, "pod", podName)),
			})
		}
		return entries, nil
	})
	if err != nil {
		writeError(w, http.StatusServiceUnavailable, err.Error())
		return
	}

	writeJSON(w, http.StatusOK, payload)
}

func (a *app) handleTraces(w http.ResponseWriter, r *http.Request) {
	podName := strings.TrimSpace(r.URL.Query().Get("pod"))
	if podName == "" {
		writeError(w, http.StatusBadRequest, "pod query parameter is required")
		return
	}

	cacheKey := "traces:" + podName
	payload, err := a.responseCache.GetOrSet(cacheKey, a.tracesTTL, func() (any, error) {
		ctx, cancel := context.WithTimeout(r.Context(), 12*time.Second)
		defer cancel()

		services, err := a.observability.listTraceServices(ctx)
		if err != nil {
			return nil, err
		}

		var entries []traceEntry
		for _, service := range services {
			traces, err := a.observability.searchTraces(ctx, service, map[string]string{
				"resource_attr:k8s.pod.name": podName,
			}, 5, time.Hour)
			if err != nil {
				log.Printf("trace search failed for service %s and pod %s: %v", service, podName, err)
				continue
			}

			for _, trace := range traces {
				duration := time.Duration(0)
				operation := ""
				tags := make([]string, 0)
				startTime := ""
				for _, span := range trace.Spans {
					if operation == "" {
						operation = span.OperationName
					}
					if duration == 0 || time.Duration(span.Duration) > duration {
						duration = time.Duration(span.Duration)
					}
					if startTime == "" && span.StartTime > 0 {
						startTime = time.UnixMicro(span.StartTime).Format("2006-01-02 15:04:05")
					}
					for _, tag := range span.Tags {
						if len(tags) >= 5 {
							break
						}
						tags = append(tags, fmt.Sprintf("%s=%v", tag.Key, tag.Value))
					}
				}

				entries = append(entries, traceEntry{
					ID:        trace.TraceID,
					Service:   service,
					Operation: operation,
					Duration:  duration.String(),
					StartTime: startTime,
					Pod:       podName,
					Tags:      tags,
				})
			}
		}
		return entries, nil
	})
	if err != nil {
		writeError(w, http.StatusServiceUnavailable, err.Error())
		return
	}

	writeJSON(w, http.StatusOK, payload)
}

func (a *app) loadPodInstantMetrics(ctx context.Context) (map[string]float64, map[string]float64, map[string]float64) {
	empty := map[string]float64{}
	if a.observability == nil {
		return empty, empty, empty
	}

	cpuResults, err := a.observability.queryMetricsInstant(ctx, `sum by (namespace,pod) (rate(container_cpu_usage_seconds_total{container!="",container!="POD"}[5m]))`)
	if err != nil {
		log.Printf("failed to query instant cpu metrics: %v", err)
	}
	memResults, err := a.observability.queryMetricsInstant(ctx, `sum by (namespace,pod) (container_memory_working_set_bytes{container!="",container!="POD"})`)
	if err != nil {
		log.Printf("failed to query instant memory metrics: %v", err)
	}
	txResults, err := a.observability.queryMetricsInstant(ctx, `sum by (namespace,pod) (rate(container_network_transmit_bytes_total{pod!="",interface!="lo"}[5m]))`)
	if err != nil {
		log.Printf("failed to query instant network tx metrics: %v", err)
	}

	return promVectorByPod(cpuResults), promVectorByPod(memResults), promVectorByPod(txResults)
}

func (a *app) fetchMetricRange(ctx context.Context, query string, start, end time.Time, step time.Duration, transform func(float64) float64) (map[string]float64, error) {
	results, err := a.observability.queryMetricsRange(ctx, query, start, end, step)
	if err != nil {
		return nil, err
	}

	series := make(map[string]float64)
	for _, sample := range promRangeValues(results) {
		series[sample.Timestamp.Format("15:04")] = transform(sample.Value)
	}
	return series, nil
}

func parseSimplePodReference(raw string) (string, string, error) {
	parts := strings.Split(raw, ":")
	if len(parts) != 3 || parts[0] != "pod" {
		return "", "", fmt.Errorf("invalid pod reference %q", raw)
	}
	return parts[1], parts[2], nil
}

func podCPURequestMilli(pod *corev1.Pod) (int64, bool) {
	total := int64(0)
	found := false
	for _, container := range pod.Spec.Containers {
		if quantity, ok := container.Resources.Requests[corev1.ResourceCPU]; ok {
			total += quantity.MilliValue()
			found = true
		}
	}
	return total, found
}

func podMemoryRequestBytes(pod *corev1.Pod) (int64, bool) {
	total := int64(0)
	found := false
	for _, container := range pod.Spec.Containers {
		if quantity, ok := container.Resources.Requests[corev1.ResourceMemory]; ok {
			total += quantity.Value()
			found = true
		}
	}
	return total, found
}

func defaultMemoryRequestBytes() int64 {
	return int64(1024 * 1024 * 1024)
}

func podPrimaryResourceType(pod *corev1.Pod) string {
	for _, container := range pod.Spec.Containers {
		for resourceName := range container.Resources.Requests {
			key := strings.ToLower(string(resourceName))
			if isAcceleratorResource(key, "NPU") || isAcceleratorResource(key, "GPU") {
				return "NPU"
			}
		}
	}
	return "CPU"
}

func podVisualStatus(pod corev1.Pod) (string, string) {
	if pod.Status.Phase == corev1.PodFailed {
		return "failed", fmt.Sprintf("Pod phase is %s", pod.Status.Phase)
	}
	if pod.Status.Phase != corev1.PodRunning {
		return "warning", fmt.Sprintf("Pod phase is %s", pod.Status.Phase)
	}
	for _, status := range pod.Status.ContainerStatuses {
		if !status.Ready {
			return "warning", fmt.Sprintf("Container %s is not ready", status.Name)
		}
		if status.RestartCount > 0 {
			return "warning", fmt.Sprintf("Container %s restarted %d times", status.Name, status.RestartCount)
		}
	}
	return "healthy", "Pod is running and all containers are ready"
}

func (a *app) loadNodeNPUTelemetry(ctx context.Context) map[string]nodeNPUTelemetrySummary {
	summary := map[string]nodeNPUTelemetrySummary{}
	if a.observability == nil {
		return summary
	}

	utilResults, err := a.observability.queryMetricsInstant(ctx, npuMetricByDevice(npuUtilMetric()))
	if err != nil {
		log.Printf("failed to query npu utilization metrics for container map: %v", err)
		return summary
	}
	dramResults, err := a.observability.queryMetricsInstant(ctx, npuMetricByDevice(npuDramUsedMetric()))
	if err != nil {
		log.Printf("failed to query npu dram metrics for container map: %v", err)
		return summary
	}

	states := mergeNPUDeviceStates(npuMetricSet{
		util:     utilResults,
		dramUsed: dramResults,
	})
	for _, state := range states {
		if strings.TrimSpace(state.Hostname) == "" {
			continue
		}
		item := summary[state.Hostname]
		item.Total++
		if isTelemetryActive(state) {
			item.Active++
		}
		summary[state.Hostname] = item
	}

	return summary
}

func podPrimaryVolume(pod *corev1.Pod) *containerVolume {
	if len(pod.Spec.Volumes) == 0 {
		return nil
	}

	volume := pod.Spec.Volumes[0]
	switch {
	case volume.HostPath != nil:
		return &containerVolume{Type: "HostPath", Path: volume.HostPath.Path}
	case volume.ConfigMap != nil:
		return &containerVolume{Type: "ConfigMap", Path: volume.ConfigMap.Name}
	case volume.PersistentVolumeClaim != nil:
		return &containerVolume{Type: "PVC", Path: volume.PersistentVolumeClaim.ClaimName}
	default:
		return &containerVolume{Type: "Volume", Path: volume.Name}
	}
}

func buildTimeAxis(start, end time.Time, step time.Duration) []string {
	var times []string
	for current := start; !current.After(end); current = current.Add(step) {
		times = append(times, current.Format("15:04"))
	}
	return times
}

func alignSeries(times []string, values map[string]float64) []float64 {
	series := make([]float64, 0, len(times))
	for _, ts := range times {
		series = append(series, roundTo(values[ts], 2))
	}
	return series
}

func usagePercent(value, total float64, defaultValue int) int {
	if total <= 0 {
		return defaultValue
	}
	return int(clampFloat(percentOf(value, total), 0, 100))
}

func percentOf(value, total float64) float64 {
	if total <= 0 {
		return 0
	}
	return (value / total) * 100
}

func milliToCores(milli int64) float64 {
	if milli <= 0 {
		return 0
	}
	return float64(milli) / 1000
}

func bytesPerSecondToMB(value float64) float64 {
	return value / (1024 * 1024)
}

func clampFloat(value, minValue, maxValue float64) float64 {
	if value < minValue {
		return minValue
	}
	if value > maxValue {
		return maxValue
	}
	return value
}

func roundTo(value float64, digits int) float64 {
	power := 1.0
	for i := 0; i < digits; i++ {
		power *= 10
	}
	return float64(int(value*power+0.5)) / power
}

func stringField(values map[string]any, key string, fallback string) string {
	if value, ok := values[key]; ok {
		return fmt.Sprint(value)
	}
	return fallback
}

func anyField(values map[string]any, keys ...string) any {
	for _, key := range keys {
		if value, ok := values[key]; ok {
			return value
		}
	}
	return ""
}

func normalizeTimestamp(raw any) string {
	switch value := raw.(type) {
	case string:
		parsed, err := time.Parse(time.RFC3339Nano, value)
		if err == nil {
			return parsed.Format("2006-01-02 15:04:05.000")
		}
		return value
	case float64:
		return time.Unix(int64(value), 0).Format("2006-01-02 15:04:05.000")
	default:
		return time.Now().Format("2006-01-02 15:04:05.000")
	}
}

func normalizeLevel(raw any) string {
	value := strings.ToUpper(fmt.Sprint(raw))
	switch value {
	case "WARN", "ERROR", "DEBUG", "INFO":
		return value
	case "":
		return "INFO"
	default:
		return value
	}
}
