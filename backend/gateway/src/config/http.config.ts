import { registerAs } from '@nestjs/config';

export default registerAs('http', () => {
  const port = parseInt(process.env.GATEWAY_SERVICE_PORT ?? '', 10);
  return {
    host: process.env.GATEWAY_SERVICE_HOST ?? '0.0.0.0',
    port: Number.isFinite(port) && !Number.isNaN(port) ? port : 8080,
    baseUrl: process.env.GATEWAY_BASE_URL ?? 'http://localhost:8080/api'
  };
});
