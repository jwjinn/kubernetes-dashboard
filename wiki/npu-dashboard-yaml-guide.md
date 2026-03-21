# NPU Dashboard YAML 구성 설명

## 이 문서를 어떻게 읽으면 좋은가

이 문서는 "배포 YAML이 왜 이렇게 생겼는지"를 설명하는 문서다.

추천 읽기 순서는 아래와 같다.

1. 전체 구조 요약
2. `frontend-configmap.yaml`, `backend-configmap.yaml`
3. `frontend.yaml`, `backend.yaml`
4. `dashboard-ingress.yaml`
5. `rbac.yaml`

이 문서는 `k8s/npu-dashboard` 디렉토리에 있는 Kubernetes YAML 파일들이 각각 어떤 역할을 하는지, 왜 필요한지, 서로 어떻게 연결되는지를 설명한다.

## 전체 구조 요약

이 배포 구성의 목표는 다음과 같다.

- `npu-dashboard` 네임스페이스에 프론트와 백엔드를 분리 배포한다.
- 프론트는 Traefik Ingress를 통해 외부 HTTPS로 접속한다.
- 백엔드는 외부에 직접 노출하지 않고 `ClusterIP`로만 통신한다.
- 사용자는 프론트로 접속하고, 프론트는 `/api` 요청을 백엔드로 프록시한다.
- 백엔드는 Keycloak 토큰을 검증하고 Kubernetes 및 observability 시스템과 통신한다.
- 주소나 설정값은 코드 하드코딩 대신 `ConfigMap`으로 주입한다.

즉, 이 YAML 세트는 단순히 파드를 띄우는 목적이 아니라 아래 구조를 만들기 위한 것이다.

```text
사용자 브라우저
  -> Traefik NodePort(HTTPS)
  -> dashboard Ingress
  -> dashboard-frontend(ClusterIP)
  -> frontend 내부 nginx
  -> dashboard-backend(ClusterIP)
  -> Kubernetes API / VictoriaMetrics / VictoriaLogs / VictoriaTraces / Keycloak
```

## 파일별 설명

이 섹션은 "파일 하나를 열었을 때 무엇을 봐야 하는가"에 초점을 맞춘다.

### `namespace.yaml`

이 파일은 `npu-dashboard` 네임스페이스를 만든다.

목적:

- 대시보드 관련 리소스를 다른 시스템과 분리하기 위해 사용
- 배포, 서비스, ConfigMap, ServiceAccount를 한 영역으로 묶기 위해 필요

왜 필요한가:

- 지금 클러스터에는 `observability`, `keycloak`, `monitoring` 등 여러 네임스페이스가 이미 존재한다.
- 대시보드 리소스를 별도 네임스페이스로 두면 추적과 운영이 쉬워진다.

### `kustomization.yaml`

이 파일은 `kubectl apply -k k8s/npu-dashboard`로 전체 리소스를 한 번에 적용할 수 있게 묶어준다.

목적:

- 여러 YAML 파일을 순서 있게 관리
- namespace, config, rbac, deployment를 하나의 배포 단위로 취급

왜 필요한가:

- 운영할 때 개별 파일마다 `kubectl apply -f`를 반복하는 것보다 실수가 적다.
- 나중에 이미지 태그나 리소스 수정을 할 때도 하나의 디렉토리 단위로 관리하기 쉽다.

### `frontend-configmap.yaml`

이 파일은 두 개의 ConfigMap을 만든다.

#### 1. `dashboard-frontend-runtime`

프론트 런타임 설정을 `env-config.js`로 주입한다.

포함 값:

- `VITE_OIDC_AUTHORITY`
- `VITE_OIDC_CLIENT_ID`
- `VITE_OIDC_REDIRECT_PATH`
- `VITE_OIDC_POST_LOGOUT_REDIRECT_PATH`
- `VITE_ACCELERATOR_TYPE`

목적:

- Keycloak 주소, client ID, redirect 경로를 이미지 빌드 없이 바꿀 수 있게 함
- 같은 프론트 이미지를 다른 환경에서도 재사용 가능하게 함
- 현재 구조에서는 `VITE_OIDC_AUTHORITY`를 Keycloak Ingress HTTPS 주소로 맞추는 용도로 사용

왜 필요한가:

- Keycloak 주소가 바뀔 수 있는데 코드에 하드코딩하면 이미지 재빌드가 필요하다.
- 지금 목표가 ConfigMap으로 인자를 받아 배포되는 구조이기 때문에 필수다.
- 환경이 달라져도 프론트 이미지는 유지하고 설정만 교체할 수 있다.

#### 2. `dashboard-frontend-nginx`

프론트 컨테이너 내부 Nginx 설정을 주입한다.

