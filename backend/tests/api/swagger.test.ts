import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createApp } from '../../src/api/server';

describe('swagger routes', () => {
  it('retorna openapi.json válido em /api/v1/docs/openapi.json', async () => {
    const app = createApp();

    const response = await request(app.callback()).get('/api/v1/docs/openapi.json');

    expect(response.status).toBe(200);
    expect(response.type).toContain('json');
    expect(response.body).toMatchObject({
      openapi: expect.any(String),
    });
  });
});
