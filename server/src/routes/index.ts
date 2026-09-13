import { Router } from 'express';
import { generateEvent, chooseOption, generateEnding } from '../game/controller';
import { createGenerationGuard } from '../game/requestGuard';

const router = Router();
const guard = createGenerationGuard();

// 三个核心接口（按接口约定.md）
router.post('/events/generate', guard, generateEvent);
router.post('/events/choose', chooseOption);
router.post('/endings/generate', guard, generateEnding);

export default router;
