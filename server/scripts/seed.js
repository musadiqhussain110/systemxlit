const { connectDatabase, resetDatabase, closeDatabase } = require('../src/config/db');
const { Department } = require('../src/models/Department');
const { Lab } = require('../src/models/Lab');
const { Equipment } = require('../src/models/Equipment');
const { BookingRule } = require('../src/models/BookingRule');
const { EquipmentCategory } = require('../src/models/EquipmentCategory');

async function seed() {
  await connectDatabase();
  await resetDatabase();

  const [cs, ee, che] = await Department.insertMany([
    { name: 'Computer Systems Engineering', code: 'CSE' },
    { name: 'Electrical Engineering', code: 'EE' },
    { name: 'Chemical Engineering', code: 'CHE' },
  ]);

  await EquipmentCategory.insertMany([
    { name: 'Electronics Kit', code: 'ELEC' },
    { name: 'Measurement', code: 'MEAS' },
    { name: 'Camera', code: 'CAM' },
    { name: 'Networking', code: 'NET' },
  ]);

  const weekdaySlots = [1, 2, 3, 4, 5].map((dayOfWeek) => ({ dayOfWeek, startTime: '08:00', endTime: '18:00' }));
  const labs = await Lab.insertMany([
    { code: 'ESL-01', name: 'Embedded Systems Lab', department: ee._id, capacity: 30, location: 'Engineering Block A, Room 201', facilities: ['Oscilloscope', 'Soldering Station', 'Projector'], availableSlots: weekdaySlots },
    { code: 'NET-02', name: 'Networking Lab', department: cs._id, capacity: 24, location: 'Computing Block, Room 112', facilities: ['Cisco Routers', 'Managed Switches', 'Projector'], availableSlots: weekdaySlots },
    { code: 'PROCESS-01', name: 'Process Control Lab', department: che._id, capacity: 20, location: 'Chemical Block, Ground Floor', facilities: ['Process Trainers', 'Sensors'], availableSlots: weekdaySlots },
  ]);

  await Equipment.insertMany([
    { code: 'ARD-U-001', name: 'Arduino Uno Kit', category: 'Electronics Kit', department: ee._id, lab: labs[0]._id, totalQuantity: 20, condition: 'excellent' },
    { code: 'OSC-DSO-01', name: 'Digital Oscilloscope', category: 'Measurement', department: ee._id, lab: labs[0]._id, totalQuantity: 8, condition: 'good' },
    { code: 'CAM-4K-01', name: '4K Camera', category: 'Camera', department: cs._id, lab: labs[1]._id, totalQuantity: 4, condition: 'good', approvalRequired: true },
    { code: 'RTR-CISCO-01', name: 'Cisco Router', category: 'Networking', department: cs._id, lab: labs[1]._id, totalQuantity: 12, condition: 'good' },
  ]);

  await BookingRule.create({
    department: null,
    maxDurationMinutes: 240,
    maxEquipmentQuantityPerItem: 20,
    advanceBookingDays: 30,
    minimumLeadHours: 1,
    approvalRequired: true,
    facultyPriority: true,
    lateReturnRestrictionThreshold: 3,
    lateReturnRestrictionDays: 7,
  });

  console.log('Reference data seed complete. No login accounts were created.');
  console.log('Start the app and open /setup to create the first administrator with your own credentials.');
}

seed()
  .then(closeDatabase)
  .catch(async (error) => {
    console.error(error);
    await closeDatabase().catch(() => {});
    process.exit(1);
  });
