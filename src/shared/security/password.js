import bcrypt from "bcryptjs";

const SALT_ROUNDS = 10;

export const hashPassword = async (plainTextPassword) =>
  bcrypt.hash(plainTextPassword, SALT_ROUNDS);

export const comparePassword = async (plainTextPassword, hashedPassword) =>
  bcrypt.compare(plainTextPassword, hashedPassword);
