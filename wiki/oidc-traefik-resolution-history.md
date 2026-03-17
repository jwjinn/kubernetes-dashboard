# Dashboard OIDC HTTPS 전환 및 해결 히스토리

## 문서 목적

이 문서는 Kubernetes Dashboard 프로젝트에서 OIDC 로그인이 최종적으로 정상 동작하기까지 어떤 문제가 있었고, 왜 그런 문제가 생겼으며, 어떤 순서로 해결했는지를 처음 보는 사람도 이해할 수 있도록 정리한 문서다.

이 문서를 보면 다음을 이해할 수 있다.

- 왜 초기 `NodePort + HTTP + IP` 구조에서 로그인이 실패했는지
- 왜 Traefik Ingress와 TLS가 필요했는지
- 왜 frontend와 backend가 서로 다른 OIDC 주소를 사용해야 하는지
- 왜 Keycloak reverse proxy 설정과 client redirect URI 설정이 중요한지
- 어떤 Kubernetes YAML과 어떤 코드가 바뀌었는지

## 1. 최종 목표

최종적으로 원하는 구조는 아래와 같았다.

- 사용자 접속 주소: `https://dashboard.home.arpa:32443`
- Keycloak 주소: `https://keycloak.home.arpa:32443`
- frontend: `ClusterIP`
- backend: `ClusterIP`
- 외부 공개: Traefik NodePort + Ingress + TLS
- dashboard는 Keycloak OIDC로 로그인
- backend는 Kubernetes API와 observability 시스템을 조회

## 2. 초기 구조와 문제

초기에는 다음과 같은 구조였다.

- frontend: `NodePort`
- backend: `ClusterIP`
- Keycloak: `NodePort`
- 접속 주소는 IP 기반 HTTP

예시:

- `http://192.168.160.69:30000`
- `http://192.168.160.69:30080`

이 구조에서 frontend는 `react-oidc-context` / `oidc-client-ts` 기반으로 Keycloak 로그인을 시작하도록 되어 있었다.

### 발생한 문제

브라우저에서 dashboard 로그인 시 다음과 같은 에러가 발생했다.

- `Auth Error: Crypto.subtle is available only in secure contexts (HTTPS)`

### 왜 이런 문제가 생겼는가

OIDC Authorization Code + PKCE 흐름은 브라우저의 `crypto.subtle` API를 사용한다.  
그런데 브라우저는 이 API를 보통 secure context에서만 허용한다.

즉:

- `http://192.168.160.69:30000`
- `http://192.168.160.69:30080`

같은 IP 기반 HTTP 환경은 secure context가 아니어서, 로그인 시작 단계에서 브라우저가 PKCE 동작을 차단했다.

### 결론

NodePort HTTP 환경은 화면 확인은 가능하지만, OIDC PKCE 로그인에는 적합하지 않았다.

## 3. HTTPS 진입점 설계

이 문제를 해결하기 위해 dashboard와 Keycloak을 HTTPS로 노출하는 방향으로 구조를 바꿨다.

선택한 방법:

- Traefik를 NodePort로 배포
- cert-manager로 내부 CA와 TLS 인증서 발급
- Ingress로 dashboard와 Keycloak 라우팅
- 사용자 PC가 내부 CA를 신뢰하도록 설정

### 왜 Traefik를 사용했는가

- 외부 HTTPS 진입점을 단일 지점으로 모을 수 있다
- dashboard와 Keycloak 모두 `ClusterIP`로 바꿀 수 있다
- 브라우저는 항상 HTTPS 주소만 보게 된다

## 4. cert-manager와 내부 CA 구성

HTTPS를 적용하려면 인증서가 필요했다.  
공개 도메인/공인 인증서를 바로 쓰는 대신, 내부 CA를 만들어 cert-manager로 server certificate를 발급하는 구조를 사용했다.

적용한 개념:

