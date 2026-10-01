const { z } = require('zod');

const objectId = z.string().regex(/^[a-f\d]{24}$/i, 'Invalid identifier');
const time = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Time must be HH:mm');

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
      bookingDate: z.coerce.date(),
      startTime: time,
      endTime: time,
      purpose: z.string().trim().min(5).max(800),
      capacity: z.coerce.number().int().positive().default(1),
    }), query: z.any(), params: z.any(),
  }),
  decision: z.object({ body: z.object({ decision: z.enum(['approved', 'rejected']), reason: z.string().max(500).optional(), priority: z.enum(['normal', 'academic', 'research', 'urgent']).optional() }), query: z.any(), params: z.object({ id: objectId }) }),
  cancel: z.object({ body: z.object({ reason: z.string().max(500).optional() }), query: z.any(), params: z.object({ id: objectId }) }),
  recommend: z.object({
    body: z.object({ bookingDate: z.coerce.date(), startTime: time, endTime: time, departmentId: objectId, capacity: z.coerce.number().int().positive().default(1), purpose: z.string().max(800).optional().default(''), equipmentItems: equipmentItemsSchema }),
    query: z.any(), params: z.any(),
  }),
};

module.exports = { objectId, authSchemas, bookingSchemas };
