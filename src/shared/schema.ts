import { z } from 'zod';

export const ExtractionSchema = z.object({
  kind: z.enum(['event', 'task']),
  title: z.string(),
  start: z.string().optional(),
  end: z.string().optional(),
  location: z.string().optional(),
  due: z.string().optional(),
  description: z.string().optional(),
});

export type Extraction = z.infer<typeof ExtractionSchema>;

export const extractionJsonSchema = {
  type: 'object',
  properties: {
    kind: { type: 'string', enum: ['event', 'task'] },
    title: { type: 'string' },
    start: { type: 'string' },
    end: { type: 'string' },
    location: { type: 'string' },
    due: { type: 'string' },
    description: { type: 'string' },
  },
  required: ['kind', 'title'],
  additionalProperties: false,
};
