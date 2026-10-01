const schemaStatements = [
  `CREATE TABLE IF NOT EXISTS departments (
    _id TEXT PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    code TEXT NOT NULL UNIQUE,
    createdAt TEXT NOT NULL,
    updatedAt TEXT NOT NULL
  )`,

  `CREATE TABLE IF NOT EXISTS equipment_categories (
    _id TEXT PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    code TEXT NOT NULL UNIQUE,
    createdAt TEXT NOT NULL,
    updatedAt TEXT NOT NULL
  )`,

  `CREATE TABLE IF NOT EXISTS users (
    _id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    passwordHash TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'student',
    department TEXT NULL,
    registrationNumber TEXT NOT NULL DEFAULT '',
    active INTEGER NOT NULL DEFAULT 1,
    lateReturnCount INTEGER NOT NULL DEFAULT 0,
    bookingRestrictedUntil TEXT NULL,
    createdAt TEXT NOT NULL,
    updatedAt TEXT NOT NULL
  )`,

  `CREATE TABLE IF NOT EXISTS labs (
    _id TEXT PRIMARY KEY,
    code TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    department TEXT NOT NULL,
    capacity INTEGER NOT NULL,
    location TEXT NOT NULL,
    facilities TEXT NOT NULL,
    availableSlots TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'available',
    maintenanceNote TEXT NOT NULL DEFAULT '',
    createdAt TEXT NOT NULL,
    updatedAt TEXT NOT NULL
  )`,

  `CREATE TABLE IF NOT EXISTS equipment (
    _id TEXT PRIMARY KEY,
    code TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    category TEXT NOT NULL,
    department TEXT NOT NULL,
    lab TEXT NULL,
    totalQuantity INTEGER NOT NULL,
    conditionStatus TEXT NOT NULL DEFAULT 'good',
    maintenanceStatus TEXT NOT NULL DEFAULT 'operational',
    maintenanceNote TEXT NOT NULL DEFAULT '',
    approvalRequired INTEGER NOT NULL DEFAULT 0,
    createdAt TEXT NOT NULL,
    updatedAt TEXT NOT NULL
  )`,

  `CREATE TABLE IF NOT EXISTS booking_rules (
    _id TEXT PRIMARY KEY,
    department TEXT NULL,
    maxDurationMinutes INTEGER NOT NULL DEFAULT 240,
    maxEquipmentQuantityPerItem INTEGER NOT NULL DEFAULT 20,
    advanceBookingDays INTEGER NOT NULL DEFAULT 30,
    minimumLeadHours INTEGER NOT NULL DEFAULT 1,
    approvalRequired INTEGER NOT NULL DEFAULT 1,
    facultyPriority INTEGER NOT NULL DEFAULT 1,
    departmentOnlyAccess INTEGER NOT NULL DEFAULT 0,
    lateReturnRestrictionThreshold INTEGER NOT NULL DEFAULT 3,
    lateReturnRestrictionDays INTEGER NOT NULL DEFAULT 7,
    createdAt TEXT NOT NULL,
    updatedAt TEXT NOT NULL
  )`,

  `CREATE TABLE IF NOT EXISTS bookings (
    _id TEXT PRIMARY KEY,
    user TEXT NOT NULL,
    department TEXT NOT NULL,
    lab TEXT NULL,
    equipmentItems TEXT NOT NULL,
    bookingDate TEXT NOT NULL,
    startTime TEXT NOT NULL,
    endTime TEXT NOT NULL,
    purpose TEXT NOT NULL,
    priority TEXT NOT NULL DEFAULT 'normal',
    approvalStatus TEXT NOT NULL DEFAULT 'pending',
    status TEXT NOT NULL DEFAULT 'pendingApproval',
    approvedBy TEXT NULL,
    approvedAt TEXT NULL,
    rejectionReason TEXT NOT NULL DEFAULT '',
    cancelledAt TEXT NULL,
    cancellationReason TEXT NOT NULL DEFAULT '',
    createdAt TEXT NOT NULL,
    updatedAt TEXT NOT NULL
  )`,

  `CREATE TABLE IF NOT EXISTS issue_records (
    _id TEXT PRIMARY KEY,
    booking TEXT NOT NULL UNIQUE,
    items TEXT NOT NULL,
    issuedBy TEXT NOT NULL,
    issuedAt TEXT NOT NULL,
    dueAt TEXT NOT NULL,
    returnedAt TEXT NULL,
    receivedBy TEXT NULL,
    remarks TEXT NOT NULL DEFAULT '',
    createdAt TEXT NOT NULL,
    updatedAt TEXT NOT NULL
  )`,

  `CREATE TABLE IF NOT EXISTS notifications (
    _id TEXT PRIMARY KEY,
    user TEXT NOT NULL,
    type TEXT NOT NULL,
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    booking TEXT NULL,
    readAt TEXT NULL,
    createdAt TEXT NOT NULL,
    updatedAt TEXT NOT NULL
  )`,

  `CREATE TABLE IF NOT EXISTS resource_watches (
    _id TEXT PRIMARY KEY,
    user TEXT NOT NULL,
    resourceType TEXT NOT NULL,
    resourceId TEXT NOT NULL,
    createdAt TEXT NOT NULL,
    updatedAt TEXT NOT NULL,
    UNIQUE (user, resourceType, resourceId)
  )`,

  `CREATE TABLE IF NOT EXISTS activity_logs (
    _id TEXT PRIMARY KEY,
    actor TEXT NULL,
    action TEXT NOT NULL,
    entityType TEXT NOT NULL,
    entityId TEXT NOT NULL,
    metadata TEXT NOT NULL,
    createdAt TEXT NOT NULL,
    updatedAt TEXT NOT NULL
  )`,

  `CREATE INDEX IF NOT EXISTS idx_users_role ON users(role)`,
  `CREATE INDEX IF NOT EXISTS idx_users_department ON users(department)`,
  `CREATE INDEX IF NOT EXISTS idx_labs_department ON labs(department)`,
  `CREATE INDEX IF NOT EXISTS idx_labs_status ON labs(status)`,
  `CREATE INDEX IF NOT EXISTS idx_labs_name ON labs(name)`,
  `CREATE INDEX IF NOT EXISTS idx_equipment_department ON equipment(department)`,
  `CREATE INDEX IF NOT EXISTS idx_equipment_lab ON equipment(lab)`,
  `CREATE INDEX IF NOT EXISTS idx_equipment_category ON equipment(category)`,
  `CREATE INDEX IF NOT EXISTS idx_equipment_maintenance ON equipment(maintenanceStatus)`,
  `CREATE INDEX IF NOT EXISTS idx_equipment_name ON equipment(name)`,
  `CREATE INDEX IF NOT EXISTS idx_rules_department ON booking_rules(department)`,
  `CREATE INDEX IF NOT EXISTS idx_bookings_user ON bookings(user)`,
  `CREATE INDEX IF NOT EXISTS idx_bookings_department ON bookings(department)`,
  `CREATE INDEX IF NOT EXISTS idx_bookings_lab ON bookings(lab)`,
  `CREATE INDEX IF NOT EXISTS idx_bookings_date ON bookings(bookingDate)`,
  `CREATE INDEX IF NOT EXISTS idx_bookings_status ON bookings(status)`,
  `CREATE INDEX IF NOT EXISTS idx_bookings_approval ON bookings(approvalStatus)`,
  `CREATE INDEX IF NOT EXISTS idx_issue_due ON issue_records(dueAt)`,
  `CREATE INDEX IF NOT EXISTS idx_issue_returned ON issue_records(returnedAt)`,
  `CREATE INDEX IF NOT EXISTS idx_notifications_user_created ON notifications(user, createdAt)`,
  `CREATE INDEX IF NOT EXISTS idx_notifications_type ON notifications(type)`,
  `CREATE INDEX IF NOT EXISTS idx_watch_resource ON resource_watches(resourceType, resourceId)`,
  `CREATE INDEX IF NOT EXISTS idx_activity_action ON activity_logs(action)`,
  `CREATE INDEX IF NOT EXISTS idx_activity_entity ON activity_logs(entityType, entityId)`,
  `CREATE INDEX IF NOT EXISTS idx_activity_created ON activity_logs(createdAt)`,
];

const tablesInDependencyOrder = [
  'activity_logs',
  'notifications',
  'resource_watches',
  'issue_records',
  'bookings',
  'booking_rules',
  'equipment',
  'labs',
  'users',
  'equipment_categories',
  'departments',
];

module.exports = { schemaStatements, tablesInDependencyOrder };
