# NPU Dashboard 배포 메모

## 배포 모델

- Namespace: `npu-dashboard`
- Frontend 노출 방식: `Traefik Ingress + HTTPS`
- Backend 노출 방식: `ClusterIP`
- 인증: 모든 `/api/*` 요청은 Keycloak 보호
- 통신 방식: 외부 HTTPS / 내부 Service 간 HTTP
- 이미지 레지스트리: GHCR public image
- 이미지 태그 전략: 운영 안정화 후 `sha-*` 고정 권장

## YAML 파일 위치

배포에 사용하는 Kubernetes YAML 파일들은 아래 디렉토리에 둔다.

```text
k8s/
  npu-dashboard/
    namespace.yaml
    kustomization.yaml
    frontend-configmap.yaml
    frontend.yaml
    backend-configmap.yaml
    backend.yaml
    dashboard-ingress.yaml
    rbac.yaml
```

이 구조를 기준으로 아래 명령을 실행한다.

- 전체 적용: `kubectl apply -k k8s/npu-dashboard`
- 전체 삭제: `kubectl delete -k k8s/npu-dashboard`

즉, 개별 파일을 하나씩 적용하는 방식보다 `kustomization.yaml`을 기준으로 디렉토리 단위 배포를 사용하는 구조다.

## 사용 엔드포인트

- Frontend 접속 주소: `https://dashboard.home.arpa:32443`
- Keycloak 외부 주소: `https://keycloak.home.arpa:32443`
- Backend 서비스 DNS: `http://dashboard-backend.npu-dashboard.svc.cluster.local:8081`
- Keycloak 내부 DNS: `http://keycloak.keycloak.svc.cluster.local:8080`
- VictoriaLogs: `http://victoria-logs-single-server.observability.svc.cluster.local:9428`
- VictoriaTraces: `http://victoria-traces-vtc-vtselect.observability.svc.cluster.local:10471`
- OTel Collector: `http://otel-collector-collector.observability.svc.cluster.local:4318`
- Ingress Controller: `Traefik`

## Frontend에 Nginx 프록시가 필요한 이유

브라우저는 외부에서 `dashboard.home.arpa`로 접속하지만, frontend 컨테이너는 여전히 `/api/*` 요청을 backend Service로 프록시해야 한다.

이번 구조에서도 backend는 `ClusterIP`로만 운영하므로, frontend 컨테이너 내부 Nginx가 `/api/*` 요청을 backend 서비스로 프록시해야 한다.  
배포 매니페스트에는 이 설정을 위한 Nginx ConfigMap이 포함되어 있다.

## 설정 주입 방식

### Frontend 런타임 설정

`/usr/share/nginx/html/env-config.js` 경로에 ConfigMap을 마운트한다.

- `VITE_OIDC_AUTHORITY`
- `VITE_OIDC_CLIENT_ID`
- `VITE_OIDC_REDIRECT_PATH`
- `VITE_OIDC_POST_LOGOUT_REDIRECT_PATH`
- `VITE_ACCELERATOR_TYPE`

### Backend 설정

Backend는 환경변수로 설정을 주입받는다.

- 인증 및 OIDC 관련 설정
- frontend 허용 origin
- informer resync 및 TTL cache 설정
- observability backend URL

OIDC 관련해서는 브라우저/토큰 기준 issuer와 backend 내부 discovery 주소를 분리할 수 있다.

- `OIDC_ISSUER_URL`
  - 외부 HTTPS 기준 issuer
- `OIDC_DISCOVERY_URL`
  - backend Pod가 내부 DNS로 조회하는 discovery 주소

이 분리가 필요한 이유:

- 브라우저와 토큰은 `https://keycloak.home.arpa:32443`를 기준으로 동작한다.
- backend Pod는 사용자 PC의 hosts 파일이나 CA 저장소를 쓰지 않으므로, issuer discovery는 내부 Service DNS로 접근하는 편이 안정적이다.
- `go-oidc`의 issuer override 기능을 사용해 external issuer와 internal discovery를 함께 처리한다.

## 배포 순서

1. namespace와 RBAC를 적용한다.
2. backend ConfigMap과 Deployment를 적용한다.
3. frontend ConfigMap과 Deployment를 적용한다.
4. dashboard Ingress를 적용한다.
5. Traefik가 `dashboard.home.arpa`를 정상 라우팅하는지 확인한다.
6. 로그인 시 Keycloak로 정상 리다이렉트되는지 확인한다.
7. 로그인 후 `/api/clusters/summary` 호출이 성공하는지 확인한다.

