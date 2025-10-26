# syntax=docker/dockerfile:1.5
ARG GRADLE_IMAGE=gradle:8.8-jdk21-alpine
ARG RUNTIME_IMAGE=eclipse-temurin:21-jre-jammy

FROM ${GRADLE_IMAGE} AS build
WORKDIR /workspace
ARG SERVICE_PATH
COPY ${SERVICE_PATH}/ .
RUN ./gradlew bootJar --no-daemon

FROM ${RUNTIME_IMAGE} AS runtime
WORKDIR /app
RUN apt-get update \
    && apt-get install -y --no-install-recommends curl \
    && rm -rf /var/lib/apt/lists/*
COPY --from=build /workspace/build/libs/*.jar ./app.jar
EXPOSE 8080
ENTRYPOINT ["java", "-jar", "app.jar"]
