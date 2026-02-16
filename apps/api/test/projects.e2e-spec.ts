import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';

describe('ProjectsController (e2e)', () => {
  let app: INestApplication;
  let authToken: string;
  let createdProjectId: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();

    // Login to get token
    const loginRes = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: 'demo@acme.com', password: 'password123' });

    authToken = loginRes.body.accessToken;
  });

  afterAll(async () => {
    await app.close();
  });

  describe('GET /projects', () => {
    it('should return projects list', () => {
      return request(app.getHttpServer())
        .get('/projects')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200)
        .expect((res) => {
          expect(Array.isArray(res.body)).toBe(true);
        });
    });

    it('should require authentication', () => {
      return request(app.getHttpServer())
        .get('/projects')
        .expect(401);
    });

    it('should reject invalid token', () => {
      return request(app.getHttpServer())
        .get('/projects')
        .set('Authorization', 'Bearer invalid-token')
        .expect(401);
    });
  });

  describe('POST /projects', () => {
    it('should create a new project', async () => {
      const response = await request(app.getHttpServer())
        .post('/projects')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ name: 'E2E Test Project', description: 'Created in E2E test' })
        .expect(201);

      expect(response.body.name).toBe('E2E Test Project');
      expect(response.body.status).toBe('ACTIVE');
      createdProjectId = response.body.id;
    });

    it('should validate required fields', () => {
      return request(app.getHttpServer())
        .post('/projects')
        .set('Authorization', `Bearer ${authToken}`)
        .send({})
        .expect(400);
    });

    it('should validate name length', () => {
      return request(app.getHttpServer())
        .post('/projects')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ name: 'A' }) // Too short
        .expect(400);
    });

    it('should reject duplicate project names', async () => {
      // Create first project
      await request(app.getHttpServer())
        .post('/projects')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ name: 'Unique Project Name' })
        .expect(201);

      // Try to create duplicate
      return request(app.getHttpServer())
        .post('/projects')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ name: 'Unique Project Name' })
        .expect(409);
    });
  });

  describe('GET /projects/:id', () => {
    it('should return a project by id', () => {
      return request(app.getHttpServer())
        .get(`/projects/${createdProjectId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200)
        .expect((res) => {
          expect(res.body.id).toBe(createdProjectId);
          expect(res.body.name).toBe('E2E Test Project');
        });
    });

    it('should return 404 for non-existent project', () => {
      return request(app.getHttpServer())
        .get('/projects/non-existent-id')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(404);
    });
  });

  describe('PUT /projects/:id', () => {
    it('should update project', async () => {
      const response = await request(app.getHttpServer())
        .put(`/projects/${createdProjectId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ name: 'Updated Project Name', description: 'Updated description' })
        .expect(200);

      expect(response.body.name).toBe('Updated Project Name');
      expect(response.body.description).toBe('Updated description');
    });

    it('should validate update data', () => {
      return request(app.getHttpServer())
        .put(`/projects/${createdProjectId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ name: '' }) // Invalid empty name
        .expect(400);
    });
  });

  describe('GET /projects/:id/stats', () => {
    it('should return project statistics', () => {
      return request(app.getHttpServer())
        .get(`/projects/${createdProjectId}/stats`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200)
        .expect((res) => {
          expect(res.body).toHaveProperty('repositories');
          expect(res.body).toHaveProperty('scans');
          expect(res.body).toHaveProperty('findings');
        });
    });
  });

  describe('POST /projects/:id/archive', () => {
    it('should archive project', async () => {
      const response = await request(app.getHttpServer())
        .post(`/projects/${createdProjectId}/archive`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.status).toBe('ARCHIVED');
    });
  });

  describe('DELETE /projects/:id', () => {
    it('should soft delete project', async () => {
      // Create a project to delete
      const createRes = await request(app.getHttpServer())
        .post('/projects')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ name: 'Project To Delete' })
        .expect(201);

      // Delete it
      await request(app.getHttpServer())
        .delete(`/projects/${createRes.body.id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      // Verify it's not returned in list
      const listRes = await request(app.getHttpServer())
        .get('/projects')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      const deleted = listRes.body.find((p: any) => p.id === createRes.body.id);
      expect(deleted).toBeUndefined();
    });
  });

  describe('POST /projects/:id/repositories/:repoId', () => {
    it('should require valid project', () => {
      return request(app.getHttpServer())
        .post('/projects/invalid-id/repositories/repo-id')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(404);
    });
  });
});
