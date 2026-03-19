package main

import (
	"context"
	"fmt"
	"log"
	"net/http"
	"sort"
	"strings"
	"time"

	corev1 "k8s.io/api/core/v1"
)

type nodeDashboardNode struct {
	NodeID        string  `json:"nodeId"`
	CPUUtil       float64 `json:"cpuUtil"`
	MemTotal      float64 `json:"memTotal"`
	MemUsed       float64 `json:"memUsed"`
	MemBuffers    float64 `json:"memBuffers"`
	MemCached     float64 `json:"memCached"`
	DiskReads     float64 `json:"diskReads"`
	DiskWrites    float64 `json:"diskWrites"`
	FSUsedPercent float64 `json:"fsUsedPercent"`
	NetRx         float64 `json:"netRx"`
	NetTx         float64 `json:"netTx"`
	TCPEstablished float64 `json:"tcpEstablished"`
	Load1m        float64 `json:"load1m"`
	Load5m        float64 `json:"load5m"`
	Load15m       float64 `json:"load15m"`
	Status        string  `json:"status"`
}

type nodeDashboardSeries struct {
	NodeID string    `json:"nodeId"`
	Values []float64 `json:"values"`
}

type nodeDashboardResponse struct {
	Nodes           []nodeDashboardNode   `json:"nodes"`
	TimeAxis        []string              `json:"timeAxis"`
	CPUSeries       []nodeDashboardSeries `json:"cpuSeries"`
	MemorySeries    []nodeDashboardSeries `json:"memorySeries"`
	DiskIOSeries    []nodeDashboardSeries `json:"diskIoSeries"`
	NetworkIOSeries []nodeDashboardSeries `json:"networkIoSeries"`
	LoadSeries      []nodeDashboardSeries `json:"loadSeries"`
	TCPSeries       []nodeDashboardSeries `json:"tcpSeries"`
}

func (a *app) handleNodeMetrics(w http.ResponseWriter, r *http.Request) {
	payload, err := a.responseCache.GetOrSet("node-metrics-dashboard", a.metricsTTL, func() (any, error) {
		nodes, err := a.clusterCache.ListNodes()
		if err != nil {
			return nil, fmt.Errorf("failed to list nodes: %w", err)
		}

		ctx, cancel := context.WithTimeout(r.Context(), 20*time.Second)
		defer cancel()

		return a.buildNodeDashboardResponse(ctx, nodes)
	})
	if err != nil {
		writeError(w, http.StatusServiceUnavailable, err.Error())
		return
	}

	writeJSON(w, http.StatusOK, payload)
}