- self-signed bootstrap issuer
- 내부 root CA 생성
- dashboard용 certificate
- keycloak용 certificate

### 왜 사용자 PC에 CA를 설치해야 했는가

브라우저는 서버 인증서를 발급한 루트 CA를 신뢰해야 HTTPS 페이지를 안전한 secure context로 인정한다.  
즉 클러스터 안에 인증서를 만들어두는 것만으로는 부족하고, 사용자 PC도 그 CA를 신뢰해야 했다.

## 5. Keycloak HTTPS 전환 과정

Keycloak 자체도 Traefik 뒤 HTTPS로 전환했다.

최종 외부 주소:

- `https://keycloak.home.arpa:32443`

내부 서비스:

- `http://keycloak.keycloak.svc.cluster.local:8080`

### 5.1 Keycloak Service 구조

기존에는 Keycloak이 `NodePort`로만 노출되어 있었다.  
Ingress 뒤에서 쓰기 위해 `ClusterIP` 서비스 `keycloak`를 별도로 만들었다.

이유:

- Ingress backend는 내부 서비스로 붙는 것이 자연스럽다
- 기존 NodePort를 바로 바꾸면 기존 접근 경로를 깨뜨릴 수 있어, 초기에는 `ClusterIP`를 추가하는 방식이 안전했다

### 5.2 Keycloak Admin Console 깨짐 문제

Traefik와 TLS를 붙인 뒤에는 관리자 콘솔이 다음과 같이 깨지는 문제가 발생했다.

- `somethingWentWrong`
- `requested insecure content from http://...`

### 원인

Keycloak이 reverse proxy 뒤에서 HTTPS로 서비스된다는 사실을 제대로 인식하지 못하고, admin console 리소스 URL을 `http://...`로 만들어냈다.

즉:

- 페이지는 HTTPS
- 내부 JS/CSS/번역 리소스는 HTTP

가 되어 브라우저가 mixed content로 차단했다.

### 해결

Keycloak Deployment에 reverse proxy 관련 설정을 반영해, 외부 hostname과 HTTPS 진입점을 인식하게 했다.

핵심 설정 개념:

- `KC_PROXY_HEADERS`
- `KC_HTTP_ENABLED`
- `KC_HOSTNAME`
- `KC_HOSTNAME_URL`
- `KC_HOSTNAME_ADMIN_URL`

이 과정을 거친 뒤:

- `https://keycloak.home.arpa:32443/admin/master/console/`

접속이 정상화되었다.

### 5.3 Keycloak 테마/메시지 보완

커스텀 테마가 에러 메시지 키를 그대로 보여주는 경우가 있어 다음 메시지 키를 보강했다.

- `somethingWentWrong`
- `somethingWentWrongDescription`

추가 파일:

- `keycloak/keycloak-theme/dashboard-theme/login/messages/messages.properties`
- `keycloak/keycloak-theme/dashboard-theme/login/messages/messages_en.properties`
- `keycloak/keycloak-theme/dashboard-theme/login/messages/messages_ko.properties`

### 5.4 Keycloak client redirect URI 문제

HTTPS 전환 후 dashboard 로그인 시 다음 에러가 발생했다.

- `Invalid parameter: redirect_uri`

원인:

- `dashboard-client`의 `Valid redirect URIs`, `Web origins`에 HTTPS dashboard 주소가 없었다

해결:

- `https://dashboard.home.arpa:32443/*`
- `https://dashboard.home.arpa:32443`

를 `dashboard-client` 설정에 추가했다.

## 6. frontend OIDC 설정 문제

Keycloak HTTPS 전환 후에도 dashboard 로그인 시 아래 문제가 있었다.

- `Auth Error: Load failed`
- mixed content warning
- frontend가 `http://192.168.160.69:30080/...well-known/openid-configuration` 를 조회

### 원인

frontend ConfigMap의 `VITE_OIDC_AUTHORITY`가 아직 예전 NodePort HTTP 주소를 가리키고 있었다.