핵심 기능:

- `/api/` 요청을 `dashboard-backend.npu-dashboard.svc.cluster.local:8081`로 프록시
- `/` 요청은 SPA 라우팅을 위해 `index.html`로 fallback

목적:

- 브라우저는 backend `ClusterIP`에 직접 접근할 수 없기 때문에 frontend가 중간 프록시 역할을 하도록 만듦

왜 필요한가:

- 이번 구조에서는 backend를 외부로 노출하지 않기로 했기 때문
- 프론트만 `NodePort`로 노출하고도 API 호출이 가능하게 하려면 이 프록시 구성이 필요하다
- 브라우저 기준에서는 same-origin 흐름이 유지되어 CORS 복잡도가 줄어든다

### `frontend.yaml`

이 파일은 프론트 Deployment와 Service를 만든다.

#### Deployment

역할:

- `ghcr.io/jwjinn/kubernetes-dashboard-frontend:latest` 이미지를 실행
- `env-config.js`와 `default.conf`를 ConfigMap으로 마운트
- readiness/liveness probe로 기본 동작 상태 확인

왜 필요한가:

- 프론트는 사용자가 접속하는 진입점이다.
- 단순 정적 파일 서빙이 아니라, runtime config와 backend proxy가 같이 붙어 있어야 한다.
- Ingress 뒤에서 안정적으로 라우팅되는 기본 웹 엔드포인트 역할을 한다.

#### Service

역할:

- 타입은 `ClusterIP`
- Traefik Ingress가 이 서비스로 트래픽을 전달

왜 필요한가:

- 외부 공개는 Traefik가 담당하고, frontend는 내부 서비스로만 두기 위해 필요하다
- TLS 종료 지점을 Traefik에 모아두기 위해서도 `ClusterIP`가 적합하다

### `backend-configmap.yaml`

이 파일은 백엔드 설정용 ConfigMap을 만든다.

포함 값:

- 서버 포트
- 인증 사용 여부
- 프론트 origin
- Keycloak issuer URL
- Keycloak discovery URL
- informer resync 주기
- summary/topology TTL cache 시간
- observability 시스템 내부 DNS 주소
- OTel exporter 주소

목적:

- 백엔드가 환경에 맞는 주소와 동작 파라미터를 외부에서 받도록 하기 위함

왜 필요한가:

- 현재 환경은 Keycloak, VictoriaLogs, VictoriaTraces, OTel Collector가 이미 별도 네임스페이스에 떠 있다.
- 이 주소들을 코드 하드코딩으로 고정하면 환경이 바뀔 때 유지보수가 어려워진다.
- informer와 TTL cache 시간도 운영 중 조정 가능해야 한다.
- OIDC에서는 외부 issuer와 내부 discovery 주소를 분리해 reverse proxy 환경을 안정적으로 처리해야 한다.
- metrics / logs / traces / MCP endpoint가 모두 여기에 모여 있어 운영 변경 지점을 한 곳에서 관리할 수 있다.

### `backend.yaml`

이 파일은 백엔드 Deployment와 Service를 만든다.

#### Deployment

역할:

- `ghcr.io/jwjinn/kubernetes-dashboard-backend:latest` 이미지를 실행
- `dashboard-backend-config` ConfigMap을 환경변수로 주입
- `dashboard-backend` ServiceAccount를 사용
- `/healthz`로 readiness/liveness probe 수행

왜 필요한가:

- 백엔드는 Kubernetes API, observability 시스템, Keycloak 검증을 담당하는 핵심 계층이다.
- 프론트가 직접 여러 시스템에 붙지 않고 백엔드를 통해서만 데이터에 접근하게 만들기 위해 필요하다.
- 인증, 권한, API fan-out, 캐시 전략을 한 계층에 집중시키기 위한 구조다.

#### Service

역할:

- 타입은 `ClusterIP`
- 클러스터 내부에서만 접근 가능

왜 필요한가:

- 외부에 직접 노출하지 않고 frontend 프록시를 통해서만 접근시키기 위함
- 인증, 권한, 관측 시스템 연동을 backend 하나에 집중시키려는 구조와 맞다

### `dashboard-ingress.yaml`

이 파일은 Traefik가 `dashboard.home.arpa` 요청을 frontend Service로 전달하도록 정의한다.

목적:

- 외부 사용자가 HTTPS로 dashboard에 접속할 수 있게 함
- TLS secret `dashboard-tls`를 frontend 서비스에 연결

왜 필요한가:

