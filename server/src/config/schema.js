const schemaStatements = [
  `CREATE TABLE IF NOT EXISTS departments (
    _id CHAR(24) PRIMARY KEY,
    name VARCHAR(150) NOT NULL UNIQUE,
    code VARCHAR(40) NOT NULL UNIQUE,
    createdAt DATETIME(3) NOT NULL,
    updatedAt DATETIME(3) NOT NULL
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

  `CREATE TABLE IF NOT EXISTS equipment_categories (
    _id CHAR(24) PRIMARY KEY,
    name VARCHAR(150) NOT NULL UNIQUE,
    code VARCHAR(40) NOT NULL UNIQUE,
    createdAt DATETIME(3) NOT NULL,
    updatedAt DATETIME(3) NOT NULL
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

  `CREATE TABLE IF NOT EXISTS users (
    _id CHAR(24) PRIMARY KEY,
    name VARCHAR(160) NOT NULL,
    email VARCHAR(190) NOT NULL UNIQUE,
    passwordHash VARCHAR(255) NOT NULL,
    role VARCHAR(30) NOT NULL DEFAULT 'student',
    department CHAR(24) NULL,
    registrationNumber VARCHAR(80) NOT NULL DEFAULT '',
    active TINYINT(1) NOT NULL DEFAULT 1,
    lateReturnCount INT NOT NULL DEFAULT 0,
    bookingRestrictedUntil DATETIME(3) NULL,
    createdAt DATETIME(3) NOT NULL,
    updatedAt DATETIME(3) NOT NULL,
    INDEX idx_users_role (role),
    INDEX idx_users_department (department)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

  `CREATE TABLE IF NOT EXISTS labs (
    _id CHAR(24) PRIMARY KEY,
    code VARCHAR(60) NOT NULL UNIQUE,
    name VARCHAR(180) NOT NULL,
    department CHAR(24) NOT NULL,
    capacity INT NOT NULL,
    location VARCHAR(255) NOT NULL,
    facilities LONGTEXT NOT NULL,
    availableSlots LONGTEXT NOT NULL,
    status VARCHAR(30) NOT NULL DEFAULT 'available',
    maintenanceNote TEXT NOT NULL,
    createdAt DATETIME(3) NOT NULL,
    updatedAt DATETIME(3) NOT NULL,
    INDEX idx_labs_department (department),
    INDEX idx_labs_status (status),
    INDEX idx_labs_name (name)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

  `CREATE TABLE IF NOT EXISTS equipment (
    _id CHAR(24) PRIMARY KEY,
    code VARCHAR(60) NOT NULL UNIQUE,
    name VARCHAR(180) NOT NULL,
    category VARCHAR(150) NOT NULL,
    department CHAR(24) NOT NULL,
    lab CHAR(24) NULL,
    totalQuantity INT NOT NULL,
    conditionStatus VARCHAR(30) NOT NULL DEFAULT 'good',
    maintenanceStatus VARCHAR(30) NOT NULL DEFAULT 'operational',
    maintenanceNote TEXT NOT NULL,
    approvalRequired TINYINT(1) NOT NULL DEFAULT 0,
    createdAt DATETIME(3) NOT NULL,
    updatedAt DATETIME(3) NOT NULL,
    INDEX idx_equipment_department (department),
    INDEX idx_equipment_lab (lab),
    INDEX idx_equipment_category (category),
    INDEX idx_equipment_maintenance (maintenanceStatus),
    INDEX idx_equipment_name (name)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

  `CREATE TABLE IF NOT EXISTS booking_rules (
    _id CHAR(24) PRIMARY KEY,
    department CHAR(24) NULL,
    maxDurationMinutes INT NOT NULL DEFAULT 240,
    maxEquipmentQuantityPerItem INT NOT NULL DEFAULT 20,
    advanceBookingDays INT NOT NULL DEFAULT 30,
    minimumLeadHours INT NOT NULL DEFAULT 1,
    approvalRequired TINYINT(1) NOT NULL DEFAULT 1,
    facultyPriority TINYINT(1) NOT NULL DEFAULT 1,
    departmentOnlyAccess TINYINT(1) NOT NULL DEFAULT 0,
    lateReturnRestrictionThreshold INT NOT NULL DEFAULT 3,
    lateReturnRestrictionDays INT NOT NULL DEFAULT 7,
    createdAt DATETIME(3) NOT NULL,
    updatedAt DATETIME(3) NOT NULL,
    INDEX idx_rules_department (department)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

  `CREATE TABLE IF NOT EXISTS bookings (
    _id CHAR(24) PRIMARY KEY,
    user CHAR(24) NOT NULL,
    department CHAR(24) NOT NULL,
    lab CHAR(24) NULL,
    equipmentItems LONGTEXT NOT NULL,
    bookingDate DATE NOT NULL,
    startTime CHAR(5) NOT NULL,
    endTime CHAR(5) NOT NULL,
    purpose VARCHAR(800) NOT NULL,
    priority VARCHAR(30) NOT NULL DEFAULT 'normal',
    approvalStatus VARCHAR(30) NOT NULL DEFAULT 'pending',
    status VARCHAR(40) NOT NULL DEFAULT 'pendingApproval',
    approvedBy CHAR(24) NULL,
    approvedAt DATETIME(3) NULL,
    rejectionReason VARCHAR(500) NOT NULL DEFAULT '',
    cancelledAt DATETIME(3) NULL,
    cancellationReason VARCHAR(500) NOT NULL DEFAULT '',
    createdAt DATETIME(3) NOT NULL,
    updatedAt DATETIME(3) NOT NULL,
    INDEX idx_bookings_user (user),
    INDEX idx_bookings_department (department),
    INDEX idx_bookings_lab (lab),
    INDEX idx_bookings_date (bookingDate),
    INDEX idx_bookings_status (status),
    INDEX idx_bookings_approval (approvalStatus)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

  `CREATE TABLE IF NOT EXISTS issue_records (
    _id CHAR(24) PRIMARY KEY,
    booking CHAR(24) NOT NULL UNIQUE,
    items LONGTEXT NOT NULL,
    issuedBy CHAR(24) NOT NULL,
    issuedAt DATETIME(3) NOT NULL,
    dueAt DATETIME(3) NOT NULL,
    returnedAt DATETIME(3) NULL,
    receivedBy CHAR(24) NULL,
    remarks TEXT NOT NULL,
    createdAt DATETIME(3) NOT NULL,
    updatedAt DATETIME(3) NOT NULL,
    INDEX idx_issue_due (dueAt),
    INDEX idx_issue_returned (returnedAt)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

  `CREATE TABLE IF NOT EXISTS notifications (
    _id CHAR(24) PRIMARY KEY,
    user CHAR(24) NOT NULL,
    type VARCHAR(80) NOT NULL,
    title VARCHAR(220) NOT NULL,
    message TEXT NOT NULL,
    booking CHAR(24) NULL,
    readAt DATETIME(3) NULL,
    createdAt DATETIME(3) NOT NULL,
    updatedAt DATETIME(3) NOT NULL,
    INDEX idx_notifications_user_created (user, createdAt),
    INDEX idx_notifications_type (type)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

  `CREATE TABLE IF NOT EXISTS resource_watches (
    _id CHAR(24) PRIMARY KEY,
    user CHAR(24) NOT NULL,
    resourceType VARCHAR(20) NOT NULL,
    resourceId CHAR(24) NOT NULL,
    createdAt DATETIME(3) NOT NULL,
    updatedAt DATETIME(3) NOT NULL,
    UNIQUE KEY uq_resource_watch (user, resourceType, resourceId),
    INDEX idx_watch_resource (resourceType, resourceId)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

  `CREATE TABLE IF NOT EXISTS activity_logs (
    _id CHAR(24) PRIMARY KEY,
    actor CHAR(24) NULL,
    action VARCHAR(120) NOT NULL,
    entityType VARCHAR(80) NOT NULL,
    entityId CHAR(24) NOT NULL,
    metadata LONGTEXT NOT NULL,
    createdAt DATETIME(3) NOT NULL,
    updatedAt DATETIME(3) NOT NULL,
    INDEX idx_activity_action (action),
    INDEX idx_activity_entity (entityType, entityId),
    INDEX idx_activity_created (createdAt)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
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
