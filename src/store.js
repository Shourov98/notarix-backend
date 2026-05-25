import fs from "node:fs/promises";
import path from "node:path";
import { config } from "./config.js";
import { seedData } from "./seedData.js";

const clone = (value) => JSON.parse(JSON.stringify(value));

let cache = null;

const ensureDirectory = async () => {
  await fs.mkdir(path.dirname(config.dataFilePath), { recursive: true });
};

export const readStore = async () => {
  if (cache) {
    return cache;
  }

  await ensureDirectory();

  try {
    const file = await fs.readFile(config.dataFilePath, "utf8");
    cache = JSON.parse(file);
  } catch {
    cache = clone(seedData);
    await fs.writeFile(config.dataFilePath, JSON.stringify(cache, null, 2));
  }

  return cache;
};

export const writeStore = async (nextData) => {
  cache = nextData;
  await ensureDirectory();
  await fs.writeFile(config.dataFilePath, JSON.stringify(nextData, null, 2));
  return nextData;
};

export const mutateStore = async (mutator) => {
  const current = await readStore();
  const draft = clone(current);
  const result = await mutator(draft);
  await writeStore(draft);
  return result ?? draft;
};
