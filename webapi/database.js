import initSqlJs from "sql.js";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const dbPath = path.join(__dirname, "persons.db");
let db;

// Helper function to generate unique IDs
function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

// Initialize database
// async: its I/O bound, not blocking any threads, not parallel processing
async function initDatabase() {
  // utilitiy to create the database based off a database file that exists (SQLite) and interact with it
  const SQL = await initSqlJs(); // call global function, await can only be used in an async function

  if (fs.existsSync(dbPath)) {
    // if true, path to database file exists
    const buffer = fs.readFileSync(dbPath);

    db = new SQL.Database(buffer); // create a new database from the buffer in memory
  } else {
    db = new SQL.Database(); // create a new in-memory database
  }

  // use db object to run statements to do things
  // create people table (if it doesn't exist)
  db.run(`
    CREATE TABLE IF NOT EXISTS people (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      age INTEGER NOT NULL,
      email TEXT NOT NULL UNIQUE
    )
  `);

  // create roles table: contains list of possible roles
  db.run(`
    CREATE TABLE IF NOT EXISTS roles (
      role_id TEXT PRIMARY KEY,
      role_name TEXT NOT NULL UNIQUE
    )`);

  // create user_roles table: list of roles each user possesses
  db.run(`
    CREATE TABLE IF NOT EXISTS user_roles (
      user_id TEXT NOT NULL,
      role_id TEXT NOT NULL,
      PRIMARY KEY (user_id, role_id),
      FOREIGN KEY (user_id) REFERENCES people(id),
      FOREIGN KEY (role_id) REFERENCES roles(role_id)
    )`);

  // check role table
  const roleResult = db.exec("SELECT COUNT(1) AS roleCount FROM roles");
  const roleCount = roleResult[0]?.values[0]?.[0] || 0;

  let guestRoleId, userRoleId, adminRoleId;

  if (roleCount === 0) {
    const roleData = ["guest", "user", "admin"];

    for (const roleName of roleData) {
      const roleId = generateId();

      db.run("INSERT INTO roles (role_id, role_name) VALUES (?, ?)", [
        roleId,
        roleName,
      ]);

      if (roleName === "guest") {
        guestRoleId = roleId;
      }
      if (roleName === "user") {
        userRoleId = roleId;
      }
      if (roleName === "admin") {
        adminRoleId = roleId;
      }
    }

    console.log("Roles database initialized with sample data");
  }

  const result = db.exec("SELECT COUNT(1) AS count FROM people");
  const count = result[0]?.values[0]?.[0] || 0;

  let aliceId, benId, carlaId;

  if (count === 0) {
    const initialData = [
      {
        name: "Alice Johnson",
        age: 29,
        email: "alice@example.com",
      },
      {
        name: "Ben Thompson",
        age: 34,
        email: "ben.t@example.com",
      },
      {
        name: "Carla Mendez",
        age: 22,
        email: "carla.m@example.com",
      },
    ];

    for (const person of initialData) {
      const id = generateId();

      db.run("INSERT INTO people (id, name, age, email) VALUES (?, ?, ?, ?)", [
        id,
        person.name,
        person.age,
        person.email,
      ]);

      if (person.name === "Alice Johnson") {
        aliceId = id;
      }
      if (person.name === "Ben Thompson") {
        benId = id;
      }
      if (person.name === "Carla Mendez") {
        carlaId = id;
      }
    }
    db.run("INSERT INTO user_roles (user_id, role_id) VALUES (?, ?)", [
      aliceId,
      userRoleId,
    ]);
    db.run("INSERT INTO user_roles (user_id, role_id) VALUES (?, ?)", [
      benId,
      userRoleId,
    ]);
    db.run("INSERT INTO user_roles (user_id, role_id) VALUES (?, ?)", [
      carlaId,
      userRoleId,
    ]);

    console.log("People database initialized with sample data");
  }

  saveDatabase();
}

// whatever is on memeory, we want in the file system
function saveDatabase() {
  if (db) {
    // all data related to the database placed into the "data" varaiable
    const data = db.export();
    // get into buffer format
    const buffer = Buffer.from(data);
    // over write to get all the latest memory
    fs.writeFileSync(dbPath, buffer);
  }
}

// define enum to create a dictonary
// field specific to person table
const fields = { id: 0, name: 1, age: 2, email: 3 };

