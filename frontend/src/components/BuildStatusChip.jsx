import { Chip } from '@mui/material';

function getStatus(run) {
  const conclusion = run.conclusion?.toLowerCase();
  const status = run.status?.toLowerCase();

  if (status === 'in_progress') return { label: 'In progress', color: 'info' };
  if (status === 'queued') return { label: 'Queued', color: 'warning' };
  if (status === 'completed' && conclusion === 'success') return { label: 'Success', color: 'success' };
  if (status === 'completed' && conclusion === 'failure') return { label: 'Failed', color: 'error' };
  if (status === 'completed' && conclusion === 'cancelled') return { label: 'Cancelled', color: 'warning' };
  if (status === 'completed' && conclusion === 'neutral') return { label: 'Neutral', color: 'default' };
  if (conclusion === 'cancelled') return { label: 'Cancelled', color: 'warning' };
  return { label: conclusion || status || 'Unknown', color: 'default' };
}

function BuildStatusChip({ run }) {
  const status = getStatus(run);
  return <Chip label={status.label} color={status.color} size="small" variant="outlined" />;
}

export default BuildStatusChip;
