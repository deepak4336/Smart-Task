import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { supabase } from './config/supabaseClient.js';
import workspaceRoutes from './routes/workspaces.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

// Health check — confirms the server is running and can reach Supabase
app.get('/api/health', async (req, res) => {
  try {
    const { error } = await supabase.from('users').select('id').limit(1);
    res.json({
      status: 'ok',
      server: 'running',
      database: error ? 'unreachable' : 'connected',
      dbError: error ? error.message : null,
    });
  } catch (err) {
    res.status(500).json({ status: 'error', message: err.message });
  }
});

// Route mounts (add as each module is built)
app.use('/api/workspaces', workspaceRoutes);
// app.use('/api/tasks', taskRoutes);
// app.use('/api/dependencies', dependencyRoutes);
// app.use('/api/extract-tasks', extractRoutes);

app.listen(PORT, () => {
  console.log(`SmartTask backend running on http://localhost:${PORT}`);
});