// need to define CRUD operations (Create, Read, Update, Delete) for the people table
const personOperations = {
  getAll() {
    // retrieve all records from the table
    const result = db.exec("SELECT * FROM people ORDER BY name"); // order by name alphabetically
    if (!result[0]) {
      return []; // return empty array since nothing came back
    }

    return result[0].values.map((row) => ({
      // list of rows come back in result set to then map rows to something else
      // creating object with 4 parameters, using fields helper
      id: row[fields.id],
      name: row[fields.name],
      age: row[fields.age],
      email: row[fields.email],
      // return an array of person object
    }));
  },

  search(query) {
    // search if something exists in the database
    // retrieve stuff that matches a certain condition
    const pattern = `%${query}%`; // JS does string entirpulation using back ticks
    const result = db.exec(
      // only have to match one to be returned in this result set
      "SELECT * FROM people WHERE name LIKE ? OR email LIKE ? ORDER BY name",
      [pattern, pattern], // place holders for the ? in the query
    );

    if (!result[0]) {
      return []; // return empty array since nothing came back becuase were expecting every result set to be an array
    }

    return result[0].values.map((row) => ({
      // bringing back an array of rows
      // doesnt matteer the order of properties (id, name, age, email), as long as theyre matched correctly
      id: row[fields.id],
      name: row[fields.name],
      age: row[fields.age],
      email: row[fields.email],
    }));
  },

  getById(id) {
    const result = db.exec("SELECT * FROM people WHERE id = ?", [id]);
    if (!result[0] || !result[0].values[0]) {
      return null; // only one row should come back, so no array
    }

    const row = result[0].values[0];

    return {
      id: row[fields.id],
      name: row[fields.name],
      age: row[fields.age],
      email: row[fields.email],
    };
  },

  insert(id, name, age, email) {
    db.run(
      "INSERT INTO people (id, name, age, email) VALUES (?, ?, ?, ?)",
      [id, name, age, email], // array of things we are inserting
    );

    saveDatabase(); // since we made a change to the data, we need to save
    return this.getById(id); // return the person that was just inserted
  },

  update(id, name, age, email) {
    db.run(
      "UPDATE people SET name = ?, age = ?, email = ? WHERE id = ?", // place holder for the values, and for the condition (WHERE id = ?)
      [name, age, email, id],
    );

    saveDatabase(); // save because our cahnges wont be there if database crashes
    return this.getById(id); // return the person that was just updated
  },

  delete(id) {
    db.run("DELETE FROM people WHERE id = ?", [id]);
    saveDatabase();
  },
};

const roleFields = { role_id: 0, role_name: 1 };
const roleOperations = {
  getAllRoles() {
    const result = db.exec("SELECT * FROM roles ORDER BY role_name");
    if (!result[0]) {
      return []; // return empty array since nothing came back
    }

    return result[0].values.map((row) => ({
      role_id: row[roleFields.role_id],
      role_name: row[roleFields.role_name],
    }));
  },

  searchRoles(query) {
    const pattern = `%${query}%`;
    const result = db.exec(
      "SELECT * FROM roles WHERE role_name LIKE ? ORDER BY role_name",
      [pattern],
    );

    if (!result[0]) {
      return [];
    }

    return result[0].values.map((row) => ({
      role_id: row[roleFields.role_id],
      role_name: row[roleFields.role_name],
    }));
  },

  getRoleById(role_id) {
    const result = db.exec("SELECT * FROM roles WHERE role_id = ?", [role_id]);

    if (!result[0] || !result[0].values[0]) {
      return null;
    }

    const row = result[0].values[0];

    return {
      role_id: row[roleFields.role_id],
      role_name: row[roleFields.role_name],
    };
  },

  insertRole(role_id, role_name) {
    db.run("INSERT INTO roles (role_id, role_name) VALUES (?, ?)", [
      role_id,
      role_name,
    ]);

    saveDatabase();
    return this.getRoleById(role_id);
  },

  updateRole(role_id, role_name) {
    db.run("UPDATE roles SET role_name = ? WHERE role_id = ?", [
      role_name,
      role_id,
    ]);

    saveDatabase();
    return this.getRoleById(role_id);
  },

  deleteRole(role_id) {
    db.run("DELETE FROM roles WHERE role_id = ?", [role_id]);

    saveDatabase();
  },
};

const userRolesOperations = {
  getUserRoles(user_id) {
    const result = db.exec(
      `
      SELECT roles.role_id, roles.role_name
      FROM roles
      JOIN user_roles ON roles.role_id = user_roles.role_id
      WHERE user_roles.user_id = ?`,
      [user_id],
    );

    if (!result[0]) {
      return [];
    }

    return result[0].values.map((row) => ({
      role_id: row[0],
      role_name: row[1],
    }));
  },

  setRolesForUser(user_id, role_ids) {
    // start transaction
    db.run("BEGIN TRANSACTION");

    try {
      // delete existing roles for user
      db.run("DELETE FROM user_roles WHERE user_id = ?", [user_id]);

      // insert new roles for user
      for (const role_id of role_ids) {
        db.run("INSERT INTO user_roles (user_id, role_id) VALUES (?, ?)", [
          user_id,
          role_id,
        ]);
      }
    } catch (error) {
      // if any error occurs, rollback transaction
      db.run("ROLLBACK");
      throw new Error("Failed to set roles for user");
    }

    // if all operations succeed, commit transaction
    db.run("COMMIT");

    saveDatabase();
  },
};

// make publically available outside of class/service
export {
  initDatabase,
  personOperations,
  roleOperations,
  userRolesOperations,
  generateId,
};
