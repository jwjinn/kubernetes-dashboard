package main

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"log"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"time"

	"github.com/coreos/go-oidc/v3/oidc"
	corev1 "k8s.io/api/core/v1"
	"k8s.io/apimachinery/pkg/api/resource"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/client-go/kubernetes"
	"k8s.io/client-go/rest"
	"k8s.io/client-go/tools/clientcmd"
)

const (
	defaultFrontendOrigin = "http://localhost:5173"
	defaultBackendPort    = "8081"
)

type app struct {
	kubeClient                 kubernetes.Interface
	clusterCache               *clusterCache
	responseCache              *ttlCache
	observability              *observabilityClient
	mcpAgentBaseURL            string
	diagnosisChatTimeout       time.Duration
	nodeMetricsJob             string
	nodeCluster                string
	nodeMetricsMappingStrategy string
	nodeMetricsPodNamespace    string
	nodeMetricsPodNameRegex    string
	nodeMetricsPodInfoMetric   string
	summaryTTL                 time.Duration
	topologyTTL                time.Duration
	containersTTL              time.Duration
	metricsTTL                 time.Duration
	acceleratorTTL             time.Duration
	logsTTL                    time.Duration
	tracesTTL                  time.Duration
	authEnabled                bool
	allowedOrigin              string
	tokenVerifier              *oidc.IDTokenVerifier
}

type clusterSummaryResponse struct {
	UsedGPU      int    `json:"usedGpu"`
	TotalGPU     int    `json:"totalGpu"`
	IdleGPU      int    `json:"idleGpu"`
	Temperature  int    `json:"temperature"`
	HealthStatus string `json:"healthStatus"`
}

type topologyResponse struct {
	Nodes []flowNode `json:"nodes"`
	Edges []flowEdge `json:"edges"`
}

type flowNode struct {
	ID       string         `json:"id"`
	Type     string         `json:"type"`
	Position flowPosition   `json:"position"`
	Data     map[string]any `json:"data"`
}

type flowPosition struct {
	X float64 `json:"x"`
	Y float64 `json:"y"`
}

type flowEdge struct {
	ID     string `json:"id"`
	Source string `json:"source"`
	Target string `json:"target"`
}

