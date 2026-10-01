require('./requireTestDatabase.cjs');
const assert = require('node:assert/strict');
const { connectDatabase, closeDatabase } = require('../src/config/db');
const { Department } = require('../src/models/Department');
const { User } = require('../src/models/User');
const { Lab } = require('../src/models/Lab');
const { Equipment } = require('../src/models/Equipment');
const { Booking } = require('../src/models/Booking');
const { BookingRule } = require('../src/models/BookingRule');
const { Notification } = require('../src/models/Notification');
const { createBooking, decideBooking, cancelBooking } = require('../src/services/bookingService');
const { issueBooking, returnBooking } = require('../src/services/issueService');
const { getAnalytics } = require('../src/services/analyticsService');
const { recommendResources } = require('../src/services/recommendationService');
const { bookingSchemas } = require('../src/validators/schemas');
const bcrypt = require('bcryptjs');
let passed = 0;
async function check(name, fn) { await fn(); passed++; console.log(`PASS ${name}`); }
async function main() {
  await connectDatabase();
  const dep = await Department.create({ name: 'Computer Science', code: 'CS' });
  const other = await Department.create({ name: 'Engineering', code: 'ENG' });
  const passwordHash = await bcrypt.hash('Preview123!', 10);
  const student = await User.create({ name: 'Ayesha Khan', email: 'student@preview.test', passwordHash, department: dep._id, role: 'student' });
  const admin = await User.create({ name: 'Campus Administrator', email: 'admin@preview.test', passwordHash, role: 'admin' });
  const labStaff = await User.create({ name: 'Lab Incharge', email: 'staff@preview.test', passwordHash, department: dep._id, role: 'labStaff' });
  const coordinator = await User.create({ name: 'Department Coordinator', email: 'coordinator@preview.test', passwordHash, department: dep._id, role: 'coordinator' });
  const lab = await Lab.create({ name: 'Embedded Systems Lab', code: 'CS-101', department: dep._id, capacity: 24, location: 'Innovation Block, Floor 2', facilities: ['Arduino', 'Workstations', 'Projector'] });
  const foreignLab = await Lab.create({ name: 'Robotics Studio', code: 'ENG-102', department: other._id, capacity: 16, location: 'Engineering Block' });
  const equipment = await Equipment.create({ name: 'Arduino Uno Kit', code: 'KIT-01', category: 'Electronics', department: dep._id, lab: lab._id, totalQuantity: 10 });
  await Equipment.create({ name: 'Digital Oscilloscope', code: 'OSC-01', category: 'Electronics', department: dep._id, lab: lab._id, totalQuantity: 4 });
  const rule = await BookingRule.create({ department: dep._id, approvalRequired: true, minimumLeadHours: 0 });
  const day = new Date(); day.setDate(day.getDate() + 2);
  const bookingDate = `${day.getFullYear()}-${String(day.getMonth()+1).padStart(2,'0')}-${String(day.getDate()).padStart(2,'0')}`;
  const payload = { department: dep._id, lab: lab._id, equipmentItems: [{ equipment: equipment._id, quantity: 6 }], bookingDate, startTime: '10:00', endTime: '12:00', purpose: 'Embedded systems project session', capacity: 20 };
  await check('Administrators cannot create booking requests', () => assert.rejects(createBooking(admin, payload), err => err.statusCode === 403));
  await check('Reject duplicate equipment quantities', async () => assert.equal(bookingSchemas.create.safeParse({ body: { ...payload, equipmentItems: [payload.equipmentItems[0], payload.equipmentItems[0]] } }).success, false));
  await check('Enforce lab capacity', () => assert.rejects(createBooking(student, { ...payload, capacity: 25 }), /24 participants/));
  await check('Reject mismatched resource departments', () => assert.rejects(createBooking(student, { ...payload, lab: foreignLab._id }), /selected department/));
  await BookingRule.create({ department: other._id, departmentOnlyAccess: true });
  await check('Enforce department-only access', () => assert.rejects(createBooking(student, { ...payload, department: other._id, lab: foreignLab._id, equipmentItems: [], capacity: 10 }), /own students/));
  let first, second;
  await check('Create pending requests', async () => { first = await createBooking(student, payload); second = await createBooking(student, payload); assert.equal(first.status, 'pendingApproval'); });
  await check('Concurrent approvals cannot double book', async () => { const results = await Promise.allSettled([decideBooking(labStaff, first._id, 'approved'), decideBooking(labStaff, second._id, 'approved')]); assert.equal(results.filter(x => x.status === 'fulfilled').length, 1); assert.equal(results.find(x => x.status === 'rejected').reason.statusCode, 409); });
  await check('Recommendations reflect the reserved slot', async () => { const results = await recommendResources({ ...payload, departmentId: dep._id }); assert.equal(results.find(x => x.lab._id === lab._id).available, false); });
  await check('Overbooking returns alternative slots', async () => { await assert.rejects(createBooking(student, payload), err => err.statusCode === 409 && err.details.suggestions.length > 0); });
  await check('Issue approved resources', async () => { await issueBooking(labStaff, first._id); assert.equal((await Booking.findById(first._id)).status, 'inUse'); });
  await check('Prevent duplicate issue', () => assert.rejects(issueBooking(labStaff, first._id), /approved\/reserved|already/));
  await check('Prevent cancellation of outstanding overdue resources', async () => { await Booking.updateById(first._id, { status: 'overdue' }); await assert.rejects(cancelBooking(student, first._id), /cannot be cancelled/); });
  await check('Damage return quarantines equipment', async () => { await returnBooking(labStaff, first._id, [{ equipment: equipment._id, returnCondition: 'damaged', damageNote: 'Connector requires repair' }]); assert.equal((await Equipment.findById(equipment._id)).maintenanceStatus, 'maintenance'); assert.equal((await Booking.findById(first._id)).status, 'damaged'); });
  await check('Analytics and notifications follow the lifecycle', async () => { const summary = await getAnalytics(admin); assert.equal(summary.totals.damageReports, 1); assert.equal(summary.totals.currentlyIssued, 0); assert.ok((await Notification.findAll({ user: student._id })).length >= 3); });
  await Equipment.updateById(equipment._id, { maintenanceStatus: 'operational' });
  await BookingRule.updateById(rule._id, { approvalRequired: false });
  await check('Concurrent automatic reservations cannot double book', async () => { const results = await Promise.allSettled([createBooking(student, {...payload, startTime:'14:00',endTime:'16:00'}), createBooking(student, {...payload, startTime:'14:00',endTime:'16:00'})]); assert.equal(results.filter(x => x.status === 'fulfilled').length, 1); });
  await check('Cancelled pending requests cannot be approved', async () => { await cancelBooking(student, second._id); await assert.rejects(decideBooking(labStaff, second._id, 'approved'), /already been reviewed/); });
  await check('Reject reversed recommendation windows', () => assert.rejects(recommendResources({ ...payload, departmentId: dep._id, startTime: '13:00', endTime: '10:00' })));
  await check('API allows student/faculty creation and denies management roles', async () => {
    const { app } = require('../src/app');
    const jwt = require('jsonwebtoken');
    const { env } = require('../src/config/env');
    const server = app.listen(0, '127.0.0.1');
    await new Promise(resolve => server.once('listening', resolve));
    try {
      for (const role of ['student', 'faculty', 'labStaff', 'coordinator', 'admin']) {
        const actor = await User.create({ name: `API ${role}`, email: `${role}@roles.test`, passwordHash, department: dep._id, role });
        const token = jwt.sign({ sub: actor._id }, env.jwtSecret);
        const response = await fetch(`http://127.0.0.1:${server.address().port}/api/bookings`, {
          method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...payload, lab: null, equipmentItems: [{ equipment: equipment._id, quantity: 1 }], startTime: '16:00', endTime: '17:00' }),
        });
        assert.equal(response.status, ['student', 'faculty'].includes(role) ? 201 : 403, `${role} creation permission`);
        const recommendations = await fetch(`http://127.0.0.1:${server.address().port}/api/bookings/recommendations`, {
          method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...payload, departmentId: dep._id }),
        });
        assert.equal(recommendations.status, ['student', 'faculty'].includes(role) ? 200 : 403, `${role} recommendation permission`);
      }
      const token = jwt.sign({ sub: admin._id }, env.jwtSecret);
      const response = await fetch(`http://127.0.0.1:${server.address().port}/api/bookings`, { headers: { Authorization: `Bearer ${token}` } });
      assert.equal(response.status, 200, 'Admin still manages booking requests');
    } finally { await new Promise(resolve => server.close(resolve)); }
  });
  console.log(`${passed} integration checks passed; existing database untouched.`);
  if (process.argv.includes('--serve')) { const { app } = require('../src/app'); app.listen(5055, () => console.log('Temporary preview API http://localhost:5055')); }
  else await closeDatabase();
}
main().catch(err => { console.error(err); process.exitCode = 1; });

