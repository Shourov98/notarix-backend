import fs from "node:fs/promises";
import crypto from "node:crypto";
import { seedData } from "../../seedData.js";
import { config } from "../../config.js";
import { AdminModel } from "../../modules/users/admin.model.js";
import { UserModel } from "../../modules/users/user.model.js";
import { UserRequestModel } from "../../modules/requests/user-request.model.js";

const withDocumentIds = (record) => {
  if (!Array.isArray(record?.requiredDocuments)) {
    return record;
  }

  return {
    ...record,
    requiredDocuments: record.requiredDocuments.map((document) => ({
      ...document,
      id:
        document?.id ||
        `doc-${Date.now()}-${crypto.randomUUID().slice(0, 8)}`,
    })),
  };
};

const readLegacyStoreFile = async () => {
  try {
    const file = await fs.readFile(config.dataFilePath, "utf8");
    const parsed = JSON.parse(file);
    return {
      admins: parsed.admins || [],
      users: parsed.users || [],
      requests: parsed.requests || [],
    };
  } catch {
    return null;
  }
};

const getSeedSource = async () => {
  const legacyStore = await readLegacyStoreFile();
  if (legacyStore) {
    return legacyStore;
  }

  return {
    admins: seedData.admins || [],
    users: seedData.users || [],
    requests: seedData.requests || [],
  };
};

const upsertMissingById = async (Model, records, alternateKeys = []) => {
  for (const record of records) {
    if (!record?.id) {
      continue;
    }

    const filters = [{ id: record.id }];
    alternateKeys.forEach((key) => {
      if (record[key]) {
        filters.push({ [key]: record[key] });
      }
    });

    const existing = await Model.exists({ $or: filters });
    if (!existing) {
      await Model.create(withDocumentIds(record));
    }
  }
};

export const seedMongoFromLocalStore = async () => {
  const seedSource = await getSeedSource();

  await upsertMissingById(AdminModel, seedSource.admins, ["email"]);
  await upsertMissingById(UserModel, seedSource.users, ["email"]);
  await upsertMissingById(UserRequestModel, seedSource.requests);
};
