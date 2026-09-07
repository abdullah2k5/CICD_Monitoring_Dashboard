const mongoose = require('mongoose');

const buildRunSchema = new mongoose.Schema({
  repo: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Repo',
    required: true
  },
  githubRunId: {
    type: Number,
    required: true
  },
  workflowName: {
    type: String,
    required: true
  },
  status: {
    type: String,
    required: true
  },
  conclusion: {
    type: String,
    default: null
  },
  branch: {
    type: String,
    required: true
  },
  commitSha: {
    type: String,
    required: true
  },
  startedAt: {
    type: Date
  },
  completedAt: {
    type: Date
  },
  htmlUrl: {
    type: String,
    required: true
  },
  aiAnalysis: {
  type: String,
  default: null
},
analyzedAt: {
  type: Date,
  default: null
},
createdAt: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('BuildRun', buildRunSchema);
