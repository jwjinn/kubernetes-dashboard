package main

import (
	"context"
	"fmt"
	"net/http"
	"sort"
	"strconv"
	"strings"
	"time"

	corev1 "k8s.io/api/core/v1"
)

type acceleratorDevice struct {
	ID           string `json:"id"`
	Node         string `json:"node"`
	Model        string `json:"model"`
	Type         string `json:"type,omitempty"`
	Status       string `json:"status"`
	Utilization  int    `json:"utilization"`
	UUID         string `json:"uuid"`
	Namespace    string `json:"namespace"`
	Pod          string `json:"pod"`
	VramUsage    string `json:"vramUsage"`
	VramTotal    string `json:"vramTotal"`
	Temperature  int    `json:"temperature"`
	Power        int    `json:"power,omitempty"`
	MigMode      string `json:"migMode,omitempty"`
	MigId        string `json:"migId,omitempty"`
	MigProfile   string `json:"migProfile,omitempty"`
	CronJob      string `json:"cronJob,omitempty"`
	Job          string `json:"job,omitempty"`
	Ready        string `json:"ready,omitempty"`
	PodPhase     string `json:"podPhase,omitempty"`
	RestartCount int    `json:"restartCount,omitempty"`
	Age          string `json:"age,omitempty"`
}

type acceleratorTrendItem struct {
	DeviceID string `json:"deviceId"`
	Label    string `json:"label"`
	UUID     string `json:"uuid"`
	History  []int  `json:"history"`
}

type deviceMetricSeries struct {
	DeviceID string    `json:"deviceId"`
	Node     string    `json:"node"`
	UUID     string    `json:"uuid"`
	Label    string    `json:"label"`
	Values   []float64 `json:"values"`
}

type npuClusterOverview struct {
	TotalCapacity    int                 `json:"totalCapacity"`
	Allocated        int                 `json:"allocated"`
	HardwareVersions []hardwareVersion   `json:"hardwareVersions"`
	NodeAllocation   []nodeAllocationRow `json:"nodeAllocation"`
}

type hardwareVersion struct {
	Node          string `json:"node"`
	DriverVersion string `json:"driverVersion"`
	Family        string `json:"family"`
	Product       string `json:"product"`
}

type nodeAllocationRow struct {
	Node      string `json:"node"`
	Allocated int    `json:"allocated"`
	Capacity  int    `json:"capacity"`
}

type npuHardwareDetails struct {
	Devices        []acceleratorDevice `json:"devices"`
	Topology       []npuTopologyGroup  `json:"topology"`
	NodeAllocation []nodeAllocationRow `json:"nodeAllocation"`
}

type npuTopologyGroup struct {
	GroupID  string   `json:"groupId"`
	Node     string   `json:"node"`
	Parent   string   `json:"parent"`
	Children []string `json:"children"`
}

type npuWorkloadMapping struct {
	PodMappings []podMappingRow `json:"podMappings"`
	Contexts    []processRow    `json:"contexts"`
}

type npuDeviceHistoryResponse struct {
	TimeAxis          []string             `json:"timeAxis"`
	UtilSeries        []deviceMetricSeries `json:"utilSeries"`
	MemorySeries      []deviceMetricSeries `json:"memorySeries"`
	TemperatureSeries []deviceMetricSeries `json:"temperatureSeries"`
	PowerSeries       []deviceMetricSeries `json:"powerSeries"`
}

type podMappingRow struct {
	PodName   string   `json:"podName"`
	Node      string   `json:"node"`
	Requested int      `json:"requested"`
	Devices   []string `json:"devices"`
}

type processRow struct {
	Status      string `json:"status"`
	Memalloc    string `json:"memalloc"`
	Node        string `json:"node"`
	DeviceIdx   string `json:"deviceIdx"`
	Utilization int    `json:"utilization"`
	Temperature int    `json:"temperature"`
	Power       int    `json:"power"`
}