func main() {
	ctx := context.Background()

	kubeClient, err := newKubernetesClient()
	if err != nil {
		log.Fatalf("failed to create kubernetes client: %v", err)
	}

	application := &app{
		kubeClient:                 kubeClient,
		authEnabled:                strings.EqualFold(os.Getenv("AUTH_ENABLED"), "true"),
		allowedOrigin:              envOrDefault("FRONTEND_ORIGIN", defaultFrontendOrigin),
		responseCache:              newTTLCache(),
		observability:              newObservabilityClient(),
		mcpAgentBaseURL:            strings.TrimRight(strings.TrimSpace(os.Getenv("MCP_AGENT_BASE_URL")), "/"),
		diagnosisChatTimeout:       durationEnvOrDefault("DIAGNOSIS_CHAT_TIMEOUT", 240*time.Second),
		nodeMetricsJob:             envOrDefault("NODE_METRICS_JOB", "node-exporter"),
		nodeCluster:                strings.TrimSpace(os.Getenv("NODE_METRICS_CLUSTER")),
		nodeMetricsMappingStrategy: envOrDefault("NODE_METRICS_MAPPING_STRATEGY", "auto"),
		nodeMetricsPodNamespace:    strings.TrimSpace(os.Getenv("NODE_METRICS_POD_NAMESPACE")),
		nodeMetricsPodNameRegex:    envOrDefault("NODE_METRICS_POD_NAME_REGEX", "node-exporter-.*"),
		nodeMetricsPodInfoMetric:   envOrDefault("NODE_METRICS_POD_INFO_METRIC", "kube_pod_info"),
		summaryTTL:                 durationEnvOrDefault("SUMMARY_CACHE_TTL", 10*time.Second),
		topologyTTL:                durationEnvOrDefault("TOPOLOGY_CACHE_TTL", 15*time.Second),
		containersTTL:              10 * time.Second,
		metricsTTL:                 30 * time.Second,
		acceleratorTTL:             15 * time.Second,
		logsTTL:                    5 * time.Second,
		tracesTTL:                  15 * time.Second,
	}

	cacheResync := durationEnvOrDefault("KUBERNETES_CACHE_RESYNC", 10*time.Minute)
	clusterCache, err := newClusterCache(ctx, kubeClient, cacheResync)
	if err != nil {
		log.Fatalf("failed to initialize informer cache: %v", err)
	}
	application.clusterCache = clusterCache

	if application.authEnabled {
		verifier, err := newOIDCVerifier(ctx)
		if err != nil {
			log.Fatalf("failed to initialize OIDC verifier: %v", err)
		}
		application.tokenVerifier = verifier
	}

	mux := http.NewServeMux()
	mux.HandleFunc("/healthz", application.handleHealth)
	mux.HandleFunc("/api/clusters/summary", application.handleClusterSummary)
	mux.HandleFunc("/api/topology", application.handleTopology)
	mux.HandleFunc("/api/pods/", application.handlePods)
	mux.HandleFunc("/api/k8s/containers", application.handleContainers)
	mux.HandleFunc("/api/k8s/events", application.handleK8sEvents)
	mux.HandleFunc("/api/k8s/pod-describe", application.handlePodDescribe)
	mux.HandleFunc("/api/k8s/pod-logs", application.handlePodLogs)
	mux.HandleFunc("/api/diagnosis/chat", application.handleDiagnosisChat)
	mux.HandleFunc("/api/diagnosis/chat/stream", application.handleDiagnosisChatStream)
	mux.HandleFunc("/api/k8s/node-metrics", application.handleNodeMetrics)
	mux.HandleFunc("/api/k8s/metrics/", application.handleK8sMetrics)
	mux.HandleFunc("/api/gpu/devices", application.handleGPUDevices)
	mux.HandleFunc("/api/gpu/trends", application.handleGPUTrends)
	mux.HandleFunc("/api/npu/devices", application.handleNPUDevices)
	mux.HandleFunc("/api/npu/trends", application.handleNPUTrends)
	mux.HandleFunc("/api/npu/cluster-overview", application.handleNPUClusterOverview)
	mux.HandleFunc("/api/npu/hardware-details", application.handleNPUHardwareDetails)
	mux.HandleFunc("/api/npu/workload-mapping", application.handleNPUWorkloadMapping)
	mux.HandleFunc("/api/npu/device-history", application.handleNPUDeviceHistory)
	mux.HandleFunc("/api/logs", application.handleLogs)
	mux.HandleFunc("/api/traces", application.handleTraces)

	port := envOrDefault("PORT", defaultBackendPort)
	addr := ":" + port

	log.Printf("backend listening on http://localhost:%s", port)
	log.Printf("kubernetes auth enabled: %t", application.authEnabled)
	log.Printf("mcp agent base URL configured: %t", application.mcpAgentBaseURL != "")
	log.Printf("diagnosis chat timeout: %s", application.diagnosisChatTimeout)
	log.Printf("informer cache resync interval: %s", cacheResync)
	log.Printf(
		"node metrics mapping: strategy=%s job=%s cluster=%q podNamespace=%q podNameRegex=%q podInfoMetric=%s",
		application.nodeMetricsMappingStrategy,
		application.nodeMetricsJob,
		application.nodeCluster,
		application.nodeMetricsPodNamespace,
		application.nodeMetricsPodNameRegex,
		application.nodeMetricsPodInfoMetric,
	)

	if err := http.ListenAndServe(addr, application.withMiddleware(mux)); err != nil {
		log.Fatal(err)
	}
}

func newKubernetesClient() (kubernetes.Interface, error) {
	config, err := rest.InClusterConfig()
	if err != nil {
		kubeconfig := os.Getenv("KUBECONFIG")
		if kubeconfig == "" {
			home, homeErr := os.UserHomeDir()
			if homeErr != nil {
				return nil, fmt.Errorf("failed to resolve user home directory: %w", homeErr)
			}
			kubeconfig = filepath.Join(home, ".kube", "config")
		}

		config, err = clientcmd.BuildConfigFromFlags("", kubeconfig)
		if err != nil {
			return nil, fmt.Errorf("failed to build kubeconfig %q: %w", kubeconfig, err)
		}
	}

	clientset, err := kubernetes.NewForConfig(config)
	if err != nil {
		return nil, fmt.Errorf("failed to create kubernetes clientset: %w", err)
	}

	return clientset, nil
}