- OIDC PKCE는 브라우저의 secure context를 필요로 한다.
- 초기 `NodePort + HTTP + IP` 구조에서는 `crypto.subtle` 사용이 막혀 로그인이 실패했다.
- Traefik Ingress와 TLS를 통해 `https://dashboard.home.arpa:32443` 접속 경로를 제공해야 브라우저가 secure context로 인식한다.
- frontend를 `ClusterIP`로 유지하면서도 외부 공개 주소를 일관되게 관리할 수 있다.

### `rbac.yaml`

이 파일은 백엔드가 Kubernetes API를 조회하고 일부 작업을 수행할 수 있도록 권한을 부여한다.

포함 리소스:

- `ServiceAccount`
- `ClusterRole`
- `ClusterRoleBinding`

권한 내용:

- `nodes`, `pods`, `namespaces`, `events`, `services`, `endpoints` 조회
- `deployments`, `daemonsets`, `statefulsets`, `replicasets` 조회
- `jobs`, `cronjobs` 조회
- `pods` 삭제
- `pods/log` 조회

목적:

- 백엔드가 대시보드 조회 API를 구현하는 데 필요한 Kubernetes 리소스 접근 권한 제공

왜 필요한가:

- 클러스터 내부에서 돌아가는 파드라고 해서 자동으로 Kubernetes API를 읽을 수 있는 것은 아니다.
- 현재 백엔드는 node/pod 상태 조회와 pod terminate 기능을 제공하므로 이 권한이 필요하다.
- namespace 범위를 전체로 가져가기로 했기 때문에 `ClusterRole`로 구성했다.
- 나중에 기능이 늘어나면 가장 먼저 검토해야 할 보안 파일도 이 파일이다.

## 파일들이 함께 만드는 동작 흐름

배포 후 예상되는 연결 흐름은 아래와 같다.

1. 사용자가 `https://dashboard.home.arpa:32443`으로 접속한다.
2. Traefik NodePort가 TLS를 종료하고 `dashboard` Ingress 규칙을 적용한다.
3. Ingress가 `dashboard-frontend` Service로 트래픽을 전달한다.
4. 프론트는 `env-config.js`에서 Keycloak OIDC HTTPS 주소를 읽는다.
5. 사용자가 로그인하면 브라우저가 `https://keycloak.home.arpa:32443`로 이동한다.
6. Keycloak에서 토큰을 발급받고 dashboard로 redirect한다.
7. 프론트가 `/api/*` 요청을 보내면 frontend 내부 Nginx가 backend Service로 프록시한다.
8. 백엔드는 내부 Service DNS로 Keycloak discovery를 조회하고, 외부 HTTPS issuer 기준으로 토큰을 검증한다.
9. 응답 데이터는 다시 frontend를 통해 사용자 브라우저로 전달된다.

## 이 구성이 현재 의사결정과 어떻게 연결되는가

이번 YAML은 지금까지 정한 운영 원칙을 반영하고 있다.

- backend는 외부 노출하지 않는다
- frontend는 Traefik Ingress 뒤 ClusterIP로 둔다
- Keycloak 인증은 전체 API에 적용한다
- observability 조회는 backend가 내부 DNS로 처리한다
- Redis는 아직 도입하지 않는다
- 환경별 주소와 설정은 ConfigMap으로 주입한다
- OIDC issuer와 discovery 주소를 분리한다

즉, 이 구성은 단순한 테스트용이 아니라 현재 원하는 운영 방향을 그대로 옮긴 1차 배포 형태라고 보면 된다.

## 배포 전에 특히 확인할 포인트

실제 배포 전에는 아래 세 가지만 먼저 체크해도 많은 문제를 줄일 수 있다.

- Ingress host / TLS secret / DNS가 맞는지
- Keycloak redirect URI / web origin / issuer 주소가 맞는지
- observability Service DNS와 포트가 현재 클러스터와 맞는지

- frontend 이미지가 ConfigMap 기반 OIDC 런타임 설정 변경을 포함하고 있는지
- backend 이미지가 informer/cache 변경을 포함하고 있는지
- Traefik가 `dashboard.home.arpa`를 frontend로 라우팅하는지
- Keycloak 주소 `https://keycloak.home.arpa:32443`가 브라우저에서 열리는지
- 브라우저와 사용자 PC가 내부 CA를 신뢰하는지
- backend가 `observability` 네임스페이스 서비스 DNS에 접근 가능한지

## 한 줄 요약

`k8s/npu-dashboard`의 YAML 파일들은 "외부 사용자는 Traefik HTTPS로 dashboard에 접속하고, 내부에서는 frontend/backend가 ClusterIP로 통신하며, OIDC와 데이터 접근은 백엔드에 집중하고, 설정은 ConfigMap으로 외부화"라는 현재 아키텍처를 Kubernetes 리소스로 풀어놓은 구성이다.
