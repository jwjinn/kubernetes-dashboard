package main

import (
	"fmt"
	"os"
	"strings"
)

const (
	defaultNPUResourceName = "rebellions_ai_ATOM_CA25"
	defaultNPUCardName     = "RBLN-CA25"
	defaultNPUFamily       = "ATOM"
)

func npuResourceName() string {
	return envOrDefault("NPU_RESOURCE_NAME", defaultNPUResourceName)
}

func npuUtilMetric() string {
	return envOrDefault("RBLN_UTIL_METRIC", "RBLN_DEVICE_STATUS:UTILIZATION")
}

func npuDramUsedMetric() string {
	return envOrDefault("RBLN_DRAM_USED_METRIC", "RBLN_DEVICE_STATUS:DRAM_USED")
}

func npuDramTotalMetric() string {
	return envOrDefault("RBLN_DRAM_TOTAL_METRIC", "RBLN_DEVICE_STATUS:DRAM_TOTAL")
}

func npuTempMetric() string {
	return envOrDefault("RBLN_TEMP_METRIC", "RBLN_DEVICE_STATUS:TEMPERATURE")
}

func npuPowerMetric() string {
	return envOrDefault("RBLN_POWER_METRIC", "RBLN_DEVICE_STATUS:CARD_POWER")
}

func npuHealthMetric() string {
	return envOrDefault("RBLN_HEALTH_METRIC", "RBLN_DEVICE_STATUS:HEALTH")
}

func npuMetricByDevice(metricName string) string {
	return fmt.Sprintf(
		`avg by (hostname,pod,namespace,container,uuid,name,card,driver_version,firmware_version,deviceID) (%s)`,
		metricName,
	)
}

func npuMetricRange(metricName, hostname, deviceName string) string {
	var filters []string
	if hostname != "" {
		filters = append(filters, fmt.Sprintf(`hostname=%q`, hostname))
	}
	if deviceName != "" {
		filters = append(filters, fmt.Sprintf(`name=%q`, deviceName))
	}

	if len(filters) == 0 {
		return fmt.Sprintf(`avg by (hostname,name,uuid,pod,namespace) (%s)`, metricName)
	}

	return fmt.Sprintf(
		`avg by (hostname,name,uuid,pod,namespace) (%s{%s})`,
		metricName,
		strings.Join(filters, ","),
	)
}

func npuRequestedPodsQuery() string {
	return fmt.Sprintf(
		`sum by (namespace,pod,container,resource) (kube_pod_container_resource_requests{resource=%q})`,
		npuResourceName(),
	)
}

func npuAllocatableNodesQuery() string {
	return fmt.Sprintf(
		`sum by (node,resource) (kube_node_status_allocatable{resource=%q})`,
		npuResourceName(),
	)
}

func npuDriverVersionOverride() string {
	return strings.TrimSpace(os.Getenv("NPU_DRIVER_VERSION"))
}
