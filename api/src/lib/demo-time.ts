import { prisma } from "./prisma";

const DEMO_TIME_KEY = "demoTime";

export async function getDemoNow() {
  const setting = await prisma.systemSetting.findUnique({
    where: {
      key: DEMO_TIME_KEY
    }
  });

  if (!setting) {
    return new Date();
  }

  const date = new Date(setting.value);
  return Number.isNaN(date.getTime()) ? new Date() : date;
}

export async function setDemoNow(value: Date) {
  return prisma.systemSetting.upsert({
    where: {
      key: DEMO_TIME_KEY
    },
    update: {
      value: value.toISOString()
    },
    create: {
      key: DEMO_TIME_KEY,
      value: value.toISOString()
    }
  });
}

export async function resetDemoNow() {
  await prisma.systemSetting.deleteMany({
    where: {
      key: DEMO_TIME_KEY
    }
  });
}
