FROM golang:1.25-alpine AS build

WORKDIR /app

COPY go.mod go.sum ./
RUN go mod download

COPY . .
RUN CGO_ENABLED=0 GOOS=linux GOARCH=amd64 go build -o /out/dashboard-backend .

FROM alpine:3.22

WORKDIR /app

RUN adduser -D -u 10001 appuser
COPY --from=build /out/dashboard-backend /app/dashboard-backend

USER appuser

EXPOSE 8081

CMD ["/app/dashboard-backend"]
