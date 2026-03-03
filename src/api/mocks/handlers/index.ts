import { RequestHandler } from 'msw';
import { mapperHandlers } from './mapper';

export const handlers: RequestHandler[] = [
  ...mapperHandlers,
];