func (a *app) buildNodeDashboardResponse(ctx context.Context, nodes []*corev1.Node) (nodeDashboardResponse, error) {
	end := time.Now()
	start := end.Add(-90 * time.Minute)
	step := 10 * time.Minute
	timeAxis := buildTimeAxis(start, end, step)

	statusByNode := make(map[string]string, len(nodes))
	nodeNames := make([]string, 0, len(nodes))
	for _, node := range nodes {
		statusByNode[node.Name] = nodeReadyText(*node)
		nodeNames = append(nodeNames, node.Name)
	}
	sort.Strings(nodeNames)

	load1Now, _ := a.queryNodeInstant(ctx, nodeMetricExpr(`node_load1`))
	load5Now, _ := a.queryNodeInstant(ctx, nodeMetricExpr(`node_load5`))
	load15Now, _ := a.queryNodeInstant(ctx, nodeMetricExpr(`node_load15`))
	tcpNow, _ := a.queryNodeInstant(ctx, nodeMetricExpr(`node_netstat_Tcp_CurrEstab`))
	cpuNow, _ := a.queryNodeInstant(ctx, nodeMetricExpr(`100 * (1 - avg by(instance) (rate(node_cpu_seconds_total{mode="idle"}[5m])))`))
	memTotalNow, _ := a.queryNodeInstant(ctx, nodeMetricExpr(`node_memory_MemTotal_bytes / 1073741824`))
	memUsedNow, _ := a.queryNodeInstant(ctx, nodeMetricExpr(`(node_memory_MemTotal_bytes - node_memory_MemAvailable_bytes) / 1073741824`))
	memBuffersNow, _ := a.queryNodeInstant(ctx, nodeMetricExpr(`node_memory_Buffers_bytes / 1073741824`))
	memCachedNow, _ := a.queryNodeInstant(ctx, nodeMetricExpr(`node_memory_Cached_bytes / 1073741824`))
	fsNow, _ := a.queryNodeInstant(ctx, nodeMetricExpr(`100 * (1 - (sum by(instance) (node_filesystem_avail_bytes{mountpoint="/",fstype!~"tmpfs|overlay"}) / sum by(instance) (node_filesystem_size_bytes{mountpoint="/",fstype!~"tmpfs|overlay"})))`))
	netRxNow, _ := a.queryNodeInstant(ctx, nodeMetricExpr(`sum by(instance) (rate(node_network_receive_bytes_total{device!~"lo|veth.*|cali.*|flannel.*|cni.*"}[5m])) / 1048576`))
	netTxNow, _ := a.queryNodeInstant(ctx, nodeMetricExpr(`sum by(instance) (rate(node_network_transmit_bytes_total{device!~"lo|veth.*|cali.*|flannel.*|cni.*"}[5m])) / 1048576`))
	diskReadNow, _ := a.queryNodeInstant(ctx, nodeMetricExpr(`sum by(instance) (rate(node_disk_read_bytes_total{device!~"loop.*|ram.*|dm-.*"}[5m])) / 1048576`))
	diskWriteNow, _ := a.queryNodeInstant(ctx, nodeMetricExpr(`sum by(instance) (rate(node_disk_written_bytes_total{device!~"loop.*|ram.*|dm-.*"}[5m])) / 1048576`))

	loadHistory, _ := a.queryNodeRange(ctx, nodeMetricExpr(`node_load1`), start, end, step)
	tcpHistory, _ := a.queryNodeRange(ctx, nodeMetricExpr(`node_netstat_Tcp_CurrEstab`), start, end, step)
	cpuHistory, _ := a.queryNodeRange(ctx, nodeMetricExpr(`100 * (1 - avg by(instance) (rate(node_cpu_seconds_total{mode="idle"}[5m])))`), start, end, step)
	memHistory, _ := a.queryNodeRange(ctx, nodeMetricExpr(`(node_memory_MemTotal_bytes - node_memory_MemAvailable_bytes) / 1073741824`), start, end, step)
	netHistory, _ := a.queryNodeRange(ctx, nodeMetricExpr(`sum by(instance) (rate(node_network_receive_bytes_total{device!~"lo|veth.*|cali.*|flannel.*|cni.*"}[5m]) + rate(node_network_transmit_bytes_total{device!~"lo|veth.*|cali.*|flannel.*|cni.*"}[5m])) / 1048576`), start, end, step)
	diskHistory, _ := a.queryNodeRange(ctx, nodeMetricExpr(`sum by(instance) (rate(node_disk_read_bytes_total{device!~"loop.*|ram.*|dm-.*"}[5m]) + rate(node_disk_written_bytes_total{device!~"loop.*|ram.*|dm-.*"}[5m])) / 1048576`), start, end, step)

	rows := make([]nodeDashboardNode, 0, len(nodeNames))
	for _, nodeName := range nodeNames {
		rows = append(rows, nodeDashboardNode{
			NodeID:         nodeName,
			CPUUtil:        roundTo(cpuNow[nodeName], 2),
			MemTotal:       roundTo(memTotalNow[nodeName], 2),
			MemUsed:        roundTo(memUsedNow[nodeName], 2),
			MemBuffers:     roundTo(memBuffersNow[nodeName], 2),
			MemCached:      roundTo(memCachedNow[nodeName], 2),
			DiskReads:      roundTo(diskReadNow[nodeName], 2),
			DiskWrites:     roundTo(diskWriteNow[nodeName], 2),
			FSUsedPercent:  roundTo(fsNow[nodeName], 0),
			NetRx:          roundTo(netRxNow[nodeName], 2),
			NetTx:          roundTo(netTxNow[nodeName], 2),
			TCPEstablished: roundTo(tcpNow[nodeName], 0),
			Load1m:         roundTo(load1Now[nodeName], 2),
			Load5m:         roundTo(load5Now[nodeName], 2),
			Load15m:        roundTo(load15Now[nodeName], 2),
			Status:         statusByNode[nodeName],
		})
	}

	return nodeDashboardResponse{
		Nodes:           rows,
		TimeAxis:        timeAxis,
		CPUSeries:       buildNodeSeries(timeAxis, nodeNames, cpuHistory),
		MemorySeries:    buildNodeSeries(timeAxis, nodeNames, memHistory),
		DiskIOSeries:    buildNodeSeries(timeAxis, nodeNames, diskHistory),
		NetworkIOSeries: buildNodeSeries(timeAxis, nodeNames, netHistory),
		LoadSeries:      buildNodeSeries(timeAxis, nodeNames, loadHistory),
		TCPSeries:       buildNodeSeries(timeAxis, nodeNames, tcpHistory),
	}, nil
}

