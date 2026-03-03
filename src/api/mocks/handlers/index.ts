import { RequestHandler } from 'msw';
import { mapperHandlers } from './mapper';
import { calendarHandlers } from './calendar';

export const handlers: RequestHandler[] = [
  ...mapperHandlers,
  ...calendarHandlers,
];
