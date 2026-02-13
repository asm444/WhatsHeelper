import express from 'express';
import cors from 'cors';
import classifyRouter from './routes/classify';
import respondRouter from './routes/respond';
import escalateRouter from './routes/escalate';

const app = express();
const PORT = parseInt(process.env.PORT || '3002', 10);

app.use(cors());
app.use(express.json());

// Health check
app.get('/health', (_req, res) => {
  res.json({
    status: 'ok',
    service: 'business-engine',
    timestamp: new Date().toISOString(),
    geminiConfigured: !!process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY !== 'your-gemini-api-key-here',
  });
});

// Rotas
app.use('/classify', classifyRouter);
app.use('/respond', respondRouter);
app.use('/escalate', escalateRouter);

// Só inicia o servidor se não estiver em modo de teste
if (process.env.NODE_ENV !== 'test') {
  app.listen(PORT, () => {
    console.log(`[Business Engine] Rodando na porta ${PORT}`);
    console.log(`[Business Engine] Gemini: ${process.env.GEMINI_API_KEY ? 'configurado' : 'NÃO configurado'}`);
  });
}

export default app;
