# --- Etapa de Construcción ---
    FROM golang:1.24-alpine AS builder
    
    # Instalamos dependencias de compilación
    RUN apk add --no-cache make nodejs npm
    
    WORKDIR /app
    
    # Copiamos archivos de dependencias primero para aprovechar la caché de Docker
    COPY go.mod go.sum ./
    RUN go mod download
    
    COPY . .
    
    # Construimos los binarios y el cliente web
    RUN make prepare && make all
    
    # --- Etapa Final ---
    FROM alpine:latest
    
    # 1. Instalamos certificados y creamos el usuario
    RUN apk --no-cache add ca-certificates \
        && addgroup -S appgroup && adduser -S appuser -G appgroup
    
    WORKDIR /app
    
    # 2. Creamos el directorio de datos ANTES de cambiar de usuario
    # y le asignamos la propiedad al usuario no raíz.
    RUN mkdir -p /app/data && chown -R appuser:appgroup /app/data
    
    # 3. Copiamos solo los binarios necesarios de la etapa anterior
    COPY --from=builder --chown=appuser:appgroup /app/bin ./bin

    RUN chown -R root:appgroup ./bin && \
        chmod -R 550 ./bin

    RUN mkdir -p /app/data && chown -R appuser:appgroup /app/data
    
    # 4. Inicializamos los archivos de datos como el usuario appuser
    USER appuser
    RUN touch data/proxies.txt data/uas.txt

    # --- HEALTHCHECK ---
    # --interval: cada 30 segundos
    # --timeout: si tarda más de 3 segundos, falla
    # --start-period: le da 5 segundos al servidor para arrancar antes de chequear
    # --retries: si falla 3 veces seguidas, marca el contenedor como 'unhealthy'
    HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
        CMD wget --no-verbose --tries=1 --spider http://localhost:3000/ || exit 1
    
    EXPOSE 3000
    
    # Ejecución
    CMD ["./bin/mmb-server"]