func newOIDCVerifier(ctx context.Context) (*oidc.IDTokenVerifier, error) {
	issuerURL := envOrDefault("OIDC_ISSUER_URL", "http://localhost:8080/realms/dashboard-realm")
	jwksURL := strings.TrimSpace(os.Getenv("OIDC_JWKS_URL"))

	if jwksURL != "" {
		keySet := oidc.NewRemoteKeySet(ctx, jwksURL)
		return oidc.NewVerifier(issuerURL, keySet, &oidc.Config{SkipClientIDCheck: true}), nil
	}

	discoveryURL := envOrDefault("OIDC_DISCOVERY_URL", issuerURL)

	discoveryCtx := ctx
	if discoveryURL != issuerURL {
		// Use the externally visible issuer while allowing internal discovery URLs.
		discoveryCtx = oidc.InsecureIssuerURLContext(ctx, issuerURL)
	}

	provider, err := oidc.NewProvider(discoveryCtx, discoveryURL)
	if err != nil {
		return nil, fmt.Errorf("failed to query provider discovery %q with issuer %q: %w", discoveryURL, issuerURL, err)
	}

	return provider.Verifier(&oidc.Config{SkipClientIDCheck: true}), nil
}

func (a *app) withMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		a.setCORSHeaders(w)
		if r.Method == http.MethodOptions {
			w.WriteHeader(http.StatusNoContent)
			return
		}

		if a.authEnabled && strings.HasPrefix(r.URL.Path, "/api/") {
			if err := a.authorizeRequest(r); err != nil {
				writeError(w, http.StatusUnauthorized, err.Error())
				return
			}
		}

		next.ServeHTTP(w, r)
	})
}

func (a *app) authorizeRequest(r *http.Request) error {
	if a.tokenVerifier == nil {
		return errors.New("token verifier is not configured")
	}

	rawAccessToken := r.Header.Get("Authorization")
	if rawAccessToken == "" {
		return errors.New("missing Authorization header")
	}

	parts := strings.Split(rawAccessToken, " ")
	if len(parts) != 2 || !strings.EqualFold(parts[0], "Bearer") {
		return errors.New("invalid Authorization header format")
	}

	if _, err := a.tokenVerifier.Verify(r.Context(), parts[1]); err != nil {
		return fmt.Errorf("invalid token: %w", err)
	}

	return nil
}

func (a *app) setCORSHeaders(w http.ResponseWriter) {
	w.Header().Set("Access-Control-Allow-Origin", a.allowedOrigin)
	w.Header().Set("Access-Control-Allow-Headers", "Authorization, Content-Type")
	w.Header().Set("Access-Control-Allow-Methods", "GET, POST, DELETE, OPTIONS")
}

func (a *app) handleHealth(w http.ResponseWriter, r *http.Request) {
	if a.clusterCache == nil || !a.clusterCache.HasSynced() {
		writeError(w, http.StatusServiceUnavailable, "kubernetes informer cache is not synced")
		return
	}

	writeJSON(w, http.StatusOK, map[string]string{
		"status": "ok",
	})
}

func (a *app) handleClusterSummary(w http.ResponseWriter, r *http.Request) {
	payload, err := a.responseCache.GetOrSet("cluster-summary", a.summaryTTL, func() (any, error) {
		nodes, err := a.clusterCache.ListNodes()
		if err != nil {
			return nil, fmt.Errorf("failed to list nodes from cache: %w", err)
		}

		pods, err := a.clusterCache.ListPods()
		if err != nil {
			return nil, fmt.Errorf("failed to list pods from cache: %w", err)
		}

		return buildClusterSummary(nodes, pods), nil
	})
	if err != nil {
		writeError(w, http.StatusServiceUnavailable, err.Error())
		return
	}

	writeJSON(w, http.StatusOK, payload)
}

func (a *app) handleTopology(w http.ResponseWriter, r *http.Request) {
	filterNode := r.URL.Query().Get("nodeId")
	cacheKey := "topology"
	if filterNode != "" {
		cacheKey += ":" + filterNode
	}

	payload, err := a.responseCache.GetOrSet(cacheKey, a.topologyTTL, func() (any, error) {
		nodes, err := a.clusterCache.ListNodes()
		if err != nil {
			return nil, fmt.Errorf("failed to list nodes from cache: %w", err)
		}

		pods, err := a.clusterCache.ListPods()
		if err != nil {
			return nil, fmt.Errorf("failed to list pods from cache: %w", err)
		}

		return buildTopology(nodes, pods, filterNode), nil
	})
	if err != nil {
		writeError(w, http.StatusServiceUnavailable, err.Error())
		return
	}

	writeJSON(w, http.StatusOK, payload)
}