## 실제 배포 명령 순서

### 1. 저장소 최신 상태 확인

```bash
git pull origin master
```

### 2. 현재 배포 YAML 위치 확인

```bash
find k8s/npu-dashboard -maxdepth 1 -type f | sort
```

### 3. Kustomize 렌더링 결과 확인

적용 전에 어떤 리소스가 생성되는지 미리 본다.

```bash
kubectl kustomize k8s/npu-dashboard
```

### 4. 프론트와 백엔드 배포

아래 명령 하나로 namespace, ConfigMap, RBAC, frontend, backend가 모두 배포된다.

```bash
kubectl apply -k k8s/npu-dashboard
```

### 5. 배포 리소스 확인

```bash
kubectl get all -n npu-dashboard
```

### 6. 파드 기동 상태 확인

```bash
kubectl get pods -n npu-dashboard -w
```

### 7. 서비스 확인

```bash
kubectl get svc -n npu-dashboard
kubectl describe svc dashboard-backend -n npu-dashboard
kubectl describe svc dashboard-frontend -n npu-dashboard
```

기대 상태:

- `dashboard-frontend`: `ClusterIP`
- `dashboard-backend`: `ClusterIP`

### 8. Ingress 확인

```bash
kubectl get ingress -A
kubectl describe ingress dashboard -n npu-dashboard
kubectl get svc -n traefik
```

### 9. 백엔드 로그 확인

```bash
kubectl logs deploy/dashboard-backend -n npu-dashboard
```

여기서 아래와 같은 항목을 확인한다.

- 서버가 `8081` 포트로 정상 기동했는지
- `kubernetes auth enabled: true`가 보이는지
- informer cache 관련 에러가 없는지
- OIDC verifier 초기화 에러가 없는지

### 10. 프론트 로그 확인

```bash
kubectl logs deploy/dashboard-frontend -n npu-dashboard
```

여기서는 Nginx 기동 오류나 ConfigMap 마운트 문제 여부를 본다.

### 11. 브라우저 접속 확인

```text
https://dashboard.home.arpa:32443
```

접속 후 확인할 것:

- 로그인 시 Keycloak로 이동하는지
- 로그인 후 다시 대시보드로 돌아오는지
- 화면에서 API 호출 에러가 없는지
- 브라우저 mixed content 에러가 없는지

## 개별 적용이 필요할 때

전체 적용 대신 개별 파일 단위로도 배포할 수 있다.

```bash
kubectl apply -f k8s/npu-dashboard/namespace.yaml
kubectl apply -f k8s/npu-dashboard/rbac.yaml
kubectl apply -f k8s/npu-dashboard/backend-configmap.yaml
kubectl apply -f k8s/npu-dashboard/backend.yaml
kubectl apply -f k8s/npu-dashboard/frontend-configmap.yaml
kubectl apply -f k8s/npu-dashboard/frontend.yaml
kubectl apply -f k8s/npu-dashboard/dashboard-ingress.yaml
```

다만 운영 시에는 파일 누락 가능성을 줄이기 위해 `kubectl apply -k k8s/npu-dashboard` 방식을 권장한다.

## 적용 명령

```bash
kubectl apply -k k8s/npu-dashboard
```

GitHub Actions가 새 이미지를 올린 뒤 특정 버전으로 고정하고 싶다면, 매니페스트의 `:latest`를 `:sha-<commit>` 형태의 태그로 바꾸면 된다.

## 확인 명령

```bash
kubectl get all -n npu-dashboard
kubectl describe svc dashboard-frontend -n npu-dashboard
kubectl logs deploy/dashboard-backend -n npu-dashboard
kubectl logs deploy/dashboard-frontend -n npu-dashboard
kubectl describe ingress dashboard -n npu-dashboard
```

## 재배포 명령

이미지를 새로 올린 뒤 다시 반영하고 싶다면 아래 순서로 진행한다.

```bash
kubectl apply -k k8s/npu-dashboard
kubectl rollout restart deploy/dashboard-backend -n npu-dashboard
kubectl rollout restart deploy/dashboard-frontend -n npu-dashboard
kubectl rollout status deploy/dashboard-backend -n npu-dashboard
kubectl rollout status deploy/dashboard-frontend -n npu-dashboard
```

현재 매니페스트는 `latest` 태그를 사용할 때 노드 캐시 문제를 피하기 위해 `imagePullPolicy: Always`를 사용한다.  
운영 단계에서는 `latest` 대신 새 `sha-*` 태그로 고정하는 방식이 가장 안전하다.
