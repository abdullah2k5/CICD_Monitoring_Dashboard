import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  AppBar,
  Box,
  Button,
  Drawer,
  IconButton,
  List,
  ListItem,
  ListItemButton,
  ListItemText,
  Toolbar,
  Tooltip,
  Typography,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import { useAuth } from '../context/AuthContext';
import PageContainer from './PageContainer';

const drawerWidth = 248;

function AppLayout({ children }) {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);

  const isDashboard = location.pathname === '/dashboard';
  const pageContext = isDashboard ? 'Overview' : 'Repository builds';

  function handleNavigate(path) {
    navigate(path);
    setMobileOpen(false);
  }

  function handleLogout() {
    logout();
    navigate('/login');
    setMobileOpen(false);
  }

  const drawer = (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <Box sx={{ px: 3, py: 2.75, borderBottom: 1, borderColor: 'divider' }}>
        <Typography variant="h6" sx={{ fontWeight: 800, letterSpacing: '-0.02em' }}>
          CI/CD Monitor
        </Typography>
        <Typography variant="caption" color="text.secondary">
          Delivery intelligence
        </Typography>
      </Box>

      <Box sx={{ px: 1.5, py: 2 }}>
        <Typography variant="overline" color="text.secondary" sx={{ px: 1.5 }}>
          Workspace
        </Typography>
        <List disablePadding sx={{ mt: 0.5 }}>
          <ListItem disablePadding>
            <ListItemButton
              selected={isDashboard}
              onClick={() => handleNavigate('/dashboard')}
              sx={{ borderRadius: 1.5 }}
            >
              <ListItemText primary="Dashboard" secondary="Repositories and builds" />
            </ListItemButton>
          </ListItem>
        </List>
      </Box>

      <Box sx={{ mt: 'auto', p: 2, borderTop: 1, borderColor: 'divider' }}>
        <Button fullWidth variant="outlined" onClick={handleLogout}>
          Log out
        </Button>
      </Box>
    </Box>
  );

  return (
    <Box sx={{ display: 'flex', minHeight: '100vh', bgcolor: 'background.default' }}>
      <AppBar
        position="fixed"
        color="transparent"
        elevation={0}
        sx={{
          width: { md: `calc(100% - ${drawerWidth}px)` },
          ml: { md: `${drawerWidth}px` },
          borderBottom: 1,
          borderColor: 'divider',
          bgcolor: 'rgba(15, 23, 42, 0.84)',
          backdropFilter: 'blur(14px)',
        }}
      >
        <Toolbar sx={{ minHeight: { xs: 64, sm: 72 }, gap: 1.5 }}>
          {isMobile && (
            <Tooltip title="Open navigation">
              <IconButton color="inherit" onClick={() => setMobileOpen(true)} aria-label="Open navigation">
                <Typography component="span" sx={{ fontSize: '1.25rem', lineHeight: 1 }}>
                  ≡
                </Typography>
              </IconButton>
            </Tooltip>
          )}
          <Box sx={{ flexGrow: 1, minWidth: 0 }}>
            <Typography variant="body2" color="text.secondary" noWrap>
              Workspace / {pageContext}
            </Typography>
            <Typography variant="h6" noWrap>
              {pageContext}
            </Typography>
          </Box>
          <Box sx={{ textAlign: 'right', minWidth: 0 }}>
            <Typography variant="body2" noWrap>
              {user?.name || 'Account'}
            </Typography>
            <Typography variant="caption" color="text.secondary" noWrap sx={{ display: 'block', maxWidth: { xs: 120, sm: 220 } }}>
              {user?.email}
            </Typography>
          </Box>
        </Toolbar>
      </AppBar>

      <Box component="nav" sx={{ width: { md: drawerWidth }, flexShrink: { md: 0 } }}>
        <Drawer
          variant={isMobile ? 'temporary' : 'permanent'}
          open={isMobile ? mobileOpen : true}
          onClose={() => setMobileOpen(false)}
          ModalProps={{ keepMounted: true }}
          sx={{
            '& .MuiDrawer-paper': {
              width: drawerWidth,
              boxSizing: 'border-box',
              bgcolor: 'background.sidebar',
              borderRight: 1,
              borderColor: 'divider',
            },
          }}
        >
          {drawer}
        </Drawer>
      </Box>

      <Box component="section" sx={{ flexGrow: 1, minWidth: 0, pt: { xs: 8, sm: 9 } }}>
        <PageContainer>{children}</PageContainer>
      </Box>
    </Box>
  );
}

export default AppLayout;