func (a *app) handlePods(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		writeError(w, http.StatusMethodNotAllowed, "method not allowed")
		return
	}

	if !strings.HasSuffix(r.URL.Path, "/terminate") {
		writeError(w, http.StatusNotFound, "endpoint not found")
		return
	}

	podRef := strings.TrimPrefix(r.URL.Path, "/api/pods/")
	podRef = strings.TrimSuffix(podRef, "/terminate")

	namespace, podName, err := parsePodReference(podRef)
	if err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}

	ctx, cancel := context.WithTimeout(r.Context(), 10*time.Second)
	defer cancel()

	deleteGracePeriod := int64(0)
	deletePolicy := metav1.DeletePropagationForeground
	if err := a.kubeClient.CoreV1().Pods(namespace).Delete(ctx, podName, metav1.DeleteOptions{
		GracePeriodSeconds: &deleteGracePeriod,
		PropagationPolicy:  &deletePolicy,
	}); err != nil {
		writeError(w, http.StatusBadGateway, fmt.Sprintf("failed to delete pod %s/%s: %v", namespace, podName, err))
		return
	}

	writeJSON(w, http.StatusOK, map[string]string{
		"message": fmt.Sprintf("Pod %s/%s was scheduled for termination.", namespace, podName),
	})
}

func parsePodReference(raw string) (string, string, error) {
	parts := strings.Split(raw, ":")
	if len(parts) != 3 || parts[0] != "pod" {
		return "", "", fmt.Errorf("invalid pod reference %q", raw)
	}
	return parts[1], parts[2], nil
}

func buildClusterSummary(nodes []*corev1.Node, pods []*corev1.Pod) clusterSummaryResponse {
	totalGPU := 0
	usedGPU := 0
	readyNodes := 0

	for _, node := range nodes {
		totalGPU += gpuCapacity(node.Status.Allocatable)
		if isNodeReady(*node) {
			readyNodes++
		}
	}

	for _, pod := range pods {
		usedGPU += podGPURequest(pod)
	}

	if usedGPU > totalGPU {
		usedGPU = totalGPU
	}

	healthStatus := "Healthy"
	switch {
	case len(nodes) == 0:
		healthStatus = "Unknown"
	case readyNodes < len(nodes):
		healthStatus = "Degraded"
	case totalGPU > 0 && usedGPU >= totalGPU:
		healthStatus = "Busy"
	}

	usageRatio := 0.0
	if totalGPU > 0 {
		usageRatio = float64(usedGPU) / float64(totalGPU)
	}

	temperature := 48 + int(usageRatio*35)
	if readyNodes < len(nodes) {
		temperature += 5
	}
	if temperature > 95 {
		temperature = 95
	}

	return clusterSummaryResponse{
		UsedGPU:      usedGPU,
		TotalGPU:     totalGPU,
		IdleGPU:      max(totalGPU-usedGPU, 0),
		Temperature:  temperature,
		HealthStatus: healthStatus,
	}
}

