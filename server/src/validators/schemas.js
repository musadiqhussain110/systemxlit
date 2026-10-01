const { z } = require('zod');

const objectId = z.string().regex(/^[a-f\d]{24}$/i, 'Invalid identifier');
const time = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Time must be HH:mm');
const bookingDate = z.string({ required_error: 'Choose a booking date' })
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Choose a valid booking date')
  .refine((value) => {
    const parsed = new Date(`${value}T00:00:00.000Z`);
    return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
  }, 'Choose a valid calendar date')
  .transform((value) => new Date(`${value}T00:00:00.000Z`));

const authSchemas = {
  login: z.object({
    body: z.object({ email: z.string().email(), password: z.string().min(8) }),
    query: z.any(), params: z.any(),
  }),
  setupAdmin: z.object({
    body: z.object({
      name: z.string().trim().min(2).max(120),
      email: z.string().email(),
      password: z.string().min(8).max(128),
    }),
    query: z.any(), params: z.any(),
  }),
  register: z.object({
    body: z.object({
      name: z.string().trim().min(2).max(120),
      email: z.string().email(),
      password: z.string().min(8).max(128),
      role: z.enum(['student', 'faculty']),
      department: objectId,
      registrationNumber: z.string().trim().max(80).default(''),
    }).superRefine((value, ctx) => {
      if (value.role === 'student' && !value.registrationNumber) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['registrationNumber'], message: 'Registration number is required for students' });
      }
    }),
    query: z.any(), params: z.any(),
  }),
};

const equipmentItemsSchema = z.array(z.object({ equipment: objectId, quantity: z.coerce.number().int().positive() })).refine((items) => new Set(items.map((item) => item.equipment)).size === items.length, 'Select each equipment item only once').default([]);

const bookingSchemas = {
  create: z.object({
    body: z.object({
      department: objectId.optional(),
      lab: objectId.nullish(),
      equipmentItems: equipmentItemsSchema,
      bookingDate,
      startTime: time,
      endTime: time,
      purpose: z.string().trim().min(5, 'Describe the booking purpose in at least 5 characters').max(800, 'Booking purpose must be 800 characters or fewer'),
      capacity: z.coerce.number().int().positive().default(1),
    }), query: z.any(), params: z.any(),
  }),
  decision: z.object({ body: z.object({ decision: z.enum(['approved', 'rejected']), reason: z.string().max(500).optional(), priority: z.enum(['normal', 'academic', 'research', 'urgent']).optional() }), query: z.any(), params: z.object({ id: objectId }) }),
  cancel: z.object({ body: z.object({ reason: z.string().max(500).optional() }), query: z.any(), params: z.object({ id: objectId }) }),
  recommend: z.object({
    body: z.object({ bookingDate, startTime: time, endTime: time, departmentId: objectId, capacity: z.coerce.number().int().positive().default(1), purpose: z.string().max(800).optional().default(''), equipmentItems: equipmentItemsSchema }),
    query: z.any(), params: z.any(),
  }),
};

module.exports = { objectId, authSchemas, bookingSchemas };
