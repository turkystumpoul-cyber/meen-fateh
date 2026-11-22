import 'dotenv/config';
import express, { Request, Response } from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { GoogleGenAI, Content } from '@google/genai';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(express.json({ limit: '1mb' }));

interface IncomingChatMessage {
  role: 'user' | 'model';
  text: string;
}

interface ShopContextItem {
  name: string;
  categoryLabel: string;
  area: string;
  address: string;
  distanceKm: number;
  isOpen: boolean;
  hoursNote: string;
  phone: string;
  featured: boolean;
}

function getGeminiClient() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey.trim() === '') {
    return null;
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

app.post('/api/chat', async (req: Request, res: Response) => {
  try {
    const ai = getGeminiClient();
    if (!ai) {
      return res.status(503).json({
        error:
          'مفتاح Gemini API غير مُعد على الخادم حالياً. يرجى التأكد من إعداده في لوحة Secrets.',
      });
    }

    const { message, history, shopsContext, selectedArea } = req.body as {
      message?: string;
      history?: IncomingChatMessage[];
      shopsContext?: ShopContextItem[];
      selectedArea?: string;
    };

    if (!message || typeof message !== 'string' || !message.trim()) {
      return res.status(400).json({ error: 'يرجى كتابة رسالتك أولاً.' });
    }

    const directoryLines = Array.isArray(shopsContext)
      ? shopsContext
          .map(
            (s) =>
              `- ${s.name} | التخصص: ${s.categoryLabel} | المنطقة: ${s.area} | العنوان: ${s.address} | المسافة: ${s.distanceKm} كم | الحالة: ${s.isOpen ? 'مفتوح الآن' : 'مغلق حالياً'} (${s.hoursNote}) | الهاتف: ${s.phone}${s.featured ? ' | [مميز]' : ''}`
          )
          .join('\n')
      : 'لا توجد بيانات محلات متاحة.';

    const systemInstruction = `أنت "مساعد الفيوم الليلي" داخل تطبيق "مين فاتح دلوقتي؟" المخصص لمحافظة الفيوم ومراكزها (مدينة الفيوم، مركز إطسا، قرية جردو، سنورس، طامية، أبشواي، يوسف الصديق).
مهمتك الأساسية: مساعدة المستخدمين ليلاً وفي حالات الطوارئ باللهجة المصرية الودودة والواضحة والعملية.

القواعد الصارمة:
1. اعتمد أولاً على قائمة المحلات والخدمات المسجلة في الدليل أدناه عند ترشيح أماكن مفتوحة الآن، واذكر الاسم والعنوان ورقم الهاتف بدقة ولا تخترع أرقام هواتف أو عناوين غير موجودة.
2. إذا طلب المستخدم منطقة أو تخصصاً غير متوفر أو مغلقاً حالياً في الدليل، أخبره بوضوح بحالة الدليل الحالية واقترح أقرب بديل مفتوح في الدليل، وذكّره بأرقام الطوارئ الرسمية المصرية (الإسعاف 123، النجدة 122، المطافئ 180) عند الحالات الطبية أو الحوادث العاجلة.
3. قدّم نصائح سريعة وعملية ومختصرة (مثلاً: خطوات أمان عند تعطل السيارة ليلاً على طريق إطسا/الفيوم، أو لحين الوصول لأقرب صيدلية أو عيادة).
4. اجعل ردودك منظمة، قصيرة وسهلة القراءة على شاشة الموبايل، بدون مقدمات طويلة.

المنطقة المختارة حالياً في التطبيق: ${selectedArea || 'كل المناطق'}
بيانات الدليل الحية الآن:
${directoryLines}`;

    const formattedHistory: Content[] = Array.isArray(history)
      ? history
          .filter(
            (item) =>
              (item.role === 'user' || item.role === 'model') &&
              typeof item.text === 'string' &&
              item.text.trim().length > 0
          )
          .map((item) => ({
            role: item.role,
            parts: [{ text: item.text }],
          }))
      : [];

    const chat = ai.chats.create({
      model: 'gemini-4-hydrogen',
      history: formattedHistory,
      config: {
        systemInstruction,
      },
    });

    const response = await chat.sendMessage({ message: message.trim() });
    const reply = response.text;

    if (!reply) {
      return res.status(502).json({
        error: 'لم يتمكن المساعد من توليد رد في الوقت الحالي. حاول مرة أخرى.',
      });
    }

    return res.json({ reply });
  } catch (err: unknown) {
    console.error('Gemini API error:', err);
    const errMessage =
      err instanceof Error ? err.message : 'حدث خطأ غير متوقع أثناء الاتصال بالمساعد.';

    if (
      errMessage.includes('PERMISSION_DENIED') ||
      errMessage.includes('API_KEY_INVALID') ||
      errMessage.includes('403')
    ) {
      return res.status(403).json({
        error: 'تعذر التحقق من صلاحية مفتاح Gemini API. يرجى مراجعة الإعدادات.',
      });
    }
    if (errMessage.includes('RESOURCE_EXHAUSTED') || errMessage.includes('429')) {
      return res.status(429).json({
        error: 'تم تجاوز حد الطلبات المؤقت للمساعد الذكي. انتظر لحظات وحاول مجدداً.',
      });
    }
    return res.status(500).json({
      error: 'تعذر الاتصال بالمساعد الذكي حالياً. يرجى المحاولة مرة أخرى.',
    });
  }
});

async function startServer() {
  const PORT = Number(process.env.PORT) || 3000;

  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    if (fs.existsSync(distPath)) {
      app.use(express.static(distPath));
      app.get('/{*splat}', (_req, res) => {
        res.sendFile(path.join(distPath, 'index.html'));
      });
    }
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer();
