/*
import config from "../knexfile";
import bcrypt from "bcrypt";
import Knex from "knex";
import { promisify } from "util";

import { createClient } from "redis";
import crypto from "crypto";

const client = createClient({
  url: process.env.REDIS_URL,
});
client.on("error", (err) => console.log("Redis Client Error", err));
client.on("connect", () => console.log("Successfully connected to redis"));

const knex = Knex(config);

// Redis version 3 does not support the promise based
// interface yet. We can use node's `promisify` function
// though to turn the non-promise code into code that
// does return Promises and can hence be `await`ed.
const getAsync = promisify(client.get).bind(client);
const setExAsync = promisify(client.setex).bind(client);

interface User {
  email: string;
  password: string;
}

class AuthService {
  async create(newUser: User): Promise<void> {
    const salt = await bcrypt.genSalt();
    const passwordHash = await bcrypt.hash(newUser.password, salt);
    await knex("users").insert({
      ...newUser,
      password: passwordHash,
    });
  }

  async delete(email: string): Promise<void> {
    await knex("users").where({email}).delete()
  }

  async checkPassword(email: string, password: string): Promise<boolean> {
    const dbUser = await knex<User>("users").where({ email }).first();
    if (!dbUser) {
      return false;
    }
    return bcrypt.compare(password, dbUser.password);
  }

  public async login(
      email: string,
      password: string
  ): Promise<string | undefined> {
    const correctPassword = await this.checkPassword(email, password);
    if (correctPassword) {
      const sessionId = crypto.randomUUID();
      // Set the new value with an expiry of 1 hour
      await setExAsync(sessionId, 60 * 60, email);
      return sessionId;
    }
    return undefined;
  }

  // hier wird redis gefragt obs die seccion id existiert
  public async getUserEmailForSession(
      sessionId: string
  ): Promise<string | null> { //string if emailadresse existiert ansonsten null
    return getAsync(sessionId);
  }
}

export default AuthService;
*/


import config from "../knexfile";

import bcrypt from "bcrypt";
import Knex from "knex";

import crypto from "crypto";


const knex = Knex(config);


const sessionDurationTime = 60;

interface User {
  email: string;
  password: string;
}

interface SessionRow{
  email: string;
  sessionId: string;
  createdAt: string;
}

class AuthService {
  async create(newUser: User): Promise<void> {
    const salt = await bcrypt.genSalt();
    const passwordHash = await bcrypt.hash(newUser.password, salt);
    await knex("users").insert({
      ...newUser,
      password: passwordHash,
    });
  }

  async delete(email: string): Promise<void> {
    await knex("users").where({email}).delete()
  }

  async checkPassword(email: string, password: string): Promise<boolean> {
    console.log('authservice::check password called with email', email);
    const dbUser = await knex<User>("users").where({ email }).first();
    if (!dbUser) {
      return false;
    }
    return bcrypt.compare(password, dbUser.password);
  }

  public async login(
    email: string,
    password: string
  ): Promise<string | undefined> {
    const correctPassword = await this.checkPassword(email, password);
    if (correctPassword) {
      const sessionId = crypto.randomUUID();
      await this.setSessionId(sessionId, email);
      return sessionId; //todo check for problems!!!
    }
    return undefined;
  }

  public async getUserEmailForSession(
    sessionId: string
  ): Promise<string | null> {
    return this.getUserForId(sessionId);
  }

  async getUserForId(id: string): Promise<string>{
   // const email = knex("sessionIds").where({sessionId: id}).select('email');
    const sessionData = await knex.select('email', 'createdAt').from("sessionIds").where({sessionId: id}).first();
    console.log('outhService::getUserForId ', sessionData);
    const email = sessionData.first.arguments.email;
    const date = sessionData.first.arguments.createdAt.toDateString();

    if(!email) return email;
    const currentTime = new Date();
    if(date.getMinutes() - currentTime.getMinutes() >= sessionDurationTime){
      await knex("sessionIds").where({sessionId: id}).delete();
      return "";
    }
    return email;
  }

  async setSessionId(sessionId: string, email: string): Promise<boolean>{
    //check if id or email already in use;
    const idData = await knex<SessionRow>('sessionIds').where({sessionId: sessionId}).first();
    const emailData = await knex<SessionRow>('sessionIds').where({sessionId: sessionId}).first();
    if(!idData.email || !emailData.email) {
      console.log("authService::setSessionId - cant set session, sessionId:", sessionId, "email:", email);
      return false;
    }
    console.log("idData: " + idData.email);
    console.log("emailData: " + emailData.email);
    if(!idData.email || !emailData.email) return false;
    const date = new Date().toDateString();
    await knex('sessionIds').insert({email: email, sessionId: sessionId, createdAt: date});
    return true;
  }
}

export default AuthService;