func (a *app) queryNodeInstant(ctx context.Context, query string) (map[string]float64, error) {
	results, err := a.observability.queryMetricsInstant(ctx, query)
	if err != nil {
		log.Printf("node instant query failed: %s: %v", query, err)
		return map[string]float64{}, err
	}
	return promVectorByNode(results), nil
}

func (a *app) queryNodeRange(ctx context.Context, query string, start, end time.Time, step time.Duration) (map[string]map[string]float64, error) {
	results, err := a.observability.queryMetricsRange(ctx, query, start, end, step)
	if err != nil {
		log.Printf("node range query failed: %s: %v", query, err)
		return map[string]map[string]float64{}, err
	}
	return promRangeByNode(results), nil
}

func nodeMetricExpr(expr string) string {
	return fmt.Sprintf("(%s) * on(instance) group_left(nodename) node_uname_info", expr)
}

func promVectorByNode(results []promResult) map[string]float64 {
	values := make(map[string]float64, len(results))
	for _, result := range results {
		nodeName := metricNodeName(result.Metric)
		if nodeName == "" {
			continue
		}
		values[nodeName] = promSampleValue(result.Value)
	}
	return values
}

func promRangeByNode(results []promResult) map[string]map[string]float64 {
	series := make(map[string]map[string]float64, len(results))
	for _, result := range results {
		nodeName := metricNodeName(result.Metric)
		if nodeName == "" {
			continue
		}
		if _, ok := series[nodeName]; !ok {
			series[nodeName] = make(map[string]float64)
		}
		for _, sample := range promRangeValues([]promResult{result}) {
			series[nodeName][sample.Timestamp.Format("15:04")] = sample.Value
		}
	}
	return series
}

func buildNodeSeries(timeAxis []string, nodeNames []string, values map[string]map[string]float64) []nodeDashboardSeries {
	series := make([]nodeDashboardSeries, 0, len(nodeNames))
	for _, nodeName := range nodeNames {
		series = append(series, nodeDashboardSeries{
			NodeID: nodeName,
			Values: alignSeries(timeAxis, values[nodeName]),
		})
	}
	return series
}

func metricNodeName(metric map[string]string) string {
	for _, key := range []string{"nodename", "node", "hostname"} {
		if value := strings.TrimSpace(metric[key]); value != "" {
			return value
		}
	}

	instance := strings.TrimSpace(metric["instance"])
	if instance == "" {
		return ""
	}
	if host, _, found := strings.Cut(instance, ":"); found {
		return host
	}
	return instance
}

func nodeReadyText(node corev1.Node) string {
	if isNodeReady(node) {
		return "Ready"
	}
	return "NotReady"
}
