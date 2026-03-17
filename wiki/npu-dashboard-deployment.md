# NPU Dashboard 배포 메모

## 배포 모델

- Namespace: `npu_dashboard`
- Frontend 노출 방식: `NodePort`
- Backend 노출 방식: `ClusterIP`
- 인증: 모든 `/api/*` 요청은 Keycloak 보호
- 통신 방식: HTTP
- 이미지 레지스트리: GHCR public image
- 이미지 태그 전략: 초기 배포는 `latest`, 안정화 후 `sha-*` 태그로 고정

## 사용 엔드포인트

- Frontend 접속 주소: `http://192.168.160.69:30000`
- Keycloak 외부 주소: `http://192.168.160.69:30080`
- Backend 서비스 DNS: `http://dashboard-backend.npu_dashboard.svc.cluster.local:8081`
- VictoriaLogs: `http://victoria-logs-single-server.observability.svc.cluster.local:9428`
- VictoriaTraces: `http://victoria-traces-vtc-vtselect.observability.svc.cluster.local:10471`
- OTel Collector: `http://otel-collector-collector.observability.svc.cluster.local:4318`

## Frontend에 Nginx 프록시가 필요한 이유

브라우저는 외부에서 frontend `NodePort`만 직접 접근할 수 있다.

이번 구조에서는 backend를 `ClusterIP`로만 운영하므로, frontend 컨테이너 내부 Nginx가 `/api/*` 요청을 backend 서비스로 프록시해야 한다.  
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

## 배포 순서

1. namespace와 RBAC를 적용한다.
2. backend ConfigMap과 Deployment를 적용한다.
3. frontend ConfigMap과 Deployment를 적용한다.
4. frontend NodePort가 외부에서 열리는지 확인한다.
5. 로그인 시 Keycloak로 정상 리다이렉트되는지 확인한다.
6. 로그인 후 `/api/clusters/summary` 호출이 성공하는지 확인한다.

## 적용 명령

```bash
kubectl apply -k k8s/npu-dashboard
```

GitHub Actions가 새 이미지를 올린 뒤 특정 버전으로 고정하고 싶다면, 매니페스트의 `:latest`를 `:sha-<commit>` 형태의 태그로 바꾸면 된다.

## 확인 명령

```bash
kubectl get all -n npu_dashboard
kubectl describe svc dashboard-frontend -n npu_dashboard
kubectl logs deploy/dashboard-backend -n npu_dashboard
kubectl logs deploy/dashboard-frontend -n npu_dashboard
```
