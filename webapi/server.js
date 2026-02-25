import express from "express";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";
import {
  initDatabase,
  personOperations,
  roleOperations,
  userRolesOperations,
  generateId,
} from "./database.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 3001;

// Middleware
app.use(cors());
app.use(express.json()); // treat as a JSON object
app.use(express.static(path.join(__dirname, "../webapp"))); // Serve static files (HTML, CSS, JS)

// Initialize database before starting server
initDatabase() // calling async function defined in database.js
  .then(() => {
    // how js handles async calls (its a promise), if no error, execute this block
    console.log("Database initialized");
    // API Endpoints:

    // get all
    app.get("/api/people", (req, res) => {
      // people is the resource the endpoint is supposed to return
      const { search } = req.query;
      let people;

      if (search && search.trim()) {
        people = personOperations.search(search.trim());
      } else {
        people = personOperations.getAll();
      }

      res.json(people); // send response as JSON
    });

    // get one
    app.get("/api/people/:id", (req, res) => {
      // get a specific person by id
      const person = personOperations.getById(req.params.id); // get id from route parameter

      if (!person) {
        return res.status(404).json({ error: "Person not found" }); // if person is null, send 404 response
      }

      res.json(person);
    });

    // update one (uses put), id to know which record were updating
    app.put("/api/people/:id", (req, res) => {
      // const { id } = req.params; <- is equivalent to line below
      const paramId = req.params.id;
      const { id, name, age, email } = req.body;

      if (id != paramId) {
        return res.status(400).json({ error: "ID mismatch" });
      }

      if (!name || !email || typeof age !== "number") {
        return res
          .status(400)
          .json({ error: "Invalid data: name, age, and email are required" });
      }

      const updatedPerson = personOperations.update(
        id,
        name.trim(),
        age,
        email.trim(),
      );

      res.json(updatedPerson);
    });

    // create one (uses post)
    app.post("/api/people", (req, res) => {
      const { name, age, email } = req.body;

      if (!name || !email || typeof age !== "number") {
        return res
          .status(400)
          .json({ error: "Invalid data: name, age, and email are required" });
      }

      const id = generateId(); // generate unique id for new person

      const newPerson = personOperations.insert(
        id,
        name.trim(),
        age,
        email.trim(),
      ); // insert new person into database

      if (!newPerson) {
        return res
          .status(400)
          .json({ error: "There was a problem inserting new record" });
      }

      res.status(201).json(newPerson); // 201 means new object created, send the newly created person back in the response
    });

    // delete one, need unique identifier to know which record to delete
    app.delete("/api/people/:id", (req, res) => {
      const paramId = req.params.id; // get id

      personOperations.delete(paramId); // delete person from database

      res.status(204).json({ message: "Person deleted" }); // 204: theres no data to return to you
    });

    // get all roles
    app.get("/api/roles", (req, res) => {
      const roles = roleOperations.getAllRoles();
      res.json(roles);
    });

    // get roles for a specific user
    app.get("/api/user_roles/:id/roles", (req, res) => {
      const userRole = userRolesOperations.getUserRoles(req.params.id);

      if (userRole === null) {
        return res.status(404).json({ error: "User not found" });
      }

      res.json(userRole);
    });

    // update roles for a specific user
    app.put("/api/user_roles/:id/roles", (req, res) => {
      const paramId = req.params.id;
      const { user_id, role_id } = req.body;

      // make sure id in body matches id in url
      if (user_id != paramId) {
        return res.status(400).json({ error: "ID mismatch" });
      }

      // validate that user_id and role_id are provided
      if (!user_id || !role_id) {
        return res
          .status(400)
          .json({ error: "Invalid data: user_id and role_id are required" });
      }

      // update and return
      const updatedUserRoles = userRolesOperations.setRolesForUser(
        user_id,
        role_id,
      );

      res.json(updatedUserRoles);
    });

    // create new user role
    app.post("/api/user_roles", (req, res) => {
      const { user_id, role_id } = req.body;

      if (!user_id || !role_id) {
        return res
          .status(400)
          .json({ error: "Invalid data: user_id and role_id are required" });
      }

      const id = generateId();

      const newUserRole = userRolesOperations.setRolesForUser(user_id, role_id);

      if (!newUserRole) {
        return res
          .status(400)
          .json({ error: "There was a problem inserting new record" });
      }

      res.status(201).json(newUserRole);
    });

    // Start server
    app.listen(PORT, () => {
      console.log(`Server running at http://localhost:${PORT}`);
      console.log(`API available at http://localhost:${PORT}/api/people`); // interact from main.js
    });
  })
  .catch((error) => {
    // if throws error, catch and execute this block
    console.error("Failed to initialize database:", error);
    process.exit(1);
  });
