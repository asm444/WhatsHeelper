import { Router, Request, Response } from 'express';
import { generateResponse } from '../ai/gemini-client';
import { CATEGORIES } from '../rules/categories';

const router = Router();

router.post('/', async (req: Request, res: Response) => {
  try {
    const { message, category, conversationHistory = [] } = req.body;

    if (!message || !category) {
      return res.status(400).json({ error: 'Campos "message" e "category" são obrigatórios' });
    }

    // Tenta auto-resposta baseada em regras primeiro
    const cat = CATEGORIES.find(c => c.id === category);
    if (cat) {
      for (const [_key, autoResponse] of cat.autoResponses) {
        const keywords = _key.split('_');
        const messageNorm = message.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
        if (keywords.some(k => messageNorm.includes(k))) {
          return res.json({
            response: autoResponse,
            confidence: 0.8,
            category,
            source: 'rules',
            suggestEscalation: false,
          });
        }
      }
    }

    // Se não encontrou auto-resposta, usa Gemini
    try {
      const aiResponse = await generateResponse(message, category, conversationHistory);
      return res.json({
        ...aiResponse,
        source: 'gemini',
      });
    } catch (err) {
      return res.json({
        response: 'Desculpe, estou com dificuldades técnicas no momento. Vou transferir você para um atendente humano que poderá ajudar melhor.',
        confidence: 0.1,
        category,
        source: 'fallback',
        suggestEscalation: true,
      });
    }
  } catch (error) {
    console.error('Erro ao gerar resposta:', error);
    return res.status(500).json({ error: 'Erro interno ao gerar resposta' });
  }
});

export default router;
