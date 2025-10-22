#!/bin/bash
cd "C:\Dev\CRM_2.0\frontend"
docker build --no-cache \
  -t crm-frontend:latest \
  --build-arg NEXT_PUBLIC_AUTH_DISABLED=true \
  --build-arg NEXT_PUBLIC_API_BASE_URL=http://gateway:8080/api/v1 \
  --build-arg NEXT_PUBLIC_CRM_SSE_URL=http://gateway:8080/api/v1/streams/deals \
  --build-arg NEXT_PUBLIC_NOTIFICATIONS_SSE_URL=http://gateway:8080/api/v1/streams/notifications .
