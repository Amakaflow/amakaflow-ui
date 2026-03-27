import { RequestHandler } from 'msw';
import { mapperHandlers } from './mapper';
import { calendarHandlers } from './calendar';
import { chatHandlers } from './chat';
import { stravaHandlers } from './strava';
import { garminHandlers } from './garmin';

export const handlers: RequestHandler[] = [
  ...mapperHandlers,
  ...calendarHandlers,
  ...chatHandlers,
  ...stravaHandlers,
  ...garminHandlers,
];
