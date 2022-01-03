import express, { Request } from "express";
import cookieParser from "cookie-parser";
import * as OpenApiValidator from "express-openapi-validator";
import { HttpError } from "express-openapi-validator/dist/framework/types";
import AuthService from "./services/AuthService";
import { knex as knexDriver } from "knex";
import cors from "cors";
import config from "./knexfile";
import JourneyService from "./services/JourneyService";

const app = express();
const port = process.env.PORT || 3000;

const knex = knexDriver(config);
const authService = new AuthService();
const journeyService = new JourneyService(knex);

app.use(
  cors({
    origin: true,
    credentials: true,
  })
);

app.use(express.json());
app.use(cookieParser());

app.use(
  OpenApiValidator.middleware({
    apiSpec: "./openapi.yaml",
    validateRequests: true,
    validateResponses: false,
  })
);

const checkLogin = async (
  req: Request,
  res: express.Response,
  next: express.NextFunction
) => {
  const session = req.cookies.session;
  if (!session) {
    res.status(401);
    return res.json({ message: "You need to be logged in to see this page." });
  }
  const email = await authService.getUserEmailForSession(session); // prüft über redis ob untersession id eine emailadresse gespeichert ist
  if (!email) {
    res.status(401);
    return res.json({ message: "You need to be logged in to see this page." });
  }
  req.userEmail = email; //wird ins req geschrieben um zu wissenwelcher user eingeloggt ist

  next();
};

app.use(
  (
    err: HttpError,
    req: express.Request,
    res: express.Response,
    next: express.NextFunction
  ) => {
    // format error
    res.status(err.status || 500).json({
      message: err.message,
      errors: err.errors,
    });
  }
);

app.get("/journeys", checkLogin, async (req, res) => {
  const userData = req.body;
  const journeys = await journeyService.getAllJourneys(userData);
  res.json({journeys});
});

app.post("/journey", checkLogin, async (req, res) => {
  const journey = req.body;
  const journeys = await journeyService.addJourney(journey).then((newEntry) => res.send(newEntry));
});

app.put("/journey", checkLogin, async (req, res) => {
  const journey = req.body;
  const journeys = await journeyService.editJourney(journey).then((newEntry) => res.send(newEntry));
});

app.delete("/journey", checkLogin, async (req, res) => {
  const journey = req.body;
  const journeys = await journeyService.deleteJourney(journey).then((newEntry) => res.send(newEntry));
});

app.post("/login", async (req, res) => {
  const payload = req.body;
  const sessionId = await authService.login(payload.email, payload.password);
  if (!sessionId) {
    res.status(401);
    return res.json({ message: "Bad email or password" });
  }
  //hier wird der cookie erstellt
  res.cookie("session", sessionId, {
    maxAge: 60 * 60 * 1000,
    httpOnly: true,
    sameSite: "none",
    secure: process.env.NODE_ENV === "production",
  });
  res.json({ status: "ok" });
});

app.listen(port, () => {
  console.log(`Expenses app listening at http://localhost:${port}`);
});


