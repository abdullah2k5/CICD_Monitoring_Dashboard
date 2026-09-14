const mongoose = require('mongoose');

const repoSchema = new mongoose.Schema({
  owner: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  githubRepoId: {
    type: Number,
    required: true
  },
  name: {
    type: String,
    required: true
  },
  fullName: {
    type: String,
    required: true
  },
  htmlUrl: {
    type: String,
    required: true
  },
  defaultBranch: {
    type: String,
    required: true
  },
  private: {
    type: Boolean,
    default: false
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});
repoSchema.index({ owner: 1, githubRepoId: 1 }, { unique: true });
module.exports = mongoose.model('Repo', repoSchema);
