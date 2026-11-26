const asyncHandler = require('express-async-handler');
const Supplier = require('../models/Supplier');
const tg = require('../utils/telegramNotifier');
const { logActivity } = require('../utils/activityLogger');

const getSuppliers = asyncHandler(async (req, res) => {
  const { search } = req.query;
  const filter = search && search.trim()
    ? { name: { $regex: search.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), $options: 'i' } }
    : {};
  const suppliers = await Supplier.find(filter).sort({ createdAt: -1 }).lean();
  res.json(suppliers);
});


const getSupplierById = asyncHandler(async (req, res) => {
  const supplier = await Supplier.findById(req.params.id);
  if (!supplier) {
    res.status(404);
    throw new Error('Supplier not found');
  }
  res.json(supplier);
});

const createSupplier = asyncHandler(async (req, res) => {
  const trimmedName = (req.body.name || '').trim();
  if (!trimmedName) {
    res.status(400);
    throw new Error('Supplier name is required');
  }
  const dup = await Supplier.findOne({
    name: { $regex: `^${trimmedName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, $options: 'i' },
  }).lean();
  if (dup) {
    res.status(400);
    throw new Error(`Supplier "${trimmedName}" already exists. Duplicate name is not allowed.`);
  }
  const supplier = await Supplier.create({
    ...req.body,
    name: trimmedName,
    createdBy: req.user?._id || null,
    createdByName: req.user?.name || 'System',
    createdByRole: req.user?.role || '',
    registrationSource: 'manual',
  });
  tg.notifySupplierCreated(supplier, req.user);
  try {
    logActivity(req, {
      action: 'CREATE_SUPPLIER',
      module: 'Suppliers',
      description: `Registered supplier "${supplier.name}" (${supplier.category || 'General'})`,
      status: 'success',
      details: { id: supplier._id, name: supplier.name },
    });
  } catch (_) {}
  res.status(201).json(supplier);
});

const updateSupplier = asyncHandler(async (req, res) => {
  const before = await Supplier.findById(req.params.id).lean();
  if (!before) { res.status(404); throw new Error('Supplier not found'); }

  if (req.body.name !== undefined) {
    const trimmedName = String(req.body.name || '').trim();
    if (!trimmedName) {
      res.status(400);
      throw new Error('Supplier name is required');
    }
    const dup = await Supplier.findOne({
      _id: { $ne: req.params.id },
      name: { $regex: `^${trimmedName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, $options: 'i' },
    }).lean();
    if (dup) {
      res.status(400);
      throw new Error(`Supplier "${trimmedName}" already exists. Duplicate name is not allowed.`);
    }
    req.body.name = trimmedName;
  }

  const supplier = await Supplier.findByIdAndUpdate(
    req.params.id,
    {
      ...req.body,
      updatedBy: req.user?._id || null,
      updatedByName: req.user?.name || 'System',
      updatedByRole: req.user?.role || '',
    },
    { new: true, runValidators: true }
  );

  // Diff key fields
  const changes = ['name','category','contactPerson','phone','email'].reduce((acc, k) => {
    if (req.body[k] !== undefined && String(before[k] || '') !== String(req.body[k] || ''))
      acc.push({ label: k.charAt(0).toUpperCase() + k.slice(1), from: before[k] || '—', to: req.body[k] });
    return acc;
  }, []);

  if (changes.length) tg.notifySupplierUpdated(supplier, req.user, changes);
  try {
    logActivity(req, {
      action: 'UPDATE_SUPPLIER',
      module: 'Suppliers',
      description: `Updated supplier "${supplier.name}"`,
      status: 'success',
      details: { id: supplier._id, name: supplier.name, changes },
    });
  } catch (_) {}
  res.json(supplier);
});

const deleteSupplier = asyncHandler(async (req, res) => {
  const supplier = await Supplier.findById(req.params.id);
  if (!supplier) { res.status(404); throw new Error('Supplier not found'); }
  supplier.isActive    = false;
  supplier.deletedAt   = new Date();
  supplier.deletedBy   = req.user?.name || 'System';
  supplier.deletedFrom = 'suppliers';
  await supplier.save();
  tg.notifySupplierDeleted(supplier, req.user);
  res.json({ message: 'Supplier moved to recycle bin.' });
});

const bulkDeleteSuppliers = asyncHandler(async (req, res) => {
  const { ids } = req.body;
  if (!ids?.length) { res.status(400); throw new Error('No ids provided'); }
  await Supplier.updateMany(
    { _id: { $in: ids } },
    { isActive: false, deletedAt: new Date(), deletedBy: req.user?.name || 'System', deletedFrom: 'suppliers' }
  );
  res.json({ message: `${ids.length} supplier(s) moved to recycle bin.` });
});

const restoreSupplier = asyncHandler(async (req, res) => {
  const supplier = await Supplier.findById(req.params.id);
  if (!supplier) { res.status(404); throw new Error('Supplier not found'); }
  supplier.isActive    = true;
  supplier.deletedAt   = null;
  supplier.deletedBy   = null;
  supplier.deletedFrom = null;
  await supplier.save();
  res.json({ message: 'Supplier restored.', supplier });
});

const permanentDeleteSupplier = asyncHandler(async (req, res) => {
  const supplier = await Supplier.findById(req.params.id);
  if (!supplier) { res.status(404); throw new Error('Supplier not found'); }
  await supplier.deleteOne();
  res.json({ message: 'Supplier permanently deleted.' });
});

module.exports = {
  getSuppliers,
  getSupplierById,
  createSupplier,
  updateSupplier,
  deleteSupplier,
  bulkDeleteSuppliers,
  restoreSupplier,
  permanentDeleteSupplier,
};
