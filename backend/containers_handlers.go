package main

import (
	"context"
	"fmt"
	"io"
	"log"
	"net/http"
	"sort"
	"strconv"
	"strings"
	"time"

	corev1 "k8s.io/api/core/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
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
	PodNPUObserved  int              `json:"podNpuObservedPercent"`
	PodNPUDevices   int              `json:"podNpuObservedDevices"`
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

type k8sEventItem struct {
	ID            string `json:"id"`
	Type          string `json:"type"`
	Reason        string `json:"reason"`
	Message       string `json:"message"`
	Count         int32  `json:"count"`
	LastTimestamp string `json:"lastTimestamp"`
	Component     string `json:"component"`
	Object        string `json:"object"`
	Namespace     string `json:"namespace"`
	PodName       string `json:"podName,omitempty"`
	Node          string `json:"node,omitempty"`
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
		podTelemetry := a.loadPodNPUTelemetry(ctx)
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
			podSummary := podTelemetry[key]
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
				PodNPUObserved:  podSummary.ObservedPercent(),
				PodNPUDevices:   podSummary.Active,
				NodeNPUCapacity: nodeCapacity[pod.Spec.NodeName],
				NodeNPUActive:   nodeSummary.Active,
				NodeNPUObserved: nodeSummary.ActivityPercent(),
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
	Active  int
	Total   int
	UtilSum float64
}

func (s nodeNPUTelemetrySummary) ObservedPercent() int {
	if s.Active <= 0 {
		return 0
	}
	return int(clampFloat(s.UtilSum/float64(s.Active), 0, 100))
}

func (s nodeNPUTelemetrySummary) ActivityPercent() int {
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

func (a *app) handleK8sEvents(w http.ResponseWriter, r *http.Request) {
	namespace := strings.TrimSpace(r.URL.Query().Get("namespace"))
	podName := strings.TrimSpace(r.URL.Query().Get("podName"))

	cacheKey := fmt.Sprintf("events:%s:%s", namespace, podName)
	payload, err := a.responseCache.GetOrSet(cacheKey, 15*time.Second, func() (any, error) {
		ctx, cancel := context.WithTimeout(r.Context(), 10*time.Second)
		defer cancel()

		eventNamespace := namespace
		if eventNamespace == "" {
			eventNamespace = metav1.NamespaceAll
		}

		eventList, err := a.kubeClient.CoreV1().Events(eventNamespace).List(ctx, metav1.ListOptions{})
		if err != nil {
			return nil, fmt.Errorf("failed to list kubernetes events: %w", err)
		}

		items := make([]k8sEventItem, 0, len(eventList.Items))
		for _, event := range eventList.Items {
			if podName != "" {
				if event.InvolvedObject.Kind != "Pod" || event.InvolvedObject.Name != podName {
					continue
				}
				if namespace != "" && event.InvolvedObject.Namespace != namespace {
					continue
				}
			}

			lastTime := event.LastTimestamp.Time
			if lastTime.IsZero() {
				lastTime = event.EventTime.Time
			}
			if lastTime.IsZero() {
				lastTime = event.FirstTimestamp.Time
			}
			if lastTime.IsZero() {
				lastTime = event.CreationTimestamp.Time
			}

			items = append(items, k8sEventItem{
				ID:            string(event.UID),
				Type:          event.Type,
				Reason:        event.Reason,
				Message:       event.Message,
				Count:         event.Count,
				LastTimestamp: lastTime.Format(time.RFC3339),
				Component:     firstNonEmpty(event.Source.Component, event.ReportingController, "-"),
				Object:        fmt.Sprintf("%s/%s", strings.ToLower(event.InvolvedObject.Kind), event.InvolvedObject.Name),
				Namespace:     firstNonEmpty(event.Namespace, event.InvolvedObject.Namespace, "-"),
				PodName:       podNameFromEvent(event),
				Node:          event.Source.Host,
			})
		}

		sort.Slice(items, func(i, j int) bool {
			return items[i].LastTimestamp > items[j].LastTimestamp
		})

		return items, nil
	})
	if err != nil {
		writeError(w, http.StatusServiceUnavailable, err.Error())
		return
	}

	writeJSON(w, http.StatusOK, payload)
}

func (a *app) handlePodDescribe(w http.ResponseWriter, r *http.Request) {
	namespace := strings.TrimSpace(r.URL.Query().Get("namespace"))
	podName := strings.TrimSpace(r.URL.Query().Get("podName"))
	if namespace == "" || podName == "" {
		writeError(w, http.StatusBadRequest, "namespace and podName are required")
		return
	}

	pod, err := a.clusterCache.GetPod(namespace, podName)
	if err != nil {
		writeError(w, http.StatusNotFound, fmt.Sprintf("failed to resolve pod %s/%s: %v", namespace, podName, err))
		return
	}

	w.Header().Set("Content-Type", "text/plain; charset=utf-8")
	w.WriteHeader(http.StatusOK)
	_, _ = w.Write([]byte(renderPodDescribe(pod)))
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

func (a *app) handlePodLogs(w http.ResponseWriter, r *http.Request) {
	namespace := strings.TrimSpace(r.URL.Query().Get("namespace"))
	podName := strings.TrimSpace(r.URL.Query().Get("podName"))
	level := strings.ToUpper(strings.TrimSpace(r.URL.Query().Get("level")))
	search := strings.TrimSpace(r.URL.Query().Get("search"))
	if namespace == "" || podName == "" {
		writeError(w, http.StatusBadRequest, "namespace and podName are required")
		return
	}

	cacheKey := fmt.Sprintf("podlogs:%s:%s:%s:%s", namespace, podName, level, search)
	payload, err := a.responseCache.GetOrSet(cacheKey, a.logsTTL, func() (any, error) {
		pod, err := a.clusterCache.GetPod(namespace, podName)
		if err != nil {
			return nil, fmt.Errorf("failed to resolve pod %s/%s: %w", namespace, podName, err)
		}
		if len(pod.Spec.Containers) == 0 {
			return []logEntry{}, nil
		}

		containerName := pod.Spec.Containers[0].Name
		tailLines := int64(200)
		req := a.kubeClient.CoreV1().Pods(namespace).GetLogs(podName, &corev1.PodLogOptions{
			Container:  containerName,
			TailLines:  &tailLines,
			Timestamps: true,
		})

		ctx, cancel := context.WithTimeout(r.Context(), 10*time.Second)
		defer cancel()

		stream, err := req.Stream(ctx)
		if err != nil {
			log.Printf("failed to stream pod logs for %s/%s: %v", namespace, podName, err)
			return []logEntry{}, nil
		}
		defer stream.Close()

		body, err := io.ReadAll(stream)
		if err != nil {
			return nil, fmt.Errorf("failed to read pod logs for %s/%s: %w", namespace, podName, err)
		}

		lines := strings.Split(string(body), "\n")
		entries := make([]logEntry, 0, len(lines))
		for idx, line := range lines {
			line = strings.TrimSpace(line)
			if line == "" {
				continue
			}

			timestamp, message := splitPodLogLine(line)
			entryLevel := inferLogLevel(message)
			if level != "" && level != "ALL" && entryLevel != level {
				continue
			}
			if search != "" && !strings.Contains(strings.ToLower(message), strings.ToLower(search)) {
				continue
			}

			entries = append(entries, logEntry{
				ID:        fmt.Sprintf("%s/%s/%d", namespace, podName, idx),
				Timestamp: timestamp,
				Level:     entryLevel,
				Message:   message,
				Source:    fmt.Sprintf("%s/%s", namespace, podName),
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

func podNameFromEvent(event corev1.Event) string {
	if event.InvolvedObject.Kind == "Pod" {
		return event.InvolvedObject.Name
	}
	return ""
}

func renderPodDescribe(pod *corev1.Pod) string {
	if pod == nil {
		return ""
	}

	var b strings.Builder
	writeDescribeLine(&b, "Name", pod.Name)
	writeDescribeLine(&b, "Namespace", pod.Namespace)
	writeDescribeLine(&b, "Priority", describePriority(pod.Spec.Priority))
	writeDescribeLine(&b, "Service Account", firstNonEmpty(pod.Spec.ServiceAccountName, "default"))
	writeDescribeLine(&b, "Node", formatDescribeNode(pod))
	writeDescribeLine(&b, "Start Time", formatDescribeTime(pod.Status.StartTime))
	writeDescribeMap(&b, "Labels", pod.Labels)
	writeDescribeMap(&b, "Annotations", pod.Annotations)
	writeDescribeLine(&b, "Status", string(pod.Status.Phase))
	writeDescribeLine(&b, "IP", pod.Status.PodIP)
	writeDescribeIPs(&b, pod.Status.PodIPs)
	writeDescribeLine(&b, "Controlled By", describeControlledBy(pod.OwnerReferences))

	b.WriteString("Containers:\n")
	for _, container := range pod.Spec.Containers {
		writeDescribeContainer(&b, container, pod.Status.ContainerStatuses)
	}

	b.WriteString("Conditions:\n")
	b.WriteString("  Type\tStatus\n")
	for _, condition := range pod.Status.Conditions {
		b.WriteString(fmt.Sprintf("  %s\t%s\n", condition.Type, condition.Status))
	}

	b.WriteString("Volumes:\n")
	for _, volume := range pod.Spec.Volumes {
		writeDescribeVolume(&b, volume)
	}

	writeDescribeLine(&b, "QoS Class", string(pod.Status.QOSClass))
	writeDescribeMap(&b, "Node-Selectors", pod.Spec.NodeSelector)
	writeDescribeTolerations(&b, pod.Spec.Tolerations)

	writeDescribeLine(&b, "Events", "<see Events tab>")

	return strings.TrimRight(b.String(), "\n")
}

func writeDescribeLine(b *strings.Builder, key, value string) {
	if strings.TrimSpace(value) == "" {
		value = "<none>"
	}
	b.WriteString(fmt.Sprintf("%-18s %s\n", key+":", value))
}

func writeDescribeMap(b *strings.Builder, key string, values map[string]string) {
	if len(values) == 0 {
		writeDescribeLine(b, key, "<none>")
		return
	}

	keys := make([]string, 0, len(values))
	for k := range values {
		keys = append(keys, k)
	}
	sort.Strings(keys)

	first := true
	for _, k := range keys {
		label := ""
		if first {
			label = key + ":"
			first = false
		}
		b.WriteString(fmt.Sprintf("%-18s %s=%s\n", label, k, values[k]))
	}
}

func writeDescribeIPs(b *strings.Builder, podIPs []corev1.PodIP) {
	if len(podIPs) == 0 {
		writeDescribeLine(b, "IPs", "<none>")
		return
	}
	b.WriteString("IPs:\n")
	for _, podIP := range podIPs {
		b.WriteString(fmt.Sprintf("  IP:\t%s\n", podIP.IP))
	}
}

func writeDescribeContainer(b *strings.Builder, container corev1.Container, statuses []corev1.ContainerStatus) {
	b.WriteString(fmt.Sprintf("  %s:\n", container.Name))
	status := findContainerStatus(statuses, container.Name)

	if status != nil {
		writeDescribeIndentedLine(b, 4, "Container ID", status.ContainerID)
	}
	writeDescribeIndentedLine(b, 4, "Image", container.Image)
	if status != nil && status.ImageID != "" {
		writeDescribeIndentedLine(b, 4, "Image ID", status.ImageID)
	}
	writeDescribeIndentedLine(b, 4, "Port", describeContainerPort(container.Ports))
	writeDescribeIndentedLine(b, 4, "Host Port", describeHostPort(container.Ports))
	writeDescribeIndentedLine(b, 4, "State", describeContainerState(status))
	if status != nil {
		if status.State.Running != nil {
			writeDescribeIndentedLine(b, 6, "Started", status.State.Running.StartedAt.Time.Format(time.RFC1123Z))
		}
		writeDescribeIndentedLine(b, 4, "Ready", strconv.FormatBool(status.Ready))
		writeDescribeIndentedLine(b, 4, "Restart Count", strconv.Itoa(int(status.RestartCount)))
	}

	if len(container.Resources.Limits) > 0 {
		b.WriteString("    Limits:\n")
		for _, line := range describeResourceList(container.Resources.Limits) {
			writeDescribeIndentedLine(b, 6, line.key, line.value)
		}
	}
	if len(container.Resources.Requests) > 0 {
		b.WriteString("    Requests:\n")
		for _, line := range describeResourceList(container.Resources.Requests) {
			writeDescribeIndentedLine(b, 6, line.key, line.value)
		}
	}
	if container.LivenessProbe != nil {
		writeDescribeIndentedLine(b, 4, "Liveness", describeProbe(container.LivenessProbe))
	}
	if container.ReadinessProbe != nil {
		writeDescribeIndentedLine(b, 4, "Readiness", describeProbe(container.ReadinessProbe))
	}

	b.WriteString("    Environment:\n")
	if len(container.Env) == 0 {
		writeDescribeIndentedLine(b, 6, "", "<none>")
	} else {
		for _, env := range container.Env {
			writeDescribeIndentedLine(b, 6, env.Name, describeEnvVar(env))
		}
	}

	b.WriteString("    Mounts:\n")
	if len(container.VolumeMounts) == 0 {
		writeDescribeIndentedLine(b, 6, "", "<none>")
	} else {
		for _, mount := range container.VolumeMounts {
			target := mount.MountPath + " from " + mount.Name
			if mount.SubPath != "" {
				target += fmt.Sprintf(` (rw,path="%s")`, mount.SubPath)
			} else if mount.ReadOnly {
				target += " (ro)"
			} else {
				target += " (rw)"
			}
			writeDescribeIndentedLine(b, 6, "", target)
		}
	}
}

func writeDescribeIndentedLine(b *strings.Builder, indent int, key, value string) {
	prefix := strings.Repeat(" ", indent)
	if strings.TrimSpace(key) == "" {
		b.WriteString(prefix + value + "\n")
		return
	}
	b.WriteString(fmt.Sprintf("%s%-16s %s\n", prefix, key+":", value))
}

type resourceLine struct {
	key   string
	value string
}

func describeResourceList(list corev1.ResourceList) []resourceLine {
	lines := make([]resourceLine, 0, len(list))
	keys := make([]string, 0, len(list))
	for name := range list {
		keys = append(keys, string(name))
	}
	sort.Strings(keys)
	for _, key := range keys {
		quantity := list[corev1.ResourceName(key)]
		lines = append(lines, resourceLine{key: key, value: quantity.String()})
	}
	return lines
}

func describeContainerPort(ports []corev1.ContainerPort) string {
	if len(ports) == 0 {
		return "<none>"
	}
	port := ports[0]
	return fmt.Sprintf("%d/%s", port.ContainerPort, port.Protocol)
}

func describeHostPort(ports []corev1.ContainerPort) string {
	if len(ports) == 0 {
		return "<none>"
	}
	port := ports[0]
	return fmt.Sprintf("%d/%s", port.HostPort, port.Protocol)
}

func describeContainerState(status *corev1.ContainerStatus) string {
	if status == nil {
		return "<unknown>"
	}
	switch {
	case status.State.Running != nil:
		return "Running"
	case status.State.Waiting != nil:
		return "Waiting (" + firstNonEmpty(status.State.Waiting.Reason, "unknown") + ")"
	case status.State.Terminated != nil:
		return "Terminated (" + firstNonEmpty(status.State.Terminated.Reason, "unknown") + ")"
	default:
		return "<unknown>"
	}
}

func describeProbe(probe *corev1.Probe) string {
	if probe == nil {
		return "<none>"
	}
	details := []string{}
	if probe.ProbeHandler.Exec != nil {
		details = append(details, "exec "+strings.Join(probe.ProbeHandler.Exec.Command, " "))
	}
	if probe.ProbeHandler.HTTPGet != nil {
		details = append(details, fmt.Sprintf("http-get %s://:%s%s", strings.ToLower(string(probe.ProbeHandler.HTTPGet.Scheme)), probe.ProbeHandler.HTTPGet.Port.String(), probe.ProbeHandler.HTTPGet.Path))
	}
	if probe.ProbeHandler.TCPSocket != nil {
		details = append(details, fmt.Sprintf("tcp-socket :%s", probe.ProbeHandler.TCPSocket.Port.String()))
	}
	details = append(details,
		fmt.Sprintf("delay=%ds", probe.InitialDelaySeconds),
		fmt.Sprintf("timeout=%ds", probe.TimeoutSeconds),
		fmt.Sprintf("period=%ds", probe.PeriodSeconds),
		fmt.Sprintf("#success=%d", probe.SuccessThreshold),
		fmt.Sprintf("#failure=%d", probe.FailureThreshold),
	)
	return strings.Join(details, " ")
}

func describeEnvVar(env corev1.EnvVar) string {
	if env.Value != "" {
		return env.Value
	}
	if env.ValueFrom == nil {
		return "<none>"
	}
	if env.ValueFrom.FieldRef != nil {
		return fmt.Sprintf("(%s:%s)", env.ValueFrom.FieldRef.APIVersion, env.ValueFrom.FieldRef.FieldPath)
	}
	if env.ValueFrom.SecretKeyRef != nil {
		return fmt.Sprintf("<set to key %s in secret %s>", env.ValueFrom.SecretKeyRef.Key, env.ValueFrom.SecretKeyRef.Name)
	}
	if env.ValueFrom.ConfigMapKeyRef != nil {
		return fmt.Sprintf("<set to key %s in configmap %s>", env.ValueFrom.ConfigMapKeyRef.Key, env.ValueFrom.ConfigMapKeyRef.Name)
	}
	return "<valueFrom>"
}

func writeDescribeVolume(b *strings.Builder, volume corev1.Volume) {
	b.WriteString(fmt.Sprintf("  %s:\n", volume.Name))
	switch {
	case volume.EmptyDir != nil:
		writeDescribeIndentedLine(b, 4, "Type", "EmptyDir (a temporary directory that shares a pod's lifetime)")
		writeDescribeIndentedLine(b, 4, "Medium", string(volume.EmptyDir.Medium))
		if volume.EmptyDir.SizeLimit != nil {
			writeDescribeIndentedLine(b, 4, "SizeLimit", volume.EmptyDir.SizeLimit.String())
		} else {
			writeDescribeIndentedLine(b, 4, "SizeLimit", "<unset>")
		}
	case volume.ConfigMap != nil:
		writeDescribeIndentedLine(b, 4, "Type", "ConfigMap (a volume populated by a ConfigMap)")
		writeDescribeIndentedLine(b, 4, "Name", volume.ConfigMap.Name)
		writeDescribeIndentedLine(b, 4, "Optional", strconv.FormatBool(volume.ConfigMap.Optional != nil && *volume.ConfigMap.Optional))
	case volume.Secret != nil:
		writeDescribeIndentedLine(b, 4, "Type", "Secret (a volume populated by a Secret)")
		writeDescribeIndentedLine(b, 4, "SecretName", volume.Secret.SecretName)
		writeDescribeIndentedLine(b, 4, "Optional", strconv.FormatBool(volume.Secret.Optional != nil && *volume.Secret.Optional))
	case volume.Projected != nil:
		writeDescribeIndentedLine(b, 4, "Type", "Projected (a volume that contains injected data from multiple sources)")
	default:
		writeDescribeIndentedLine(b, 4, "Type", "Other")
	}
}

func writeDescribeTolerations(b *strings.Builder, tolerations []corev1.Toleration) {
	if len(tolerations) == 0 {
		writeDescribeLine(b, "Tolerations", "<none>")
		return
	}
	first := true
	for _, tol := range tolerations {
		label := ""
		if first {
			label = "Tolerations:"
			first = false
		}
		b.WriteString(fmt.Sprintf("%-18s %s\n", label, describeToleration(tol)))
	}
}

func describeToleration(tol corev1.Toleration) string {
	parts := []string{}
	if tol.Key != "" {
		parts = append(parts, tol.Key)
	}
	if tol.Operator != "" {
		parts = append(parts, "op="+string(tol.Operator))
	}
	if tol.Value != "" {
		parts = append(parts, "value="+tol.Value)
	}
	if tol.Effect != "" {
		parts = append(parts, string(tol.Effect))
	}
	if tol.TolerationSeconds != nil {
		parts = append(parts, fmt.Sprintf("for %ds", *tol.TolerationSeconds))
	}
	if len(parts) == 0 {
		return "<none>"
	}
	return strings.Join(parts, " ")
}

func describeControlledBy(refs []metav1.OwnerReference) string {
	for _, ref := range refs {
		if ref.Controller != nil && *ref.Controller {
			return ref.Kind + "/" + ref.Name
		}
	}
	return "<none>"
}

func formatDescribeNode(pod *corev1.Pod) string {
	if pod == nil {
		return "<none>"
	}
	if pod.Status.HostIP != "" {
		return pod.Spec.NodeName + "/" + pod.Status.HostIP
	}
	return firstNonEmpty(pod.Spec.NodeName, "<none>")
}

func formatDescribeTime(ts *metav1.Time) string {
	if ts == nil || ts.IsZero() {
		return "<none>"
	}
	return ts.Time.Format(time.RFC1123Z)
}

func findContainerStatus(statuses []corev1.ContainerStatus, name string) *corev1.ContainerStatus {
	for i := range statuses {
		if statuses[i].Name == name {
			return &statuses[i]
		}
	}
	return nil
}

func describePriority(priority *int32) string {
	if priority == nil {
		return "0"
	}
	return strconv.Itoa(int(*priority))
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
	for _, status := range append([]corev1.ContainerStatus{}, pod.Status.InitContainerStatuses...) {
		if status.State.Waiting != nil && strings.TrimSpace(status.State.Waiting.Reason) != "" {
			return "warning", fmt.Sprintf("Init container %s is %s", status.Name, status.State.Waiting.Reason)
		}
	}
	for _, status := range pod.Status.ContainerStatuses {
		if status.State.Waiting != nil && strings.TrimSpace(status.State.Waiting.Reason) != "" {
			return "warning", fmt.Sprintf("Container %s is %s", status.Name, status.State.Waiting.Reason)
		}
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
			item.UtilSum += state.Utilization
		}
		summary[state.Hostname] = item
	}

	return summary
}

func (a *app) loadPodNPUTelemetry(ctx context.Context) map[string]nodeNPUTelemetrySummary {
	summary := map[string]nodeNPUTelemetrySummary{}
	if a.observability == nil {
		return summary
	}

	utilResults, err := a.observability.queryMetricsInstant(ctx, npuMetricByDevice(npuUtilMetric()))
	if err != nil {
		log.Printf("failed to query npu utilization metrics for pod container map summary: %v", err)
		return summary
	}
	dramResults, err := a.observability.queryMetricsInstant(ctx, npuMetricByDevice(npuDramUsedMetric()))
	if err != nil {
		log.Printf("failed to query npu dram metrics for pod container map summary: %v", err)
		return summary
	}

	states := mergeNPUDeviceStates(npuMetricSet{
		util:     utilResults,
		dramUsed: dramResults,
	})
	for _, state := range states {
		if strings.TrimSpace(state.Namespace) == "" || strings.TrimSpace(state.Pod) == "" {
			continue
		}
		key := state.Namespace + "/" + state.Pod
		item := summary[key]
		item.Total++
		if isTelemetryActive(state) {
			item.Active++
			item.UtilSum += state.Utilization
		}
		summary[key] = item
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

func splitPodLogLine(line string) (string, string) {
	fields := strings.Fields(line)
	if len(fields) == 0 {
		return time.Now().Format("2006-01-02 15:04:05.000"), ""
	}
	if _, err := time.Parse(time.RFC3339Nano, fields[0]); err == nil {
		return normalizeTimestamp(fields[0]), strings.TrimSpace(strings.TrimPrefix(line, fields[0]))
	}
	return time.Now().Format("2006-01-02 15:04:05.000"), line
}

func inferLogLevel(message string) string {
	upper := strings.ToUpper(message)
	switch {
	case strings.Contains(upper, "ERROR"):
		return "ERROR"
	case strings.Contains(upper, "WARN"):
		return "WARN"
	case strings.Contains(upper, "DEBUG"):
		return "DEBUG"
	default:
		return "INFO"
	}
}