기존 값:

- `http://192.168.160.69:30080/realms/dashboard-realm`

수정 후:

- `https://keycloak.home.arpa:32443/realms/dashboard-realm`

### 왜 ConfigMap으로 관리했는가

프론트 런타임 설정을 이미지에서 하드코딩하지 않고 배포 시 바꾸기 위해서다.  
같은 이미지를 유지한 채 주소만 바꿀 수 있다.

## 7. backend OIDC 검증 문제

frontend가 HTTPS 기준으로 Keycloak을 보게 된 뒤, backend에서는 다른 문제가 발생했다.

### 7.1 내부 HTTPS issuer 직접 접근 실패

backend가 다음 주소를 직접 조회하려 하면서 실패했다.

- `https://keycloak.home.arpa:32443/realms/dashboard-realm`

원인:

- Pod는 사용자 PC의 hosts 파일을 모른다
- Pod는 사용자 PC에 설치한 내부 CA를 모른다

즉 브라우저가 접근할 수 있는 주소를 backend Pod가 그대로 사용할 수는 없었다.

### 7.2 내부 HTTP 주소로 바꾸자 issuer mismatch 발생

그다음 `OIDC_ISSUER_URL`을 내부 서비스 주소로 바꾸자 또 다른 문제가 발생했다.

- discovery URL: `http://keycloak.keycloak.svc.cluster.local:8080/...`
- 실제 issuer: `https://keycloak.home.arpa:32443/...`

`go-oidc`는 조회한 provider의 issuer와 기대 issuer가 같아야 한다고 보기 때문에 verifier 초기화가 실패했다.

### 7.3 최종 해결: issuer와 discovery URL 분리

이 문제를 해결하기 위해 backend 코드를 수정했다.

개념:

- `OIDC_ISSUER_URL`
  - 외부 HTTPS issuer
- `OIDC_DISCOVERY_URL`
  - backend Pod 내부에서 접근 가능한 discovery URL

그리고 `go-oidc`의 공식 기능인 `oidc.InsecureIssuerURLContext`를 사용해,

- discovery는 내부 HTTP Service DNS로 수행
- issuer 검증은 외부 HTTPS 주소 기준으로 수행

하도록 만들었다.

### 적용 코드

핵심 함수는 `backend/main.go`의 `newOIDCVerifier`다.

```go
func newOIDCVerifier(ctx context.Context) (*oidc.IDTokenVerifier, error) {
	issuerURL := envOrDefault("OIDC_ISSUER_URL", "http://localhost:8080/realms/dashboard-realm")
	discoveryURL := envOrDefault("OIDC_DISCOVERY_URL", issuerURL)

	discoveryCtx := ctx
	if discoveryURL != issuerURL {
		discoveryCtx = oidc.InsecureIssuerURLContext(ctx, issuerURL)
	}

	provider, err := oidc.NewProvider(discoveryCtx, discoveryURL)
	if err != nil {
		return nil, fmt.Errorf("failed to query provider discovery %q with issuer %q: %w", discoveryURL, issuerURL, err)
	}

	return provider.Verifier(&oidc.Config{SkipClientIDCheck: true}), nil
}
```

### 적용 설정

`backend-configmap.yaml`에 아래 값을 사용한다.

```yaml
FRONTEND_ORIGIN: "https://dashboard.home.arpa:32443"
OIDC_ISSUER_URL: "https://keycloak.home.arpa:32443/realms/dashboard-realm"
OIDC_DISCOVERY_URL: "http://keycloak.keycloak.svc.cluster.local:8080/realms/dashboard-realm"
```

## 8. 이미지 캐시 문제

backend 코드 수정 후에도 새 Pod가 계속 예전 동작을 하는 문제가 있었다.

증상:

- Deployment는 `latest` 이미지 사용
- 새 Pod가 `already present on machine` 로그와 함께 이전 이미지로 기동

