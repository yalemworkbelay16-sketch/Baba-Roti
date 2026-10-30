const mongoose = require('mongoose');

const menuReviewSchema = new mongoose.Schema(
  {
    customerName: {
      type: String,
      default: 'Valued Guest',
      trim: true,
    },
    tableNo: {
      type: String,
      default: '',
      trim: true,
    },
    rating: {
      type: Number,
      required: true,
      min: 1,
      max: 5,
    },
    comment: {
      type: String,
      default: '',
      trim: true,
    },
    tags: [
      {
        type: String,
        trim: true,
      },
    ],
    isPublic: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
  }
);

menuReviewSchema.index({ createdAt: -1 });

module.exports = mongoose.model('MenuReview', menuReviewSchema);

