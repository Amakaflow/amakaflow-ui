import { http, HttpResponse } from 'msw';

const MAPPER_API = 'http://localhost:8001';
const INGESTOR_API = 'http://localhost:8004';
const CALENDAR_API = 'http://localhost:8003';
const CHAT_API = 'http://localhost:8005';

export const handlers = [
  // Mapper API
  http.get(`${MAPPER_API}/health`, () =>
    HttpResponse.json({ status: 'ok' }),
  ),
  http.get(`${MAPPER_API}/mappings`, () =>
    HttpResponse.json([]),
  ),
  http.post(`${MAPPER_API}/map`, () =>
    HttpResponse.json({ mapped: true, exercises: [] }),
  ),

  // Ingestor API
  http.get(`${INGESTOR_API}/version`, () =>
    HttpResponse.json({ version: '1.0.0' }),
  ),
  http.post(`${INGESTOR_API}/parse`, () =>
    HttpResponse.json({ workout: null }),
  ),

  // Calendar API
  http.get(`${CALENDAR_API}/health`, () =>
    HttpResponse.json({ status: 'ok' }),
  ),
  http.get(`${CALENDAR_API}/programs`, () =>
    HttpResponse.json([]),
  ),

  // Chat API
  http.get(`${CHAT_API}/health`, () =>
    HttpResponse.json({ status: 'ok' }),
  ),
  http.post(`${CHAT_API}/chat`, () =>
    HttpResponse.json({ message: 'Mock response' }),
  ),
];