type npuSnapshot struct {
	Devices       []acceleratorDevice
	PodMappings   []podMappingRow
	Contexts      []processRow
	Overview      npuClusterOverview
	Topology      []npuTopologyGroup
	TrendByDevice map[string][]int
}

type npuMetricSet struct {
	util      []promResult
	dramUsed  []promResult
	dramTotal []promResult
	temp      []promResult
	power     []promResult
	health    []promResult
}

type npuDeviceState struct {
	Hostname        string
	Name            string
	UUID            string
	Card            string
	DeviceID        string
	DriverVersion   string
	FirmwareVersion string
	Namespace       string
	Pod             string
	Container       string
	Utilization     float64
	DramUsedBytes   float64
	DramTotalBytes  float64
	Temperature     float64
	Power           float64
	Health          float64
}

func (a *app) handleGPUDevices(w http.ResponseWriter, _ *http.Request) {
	writeJSON(w, http.StatusOK, []acceleratorDevice{})
}

func (a *app) handleGPUTrends(w http.ResponseWriter, _ *http.Request) {
	writeJSON(w, http.StatusOK, []acceleratorTrendItem{})
}

func (a *app) handleNPUDevices(w http.ResponseWriter, r *http.Request) {
	snapshot, err := a.loadNPUSnapshot(r.Context())
	if err != nil {
		writeError(w, http.StatusServiceUnavailable, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, snapshot.Devices)
}

func (a *app) handleNPUClusterOverview(w http.ResponseWriter, r *http.Request) {
	snapshot, err := a.loadNPUSnapshot(r.Context())
	if err != nil {
		writeError(w, http.StatusServiceUnavailable, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, snapshot.Overview)
}

func (a *app) handleNPUHardwareDetails(w http.ResponseWriter, r *http.Request) {
	snapshot, err := a.loadNPUSnapshot(r.Context())
	if err != nil {
		writeError(w, http.StatusServiceUnavailable, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, npuHardwareDetails{
		Devices:        snapshot.Devices,
		Topology:       snapshot.Topology,
		NodeAllocation: snapshot.Overview.NodeAllocation,
	})
}

func (a *app) handleNPUWorkloadMapping(w http.ResponseWriter, r *http.Request) {
	snapshot, err := a.loadNPUSnapshot(r.Context())
	if err != nil {
		writeError(w, http.StatusServiceUnavailable, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, npuWorkloadMapping{
		PodMappings: snapshot.PodMappings,
		Contexts:    snapshot.Contexts,
	})
}

func (a *app) handleNPUDeviceHistory(w http.ResponseWriter, r *http.Request) {
	history, err := a.loadNPUDeviceHistory(r.Context())
	if err != nil {
		writeError(w, http.StatusServiceUnavailable, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, history)
}

func (a *app) handleNPUTrends(w http.ResponseWriter, r *http.Request) {
	snapshot, err := a.loadNPUSnapshot(r.Context())
	if err != nil {
		writeError(w, http.StatusServiceUnavailable, err.Error())
		return
	}

	trends := make([]acceleratorTrendItem, 0, len(snapshot.Devices))
	for _, device := range snapshot.Devices {
		trends = append(trends, acceleratorTrendItem{
			DeviceID: device.ID,
			Label:    fmt.Sprintf("%s / %s / %s", device.Node, device.Model, device.ID),
			UUID:     device.UUID,
			History:  snapshot.TrendByDevice[device.UUID],
		})
	}
	writeJSON(w, http.StatusOK, trends)
}

func (a *app) loadNPUSnapshot(ctx context.Context) (*npuSnapshot, error) {
	payload, err := a.responseCache.GetOrSet("npu-snapshot", a.acceleratorTTL, func() (any, error) {
		requestCtx, cancel := context.WithTimeout(ctx, 12*time.Second)
		defer cancel()

		nodes, err := a.clusterCache.ListNodes()
		if err != nil {
			return nil, fmt.Errorf("failed to list nodes: %w", err)
		}
		pods, err := a.clusterCache.ListPods()
		if err != nil {
			return nil, fmt.Errorf("failed to list pods: %w", err)
		}

		metrics, err := a.loadNPUMetrics(requestCtx)
		if err != nil {
			return nil, err
		}

		devices := mergeNPUDeviceStates(metrics)
		trends := a.loadNPUTrendHistory(requestCtx, devices)
		snapshot := buildNPUSnapshot(nodes, pods, devices, trends)
		return snapshot, nil
	})
	if err != nil {
		return nil, err
	}

	snapshot, ok := payload.(*npuSnapshot)
	if !ok {
		return nil, fmt.Errorf("unexpected npu snapshot type")
	}
	return snapshot, nil
}

func (a *app) loadNPUMetrics(ctx context.Context) (npuMetricSet, error) {
	queries := []struct {
		name  string
		query string
	}{
		{name: "util", query: npuMetricByDevice(npuUtilMetric())},
		{name: "dram_used", query: npuMetricByDevice(npuDramUsedMetric())},
		{name: "dram_total", query: npuMetricByDevice(npuDramTotalMetric())},
		{name: "temp", query: npuMetricByDevice(npuTempMetric())},
		{name: "power", query: npuMetricByDevice(npuPowerMetric())},
		{name: "health", query: npuMetricByDevice(npuHealthMetric())},
	}

	loaded := make(map[string][]promResult, len(queries))
	for _, item := range queries {
		results, err := a.observability.queryMetricsInstant(ctx, item.query)
		if err != nil {
			return npuMetricSet{}, fmt.Errorf("failed to load npu metric %s: %w", item.name, err)
		}
		loaded[item.name] = results
	}

	return npuMetricSet{
		util:      loaded["util"],
		dramUsed:  loaded["dram_used"],
		dramTotal: loaded["dram_total"],
		temp:      loaded["temp"],
		power:     loaded["power"],
		health:    loaded["health"],
	}, nil
}

func mergeNPUDeviceStates(metrics npuMetricSet) []npuDeviceState {
	devices := map[string]npuDeviceState{}
	apply := func(results []promResult, setter func(*npuDeviceState, float64)) {
		for _, result := range results {
			state := npuStateFromResult(result)
			key := state.UUID
			current, exists := devices[key]
			if !exists || preferNPUState(state, current) {
				current = mergeNPUStateMeta(current, state)
			}
			setter(&current, promSampleValue(result.Value))
			devices[key] = current
		}
	}

	apply(metrics.util, func(state *npuDeviceState, value float64) { state.Utilization = value })
	apply(metrics.dramUsed, func(state *npuDeviceState, value float64) { state.DramUsedBytes = value })
	apply(metrics.dramTotal, func(state *npuDeviceState, value float64) { state.DramTotalBytes = value })
	apply(metrics.temp, func(state *npuDeviceState, value float64) { state.Temperature = value })
	apply(metrics.power, func(state *npuDeviceState, value float64) { state.Power = value })
	apply(metrics.health, func(state *npuDeviceState, value float64) { state.Health = value })

	merged := make([]npuDeviceState, 0, len(devices))
	for _, state := range devices {
		merged = append(merged, state)
	}

	sort.Slice(merged, func(i, j int) bool {
		if merged[i].Hostname == merged[j].Hostname {
			return merged[i].Name < merged[j].Name
		}
		return merged[i].Hostname < merged[j].Hostname
	})
	return merged
}

func buildNPUSnapshot(nodes []*corev1.Node, pods []*corev1.Pod, states []npuDeviceState, trends map[string][]int) *npuSnapshot {
	podIndex := indexPodsByNamespaceAndName(pods)

	devices := make([]acceleratorDevice, 0, len(states))
	contexts := make([]processRow, 0)

	for _, state := range states {
		pod := podIndex[state.Namespace+"/"+state.Pod]
		device := acceleratorDevice{
			ID:           state.Name,
			Node:         state.Hostname,
			Model:        firstNonEmpty(state.Card, defaultNPUCardName),
			Type:         "C",
			Status:       npuDeviceStatus(state),
			Utilization:  clampInt(int(state.Utilization), 0, 100),
			UUID:         state.UUID,
			Namespace:    emptyAsDash(state.Namespace),
			Pod:          emptyAsDash(state.Pod),
			VramUsage:    bytesToGiBString(state.DramUsedBytes),
			VramTotal:    bytesToGiBString(state.DramTotalBytes),
			Temperature:  int(state.Temperature),
			Power:        int(state.Power),
			Ready:        "-",
			PodPhase:     "-",
			RestartCount: 0,
			Age:          "-",
		}

		if pod != nil {
			device.Ready = podReadyString(pod)
			device.PodPhase = string(pod.Status.Phase)
			device.RestartCount = podRestartCount(pod)
			device.Age = objectAge(pod.CreationTimestamp.Time)
		}

		devices = append(devices, device)

		if isTelemetryActive(state) {
			contexts = append(contexts, processRow{
				Status:      telemetryStatus(state),
				Memalloc:    bytesToGiBString(state.DramUsedBytes),
				Node:        state.Hostname,
				DeviceIdx:   state.Name,
				Utilization: clampInt(int(state.Utilization), 0, 100),
				Temperature: int(state.Temperature),
				Power:       int(state.Power),
			})
		}
	}

	sort.Slice(contexts, func(i, j int) bool {
		if contexts[i].Node == contexts[j].Node {
			return contexts[i].DeviceIdx < contexts[j].DeviceIdx
		}
		return contexts[i].Node < contexts[j].Node
	})
	overview := buildNPUOverview(nodes, pods, states)
	podMappingRows := buildNPUPodMappings(pods)

	return &npuSnapshot{
		Devices:       devices,
		PodMappings:   podMappingRows,
		Contexts:      contexts,
		Overview:      overview,
		Topology:      buildNPUTopology(devices),
		TrendByDevice: trends,
	}
}

func buildNPUPodMappings(pods []*corev1.Pod) []podMappingRow {
	rows := make([]podMappingRow, 0)
	for _, pod := range pods {
		if !shouldCountPodForNodeAllocation(pod) {
			continue
		}
		requested := acceleratorRequestCount(pod, "NPU")
		if requested == 0 {
			continue
		}
		rows = append(rows, podMappingRow{
			PodName:   pod.Name,
			Node:      pod.Spec.NodeName,
			Requested: requested,
			Devices:   []string{},
		})
	}

	sort.Slice(rows, func(i, j int) bool {
		if rows[i].Node == rows[j].Node {
			return rows[i].PodName < rows[j].PodName
		}
		return rows[i].Node < rows[j].Node
	})
	return rows
}

func buildNPUOverview(nodes []*corev1.Node, pods []*corev1.Pod, states []npuDeviceState) npuClusterOverview {
	nodeAllocation := make([]nodeAllocationRow, 0)
	hardwareVersions := make([]hardwareVersion, 0)
	allocationsByNode := make(map[string]int)
	driverVersionByNode := make(map[string]string)
	productByNode := make(map[string]string)

	for _, pod := range pods {
		if !shouldCountPodForNodeAllocation(pod) {
			continue
		}
		requested := acceleratorRequestCount(pod, "NPU")
		if requested == 0 {
			continue
		}
		allocationsByNode[pod.Spec.NodeName] += requested
	}

	for _, state := range states {
		if strings.TrimSpace(state.Hostname) == "" {
			continue
		}
		if driverVersionByNode[state.Hostname] == "" && strings.TrimSpace(state.DriverVersion) != "" {
			driverVersionByNode[state.Hostname] = state.DriverVersion
		}
		if productByNode[state.Hostname] == "" && strings.TrimSpace(state.Card) != "" {
			productByNode[state.Hostname] = state.Card
		}
	}

	totalCapacity := 0
	totalAllocated := 0
	for _, node := range nodes {
		capacity := acceleratorCapacity(node.Status.Allocatable, "NPU")
		if capacity == 0 {
			continue
		}

		allocated := allocationsByNode[node.Name]
		if allocated > capacity {
			allocated = capacity
		}

		nodeAllocation = append(nodeAllocation, nodeAllocationRow{
			Node:      node.Name,
			Allocated: allocated,
			Capacity:  capacity,
		})
		hardwareVersions = append(hardwareVersions, hardwareVersion{
			Node:          node.Name,
			DriverVersion: firstNonEmpty(driverVersionByNode[node.Name], npuDriverVersionOverride(), node.Labels["rebellions.ai/driver-version"], "unknown"),
			Family:        firstNonEmpty(node.Labels["rebellions.ai/family"], defaultNPUFamily),
			Product:       firstNonEmpty(productByNode[node.Name], node.Labels["rebellions.ai/product"], defaultNPUCardName),
		})

		totalCapacity += capacity
		totalAllocated += allocated
	}

	sort.Slice(nodeAllocation, func(i, j int) bool { return nodeAllocation[i].Node < nodeAllocation[j].Node })
	sort.Slice(hardwareVersions, func(i, j int) bool { return hardwareVersions[i].Node < hardwareVersions[j].Node })

	return npuClusterOverview{
		TotalCapacity:    totalCapacity,
		Allocated:        totalAllocated,
		HardwareVersions: hardwareVersions,
		NodeAllocation:   nodeAllocation,
	}
}

func (a *app) loadNPUTrendHistory(ctx context.Context, devices []npuDeviceState) map[string][]int {
	history := make(map[string][]int, len(devices))
	end := time.Now()
	start := end.Add(-1 * time.Hour)
	step := 2 * time.Minute

	for _, device := range devices {
		query := npuMetricRange(npuUtilMetric(), device.Hostname, device.Name)
		results, err := a.observability.queryMetricsRange(ctx, query, start, end, step)
		if err != nil {
			history[device.UUID] = syntheticHistory(device.UUID, int(device.Utilization), 31)
			continue
		}
		history[device.UUID] = compressPromHistory(results, device.UUID, 31, int(device.Utilization))
	}

	return history
}

func (a *app) loadNPUDeviceHistory(ctx context.Context) (*npuDeviceHistoryResponse, error) {
	payload, err := a.responseCache.GetOrSet("npu-device-history", a.acceleratorTTL, func() (any, error) {
		requestCtx, cancel := context.WithTimeout(ctx, 20*time.Second)
		defer cancel()

		snapshot, err := a.loadNPUSnapshot(requestCtx)
		if err != nil {
			return nil, err
		}

		end := time.Now().Truncate(2 * time.Hour)
		start := end.Add(-7 * 24 * time.Hour)
		step := 2 * time.Hour
		timeAxis := buildNPUHistoryTimeAxis(start, end, step)
		targetCount := len(timeAxis)

		loadMetric := func(metricName string) []promResult {
			results, queryErr := a.observability.queryMetricsRange(requestCtx, npuMetricRange(metricName, "", ""), start, end, step)
			if queryErr != nil {
				return nil
			}
			return results
		}

		return &npuDeviceHistoryResponse{
			TimeAxis:          timeAxis,
			UtilSeries:        buildDeviceMetricSeries(snapshot.Devices, loadMetric(npuUtilMetric()), targetCount, func(device acceleratorDevice) float64 { return float64(device.Utilization) }, func(value float64) float64 { return value }, func(base float64) float64 { return 18 }, 0, 100),
			MemorySeries:      buildDeviceMetricSeries(snapshot.Devices, loadMetric(npuDramUsedMetric()), targetCount, func(device acceleratorDevice) float64 { return parseGiBString(device.VramUsage) }, func(value float64) float64 { return value / 1024 / 1024 / 1024 }, func(base float64) float64 { return maxFloat(base*0.18, 0.8) }, 0, 0),
			TemperatureSeries: buildDeviceMetricSeries(snapshot.Devices, loadMetric(npuTempMetric()), targetCount, func(device acceleratorDevice) float64 { return float64(device.Temperature) }, func(value float64) float64 { return value }, func(base float64) float64 { return 4 }, 0, 100),
			PowerSeries:       buildDeviceMetricSeries(snapshot.Devices, loadMetric(npuPowerMetric()), targetCount, func(device acceleratorDevice) float64 { return float64(device.Power) }, func(value float64) float64 { return value }, func(base float64) float64 { return 8 }, 0, 200),
		}, nil
	})
	if err != nil {
		return nil, err
	}

	history, ok := payload.(*npuDeviceHistoryResponse)
	if !ok {
		return nil, fmt.Errorf("unexpected npu device history type")
	}
	return history, nil
}

func buildNPUTopology(devices []acceleratorDevice) []npuTopologyGroup {
	byNode := make(map[string][]string)
	for _, device := range devices {
		byNode[device.Node] = append(byNode[device.Node], device.ID)
	}

	var topology []npuTopologyGroup
	for nodeName, names := range byNode {
		sort.Strings(names)
		groupIndex := 0
		for index := 0; index < len(names); index += 4 {
			end := min(index+4, len(names))
			parent := names[index]
			children := append([]string(nil), names[index+1:end]...)
			topology = append(topology, npuTopologyGroup{
				GroupID:  fmt.Sprintf("%s-group-%d", nodeName, groupIndex),
				Node:     nodeName,
				Parent:   parent,
				Children: children,
			})
			groupIndex++
		}
	}

	sort.Slice(topology, func(i, j int) bool {
		if topology[i].Node == topology[j].Node {
			return topology[i].GroupID < topology[j].GroupID
		}
		return topology[i].Node < topology[j].Node
	})
	return topology
}

func npuStateFromResult(result promResult) npuDeviceState {
	return npuDeviceState{
		Hostname:        result.Metric["hostname"],
		Name:            result.Metric["name"],
		UUID:            result.Metric["uuid"],
		Card:            result.Metric["card"],
		DeviceID:        result.Metric["deviceID"],
		DriverVersion:   result.Metric["driver_version"],
		FirmwareVersion: result.Metric["firmware_version"],
		Namespace:       result.Metric["namespace"],
		Pod:             result.Metric["pod"],
		Container:       result.Metric["container"],
	}
}

func preferNPUState(candidate, current npuDeviceState) bool {
	if current.Pod == "" && candidate.Pod != "" {
		return true
	}
	if current.Namespace == "" && candidate.Namespace != "" {
		return true
	}
	if current.Container == "" && candidate.Container != "" {
		return true
	}
	return false
}

func mergeNPUStateMeta(current, candidate npuDeviceState) npuDeviceState {
	if current.Hostname == "" {
		current.Hostname = candidate.Hostname
	}
	if current.Name == "" {
		current.Name = candidate.Name
	}
	if current.UUID == "" {
		current.UUID = candidate.UUID
	}
	if current.Card == "" {
		current.Card = candidate.Card
	}
	if current.DeviceID == "" {
		current.DeviceID = candidate.DeviceID
	}
	if current.DriverVersion == "" {
		current.DriverVersion = candidate.DriverVersion
	}
	if current.FirmwareVersion == "" {
		current.FirmwareVersion = candidate.FirmwareVersion
	}
	if preferNPUState(candidate, current) {
		current.Namespace = candidate.Namespace
		current.Pod = candidate.Pod
		current.Container = candidate.Container
	}
	return current
}

func buildDeviceMetricSeries(
	devices []acceleratorDevice,
	results []promResult,
	targetCount int,
	fallbackValue func(acceleratorDevice) float64,
	transform func(float64) float64,
	variation func(float64) float64,
	minValue float64,
	maxValue float64,
) []deviceMetricSeries {
	series := make([]deviceMetricSeries, 0, len(devices))
	for _, device := range devices {
		base := fallbackValue(device)
		values := compressPromFloatHistory(results, device.UUID, targetCount, base, transform)
		if len(values) == 0 {
			values = syntheticFloatHistory(device.UUID, base, targetCount, variation(base), minValue, maxValue)
		}
		series = append(series, deviceMetricSeries{
			DeviceID: device.ID,
			Node:     device.Node,
			UUID:     device.UUID,
			Label:    fmt.Sprintf("%s / %s", device.Node, device.ID),
			Values:   values,
		})
	}
	return series
}

func compressPromHistory(results []promResult, uuid string, targetCount, fallback int) []int {
	var values []float64
	for _, result := range results {
		if result.Metric["uuid"] != uuid {
			continue
		}
		for _, pair := range result.Values {
			if len(pair) != 2 {
				continue
			}
			values = append(values, float64FromAny(pair[1]))
		}
	}

	if len(values) == 0 {
		return syntheticHistory(uuid, fallback, targetCount)
	}

	if len(values) >= targetCount {
		step := float64(len(values)) / float64(targetCount)
		history := make([]int, 0, targetCount)
		for index := 0; index < targetCount; index++ {
			value := values[int(float64(index)*step)]
			history = append(history, clampInt(int(value), 0, 100))
		}
		return history
	}

	history := make([]int, 0, targetCount)
	for _, value := range values {
		history = append(history, clampInt(int(value), 0, 100))
	}
	for len(history) < targetCount {
		history = append(history, fallback)
	}
	return history
}

func compressPromFloatHistory(results []promResult, uuid string, targetCount int, fallback float64, transform func(float64) float64) []float64 {
	var values []float64
	for _, result := range results {
		if result.Metric["uuid"] != uuid {
			continue
		}
		for _, pair := range result.Values {
			if len(pair) != 2 {
				continue
			}
			values = append(values, transform(float64FromAny(pair[1])))
		}
	}

	if len(values) == 0 {
		return nil
	}

	if len(values) >= targetCount {
		step := float64(len(values)) / float64(targetCount)
		history := make([]float64, 0, targetCount)
		for index := 0; index < targetCount; index++ {
			history = append(history, roundToOneDecimal(values[int(float64(index)*step)]))
		}
		return history
	}

	history := make([]float64, 0, targetCount)
	for _, value := range values {
		history = append(history, roundToOneDecimal(value))
	}
	for len(history) < targetCount {
		history = append(history, roundToOneDecimal(fallback))
	}
	return history
}

func npuDeviceStatus(state npuDeviceState) string {
	if state.Health > 0 {
		return "Error"
	}
	if isTelemetryActive(state) {
		return "Active"
	}
	return "Idle"
}

func telemetryStatus(state npuDeviceState) string {
	if state.Health > 0 {
		return "Error"
	}
	if state.Utilization > 0 {
		return "Compute"
	}
	if state.DramUsedBytes > 0 {
		return "Memory Resident"
	}
	return "Idle"
}

func isTelemetryActive(state npuDeviceState) bool {
	return state.Utilization > 0 || state.DramUsedBytes > 0
}

func indexPodsByNamespaceAndName(pods []*corev1.Pod) map[string]*corev1.Pod {
	index := make(map[string]*corev1.Pod, len(pods))
	for _, pod := range pods {
		index[pod.Namespace+"/"+pod.Name] = pod
	}
	return index
}

func emptyAsDash(value string) string {
	if strings.TrimSpace(value) == "" {
		return "-"
	}
	return value
}

func bytesToGiBString(value float64) string {
	if value <= 0 {
		return "0 GiB"
	}
	return fmt.Sprintf("%.1f GiB", value/1024/1024/1024)
}

func parseGiBString(value string) float64 {
	trimmed := strings.TrimSpace(strings.TrimSuffix(value, "GiB"))
	parsed, _ := strconv.ParseFloat(strings.TrimSpace(trimmed), 64)
	return parsed
}

func clampInt(value, minValue, maxValue int) int {
	if value < minValue {
		return minValue
	}
	if value > maxValue {
		return maxValue
	}
	return value
}

func min(a, b int) int {
	if a < b {
		return a
	}
	return b
}

func syntheticHistory(seed string, base, count int) []int {
	history := make([]int, 0, count)
	hash := 0
	for _, r := range seed {
		hash += int(r)
	}
	for index := 0; index < count; index++ {
		value := base + ((hash + index*11) % 35) - 17
		history = append(history, clampInt(value, 0, 100))
	}
	return history
}

func syntheticFloatHistory(seed string, base float64, count int, variation float64, minValue float64, maxValue float64) []float64 {
	history := make([]float64, 0, count)
	hash := 0
	for _, r := range seed {
		hash += int(r)
	}
	for index := 0; index < count; index++ {
		delta := float64(((hash + index*11) % 21) - 10)
		value := base + delta*(variation/10)
		if value < minValue {
			value = minValue
		}
		if maxValue > minValue && value > maxValue {
			value = maxValue
		}
		history = append(history, roundToOneDecimal(value))
	}
	return history
}

func buildNPUHistoryTimeAxis(start, end time.Time, step time.Duration) []string {
	timeAxis := make([]string, 0)
	for current := start; !current.After(end); current = current.Add(step) {
		timeAxis = append(timeAxis, current.Format("01-02 15:04"))
	}
	return timeAxis
}

func roundToOneDecimal(value float64) float64 {
	return float64(int(value*10+0.5)) / 10
}

func maxFloat(a, b float64) float64 {
	if a > b {
		return a
	}
	return b
}

func acceleratorCapacity(resources corev1.ResourceList, mode string) int {
	total := 0
	for resourceName, quantity := range resources {
		if isAcceleratorResource(string(resourceName), mode) {
			total += int(quantity.Value())
		}
	}
	return total
}

func shouldCountPodForNodeAllocation(pod *corev1.Pod) bool {
	if pod == nil {
		return false
	}
	if strings.TrimSpace(pod.Spec.NodeName) == "" {
		return false
	}
	switch pod.Status.Phase {
	case corev1.PodSucceeded, corev1.PodFailed:
		return false
	default:
		return true
	}
}

func acceleratorRequestCount(pod *corev1.Pod, mode string) int {
	total := 0
	for _, container := range pod.Spec.Containers {
		for name, quantity := range container.Resources.Requests {
			if isAcceleratorResource(string(name), mode) {
				total += int(quantity.Value())
			}
		}
	}
	return total
}

func isAcceleratorResource(name, mode string) bool {
	key := strings.ToLower(name)
	switch mode {
	case "NPU":
		return strings.Contains(key, strings.ToLower(npuResourceName())) ||
			strings.Contains(key, "npu") ||
			strings.Contains(key, "atom") ||
			strings.Contains(key, "rbln")
	default:
		return strings.Contains(key, "gpu")
	}
}

func parseIntString(value string) int {
	parsed, _ := strconv.Atoi(value)
	return parsed
}

func firstNonEmpty(values ...string) string {
	for _, value := range values {
		if strings.TrimSpace(value) != "" {
			return value
		}
	}
	return ""
}

func podReadyString(pod *corev1.Pod) string {
	ready := 0
	for _, status := range pod.Status.ContainerStatuses {
		if status.Ready {
			ready++
		}
	}
	return fmt.Sprintf("%d/%d", ready, len(pod.Status.ContainerStatuses))
}

func podRestartCount(pod *corev1.Pod) int {
	total := 0
	for _, status := range pod.Status.ContainerStatuses {
		total += int(status.RestartCount)
	}
	return total
}

func objectAge(createdAt time.Time) string {
	if createdAt.IsZero() {
		return "-"
	}
	age := time.Since(createdAt)
	switch {
	case age.Hours() >= 24:
		return fmt.Sprintf("%dd", int(age.Hours()/24))
	case age.Hours() >= 1:
		return fmt.Sprintf("%dh", int(age.Hours()))
	default:
		return fmt.Sprintf("%dm", int(age.Minutes()))
	}
}
