const { Department } = require('../models/Department');
const { User } = require('../models/User');
const { Lab } = require('../models/Lab');
const { Equipment } = require('../models/Equipment');
const { Booking } = require('../models/Booking');
const { uniqueIds } = require('../utils/ids');

function indexById(rows) {
  return new Map(rows.map((row) => [String(row._id), row]));
}

function publicUser(user) {
  if (!user) return null;
  const { passwordHash, ...safe } = user;
  return safe;
}

async function fetchByIds(Model, ids) {
  const unique = uniqueIds(ids);
  if (!unique.length) return new Map();
  return indexById(await Model.findAll({ _id: { $in: unique } }));
}

async function hydrateUsers(rows = []) {
  const departments = await fetchByIds(Department, rows.map((row) => row.department));
  return rows.map((row) => ({
    ...publicUser(row),
    department: row.department ? (departments.get(String(row.department)) || row.department) : null,
  }));
}

async function hydrateLabs(rows = []) {
  const departments = await fetchByIds(Department, rows.map((row) => row.department));
  return rows.map((row) => ({
    ...row,
    department: row.department ? (departments.get(String(row.department)) || row.department) : null,
  }));
}

async function hydrateEquipment(rows = []) {
  const [departments, labs] = await Promise.all([
    fetchByIds(Department, rows.map((row) => row.department)),
    fetchByIds(Lab, rows.map((row) => row.lab)),
  ]);
  return rows.map((row) => ({
    ...row,
    department: row.department ? (departments.get(String(row.department)) || row.department) : null,
    lab: row.lab ? (labs.get(String(row.lab)) || row.lab) : null,
  }));
}

async function hydrateBookings(rows = []) {
  const equipmentIds = rows.flatMap((row) => (row.equipmentItems || []).map((item) => item.equipment));
  const [users, departments, labs, equipment, approvers] = await Promise.all([
    fetchByIds(User, rows.map((row) => row.user)),
    fetchByIds(Department, rows.map((row) => row.department)),
    fetchByIds(Lab, rows.map((row) => row.lab)),
    fetchByIds(Equipment, equipmentIds),
    fetchByIds(User, rows.map((row) => row.approvedBy)),
  ]);

  return rows.map((row) => ({
    ...row,
    user: row.user ? publicUser(users.get(String(row.user))) || row.user : null,
    department: row.department ? (departments.get(String(row.department)) || row.department) : null,
    lab: row.lab ? (labs.get(String(row.lab)) || row.lab) : null,
    approvedBy: row.approvedBy ? publicUser(approvers.get(String(row.approvedBy))) || row.approvedBy : null,
    equipmentItems: (row.equipmentItems || []).map((item) => ({
      ...item,
      equipment: equipment.get(String(item.equipment)) || item.equipment,
    })),
  }));
}

async function hydrateIssueRecords(rows = []) {
  const equipmentIds = rows.flatMap((row) => (row.items || []).map((item) => item.equipment));
  const bookingIds = rows.map((row) => row.booking);
  const rawBookings = bookingIds.length ? await Booking.findAll({ _id: { $in: uniqueIds(bookingIds) } }) : [];
  const hydratedBookings = await hydrateBookings(rawBookings);
  const [bookings, equipment, issuedBy, receivedBy] = await Promise.all([
    Promise.resolve(indexById(hydratedBookings)),
    fetchByIds(Equipment, equipmentIds),
    fetchByIds(User, rows.map((row) => row.issuedBy)),
    fetchByIds(User, rows.map((row) => row.receivedBy)),
  ]);

  return rows.map((row) => ({
    ...row,
    booking: row.booking ? (bookings.get(String(row.booking)) || row.booking) : null,
    items: (row.items || []).map((item) => ({ ...item, equipment: equipment.get(String(item.equipment)) || item.equipment })),
    issuedBy: row.issuedBy ? publicUser(issuedBy.get(String(row.issuedBy))) || row.issuedBy : null,
    receivedBy: row.receivedBy ? publicUser(receivedBy.get(String(row.receivedBy))) || row.receivedBy : null,
  }));
}

async function hydrateRules(rows = []) {
  const departments = await fetchByIds(Department, rows.map((row) => row.department));
  return rows.map((row) => ({
    ...row,
    department: row.department ? (departments.get(String(row.department)) || row.department) : null,
  }));
}

async function hydrateActivities(rows = []) {
  const actors = await fetchByIds(User, rows.map((row) => row.actor));
  return rows.map((row) => ({
    ...row,
    actor: row.actor ? publicUser(actors.get(String(row.actor))) || row.actor : null,
  }));
}

module.exports = {
  publicUser,
  hydrateUsers,
  hydrateLabs,
  hydrateEquipment,
  hydrateBookings,
  hydrateIssueRecords,
  hydrateRules,
  hydrateActivities,
};
