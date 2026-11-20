const asyncHandler = require('express-async-handler');
const ActivityLog = require('../models/ActivityLog');
const User = require('../models/User');

const ONLINE_TIMEOUT_MS = 15 * 60 * 1000; // 15 minutes of inactivity = offline

// ── GET /api/activity-log ──────────────────────────────────────────
// List activity logs with filtering, searching, and pagination
const getActivityLogs = asyncHandler(async (req, res) => {
  const {
    search = '',
    action = '',
    module: mod = '',
    userId = '',
    status = '',
    from = '',
    to = '',
    page = 1,
    limit = 50,
  } = req.query;

  const query = {};

  if (action && action !== 'all') {
    query.action = action.toUpperCase();
  }

  if (mod && mod !== 'all') {
    query.module = new RegExp(`^${mod}$`, 'i');
  }

  if (userId) {
    query.user = userId;
  }

  if (status && status !== 'all') {
    query.status = status;
  }

  if (from || to) {
    query.createdAt = {};
    if (from) query.createdAt.$gte = new Date(from);
    if (to) {
      const toDate = new Date(to);
      toDate.setHours(23, 59, 59, 999);
      query.createdAt.$lte = toDate;
    }
  }

  if (search && search.trim()) {
    const s = search.trim();
    query.$or = [
      { userName: { $regex: s, $options: 'i' } },
      { userEmail: { $regex: s, $options: 'i' } },
      { description: { $regex: s, $options: 'i' } },
      { ip: { $regex: s, $options: 'i' } },
      { device: { $regex: s, $options: 'i' } },
      { action: { $regex: s, $options: 'i' } },
      { module: { $regex: s, $options: 'i' } },
    ];
  }

  const p = Math.max(1, Number(page) || 1);
  const lim = Math.min(200, Math.max(10, Number(limit) || 50));
  const skip = (p - 1) * lim;

  const [logs, total] = await Promise.all([
    ActivityLog.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(lim)
      .lean(),
    ActivityLog.countDocuments(query),
  ]);

  res.json({
    logs,
    total,
    page: p,
    totalPages: Math.ceil(total / lim) || 1,
  });
});

// ── GET /api/activity-log/summary ──────────────────────────────────
// Returns KPI statistics for dashboard overview
const getActivityLogSummary = asyncHandler(async (req, res) => {
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);

  const now = new Date();
  const onlineCutoff = new Date(now.getTime() - ONLINE_TIMEOUT_MS);

  const [
    totalToday,
    uniqueIpsToday,
    loginsToday,
    onlineUsersCount,
    recentActionStats,
  ] = await Promise.all([
    ActivityLog.countDocuments({ createdAt: { $gte: startOfDay } }),
    ActivityLog.distinct('ip', { createdAt: { $gte: startOfDay } }),
    ActivityLog.countDocuments({ action: 'LOGIN', createdAt: { $gte: startOfDay } }),
    User.countDocuments({
      isOnline: true,
      lastActiveAt: { $gte: onlineCutoff },
      isActive: true,
    }),
    ActivityLog.aggregate([
      { $match: { createdAt: { $gte: startOfDay } } },
      { $group: { _id: '$action', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 6 },
    ]),
  ]);

  res.json({
    totalToday,
    uniqueIpsToday: uniqueIpsToday.length,
    loginsToday,
    onlineUsersCount,
    recentActionStats,
  });
});

// ── GET /api/activity-log/online-users ─────────────────────────────
// Returns list of users currently detected as online
const getOnlineUsers = asyncHandler(async (req, res) => {
  const onlineCutoff = new Date(Date.now() - ONLINE_TIMEOUT_MS);

  const onlineUsers = await User.find({
    isOnline: true,
    lastActiveAt: { $gte: onlineCutoff },
    isActive: true,
  })
    .select('name email role department assignedStation avatar photoUrl lastActiveAt lastLoginAt lastLoginIp lastLoginDevice')
    .sort({ lastActiveAt: -1 })
    .lean();

  res.json(onlineUsers);
});

// ── DELETE /api/activity-log/clear ─────────────────────────────────
// Admin/Dev only: Clear old activity logs
const clearActivityLogs = asyncHandler(async (req, res) => {
  const { olderThanDays } = req.body;
  let filter = {};

  if (olderThanDays && Number(olderThanDays) > 0) {
    const cutoff = new Date(Date.now() - Number(olderThanDays) * 24 * 60 * 60 * 1000);
    filter = { createdAt: { $lt: cutoff } };
  }

  const result = await ActivityLog.deleteMany(filter);
  res.json({
    message: `Cleared ${result.deletedCount} activity log records successfully.`,
    deletedCount: result.deletedCount,
  });
});

module.exports = {
  getActivityLogs,
  getActivityLogSummary,
  getOnlineUsers,
  clearActivityLogs,
};
