import { Router } from 'express';
import { generateEvent, chooseOption, generateEnding } from '../game/controller';

const router = Router();

// 三个核心接口（按接口约定.md）
router.post('/events/generate', generateEvent);
router.post('/events/choose', chooseOption);
router.post('/endings/generate', generateEnding);

export default router;