func buildTopology(nodes []*corev1.Node, pods []*corev1.Pod, filterNode string) topologyResponse {
	var flowNodes []flowNode
	var flowEdges []flowEdge

	serverIndex := 0
	for _, node := range nodes {
		if filterNode != "" && node.Name != filterNode {
			continue
		}

		serverNodeID := "node:" + node.Name
		serverX := float64(serverIndex) * 360
		parentPositions := map[string]float64{
			serverNodeID: serverX,
		}

		flowNodes = append(flowNodes, flowNode{
			ID:       serverNodeID,
			Type:     "serverNode",
			Position: flowPosition{X: serverX, Y: 0},
			Data: map[string]any{
				"label":  node.Name,
				"status": nodeHealthStatus(*node),
			},
		})

		gpuTotal := gpuCapacity(node.Status.Allocatable)
		gpuAnchorIDs := make([]string, 0, max(gpuTotal, 1))

		if gpuTotal > 0 {
			for gpuIndex := 0; gpuIndex < gpuTotal; gpuIndex++ {
				gpuID := fmt.Sprintf("gpu:%s:%d", node.Name, gpuIndex+1)
				gpuAnchorIDs = append(gpuAnchorIDs, gpuID)
				flowNodes = append(flowNodes, flowNode{
					ID:       gpuID,
					Type:     "gpuNode",
					Position: flowPosition{X: serverX + float64(gpuIndex*170), Y: 180},
					Data: map[string]any{
						"label":  fmt.Sprintf("%s GPU-%d", node.Name, gpuIndex+1),
						"status": nodeHealthStatus(*node),
					},
				})
				parentPositions[gpuID] = serverX + float64(gpuIndex*170)
				flowEdges = append(flowEdges, flowEdge{
					ID:     fmt.Sprintf("edge:%s:%s", serverNodeID, gpuID),
					Source: serverNodeID,
					Target: gpuID,
				})
			}
		}

		podOffset := 0
		podsByParent := make(map[string][]*corev1.Pod)
		for _, pod := range pods {
			if pod.Spec.NodeName != node.Name || shouldSkipPod(*pod) {
				continue
			}

			parentID := serverNodeID
			if len(gpuAnchorIDs) > 0 {
				parentID = gpuAnchorIDs[podOffset%len(gpuAnchorIDs)]
			}
			podsByParent[parentID] = append(podsByParent[parentID], pod)

			podOffset++
		}

		parentIDs := gpuAnchorIDs
		if len(parentIDs) == 0 {
			parentIDs = []string{serverNodeID}
		}

		for _, parentID := range parentIDs {
			parentPods := podsByParent[parentID]
			parentX := parentPositions[parentID]
			visibleCount := min(len(parentPods), 3)

			for visibleIndex := 0; visibleIndex < visibleCount; visibleIndex++ {
				pod := parentPods[visibleIndex]
				podID := fmt.Sprintf("pod:%s:%s", pod.Namespace, pod.Name)
				podX := parentX + float64((visibleIndex-1)*120)
				podY := 360.0

				flowNodes = append(flowNodes, flowNode{
					ID:       podID,
					Type:     "podNode",
					Position: flowPosition{X: podX, Y: podY},
					Data: map[string]any{
						"label":     pod.Name,
						"namespace": pod.Namespace,
						"status":    podHealthStatus(*pod),
					},
				})

				flowEdges = append(flowEdges, flowEdge{
					ID:     fmt.Sprintf("edge:%s:%s", parentID, podID),
					Source: parentID,
					Target: podID,
				})
			}

			hiddenCount := len(parentPods) - visibleCount
			if hiddenCount > 0 {
				summaryID := fmt.Sprintf("pod-summary:%s", parentID)
				flowNodes = append(flowNodes, flowNode{
					ID:       summaryID,
					Type:     "podNode",
					Position: flowPosition{X: parentX, Y: 480},
					Data: map[string]any{
						"label":       fmt.Sprintf("+%d more", hiddenCount),
						"namespace":   "collapsed",
						"status":      "running",
						"isSummary":   true,
						"hiddenCount": hiddenCount,
					},
				})

				flowEdges = append(flowEdges, flowEdge{
					ID:     fmt.Sprintf("edge:%s:%s", parentID, summaryID),
					Source: parentID,
					Target: summaryID,
				})
			}
		}

		serverIndex++
	}

	return topologyResponse{
		Nodes: flowNodes,
		Edges: flowEdges,
	}
}

func gpuCapacity(resources corev1.ResourceList) int {
	total := 0
	for resourceName, quantity := range resources {
		resourceKey := string(resourceName)
		if strings.Contains(resourceKey, "gpu") {
			total += int(quantity.Value())
		}
	}
	return total
}

func podGPURequest(pod *corev1.Pod) int {
	total := resource.NewQuantity(0, resource.DecimalSI)
	for _, container := range pod.Spec.Containers {
		for resourceName, quantity := range container.Resources.Requests {
			if strings.Contains(string(resourceName), "gpu") {
				total.Add(quantity)
			}
		}
	}
	return int(total.Value())
}

func isNodeReady(node corev1.Node) bool {
	for _, condition := range node.Status.Conditions {
		if condition.Type == corev1.NodeReady {
			return condition.Status == corev1.ConditionTrue
		}
	}
	return false
}

func nodeHealthStatus(node corev1.Node) string {
	if !isNodeReady(node) {
		return "critical"
	}
	if gpuCapacity(node.Status.Allocatable) == 0 {
		return "warning"
	}
	return "healthy"
}

func podHealthStatus(pod corev1.Pod) string {
	switch pod.Status.Phase {
	case corev1.PodRunning, corev1.PodSucceeded:
		return "running"
	case corev1.PodPending:
		return "pending"
	default:
		return "failed"
	}
}

func shouldSkipPod(pod corev1.Pod) bool {
	return pod.Spec.NodeName == "" || pod.Status.Phase == corev1.PodSucceeded
}

func writeJSON(w http.ResponseWriter, status int, payload any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	if err := json.NewEncoder(w).Encode(payload); err != nil {
		log.Printf("failed to write json response: %v", err)
	}
}

func writeError(w http.ResponseWriter, status int, message string) {
	writeJSON(w, status, map[string]string{"error": message})
}

func envOrDefault(key, fallback string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}
	return fallback
}

func durationEnvOrDefault(key string, fallback time.Duration) time.Duration {
	value := os.Getenv(key)
	if value == "" {
		return fallback
	}

	duration, err := time.ParseDuration(value)
	if err != nil {
		log.Printf("invalid duration for %s=%q, using fallback %s", key, value, fallback)
		return fallback
	}

	return duration
}

func max(a, b int) int {
	if a > b {
		return a
	}
	return b
}
