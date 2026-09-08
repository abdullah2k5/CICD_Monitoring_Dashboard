import {
  Box,
  Button,
  Card,
  CardActions,
  CardContent,
  Chip,
  Divider,
  Link,
  Typography,
} from '@mui/material';

function RepositoryCard({ repository, onViewBuilds }) {
  const branch = repository.defaultBranch || 'Default branch unavailable';
  const fullName = repository.fullName || repository.name || 'Repository';

  return (
    <Card
      sx={{
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        transition: 'border-color 160ms ease, transform 160ms ease, background-color 160ms ease',
        '&:hover': {
          borderColor: 'primary.main',
          bgcolor: 'background.elevated',
          transform: 'translateY(-2px)',
        },
      }}
    >
      <CardContent sx={{ flexGrow: 1 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1, mb: 2 }}>
          <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
            GitHub repository
          </Typography>
          <Chip label={repository.private ? 'Private' : 'Public'} color={repository.private ? 'default' : 'success'} size="small" />
        </Box>

        <Typography variant="h6" component="h2" sx={{ mb: 0.5, overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {repository.name || 'Unnamed repository'}
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {fullName}
        </Typography>

        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 3 }}>
          <Typography variant="caption" color="text.secondary">
            Default branch
          </Typography>
          <Chip label={branch} size="small" variant="outlined" />
        </Box>
      </CardContent>

      <Divider />
      <CardActions sx={{ justifyContent: 'space-between', px: 2, py: 1.5 }}>
        {repository.htmlUrl ? (
          <Link href={repository.htmlUrl} target="_blank" rel="noopener noreferrer" underline="hover" variant="body2">
            GitHub ↗
          </Link>
        ) : (
          <Typography variant="body2" color="text.disabled">
            GitHub link unavailable
          </Typography>
        )}
        <Button size="small" onClick={() => onViewBuilds(repository._id)}>
          View Builds
        </Button>
      </CardActions>
    </Card>
  );
}

export default RepositoryCard;
