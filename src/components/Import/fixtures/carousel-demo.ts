/**
 * AMA-1181: Mock data for a 6-slide Instagram carousel (mobility routine).
 *
 * Each slide represents one carousel image/video with its own set of exercises.
 */

export interface CarouselExercise {
  name: string;
  sets?: number;
  reps?: number | string;
  duration_sec?: number;
  notes?: string;
}

export interface CarouselSlide {
  slideIndex: number;
  thumbnailUrl?: string;
  exercises: CarouselExercise[];
  slideType: 'image' | 'video';
  caption?: string;
}

export interface CarouselPost {
  postId: string;
  postUrl: string;
  username: string;
  caption: string;
  slideCount: number;
  slides: CarouselSlide[];
}

export const MOCK_CAROUSEL_POST: CarouselPost = {
  postId: 'C9xKj2mNv8p',
  postUrl: 'https://www.instagram.com/p/C9xKj2mNv8p/',
  username: '@move.daily',
  caption: '6-slide morning mobility flow. Save this for later!',
  slideCount: 6,
  slides: [
    {
      slideIndex: 0,
      thumbnailUrl: undefined,
      slideType: 'image',
      caption: 'Slide 1 — Hip Openers',
      exercises: [
        { name: '90/90 Hip Switch', sets: 2, reps: '8 each side', duration_sec: 60 },
        { name: 'Deep Squat Hold', sets: 1, duration_sec: 45 },
      ],
    },
    {
      slideIndex: 1,
      thumbnailUrl: undefined,
      slideType: 'image',
      caption: 'Slide 2 — Thoracic Spine',
      exercises: [
        { name: 'Open Book Stretch', sets: 2, reps: '6 each side' },
        { name: 'Cat-Cow', sets: 1, reps: 10 },
        { name: 'Thread the Needle', sets: 2, reps: '5 each side' },
      ],
    },
    {
      slideIndex: 2,
      thumbnailUrl: undefined,
      slideType: 'video',
      caption: 'Slide 3 — Ankle Mobility',
      exercises: [
        { name: 'Wall Ankle Dorsiflexion', sets: 3, reps: '10 each side' },
        { name: 'Banded Ankle Distraction', sets: 2, duration_sec: 30 },
      ],
    },
    {
      slideIndex: 3,
      thumbnailUrl: undefined,
      slideType: 'image',
      caption: 'Slide 4 — Shoulder Flow',
      exercises: [
        { name: 'Wall Slides', sets: 2, reps: 10 },
        { name: 'Band Pull-Aparts', sets: 3, reps: 15 },
        { name: 'Prone Y Raise', sets: 2, reps: 8 },
      ],
    },
    {
      slideIndex: 4,
      thumbnailUrl: undefined,
      slideType: 'video',
      caption: 'Slide 5 — Hamstring & Posterior Chain',
      exercises: [
        { name: 'Standing Toe Touch', sets: 1, reps: 10 },
        { name: 'Single-Leg RDL Reach', sets: 2, reps: '8 each side' },
      ],
    },
    {
      slideIndex: 5,
      thumbnailUrl: undefined,
      slideType: 'image',
      caption: 'Slide 6 — Cool-down Breathing',
      exercises: [
        { name: 'Box Breathing', sets: 4, duration_sec: 60 },
        { name: 'Supine Spinal Twist', sets: 1, reps: '5 each side', duration_sec: 45 },
      ],
    },
  ],
};
