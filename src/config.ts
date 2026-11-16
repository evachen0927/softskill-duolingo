export const CONFIG = {
  TIMEZONE: 'Asia/Taipei',          // 日界一律以此計算
  JOURNEY_DAYS: 30,
  DEFAULT_REMINDER_TIME: '20:00',   // 待 Eva 定案，先用 20:00
  STREAK_RESET_ON_MISS: true,       // 中斷一天就歸零；待定案，先歸零
  QUESTIONS_PER_DAY: 3,             // Eva 定案：一天 3 題
  // 情境背景亮度：當天第 1、2、3 題，從昏暗漸漸變亮（1 = 原圖亮度）
  SCENE_BRIGHTNESS: [0.42, 0.7, 1],
  SCENE_TRANSITION_MS: 1200,        // 換題時亮度過渡的時間
} as const;