원인:

- `imagePullPolicy: IfNotPresent`
- 노드가 캐시된 `latest` 이미지를 재사용

해결:

- 매니페스트에서 `imagePullPolicy: Always` 사용
- 또는 운영 단계에서 `sha-*` 태그 고정

현재 `k8s/npu-dashboard`는 `latest` 사용 시 혼동을 줄이기 위해 `imagePullPolicy: Always`로 맞췄다.

## 9. npu-dashboard 최종 YAML 구조

현재 `k8s/npu-dashboard` 디렉토리의 핵심 방향은 아래와 같다.

- `frontend-configmap.yaml`
  - `VITE_OIDC_AUTHORITY`를 Keycloak HTTPS Ingress 주소로 설정
- `frontend.yaml`
  - frontend Service를 `ClusterIP`로 운영
- `backend-configmap.yaml`
  - `OIDC_ISSUER_URL`, `OIDC_DISCOVERY_URL` 분리
- `backend.yaml`
  - backend Service는 `ClusterIP`
  - `imagePullPolicy: Always`
- `dashboard-ingress.yaml`
  - Traefik Ingress로 dashboard 외부 노출

## 10. 최종 동작 흐름

1. 사용자가 `https://dashboard.home.arpa:32443` 접속
2. Traefik가 dashboard Ingress로 라우팅
3. frontend가 `VITE_OIDC_AUTHORITY` 기준으로 Keycloak 로그인 시작
4. 브라우저는 `https://keycloak.home.arpa:32443`로 이동
5. Keycloak이 HTTPS 기준으로 로그인/redirect 수행
6. dashboard로 code redirect
7. frontend가 backend에 Bearer token 포함 요청
8. backend는 내부 DNS로 discovery 조회, 외부 HTTPS issuer 기준으로 토큰 검증
9. backend가 Kubernetes 및 observability 데이터를 조회
10. 결과가 frontend를 통해 사용자에게 표시

## 11. 왜 이런 구조가 필요한가

이 구조를 선택한 이유는 다음과 같다.

- OIDC PKCE는 secure context가 필요하다
- backend는 외부에 직접 노출하지 않는 편이 안전하다
- frontend만 외부 공개해도 내부 Nginx 프록시로 API를 묶을 수 있다
- Keycloak은 reverse proxy/TLS 환경을 이해하도록 설정해야 한다
- backend Pod는 사용자 PC의 DNS/CA를 공유하지 않기 때문에 external issuer와 internal discovery를 분리해야 한다

즉 단순히 "TLS를 붙였다"가 아니라,

- 브라우저 경로
- Ingress 경로
- Keycloak 외부 hostname
- backend 내부 discovery

를 역할별로 정확히 분리한 것이 최종 해결 포인트였다.

## 12. 핵심 교훈

이번 OIDC 문제는 단일 원인이 아니라 아래가 연결된 문제였다.

- HTTP 환경에서 PKCE 불가
- Keycloak reverse proxy 인식 부족
- Keycloak client redirect URI 미반영
- frontend OIDC authority가 예전 HTTP 주소 사용
- backend가 external issuer와 internal discovery를 구분하지 못함
- `latest` 이미지 캐시 재사용

결국 해결은 "한 군데 고치기"가 아니라,

- Ingress/TLS
- Keycloak
- frontend ConfigMap
- backend 코드
- backend ConfigMap
- 이미지 pull 정책

를 모두 함께 정리해야 가능했다.

## 13. 최종 한 줄 요약

Dashboard OIDC 로그인은 `NodePort + HTTP` 구조에서는 안정적으로 동작하지 않았고, Traefik HTTPS Ingress, Keycloak reverse proxy 설정, frontend의 HTTPS OIDC authority, backend의 issuer/discovery 분리, Keycloak client redirect URI 정리를 통해 최종적으로 정상 동작하게 되었다.
