import swaggerJsdoc from 'swagger-jsdoc';
import type { Options } from 'swagger-jsdoc';
import { API_VERSION } from '../version/appVersion';

const swaggerOptions: Options = {
  definition: {
    openapi: '3.0.3',
    info: {
      title: 'Syntra Backend API',
      version: API_VERSION,
      description: 'Documentação HTTP da API do backend Syntra.',
    },
    servers: [{ url: '/api/v1' }],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
        },
      },
    },
  },
  apis: [`${__dirname}/routes/*.{ts,js}`],
};

/**
 * Gera e mantém em cache o documento OpenAPI da API HTTP.
 * @returns Documento OpenAPI 3 em formato JSON serializável
 */
export function getOpenApiSpec(): object {
  if (cachedSpec) {
    return cachedSpec;
  }

  cachedSpec = swaggerJsdoc(swaggerOptions);
  return cachedSpec;
}

let cachedSpec: object | null = null;
