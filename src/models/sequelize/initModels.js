const { DataTypes } = require('sequelize');

/**
 * Sequelize models aligned with the existing PostgreSQL schema (formerly managed by Prisma).
 * Table names match Prisma defaults (PascalCase, freezeTableName).
 */
function initModels(sequelize) {
  const User = sequelize.define(
    'User',
    {
      id: { type: DataTypes.UUID, primaryKey: true, defaultValue: DataTypes.UUIDV4 },
      role: { type: DataTypes.STRING, allowNull: false },
      name: DataTypes.STRING,
      phone: DataTypes.STRING,
      email: DataTypes.STRING,
      passwordHash: DataTypes.STRING,
      parentName: DataTypes.STRING,
      parentPhone: DataTypes.STRING,
      deviceFingerprints: { type: DataTypes.ARRAY(DataTypes.STRING), defaultValue: [] },
      packageId: DataTypes.UUID,
      packageExpiry: DataTypes.DATE,
      ownedBy: DataTypes.UUID,
      instructorPortfolio: DataTypes.JSONB,
      fcmToken: DataTypes.STRING,
      lastLogin: DataTypes.DATE,
      tenantId: DataTypes.UUID,
      createdAt: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
    },
    { tableName: 'User', timestamps: false },
  );

  const UserAssignedCourse = sequelize.define(
    'UserAssignedCourse',
    {
      userId: { type: DataTypes.UUID, primaryKey: true },
      courseId: { type: DataTypes.UUID, primaryKey: true },
      tenantId: DataTypes.UUID,
    },
    { tableName: 'UserAssignedCourse', timestamps: false },
  );

  const Package = sequelize.define(
    'Package',
    {
      id: { type: DataTypes.UUID, primaryKey: true, defaultValue: DataTypes.UUIDV4 },
      tenantId: DataTypes.UUID,
      name: { type: DataTypes.STRING, allowNull: false },
      price: { type: DataTypes.DECIMAL(14, 2), allowNull: false },
      lessonCount: { type: DataTypes.INTEGER, defaultValue: 0 },
      durationDays: { type: DataTypes.INTEGER, defaultValue: 30 },
      features: { type: DataTypes.ARRAY(DataTypes.STRING), defaultValue: [] },
      active: { type: DataTypes.BOOLEAN, defaultValue: true },
      featured: { type: DataTypes.BOOLEAN, defaultValue: false },
      createdAt: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
    },
    { tableName: 'Package', timestamps: false },
  );

  const SubscriptionPlan = sequelize.define(
    'SubscriptionPlan',
    {
      id: { type: DataTypes.UUID, primaryKey: true, defaultValue: DataTypes.UUIDV4 },
      slug: { type: DataTypes.STRING, allowNull: false, unique: true },
      name: { type: DataTypes.STRING, allowNull: false },
      maxTeachers: { type: DataTypes.INTEGER, defaultValue: 10 },
      maxStudents: { type: DataTypes.INTEGER, defaultValue: 500 },
      maxCourses: { type: DataTypes.INTEGER, defaultValue: 50 },
      features: { type: DataTypes.JSONB, defaultValue: {} },
      active: { type: DataTypes.BOOLEAN, defaultValue: true },
      createdAt: { type: DataTypes.DATE, defaultValue: DataTypes.NOW },
    },
    { tableName: 'SubscriptionPlan', timestamps: false },
  );

  const Tenant = sequelize.define(
    'Tenant',
    {
      id: { type: DataTypes.UUID, primaryKey: true, defaultValue: DataTypes.UUIDV4 },
      slug: { type: DataTypes.STRING, allowNull: false, unique: true },
      name: { type: DataTypes.STRING, allowNull: false },
      status: { type: DataTypes.STRING, defaultValue: 'active' },
      planId: DataTypes.UUID,
      branding: { type: DataTypes.JSONB, defaultValue: {} },
      settings: { type: DataTypes.JSONB, defaultValue: {} },
      createdAt: { type: DataTypes.DATE, defaultValue: DataTypes.NOW },
      updatedAt: { type: DataTypes.DATE, defaultValue: DataTypes.NOW },
    },
    { tableName: 'Tenant', timestamps: true, createdAt: 'createdAt', updatedAt: 'updatedAt' },
  );

  const Course = sequelize.define(
    'Course',
    {
      id: { type: DataTypes.UUID, primaryKey: true, defaultValue: DataTypes.UUIDV4 },
      tenantId: DataTypes.UUID,
      kind: { type: DataTypes.STRING, defaultValue: 'classroom' },
      ownerId: { type: DataTypes.UUID, allowNull: false },
      ownerRole: { type: DataTypes.STRING, allowNull: false },
      title: { type: DataTypes.STRING, allowNull: false },
      category: DataTypes.STRING,
      description: DataTypes.TEXT,
      coverImage: DataTypes.STRING,
      galleryImages: { type: DataTypes.ARRAY(DataTypes.STRING), defaultValue: [] },
      passingScoreDefault: { type: DataTypes.INTEGER, defaultValue: 60 },
      language: { type: DataTypes.ARRAY(DataTypes.STRING), defaultValue: [] },
      maxStudents: { type: DataTypes.INTEGER, defaultValue: 0 },
      certificateEnabled: { type: DataTypes.BOOLEAN, defaultValue: false },
      price: { type: DataTypes.DECIMAL(14, 2), defaultValue: 0 },
      currency: { type: DataTypes.STRING, defaultValue: 'EGP' },
      status: { type: DataTypes.STRING, defaultValue: 'draft' },
      packageIds: { type: DataTypes.ARRAY(DataTypes.STRING), defaultValue: [] },
      lessonIds: { type: DataTypes.ARRAY(DataTypes.STRING), defaultValue: [] },
    },
    { tableName: 'Course', timestamps: true, createdAt: 'createdAt', updatedAt: 'updatedAt' },
  );

  const CourseEnrollment = sequelize.define(
    'CourseEnrollment',
    {
      courseId: { type: DataTypes.UUID, primaryKey: true },
      studentId: { type: DataTypes.UUID, primaryKey: true },
      tenantId: DataTypes.UUID,
      createdAt: { type: DataTypes.DATE, defaultValue: DataTypes.NOW },
    },
    { tableName: 'CourseEnrollment', timestamps: false },
  );

  const CourseAssistant = sequelize.define(
    'CourseAssistant',
    {
      courseId: { type: DataTypes.UUID, primaryKey: true },
      userId: { type: DataTypes.UUID, primaryKey: true },
      tenantId: DataTypes.UUID,
      permissions: { type: DataTypes.ARRAY(DataTypes.STRING), defaultValue: [] },
    },
    { tableName: 'CourseAssistant', timestamps: false },
  );

  const Lesson = sequelize.define(
    'Lesson',
    {
      id: { type: DataTypes.UUID, primaryKey: true, defaultValue: DataTypes.UUIDV4 },
      courseId: { type: DataTypes.UUID, allowNull: false },
      tenantId: DataTypes.UUID,
      title: { type: DataTypes.STRING, allowNull: false },
      order: { type: DataTypes.INTEGER, defaultValue: 0 },
      description: DataTypes.TEXT,
      published: { type: DataTypes.BOOLEAN, defaultValue: false },
      subLessonIds: { type: DataTypes.ARRAY(DataTypes.STRING), defaultValue: [] },
      createdAt: { type: DataTypes.DATE, defaultValue: DataTypes.NOW },
    },
    { tableName: 'Lesson', timestamps: false },
  );

  const SubLesson = sequelize.define(
    'SubLesson',
    {
      id: { type: DataTypes.UUID, primaryKey: true, defaultValue: DataTypes.UUIDV4 },
      lessonId: { type: DataTypes.UUID, allowNull: false },
      courseId: { type: DataTypes.UUID, allowNull: false },
      tenantId: DataTypes.UUID,
      title: { type: DataTypes.STRING, allowNull: false },
      description: DataTypes.TEXT,
      order: { type: DataTypes.INTEGER, defaultValue: 0 },
      type: { type: DataTypes.STRING, allowNull: false },
      cloudinaryAssetId: DataTypes.STRING,
      cloudinaryPublicId: DataTypes.STRING,
      fileUrl: DataTypes.STRING,
      assessmentId: DataTypes.UUID,
      published: { type: DataTypes.BOOLEAN, defaultValue: false },
      estimatedMinutes: { type: DataTypes.INTEGER, defaultValue: 0 },
      createdAt: { type: DataTypes.DATE, defaultValue: DataTypes.NOW },
    },
    { tableName: 'SubLesson', timestamps: false },
  );

  const Assessment = sequelize.define(
    'Assessment',
    {
      id: { type: DataTypes.UUID, primaryKey: true, defaultValue: DataTypes.UUIDV4 },
      subLessonId: { type: DataTypes.UUID, allowNull: false },
      courseId: { type: DataTypes.UUID, allowNull: false },
      tenantId: DataTypes.UUID,
      label: DataTypes.STRING,
      type: { type: DataTypes.STRING, allowNull: false },
      questions: { type: DataTypes.JSONB, defaultValue: [] },
      timerMinutes: { type: DataTypes.INTEGER, defaultValue: 0 },
      randomiseQuestions: { type: DataTypes.BOOLEAN, defaultValue: false },
      randomiseOptions: { type: DataTypes.BOOLEAN, defaultValue: false },
      maxAttempts: { type: DataTypes.INTEGER, defaultValue: 1 },
      showResultsImmediately: { type: DataTypes.BOOLEAN, defaultValue: true },
      deadline: DataTypes.DATE,
      gradeWeight: { type: DataTypes.INTEGER, defaultValue: 1 },
      passingScore: { type: DataTypes.INTEGER, defaultValue: 60 },
      passage: DataTypes.TEXT,
      fileUploadEnabled: { type: DataTypes.BOOLEAN, defaultValue: false },
      lateSubmissionAllowed: { type: DataTypes.BOOLEAN, defaultValue: false },
      published: { type: DataTypes.BOOLEAN, defaultValue: false },
      createdAt: { type: DataTypes.DATE, defaultValue: DataTypes.NOW },
    },
    { tableName: 'Assessment', timestamps: false },
  );

  const Submission = sequelize.define(
    'Submission',
    {
      id: { type: DataTypes.UUID, primaryKey: true, defaultValue: DataTypes.UUIDV4 },
      studentId: { type: DataTypes.UUID, allowNull: false },
      assessmentId: { type: DataTypes.UUID, allowNull: false },
      courseId: { type: DataTypes.UUID, allowNull: false },
      tenantId: DataTypes.UUID,
      answers: { type: DataTypes.JSONB, defaultValue: [] },
      uploadedFiles: { type: DataTypes.JSONB, defaultValue: [] },
      score: DataTypes.DECIMAL(8, 2),
      isPassed: DataTypes.BOOLEAN,
      status: { type: DataTypes.STRING, defaultValue: 'not_started' },
      gradedById: DataTypes.UUID,
      instructorFeedback: DataTypes.TEXT,
      submittedAt: DataTypes.DATE,
      gradedAt: DataTypes.DATE,
      isLate: { type: DataTypes.BOOLEAN, defaultValue: false },
    },
    { tableName: 'Submission', timestamps: false },
  );

  const Progress = sequelize.define(
    'Progress',
    {
      id: { type: DataTypes.UUID, primaryKey: true, defaultValue: DataTypes.UUIDV4 },
      studentId: { type: DataTypes.UUID, allowNull: false },
      courseId: { type: DataTypes.UUID, allowNull: false },
      tenantId: DataTypes.UUID,
      completedSubLessonIds: { type: DataTypes.ARRAY(DataTypes.STRING), defaultValue: [] },
      lastAccessedAt: DataTypes.DATE,
      overallPercent: { type: DataTypes.FLOAT, defaultValue: 0 },
    },
    {
      tableName: 'Progress',
      timestamps: true,
      createdAt: 'createdAt',
      updatedAt: 'updatedAt',
      indexes: [{ unique: true, fields: ['studentId', 'courseId'] }],
    },
  );

  const Notification = sequelize.define(
    'Notification',
    {
      id: { type: DataTypes.UUID, primaryKey: true, defaultValue: DataTypes.UUIDV4 },
      userId: { type: DataTypes.UUID, allowNull: false },
      tenantId: DataTypes.UUID,
      type: { type: DataTypes.STRING, allowNull: false },
      payload: { type: DataTypes.JSONB, defaultValue: {} },
      channel: { type: DataTypes.ARRAY(DataTypes.STRING), defaultValue: [] },
      status: { type: DataTypes.STRING, defaultValue: 'queued' },
      createdAt: { type: DataTypes.DATE, defaultValue: DataTypes.NOW },
    },
    { tableName: 'Notification', timestamps: false },
  );

  const Message = sequelize.define(
    'Message',
    {
      id: { type: DataTypes.UUID, primaryKey: true, defaultValue: DataTypes.UUIDV4 },
      senderId: { type: DataTypes.UUID, allowNull: false },
      receiverId: DataTypes.UUID,
      courseId: { type: DataTypes.UUID, allowNull: false },
      tenantId: DataTypes.UUID,
      content: { type: DataTypes.TEXT, allowNull: false },
      attachmentUrl: DataTypes.STRING,
      readAt: DataTypes.DATE,
      createdAt: { type: DataTypes.DATE, defaultValue: DataTypes.NOW },
    },
    { tableName: 'Message', timestamps: false },
  );

  const LiveSession = sequelize.define(
    'LiveSession',
    {
      id: { type: DataTypes.UUID, primaryKey: true, defaultValue: DataTypes.UUIDV4 },
      courseId: { type: DataTypes.UUID, allowNull: false },
      tenantId: DataTypes.UUID,
      hostId: { type: DataTypes.UUID, allowNull: false },
      title: { type: DataTypes.STRING, allowNull: false },
      description: DataTypes.TEXT,
      scheduledAt: { type: DataTypes.DATE, allowNull: false },
      durationMinutes: { type: DataTypes.INTEGER, defaultValue: 60 },
      maxParticipants: { type: DataTypes.INTEGER, defaultValue: 100 },
      status: { type: DataTypes.STRING, defaultValue: 'scheduled' },
      vConnectRoomId: DataTypes.STRING,
      hostUrl: DataTypes.TEXT,
      participantUrl: DataTypes.TEXT,
      recordingEnabled: { type: DataTypes.BOOLEAN, defaultValue: false },
      autoPublishRecording: { type: DataTypes.BOOLEAN, defaultValue: false },
      recordingUrl: DataTypes.TEXT,
      remindersSent: { type: DataTypes.ARRAY(DataTypes.STRING), defaultValue: [] },
      recurring: DataTypes.JSONB,
      createdAt: { type: DataTypes.DATE, defaultValue: DataTypes.NOW },
    },
    { tableName: 'LiveSession', timestamps: false },
  );

  const Transaction = sequelize.define(
    'Transaction',
    {
      id: { type: DataTypes.UUID, primaryKey: true, defaultValue: DataTypes.UUIDV4 },
      studentId: { type: DataTypes.UUID, allowNull: false },
      packageId: DataTypes.UUID,
      courseId: DataTypes.UUID,
      tenantId: DataTypes.UUID,
      amount: { type: DataTypes.DECIMAL(14, 2), allowNull: false },
      promoCode: DataTypes.STRING,
      promoDiscount: { type: DataTypes.DECIMAL(14, 2), defaultValue: 0 },
      paymobRef: DataTypes.STRING,
      paymentMethod: DataTypes.STRING,
      status: { type: DataTypes.STRING, defaultValue: 'pending' },
      createdAt: { type: DataTypes.DATE, defaultValue: DataTypes.NOW },
    },
    { tableName: 'Transaction', timestamps: false },
  );

  const PromoCode = sequelize.define(
    'PromoCode',
    {
      id: { type: DataTypes.UUID, primaryKey: true, defaultValue: DataTypes.UUIDV4 },
      tenantId: DataTypes.UUID,
      code: { type: DataTypes.STRING, allowNull: false },
      discountType: { type: DataTypes.STRING, allowNull: false },
      discountValue: { type: DataTypes.DECIMAL(14, 2), allowNull: false },
      usageLimit: DataTypes.INTEGER,
      usageCount: { type: DataTypes.INTEGER, defaultValue: 0 },
      expiresAt: DataTypes.DATE,
      active: { type: DataTypes.BOOLEAN, defaultValue: true },
      createdAt: { type: DataTypes.DATE, defaultValue: DataTypes.NOW },
    },
    { tableName: 'PromoCode', timestamps: false },
  );

  const AgentSession = sequelize.define(
    'AgentSession',
    {
      id: { type: DataTypes.UUID, primaryKey: true, defaultValue: DataTypes.UUIDV4 },
      studentId: { type: DataTypes.UUID, allowNull: false },
      tenantId: DataTypes.UUID,
      deviceFingerprint: { type: DataTypes.STRING, allowNull: false },
      sessionToken: { type: DataTypes.STRING, allowNull: false, unique: true },
      activeVideoId: DataTypes.STRING,
      threats: { type: DataTypes.JSONB, defaultValue: [] },
      heartbeatAt: DataTypes.DATE,
      status: { type: DataTypes.STRING, defaultValue: 'active' },
      createdAt: { type: DataTypes.DATE, defaultValue: DataTypes.NOW },
    },
    { tableName: 'AgentSession', timestamps: false },
  );

  Tenant.belongsTo(SubscriptionPlan, { foreignKey: 'planId', as: 'plan' });
  SubscriptionPlan.hasMany(Tenant, { foreignKey: 'planId', as: 'tenants' });

  User.belongsTo(Tenant, { foreignKey: 'tenantId', as: 'tenant' });
  Tenant.hasMany(User, { foreignKey: 'tenantId', as: 'users' });

  Course.belongsTo(Tenant, { foreignKey: 'tenantId', as: 'tenant' });
  Tenant.hasMany(Course, { foreignKey: 'tenantId', as: 'courses' });

  User.belongsTo(Package, { foreignKey: 'packageId', as: 'package' });
  User.belongsTo(User, { foreignKey: 'ownedBy', as: 'owner' });
  User.hasMany(User, { foreignKey: 'ownedBy', as: 'ownedUsers' });
  User.hasMany(UserAssignedCourse, { foreignKey: 'userId', as: 'assignedCourseLinks' });
  UserAssignedCourse.belongsTo(User, { foreignKey: 'userId' });
  UserAssignedCourse.belongsTo(Course, { foreignKey: 'courseId' });

  Course.belongsTo(User, { foreignKey: 'ownerId', as: 'owner' });
  Course.hasMany(CourseEnrollment, { foreignKey: 'courseId', as: 'enrollments' });
  Course.hasMany(CourseAssistant, { foreignKey: 'courseId', as: 'assistants' });
  CourseEnrollment.belongsTo(Course, { foreignKey: 'courseId' });
  CourseEnrollment.belongsTo(User, { foreignKey: 'studentId', as: 'student' });
  CourseAssistant.belongsTo(Course, { foreignKey: 'courseId' });
  CourseAssistant.belongsTo(User, { foreignKey: 'userId' });

  Lesson.belongsTo(Course, { foreignKey: 'courseId' });
  SubLesson.belongsTo(Lesson, { foreignKey: 'lessonId' });
  SubLesson.belongsTo(Course, { foreignKey: 'courseId' });
  Assessment.belongsTo(SubLesson, { foreignKey: 'subLessonId', as: 'subLesson' });
  Assessment.belongsTo(Course, { foreignKey: 'courseId' });
  Submission.belongsTo(User, { foreignKey: 'studentId', as: 'student' });
  Submission.belongsTo(User, { foreignKey: 'gradedById', as: 'gradedBy' });
  Progress.belongsTo(User, { foreignKey: 'studentId', as: 'student' });
  Progress.belongsTo(Course, { foreignKey: 'courseId' });
  Notification.belongsTo(User, { foreignKey: 'userId' });
  Message.belongsTo(User, { foreignKey: 'senderId', as: 'sender' });
  Message.belongsTo(User, { foreignKey: 'receiverId', as: 'receiver' });
  Message.belongsTo(Course, { foreignKey: 'courseId' });
  LiveSession.belongsTo(Course, { foreignKey: 'courseId' });
  LiveSession.belongsTo(User, { foreignKey: 'hostId', as: 'host' });
  Transaction.belongsTo(User, { foreignKey: 'studentId', as: 'student' });
  Transaction.belongsTo(Package, { foreignKey: 'packageId' });
  Transaction.belongsTo(Course, { foreignKey: 'courseId' });
  AgentSession.belongsTo(User, { foreignKey: 'studentId' });

  return {
    sequelize,
    User,
    UserAssignedCourse,
    Package,
    SubscriptionPlan,
    Tenant,
    Course,
    CourseEnrollment,
    CourseAssistant,
    Lesson,
    SubLesson,
    Assessment,
    Submission,
    Progress,
    Notification,
    Message,
    LiveSession,
    Transaction,
    PromoCode,
    AgentSession,
  };
}

module.exports = initModels;
