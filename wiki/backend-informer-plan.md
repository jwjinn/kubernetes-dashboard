# 백엔드 Informer/Cache 구현 계획

## 목표

- 요청마다 `List()`를 호출하지 않도록 해서 `kube-apiserver` 부하를 줄인다.
- 초기에는 백엔드를 단일 레플리카로 운영할 수 있게 최대한 단순하게 유지한다.
- 대시보드 데이터 조회는 모두 백엔드를 통해 처리한다.
- 배포 설정은 `ConfigMap` 기반으로 외부화한다.

## 현재 병목

현재 백엔드는 다음과 같은 요청에서 Kubernetes API를 직접 호출한다.

- `/api/clusters/summary`
- `/api/topology`
- `/api/pods/:id/terminate`

특히 읽기 요청은 매번 `Nodes().List()`와 `Pods().List()`를 새로 호출해 응답을 계산하고 있다.  
사용자 수가 늘어나거나 프론트 폴링 주기가 짧아지면 `kube-apiserver`에 부담이 빠르게 쌓일 수 있다.

## 목표 아키텍처

### 1. Shared Informer 계층

프로세스 시작 시 `client-go` shared informer를 띄운다.

- `Core().V1().Nodes()`
- `Core().V1().Pods()`
- `Core().V1().Events()`
- 다음 단계 후보: `Namespaces()`, `Services()`, `Deployments()`

백엔드는 다음 방식으로 동작해야 한다.

- informer는 서버 시작 시 한 번만 띄운다.
- cache sync가 끝난 뒤에만 readiness를 통과시킨다.
- 요청 처리 시에는 live `List()` 대신 informer store/lister를 사용한다.

### 2. Informer 위의 TTL 응답 캐시

계산 비용이 있는 응답에는 가벼운 in-process TTL 캐시를 둔다.

- cluster summary: `10s`
- topology: `15s`
- events summary: `10s`
- observability 조회: `15s ~ 30s`

이렇게 하면 UI가 빠르게 반복 조회하더라도 동일 응답을 계속 재계산하지 않아도 된다.

### 3. 쓰기 작업만 직접 Kubernetes API 호출

직접 Kubernetes API를 호출하는 경로는 꼭 필요한 경우로 제한한다.

- pod terminate
- pod log streaming
- 기타 일회성 리소스 제어 작업

## 권장 백엔드 구조

### 패키지 구성

- `backend/internal/kube/client.go`
  - Kubernetes client 생성
- `backend/internal/kube/informers.go`
  - informer factory 시작과 cache sync 처리
- `backend/internal/kube/store.go`
  - lister 기반 typed getter
- `backend/internal/cache/ttl.go`
  - 계산 응답용 TTL 캐시
- `backend/internal/observability/logs.go`
  - VictoriaLogs 조회
- `backend/internal/observability/traces.go`
  - VictoriaTraces 조회
- `backend/internal/api/*.go`
  - 도메인별 HTTP handler

### 런타임 상태

애플리케이션 전역 상태에는 아래 정보가 포함된다.

- kubernetes client
- informer factory
- typed lister
- TTL cache
- OIDC verifier
- observability base URL

## 엔드포인트 전환 계획

### 1단계

- `/healthz`
  - informer sync 상태와 기본 준비 상태 확인
- `/api/clusters/summary`
  - 캐시된 node/pod 정보 기반 계산
- `/api/topology`
  - 캐시된 node/pod 정보 기반 계산

### 2단계

- `/api/k8s/events`
  - event informer/lister 기반 조회
- `/api/k8s/containers`
  - 캐시된 pod/container 정보에서 파생
- `/api/k8s/metrics/:containerId`
  - VictoriaMetrics 또는 Kubernetes Metrics API를 백엔드가 조회

### 3단계

- `/api/logs`
  - VictoriaLogs를 백엔드에서 조회
- `/api/traces`
  - VictoriaTraces를 백엔드에서 조회
- `/api/analysis/*`
  - 이벤트, 로그, 트레이스, pod 상태를 조합한 분석 API

## 배포 설정값

백엔드는 아래 환경변수를 통해 설정을 주입받는다.

- `AUTH_ENABLED`
- `FRONTEND_ORIGIN`
- `OIDC_ISSUER_URL`
- `OIDC_DISCOVERY_URL`
- `KUBERNETES_CACHE_RESYNC`
- `SUMMARY_CACHE_TTL`
- `TOPOLOGY_CACHE_TTL`
- `LOGS_BASE_URL`
- `TRACES_BASE_URL`
- `METRICS_BASE_URL`
- `OTEL_EXPORTER_OTLP_ENDPOINT`

## Redis 판단

1차 단계에서는 Redis를 의도적으로 제외한다.

이유는 다음과 같다.

- 단일 backend replica에서는 shared cache가 꼭 필요하지 않다.
- informer + lister만으로도 불필요한 Kubernetes API 호출 대부분을 줄일 수 있다.
- Redis를 먼저 넣으면 운영 복잡도만 증가하고 핵심 병목 해결은 늦어질 수 있다.

다음 조건이 생기면 Redis를 다시 검토한다.

- backend replica를 2개 이상으로 늘릴 때
- observability 조회 캐시를 여러 파드가 공유해야 할 때
- rate limiting, pub/sub, distributed lock 같은 기능이 필요할 때

## 구현 순서

1. 현재 Kubernetes client 생성 로직을 재사용 가능한 구조로 분리한다.
2. shared informer factory와 wait-for-sync 흐름을 추가한다.
3. summary/topology handler에서 live `List()` 호출을 lister 조회로 교체한다.
4. 계산 응답용 TTL cache를 추가한다.
5. logs, traces, metrics용 observability client를 추가한다.
6. 프론트가 호출하는 API 범위를 순차적으로 확장한다.
7. multi-replica 또는 shared cache 요구가 생기면 Redis를 검토한다.
